"""
ws_manager.py — Conexiones WebSocket reales a los 3 exchanges.

Binance:  Usa el stream público bookTicker (no requiere API key).
Kraken:   Usa el protocolo de suscripción JSON sobre WS público.
Coinbase: Usa el protocolo Advanced Trade WebSocket (nivel 2).

Cada cliente corre como una corrutina asyncio independiente.
Al recibir cada mensaje se actualiza el OrderBook en RAM y se
dispara la detección de oportunidades sin ningún polling.
"""
import asyncio
import json
import logging
import time
from typing import Callable

import websockets
from websockets.exceptions import ConnectionClosedError, ConnectionClosedOK

from config import config
from orderbook import OrderBook

logger = logging.getLogger(__name__)

RECONNECT_DELAY_SEC = 3
MAX_RECONNECT_ATTEMPTS = 20


class WSManager:
    """
    Lanza y mantiene las 3 conexiones WebSocket concurrentemente.
    Llama a `on_update` cada vez que cambia el order book de cualquier exchange.
    """

    def __init__(self, order_book: OrderBook, on_update: Callable):
        self.order_book = order_book
        self.on_update = on_update
        self._tasks: list[asyncio.Task] = []

    async def start(self):
        exchanges = config.EXCHANGES
        runners = []

        if exchanges["binance"].enabled:
            runners.append(self._run_binance())
        if exchanges["kraken"].enabled:
            runners.append(self._run_kraken())
        if exchanges["coinbase"].enabled:
            runners.append(self._run_coinbase())

        self._tasks = [asyncio.create_task(r) for r in runners]
        logger.info(f"WSManager: {len(self._tasks)} conexiones iniciadas")

    async def stop(self):
        for t in self._tasks:
            t.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        logger.info("WSManager: todas las conexiones cerradas")

    # ─────────────────────────── BINANCE ────────────────────────────────────

    async def _run_binance(self):
        """
        Stream público bookTicker — actualiza best bid/ask en tiempo real.
        Mensaje de ejemplo:
        {"u":123,"s":"BTCUSDT","b":"67000.10","B":"0.5","a":"67001.00","A":"0.3"}
        """
        url = config.EXCHANGES["binance"].ws_url
        attempts = 0

        while attempts < MAX_RECONNECT_ATTEMPTS:
            try:
                async with websockets.connect(url, ping_interval=20, ping_timeout=10) as ws:
                    logger.info("Binance WS conectado")
                    attempts = 0  # reset al conectar con éxito
                    async for raw in ws:
                        data = json.loads(raw)
                        bid = float(data["b"])
                        ask = float(data["a"])
                        bid_vol = float(data["B"])
                        ask_vol = float(data["A"])
                        ts = time.time()

                        self.order_book.update(
                            exchange="binance",
                            bid=bid,
                            ask=ask,
                            bid_volume=bid_vol,
                            ask_volume=ask_vol,
                            timestamp=ts,
                        )
                        await self.on_update("binance")

            except (ConnectionClosedError, ConnectionClosedOK) as e:
                logger.warning(f"Binance WS cerrado: {e}. Reconectando en {RECONNECT_DELAY_SEC}s…")
            except Exception as e:
                logger.error(f"Binance WS error: {e}")

            attempts += 1
            await asyncio.sleep(RECONNECT_DELAY_SEC * attempts)  # backoff exponencial

        logger.critical("Binance: máximo de reconexiones alcanzado")

    # ─────────────────────────── KRAKEN ─────────────────────────────────────

    async def _run_kraken(self):
        """
        Kraken WS v1 público. Requiere enviar mensaje de suscripción al conectar.
        Mensajes: heartbeat, systemStatus, subscriptionStatus, ticker array.
        """
        url = config.EXCHANGES["kraken"].ws_url
        subscribe_msg = json.dumps({
            "event": "subscribe",
            "pair": ["XBT/USD"],   # Kraken usa XBT en lugar de BTC
            "subscription": {"name": "ticker"},
        })
        attempts = 0

        while attempts < MAX_RECONNECT_ATTEMPTS:
            try:
                async with websockets.connect(url, ping_interval=20, ping_timeout=10) as ws:
                    await ws.send(subscribe_msg)
                    logger.info("Kraken WS conectado y suscrito a XBT/USD ticker")
                    attempts = 0

                    async for raw in ws:
                        data = json.loads(raw)

                        # Filtrar mensajes de control
                        if isinstance(data, dict):
                            continue  # heartbeat / systemStatus / subscriptionStatus

                        # Datos reales: [channelID, {ticker_data}, "ticker", "XBT/USD"]
                        if isinstance(data, list) and len(data) == 4:
                            ticker = data[1]
                            # "b" = best bid [price, wholeLotVol, lotVol]
                            # "a" = best ask [price, wholeLotVol, lotVol]
                            bid = float(ticker["b"][0])
                            ask = float(ticker["a"][0])
                            bid_vol = float(ticker["b"][2])
                            ask_vol = float(ticker["a"][2])

                            self.order_book.update(
                                exchange="kraken",
                                bid=bid,
                                ask=ask,
                                bid_volume=bid_vol,
                                ask_volume=ask_vol,
                                timestamp=time.time(),
                            )
                            await self.on_update("kraken")

            except (ConnectionClosedError, ConnectionClosedOK) as e:
                logger.warning(f"Kraken WS cerrado: {e}. Reconectando…")
            except Exception as e:
                logger.error(f"Kraken WS error: {e}")

            attempts += 1
            await asyncio.sleep(RECONNECT_DELAY_SEC * attempts)

        logger.critical("Kraken: máximo de reconexiones alcanzado")

    # ─────────────────────────── COINBASE ────────────────────────────────────

    async def _run_coinbase(self):
        """
        Coinbase Advanced Trade WebSocket (público, no requiere auth para ticker).
        Protocolo: enviar subscribe con product_ids y channel "ticker".
        """
        url = config.EXCHANGES["coinbase"].ws_url
        subscribe_msg = json.dumps({
            "type": "subscribe",
            "product_ids": ["BTC-USD"],
            "channel": "ticker",
        })
        attempts = 0

        while attempts < MAX_RECONNECT_ATTEMPTS:
            try:
                async with websockets.connect(
                    url,
                    ping_interval=20,
                    ping_timeout=10,
                    extra_headers={"User-Agent": "arbitrage-bot/1.0"},
                ) as ws:
                    await ws.send(subscribe_msg)
                    logger.info("Coinbase WS conectado y suscrito a BTC-USD ticker")
                    attempts = 0

                    async for raw in ws:
                        data = json.loads(raw)
                        msg_type = data.get("type", "")

                        if msg_type == "ticker":
                            # Campos: best_bid, best_ask, best_bid_size, best_ask_size
                            bid = float(data.get("best_bid", 0) or 0)
                            ask = float(data.get("best_ask", 0) or 0)
                            bid_vol = float(data.get("best_bid_size", 0) or 0)
                            ask_vol = float(data.get("best_ask_size", 0) or 0)

                            if bid > 0 and ask > 0:
                                self.order_book.update(
                                    exchange="coinbase",
                                    bid=bid,
                                    ask=ask,
                                    bid_volume=bid_vol,
                                    ask_volume=ask_vol,
                                    timestamp=time.time(),
                                )
                                await self.on_update("coinbase")

            except (ConnectionClosedError, ConnectionClosedOK) as e:
                logger.warning(f"Coinbase WS cerrado: {e}. Reconectando…")
            except Exception as e:
                logger.error(f"Coinbase WS error: {e}")

            attempts += 1
            await asyncio.sleep(RECONNECT_DELAY_SEC * attempts)

        logger.critical("Coinbase: máximo de reconexiones alcanzado")
