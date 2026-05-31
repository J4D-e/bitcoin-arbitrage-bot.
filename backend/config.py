"""
Configuración central del bot de arbitraje.
Las credenciales de exchanges se cargan desde .env — NUNCA se hardcodean.
"""
import os
from dataclasses import dataclass, field
from dotenv import load_dotenv

load_dotenv()

@dataclass
class ExchangeConfig:
    name: str
    api_key: str
    api_secret: str
    ws_url: str
    rest_url: str
    maker_fee: float
    taker_fee: float
    enabled: bool = True

@dataclass
class Config:
    # ── Server ──────────────────────────────────────────────────────────────
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    # ── Trading ──────────────────────────────────────────────────────────────
    SYMBOL: str = os.getenv("SYMBOL", "BTC/USDT")
    MIN_SPREAD_PCT: float = float(os.getenv("MIN_SPREAD_PCT", "0.15"))   # 0.15% mínimo
    TRADE_AMOUNT_USDT: float = float(os.getenv("TRADE_AMOUNT_USDT", "100.0"))
    SLIPPAGE_PCT: float = float(os.getenv("SLIPPAGE_PCT", "0.05"))
    MAX_OPEN_TRADES: int = int(os.getenv("MAX_OPEN_TRADES", "3"))

    # ── Circuit Breaker ───────────────────────────────────────────────────────
    CIRCUIT_BREAKER_MAX_LOSS_USD: float = float(os.getenv("CIRCUIT_BREAKER_MAX_LOSS_USD", "50.0"))
    CIRCUIT_BREAKER_WINDOW_SEC: int = int(os.getenv("CIRCUIT_BREAKER_WINDOW_SEC", "300"))

    # ── Exchanges ─────────────────────────────────────────────────────────────
    @property
    def EXCHANGES(self) -> dict[str, ExchangeConfig]:
        return {
            "binance": ExchangeConfig(
                name="Binance",
                api_key=os.getenv("BINANCE_API_KEY", ""),
                api_secret=os.getenv("BINANCE_API_SECRET", ""),
                ws_url="wss://stream.binance.com:9443/ws/btcusdt@bookTicker",
                rest_url="https://api.binance.com",
                maker_fee=0.001,   # 0.10%
                taker_fee=0.001,   # 0.10%
            ),
            "kraken": ExchangeConfig(
                name="Kraken",
                api_key=os.getenv("KRAKEN_API_KEY", ""),
                api_secret=os.getenv("KRAKEN_API_SECRET", ""),
                ws_url="wss://ws.kraken.com",
                rest_url="https://api.kraken.com",
                maker_fee=0.0016,  # 0.16%
                taker_fee=0.0026,  # 0.26%
            ),
            "coinbase": ExchangeConfig(
                name="Coinbase",
                api_key=os.getenv("COINBASE_API_KEY", ""),
                api_secret=os.getenv("COINBASE_API_SECRET", ""),
                ws_url="wss://advanced-trade-ws.coinbase.com",
                rest_url="https://api.coinbase.com",
                maker_fee=0.006,   # 0.60% (sin volumen)
                taker_fee=0.006,
            ),
        }

    # ── Wallets iniciales para simulación ────────────────────────────────────
    INITIAL_BALANCES: dict = field(default_factory=lambda: {
        "binance":  {"BTC": 0.1, "USDT": 10000.0},
        "kraken":   {"BTC": 0.1, "USDT": 10000.0},
        "coinbase": {"BTC": 0.1, "USDT": 10000.0},
    })

config = Config()
