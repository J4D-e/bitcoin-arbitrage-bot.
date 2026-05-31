/**
 * useArbitrageWS.js
 * Mantiene la conexión WebSocket al backend FastAPI y expone
 * el estado completo del sistema al resto del frontend.
 * Se reconecta automáticamente con backoff exponencial.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";
const MAX_RECONNECT_DELAY_MS = 15_000;

const INITIAL_STATE = {
  connected: false,
  latencyMs: null,
  orderbook: {},       // { binance: { bid, ask, … }, kraken: {…}, coinbase: {…} }
  opportunities: [],   // ArbitrageOpportunity[]
  stats: {},           // { total_trades, total_profit_usd, … }
  wallets: {},         // { binance: { BTC, USDT }, … }
  trades: [],          // Trade[] – historial completo
};

export function useArbitrageWS() {
  const [state, setState] = useState(INITIAL_STATE);
  const wsRef = useRef(null);
  const reconnectDelay = useRef(1_000);
  const reconnectTimer = useRef(null);
  const pingTimestamp = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectDelay.current = 1_000; // reset backoff
      setState(s => ({ ...s, connected: true }));
      // Medir latencia con ping periódico
      pingTimestamp.current = Date.now();
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Calcular latencia aproximada
      const latencyMs = pingTimestamp.current
        ? Date.now() - pingTimestamp.current
        : null;
      pingTimestamp.current = Date.now();

      setState(s => {
        const newTrades = data.new_trade
          ? [data.new_trade, ...s.trades].slice(0, 200)  // máx 200 en RAM
          : data.trades ?? s.trades;

        return {
          ...s,
          connected: true,
          latencyMs,
          orderbook: data.orderbook ?? s.orderbook,
          opportunities: data.opportunities ?? s.opportunities,
          stats: data.stats ?? s.stats,
          wallets: data.wallets ?? s.wallets,
          trades: newTrades,
        };
      });
    };

    ws.onclose = () => {
      setState(s => ({ ...s, connected: false }));
      wsRef.current = null;

      const delay = Math.min(reconnectDelay.current, MAX_RECONNECT_DELAY_MS);
      reconnectDelay.current = Math.min(delay * 1.5, MAX_RECONNECT_DELAY_MS);
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  /** Envía un comando al backend para ajustar configuración en tiempo real */
  const sendConfig = useCallback((updates) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "set_config", ...updates }));
    }
  }, []);

  return { ...state, sendConfig };
}
