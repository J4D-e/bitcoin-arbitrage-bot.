"""
engine.py — Motor de decisión y executor de trades simulados.

En modo simulación: actualiza wallets virtuales, registra historial.
Para producción real habría que reemplazar _execute_simulated() por
llamadas firmadas a las APIs REST de cada exchange.
"""
import asyncio
import copy
import logging
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from orderbook import ArbitrageOpportunity, OrderBook

logger = logging.getLogger(__name__)


class TradeStatus(str, Enum):
    PENDING = "pending"
    FILLED = "filled"
    PARTIAL = "partial"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class Trade:
    id: str
    buy_exchange: str
    sell_exchange: str
    buy_price: float
    sell_price: float
    btc_amount: float
    usdt_amount: float
    net_profit_usd: float
    net_profit_pct: float
    status: TradeStatus
    timestamp: float = field(default_factory=time.time)
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "buy_exchange": self.buy_exchange,
            "sell_exchange": self.sell_exchange,
            "buy_price": round(self.buy_price, 2),
            "sell_price": round(self.sell_price, 2),
            "btc_amount": round(self.btc_amount, 6),
            "usdt_amount": round(self.usdt_amount, 2),
            "net_profit_usd": round(self.net_profit_usd, 4),
            "net_profit_pct": round(self.net_profit_pct, 4),
            "status": self.status.value,
            "timestamp": self.timestamp,
            "error": self.error,
        }


