"""
orderbook.py — Cache de precios en RAM + detección de oportunidades de arbitraje.

El dict vive en un solo proceso asyncio — sin locks, sin race conditions,
porque asyncio es cooperativo (single-threaded event loop).
"""
import time
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ExchangeQuote:
    exchange: str
    bid: float = 0.0          # mejor precio de venta (yo vendo aquí)
    ask: float = 0.0          # mejor precio de compra (yo compro aquí)
    bid_volume: float = 0.0
    ask_volume: float = 0.0
    timestamp: float = field(default_factory=time.time)
    latency_ms: float = 0.0   # milisegundos desde última actualización

    @property
    def mid(self) -> float:
        return (self.bid + self.ask) / 2 if self.bid and self.ask else 0.0

    @property
    def spread_pct(self) -> float:
        """Spread interno del exchange (bid vs ask)."""
        if self.bid and self.ask:
            return (self.ask - self.bid) / self.bid * 100
        return 0.0

    @property
    def is_stale(self) -> bool:
        """True si no recibimos actualización en los últimos 10 segundos."""
        return (time.time() - self.timestamp) > 10.0

    def to_dict(self) -> dict:
        return {
            "exchange": self.exchange,
            "bid": round(self.bid, 2),
            "ask": round(self.ask, 2),
            "bid_volume": round(self.bid_volume, 6),
            "ask_volume": round(self.ask_volume, 6),
            "mid": round(self.mid, 2),
            "spread_pct": round(self.spread_pct, 4),
            "timestamp": self.timestamp,
            "latency_ms": round(self.latency_ms, 1),
            "is_stale": self.is_stale,
        }


@dataclass
class ArbitrageOpportunity:
    buy_exchange: str
    sell_exchange: str
    buy_price: float
    sell_price: float
    gross_spread: float
    gross_spread_pct: float
    buy_fee: float
    sell_fee: float
    slippage: float
    net_profit_pct: float
    net_profit_usd: float
    trade_amount_usdt: float
    volume_available: float
    timestamp: float = field(default_factory=time.time)

    @property
    def is_profitable(self) -> bool:
        return self.net_profit_pct > 0

    def to_dict(self) -> dict:
        return {
            "buy_exchange": self.buy_exchange,
            "sell_exchange": self.sell_exchange,
            "buy_price": round(self.buy_price, 2),
            "sell_price": round(self.sell_price, 2),
            "gross_spread": round(self.gross_spread, 2),
            "gross_spread_pct": round(self.gross_spread_pct, 4),
            "buy_fee_pct": round(self.buy_fee * 100, 3),
            "sell_fee_pct": round(self.sell_fee * 100, 3),
            "slippage_pct": round(self.slippage * 100, 3),
            "net_profit_pct": round(self.net_profit_pct, 4),
            "net_profit_usd": round(self.net_profit_usd, 4),
            "trade_amount_usdt": round(self.trade_amount_usdt, 2),
            "volume_available": round(self.volume_available, 6),
            "timestamp": self.timestamp,
            "is_profitable": self.is_profitable,
        }


class OrderBook:
    """
    Mantiene los quotes más recientes de cada exchange en RAM.
    Thread-safe para asyncio (single event loop).
    """

    def __init__(self, config):
        self.config = config
        self._quotes: dict[str, ExchangeQuote] = {}
        self._last_update_times: dict[str, float] = {}

    def update(
        self,
        exchange: str,
        bid: float,
        ask: float,
        bid_volume: float,
        ask_volume: float,
        timestamp: float,
    ):
        now = time.time()
        prev_ts = self._last_update_times.get(exchange, now)
        latency_ms = (now - prev_ts) * 1000

        self._quotes[exchange] = ExchangeQuote(
            exchange=exchange,
            bid=bid,
            ask=ask,
            bid_volume=bid_volume,
            ask_volume=ask_volume,
            timestamp=timestamp,
            latency_ms=latency_ms,
        )
        self._last_update_times[exchange] = now

    def get_quote(self, exchange: str) -> Optional[ExchangeQuote]:
        return self._quotes.get(exchange)

    def all_quotes(self) -> dict[str, dict]:
        return {ex: q.to_dict() for ex, q in self._quotes.items()}

    def detect_opportunities(self) -> list[ArbitrageOpportunity]:
        """
        Compara cada par de exchanges para encontrar spreads rentables.
        Fórmula: net_profit = (sell_bid - buy_ask) / buy_ask - buy_fee - sell_fee - slippage
        """
        exchanges = list(self._quotes.keys())
        opportunities = []
        cfg = self.config
        exchanges_cfg = cfg.EXCHANGES

        for i in range(len(exchanges)):
            for j in range(len(exchanges)):
                if i == j:
                    continue

                buy_ex = exchanges[i]
                sell_ex = exchanges[j]

                q_buy = self._quotes.get(buy_ex)
                q_sell = self._quotes.get(sell_ex)

                if not q_buy or not q_sell:
                    continue
                if q_buy.is_stale or q_sell.is_stale:
                    continue
                if q_buy.ask <= 0 or q_sell.bid <= 0:
                    continue

                # Compro al ask del exchange barato, vendo al bid del exchange caro
                buy_price = q_buy.ask
                sell_price = q_sell.bid

                if sell_price <= buy_price:
                    continue

                gross_spread = sell_price - buy_price
                gross_spread_pct = gross_spread / buy_price

                buy_fee = exchanges_cfg[buy_ex].taker_fee
                sell_fee = exchanges_cfg[sell_ex].taker_fee
                slippage = cfg.SLIPPAGE_PCT / 100

                net_profit_pct = gross_spread_pct - buy_fee - sell_fee - slippage

                if net_profit_pct < (cfg.MIN_SPREAD_PCT / 100):
                    continue

                # Volumen máximo disponible (limitado por el order book)
                btc_amount = cfg.TRADE_AMOUNT_USDT / buy_price
                volume_available = min(q_buy.ask_volume, q_sell.bid_volume, btc_amount)
                net_profit_usd = volume_available * buy_price * net_profit_pct

                opp = ArbitrageOpportunity(
                    buy_exchange=buy_ex,
                    sell_exchange=sell_ex,
                    buy_price=buy_price,
                    sell_price=sell_price,
                    gross_spread=gross_spread,
                    gross_spread_pct=gross_spread_pct * 100,
                    buy_fee=buy_fee,
                    sell_fee=sell_fee,
                    slippage=slippage,
                    net_profit_pct=net_profit_pct * 100,
                    net_profit_usd=net_profit_usd,
                    trade_amount_usdt=cfg.TRADE_AMOUNT_USDT,
                    volume_available=volume_available,
                )
                opportunities.append(opp)

        # Ordenar por rentabilidad neta descendente
        return sorted(opportunities, key=lambda o: o.net_profit_pct, reverse=True)
