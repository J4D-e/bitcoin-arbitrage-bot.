"""
test_backend.py — Verifica que todos los endpoints respondan correctamente.
Corre este script con el backend ya levantado: python main.py
"""
import asyncio
import json
import sys
import time

import httpx
import websockets

BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws"

PASS = "\033[92m✅ PASS\033[0m"
FAIL = "\033[91m❌ FAIL\033[0m"
INFO = "\033[94mℹ️  INFO\033[0m"


async def test_rest():
    print("\n═══════════════════════════════════════")
    print("  REST ENDPOINTS")
    print("═══════════════════════════════════════")

    async with httpx.AsyncClient(timeout=10) as client:
        endpoints = [
            ("GET", "/health"),
            ("GET", "/api/orderbook"),
            ("GET", "/api/opportunities"),
            ("GET", "/api/stats"),
            ("GET", "/api/trades"),
            ("GET", "/api/wallets"),
        ]

        all_pass = True
        for method, path in endpoints:
            try:
                r = await client.get(f"{BASE_URL}{path}")
                data = r.json()
                status = PASS if r.status_code == 200 else FAIL
                print(f"{status}  {method} {path}  →  {r.status_code}")

                if path == "/api/orderbook":
                    exchanges = list(data.get("quotes", {}).keys())
                    print(f"    {INFO}  Exchanges conectados: {exchanges or 'ninguno (espera ~10s)'}")

                if path == "/api/stats":
                    print(f"    {INFO}  Trades: {data.get('total_trades', 0)} | "
                          f"P&L: ${data.get('total_profit_usd', 0):.4f}")

                if r.status_code != 200:
                    all_pass = False

            except httpx.ConnectError:
                print(f"{FAIL}  {method} {path}  →  No se puede conectar al servidor")
                print("         ⚠️  ¿Está corriendo 'python main.py'?")
                all_pass = False

    return all_pass


async def test_websocket():
    print("\n═══════════════════════════════════════")
    print("  WEBSOCKET")
    print("═══════════════════════════════════════")

    try:
        async with websockets.connect(WS_URL, open_timeout=5) as ws:
            raw = await asyncio.wait_for(ws.recv(), timeout=10)
            data = json.loads(raw)

            msg_type = data.get("type")
            has_orderbook = "orderbook" in data
            has_stats = "stats" in data

            print(f"{PASS}  Conexión WebSocket establecida")
            print(f"  {INFO}  type={msg_type} | orderbook={'✓' if has_orderbook else '✗'} | "
                  f"stats={'✓' if has_stats else '✗'}")

            # Esperar un update real de precio
            print(f"  {INFO}  Esperando update de precio (hasta 15s)…")
            try:
                raw2 = await asyncio.wait_for(ws.recv(), timeout=15)
                data2 = json.loads(raw2)
                exchange = data2.get("exchange_updated", "?")
                print(f"{PASS}  Update recibido de exchange: {exchange}")
            except asyncio.TimeoutError:
                print(f"  ⚠️  Sin updates en 15s — los WS públicos pueden tardar un poco")

        return True

    except Exception as e:
        print(f"{FAIL}  WebSocket: {e}")
        return False


async def main():
    print("\n🔍 Bitcoin Arbitrage Bot — Test Suite")
    print(f"   Backend URL: {BASE_URL}")
    print(f"   Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")

    rest_ok = await test_rest()
    ws_ok = await test_websocket()

    print("\n═══════════════════════════════════════")
    if rest_ok and ws_ok:
        print("✅  TODOS LOS TESTS PASARON")
    else:
        print("❌  ALGUNOS TESTS FALLARON")
        sys.exit(1)
    print("═══════════════════════════════════════\n")


if __name__ == "__main__":
    asyncio.run(main())