class ArbitrageEngine:
    """
    Evalúa oportunidades y ejecuta trades simulados.
    circuit_breaker: desactiva el bot si la pérdida acumulada supera el límite.
    """

    def __init__(self, config, order_book: OrderBook):
        self.config = config
        self.order_book = order_book

        # Wallets simuladas: copia mutable de los balances iniciales
        self.wallets: dict[str, dict[str, float]] = copy.deepcopy(
            config.INITIAL_BALANCES
        )
        self.trades: list[Trade] = []
        self.total_profit_usd: float = 0.0
        self.open_trades: int = 0
        self._circuit_broken: bool = False
        self._loss_window: list[tuple[float, float]] = []  # (timestamp, pnl)

    # ─────────────────────── CIRCUIT BREAKER ────────────────────────────────

    def _check_circuit_breaker(self) -> bool:
        """Retorna True si el bot debe detenerse."""
        if self._circuit_broken:
            return True

        now = time.time()
        window = self.config.CIRCUIT_BREAKER_WINDOW_SEC

        # Limpiar entradas fuera de la ventana
        self._loss_window = [(t, p) for t, p in self._loss_window if now - t < window]
        recent_loss = sum(p for _, p in self._loss_window if p < 0)

        if abs(recent_loss) >= self.config.CIRCUIT_BREAKER_MAX_LOSS_USD:
            self._circuit_broken = True
            logger.critical(
                f"🚨 CIRCUIT BREAKER activado: pérdida de ${abs(recent_loss):.2f} "
                f"en los últimos {window}s"
            )
        return self._circuit_broken

    # ─────────────────────── EVALUACIÓN ─────────────────────────────────────

    async def evaluate(self) -> Optional[Trade]:
        """
        Detecta la mejor oportunidad actual y la ejecuta si cumple todos los criterios.
        """
        if self._check_circuit_breaker():
            return None

        if self.open_trades >= self.config.MAX_OPEN_TRADES:
            return None

        opportunities = self.order_book.detect_opportunities()
        if not opportunities:
            return None

        best = opportunities[0]

        # Verificar balance suficiente
        buy_wallet = self.wallets.get(best.buy_exchange, {})
        usdt_available = buy_wallet.get("USDT", 0.0)
        if usdt_available < self.config.TRADE_AMOUNT_USDT:
            logger.debug(
                f"Balance insuficiente en {best.buy_exchange}: "
                f"${usdt_available:.2f} < ${self.config.TRADE_AMOUNT_USDT}"
            )
            return None

        return await self._execute_simulated(best)

    # ─────────────────────── EJECUCIÓN SIMULADA ──────────────────────────────

    async def _execute_simulated(self, opp: ArbitrageOpportunity) -> Trade:
        """
        Simula la ejecución de un trade de arbitraje:
        1. Compra BTC en buy_exchange gastando USDT
        2. Vende BTC en sell_exchange recibiendo USDT
        3. Actualiza wallets virtuales
        """
        self.open_trades += 1
        trade_id = str(uuid.uuid4())[:8]

        # Simular latencia de red (~50-150ms)
        await asyncio.sleep(0.05)

        try:
            btc_amount = opp.volume_available
            usdt_cost = btc_amount * opp.buy_price
            usdt_received = btc_amount * opp.sell_price
            buy_fee_usd = usdt_cost * self.config.EXCHANGES[opp.buy_exchange].taker_fee
            sell_fee_usd = usdt_received * self.config.EXCHANGES[opp.sell_exchange].taker_fee
            net_profit = usdt_received - usdt_cost - buy_fee_usd - sell_fee_usd

            # Actualizar wallets
            self.wallets[opp.buy_exchange]["USDT"] -= usdt_cost + buy_fee_usd
            self.wallets[opp.buy_exchange]["BTC"] = (
                self.wallets[opp.buy_exchange].get("BTC", 0) + btc_amount
            )
            self.wallets[opp.sell_exchange]["BTC"] = (
                self.wallets[opp.sell_exchange].get("BTC", 0) - btc_amount
            )
            self.wallets[opp.sell_exchange]["USDT"] += usdt_received - sell_fee_usd

            self.total_profit_usd += net_profit
            self._loss_window.append((time.time(), net_profit))

            trade = Trade(
                id=trade_id,
                buy_exchange=opp.buy_exchange,
                sell_exchange=opp.sell_exchange,
                buy_price=opp.buy_price,
                sell_price=opp.sell_price,
                btc_amount=btc_amount,
                usdt_amount=usdt_cost,
                net_profit_usd=net_profit,
                net_profit_pct=opp.net_profit_pct,
                status=TradeStatus.FILLED,
            )

            logger.info(
                f"✅ Trade {trade_id}: compra {opp.buy_exchange} ${opp.buy_price:,.2f} → "
                f"venta {opp.sell_exchange} ${opp.sell_price:,.2f} | "
                f"profit neto: ${net_profit:.4f} ({opp.net_profit_pct:.3f}%)"
            )

        except Exception as e:
            trade = Trade(
                id=trade_id,
                buy_exchange=opp.buy_exchange,
                sell_exchange=opp.sell_exchange,
                buy_price=opp.buy_price,
                sell_price=opp.sell_price,
                btc_amount=0,
                usdt_amount=0,
                net_profit_usd=0,
                net_profit_pct=0,
                status=TradeStatus.FAILED,
                error=str(e),
            )
            logger.error(f"❌ Trade {trade_id} fallido: {e}")

        finally:
            self.open_trades -= 1

        self.trades.append(trade)
        return trade

    # ─────────────────────── STATS ───────────────────────────────────────────

    def get_stats(self) -> dict:
        filled = [t for t in self.trades if t.status == TradeStatus.FILLED]
        failed = [t for t in self.trades if t.status == TradeStatus.FAILED]
        win_rate = len(filled) / len(self.trades) * 100 if self.trades else 0

        return {
            "total_trades": len(self.trades),
            "filled_trades": len(filled),
            "failed_trades": len(failed),
            "win_rate_pct": round(win_rate, 1),
            "total_profit_usd": round(self.total_profit_usd, 4),
            "circuit_breaker_active": self._circuit_broken,
            "open_trades": self.open_trades,
        }

    def get_wallets(self) -> dict:
        return {
            exchange: {
                asset: round(amount, 8)
                for asset, amount in balances.items()
            }
            for exchange, balances in self.wallets.items()
        }
