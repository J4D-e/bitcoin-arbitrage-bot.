# ₿ Bitcoin Arbitrage Bot

Sistema de arbitraje de Bitcoin en tiempo real con datos de precios reales de Binance, Kraken y Coinbase vía WebSocket.

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Python 3.11 + FastAPI + asyncio |
| Precios | WebSocket públicos (Binance, Kraken, Coinbase) |
| Frontend | React + Vite + Recharts |
| Deploy | Contabo VPS + Nginx + systemd |

---

## Configuración del Repositorio GitHub

### 1. Crear el repo

```bash
# En la carpeta del proyecto
git init
git add .
git commit -m "feat: initial commit — arbitrage bot con APIs reales"

# Crear repo en GitHub (sin README, sin .gitignore — ya los tienes)
# Luego:
git remote add origin https://github.com/TU_USUARIO/bitcoin-arbitrage-bot.git
git branch -M main
git push -u origin main
```

### 2. Branches recomendados

```
main       ← código estable, deploy de producción
develop    ← desarrollo activo
feature/*  ← features nuevas (ej: feature/okx-exchange)
```

```bash
# Crear rama develop
git checkout -b develop
git push -u origin develop
```

### 3. Secrets de GitHub (para CI/CD opcional)

En **Settings → Secrets and variables → Actions**, agrega:

| Secret | Descripción |
|--------|-------------|
| `CONTABO_HOST` | IP de tu VPS |
| `CONTABO_USER` | usuario SSH (ej: `ubuntu`) |
| `CONTABO_SSH_KEY` | clave privada SSH (para deploy automático) |

> ⚠️ **NUNCA** subas el archivo `.env` al repositorio. Está en `.gitignore`.

---

## Setup Local (Desarrollo)

### Backend

```bash
cd backend

# Crear entorno virtual
python -m venv venv
source venv/bin/activate          # Linux/Mac
# venv\Scripts\activate           # Windows

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Edita .env si quieres cambiar parámetros

# Levantar el servidor
python main.py
# → http://localhost:8000
# → WebSocket: ws://localhost:8000/ws
```

El backend se conecta automáticamente a los 3 exchanges. Los streams de precios son públicos — **no necesitas API keys** para ver los precios en tiempo real. Las keys solo son necesarias si en el futuro implementas órdenes reales.

### Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Configurar URL del backend
cp .env.example .env
# VITE_WS_URL=ws://localhost:8000/ws  ← ya viene configurado

# Levantar en desarrollo
npm run dev
# → http://localhost:5173
```

### Test del backend

Con el backend corriendo en Terminal 1, en Terminal 2:

```bash
cd backend
source venv/bin/activate
python test_backend.py
```

---

## Deploy en Contabo VPS

### 1. Conectar al VPS

```bash
ssh ubuntu@TU_IP_CONTABO
```

### 2. Instalar dependencias del sistema

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3.11 python3.11-venv python3-pip nodejs npm nginx git
```

### 3. Clonar el repositorio

```bash
cd /home/ubuntu
git clone https://github.com/TU_USUARIO/bitcoin-arbitrage-bot.git
cd bitcoin-arbitrage-bot
```

### 4. Setup del Backend

```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Crear .env con tus valores reales
cp .env.example .env
nano .env
```

### 5. Setup del Frontend

```bash
cd ../frontend
npm install
cp .env.example .env
# Editar .env: VITE_WS_URL=ws://TU_IP_CONTABO/ws
nano .env
npm run build

# Copiar archivos estáticos a Nginx
sudo mkdir -p /var/www/arbitrage-bot
sudo cp -r dist/* /var/www/arbitrage-bot/
```

### 6. Configurar Nginx

```bash
sudo cp /home/ubuntu/bitcoin-arbitrage-bot/docs/nginx.conf \
        /etc/nginx/sites-available/arbitrage-bot

# Editar con tu IP
sudo nano /etc/nginx/sites-available/arbitrage-bot
# Reemplaza TU_IP_O_DOMINIO

sudo ln -s /etc/nginx/sites-available/arbitrage-bot \
           /etc/nginx/sites-enabled/
sudo nginx -t    # verificar config
sudo systemctl reload nginx
```

