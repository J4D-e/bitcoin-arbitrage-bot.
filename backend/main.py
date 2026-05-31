"""
main.py — FastAPI app principal.

Endpoints:
  GET  /health              — Estado del sistema
  GET  /api/orderbook       — Precios actuales de todos los exchanges
  GET  /api/opportunities   — Oportunidades de arbitraje detectadas
  GET  /api/stats           — Estadísticas globales
  GET  /api/trades          — Historial de trades
  GET  /api/wallets         — Balances simulados
  WS   /ws                  — Stream en tiempo real (JSON cada update)
"""
import asyncio
import json
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from config import config
from engine import ArbitrageEngine
from orderbook import OrderBook
from ws_manager import WSManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Instancias globales ───────────────────────────────────────────────────────
order_book = OrderBook(config)
engine = ArbitrageEngine(config, order_book)
ws_manager: WSManager | None = None

# Clientes WebSocket del frontend conectados
_frontend_clients: list[WebSocket] = []


async def _on_exchange_update(exchange: str):
    """Callback llamado cada vez que llega un nuevo precio de cualquier exchange."""
    # Evaluar si hay oportunidad de arbitraje
    trade = await engine.evaluate()

    # Construir payload para el frontend
    payload = {
        "type": "update",
        "timestamp": time.time(),
        "exchange_updated": exchange,
        "orderbook": order_book.all_quotes(),
        "opportunities": [o.to_dict() for o in order_book.detect_opportunities()],
        "stats": engine.get_stats(),
        "wallets": engine.get_wallets(),
        "new_trade": trade.to_dict() if trade else None,
    }

    # Broadcast a todos los clientes frontend conectados
    if _frontend_clients:
        raw = json.dumps(payload)
        dead = []
        for ws in _frontend_clients:
            try:
                await ws.send_text(raw)
            except Exception:
                dead.append(ws)
        for ws in dead:
            _frontend_clients.remove(ws)


# ── Lifecycle ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global ws_manager
    logger.info("Iniciando conexiones WebSocket a exchanges…")
    ws_manager = WSManager(order_book, _on_exchange_update)
    await ws_manager.start()
    logger.info("✅ Bot de arbitraje corriendo")
    yield
    logger.info("Cerrando conexiones…")
    await ws_manager.stop()


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Bitcoin Arbitrage Bot",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # En producción: poner el dominio del frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── REST Endpoints ────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    stats = engine.get_stats()
    return {
        "status": "ok",
        "circuit_breaker": stats["circuit_breaker_active"],
        "trades": stats["total_trades"],
        "net_profit_usd": stats["total_profit_usd"],
        "exchanges_connected": list(order_book._quotes.keys()),
        "uptime_ts": time.time(),
    }


@app.get("/api/orderbook")
async def get_orderbook():
    return {
        "quotes": order_book.all_quotes(),
        "exchange_count": len(order_book._quotes),
        "timestamp": time.time(),
    }


@app.get("/api/opportunities")
async def get_opportunities():
    opps = order_book.detect_opportunities()
    return {
        "opportunities": [o.to_dict() for o in opps],
        "count": len(opps),
        "best_net_profit_pct": opps[0].net_profit_pct if opps else 0,
        "timestamp": time.time(),
    }


@app.get("/api/stats")
async def get_stats():
    return engine.get_stats()


@app.get("/api/trades")
async def get_trades(limit: int = 100):
    trades = engine.trades[-limit:]
    return {
        "trades": [t.to_dict() for t in reversed(trades)],
        "total": len(engine.trades),
    }


@app.get("/api/wallets")
async def get_wallets():
    return engine.get_wallets()


# ── WebSocket Endpoint ────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    _frontend_clients.append(websocket)
    client_ip = websocket.client.host if websocket.client else "unknown"
    logger.info(f"Frontend conectado: {client_ip} (total: {len(_frontend_clients)})")

    try:
        # Enviar estado actual inmediatamente al conectar
        initial = {
            "type": "initial",
            "timestamp": time.time(),
            "orderbook": order_book.all_quotes(),
            "opportunities": [o.to_dict() for o in order_book.detect_opportunities()],
            "stats": engine.get_stats(),
            "wallets": engine.get_wallets(),
            "trades": [t.to_dict() for t in engine.trades[-50:]],
        }
        await websocket.send_text(json.dumps(initial))

        # Mantener la conexión viva esperando mensajes del cliente
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            # Comando: ajustar parámetros en tiempo real
            if msg.get("type") == "set_config":
                if "min_spread_pct" in msg:
                    config.MIN_SPREAD_PCT = float(msg["min_spread_pct"])
                if "trade_amount_usdt" in msg:
                    config.TRADE_AMOUNT_USDT = float(msg["trade_amount_usdt"])
                await websocket.send_text(json.dumps({"type": "config_updated", "config": {
                    "min_spread_pct": config.MIN_SPREAD_PCT,
                    "trade_amount_usdt": config.TRADE_AMOUNT_USDT,
                }}))

    except WebSocketDisconnect:
        logger.info(f"Frontend desconectado: {client_ip}")
    except Exception as e:
        logger.error(f"WS error con {client_ip}: {e}")
    finally:
        if websocket in _frontend_clients:
            _frontend_clients.remove(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.PORT,
        reload=config.DEBUG,
        log_level="info",
    )