### 7. Configurar systemd (autostart)

```bash
sudo cp /home/ubuntu/bitcoin-arbitrage-bot/docs/arbitrage-bot.service \
        /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable arbitrage-bot
sudo systemctl start arbitrage-bot

# Verificar
sudo systemctl status arbitrage-bot
sudo journalctl -u arbitrage-bot -f   # logs en tiempo real
```

### 8. Verificar que todo funciona

```bash
curl http://localhost:8000/health
curl http://TU_IP_CONTABO/health
# Abre en el navegador: http://TU_IP_CONTABO
```

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                     Contabo VPS                          │
│                                                          │
│  ┌──────────────┐      ┌──────────────────────────────┐ │
│  │    Nginx     │      │      FastAPI Backend          │ │
│  │   (puerto 80)│─────▶│      (puerto 8000)            │ │
│  │              │      │                               │ │
│  │ /         →  │      │  ┌─────────┐  ┌───────────┐  │ │
│  │ /api/*    →  │      │  │WSManager│  │  Engine   │  │ │
│  │ /ws       →  │      │  │asyncio  │  │ arbitraje │  │ │
│  └──────────────┘      │  └────┬────┘  └───────────┘  │ │
│         ▲              │       │                        │ │
│         │              └───────┼────────────────────────┘ │
│  ┌──────┴──────┐               │                          │
│  │React Frontend│              │ WebSocket                │
│  │(dist estático)│             ▼                          │
│  └─────────────┘    ┌──────────────────────┐             │
│                      │  Exchanges externos  │             │
└──────────────────────│  Binance  WS público │─────────────┘
                       │  Kraken   WS público │
                       │  Coinbase WS público │
                       └──────────────────────┘
```

## Flujo de datos

```
Exchange WS → ws_manager.py → orderbook.py (RAM) → engine.py
                                    ↓
                          detect_opportunities()
                                    ↓
                         ¿spread_neto > MIN_SPREAD_PCT?
                                    ↓ sí
                         execute_simulated() → Trade
                                    ↓
                    broadcast via WebSocket → React Frontend
```

## Endpoints API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado del sistema |
| GET | `/api/orderbook` | Precios actuales de los 3 exchanges |
| GET | `/api/opportunities` | Oportunidades detectadas con profit neto |
| GET | `/api/stats` | Estadísticas: trades, P&L, win rate |
| GET | `/api/trades?limit=100` | Historial de trades |
| GET | `/api/wallets` | Balances simulados por exchange |
| WS | `/ws` | Stream en tiempo real (JSON por cada update de precio) |

---

## Cómo funcionan los WebSockets de precios (sin API key)

Los 3 exchanges exponen streams **públicos** de precios:

**Binance** — `wss://stream.binance.com:9443/ws/btcusdt@bookTicker`
Recibe el mejor bid y ask en tiempo real, sin suscripción ni autenticación.

**Kraken** — `wss://ws.kraken.com`
Requiere enviar un mensaje de suscripción al conectar, pero el channel `ticker` es público.

**Coinbase** — `wss://advanced-trade-ws.coinbase.com`
Suscripción al channel `ticker` para `BTC-USD`, también público.

Todos se reconectan automáticamente con backoff exponencial si se cae la conexión.

---

## Parámetros configurables (en `.env`)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `MIN_SPREAD_PCT` | `0.15` | Spread neto mínimo para ejecutar (%) |
| `TRADE_AMOUNT_USDT` | `100.0` | Monto por trade simulado (USDT) |
| `SLIPPAGE_PCT` | `0.05` | Slippage estimado (%) |
| `MAX_OPEN_TRADES` | `3` | Trades simultáneos máximos |
| `CIRCUIT_BREAKER_MAX_LOSS_USD` | `50.0` | Pérdida máxima antes de detener el bot |

También se pueden ajustar en tiempo real desde el WebSocket enviando:
```json
{ "type": "set_config", "min_spread_pct": 0.10, "trade_amount_usdt": 200 }
```
