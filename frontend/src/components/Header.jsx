/** components/Header.jsx */
import { useEffect, useState } from "react";
import { EXCHANGE_COLORS, EXCHANGE_LABELS, fmtMs, fmtUSD } from "../utils/format";

export default function Header({ connected, latencyMs, orderbook, stats }) {
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-US", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const profit = stats?.total_profit_usd ?? 0;
  const trades = stats?.total_trades ?? 0;
  const exchanges = Object.keys(orderbook);

  return (
    <header style={styles.root}>
      {/* Logo */}
      <div style={styles.logo}>
        <span style={styles.logoText}>ARBITRAGE</span>
        <span style={styles.logoBTC}>₿</span>
        <span style={styles.logoSub}>BOT</span>
      </div>

      {/* Exchanges status */}
      <div style={styles.exchanges}>
        {["binance", "kraken", "coinbase"].map(ex => {
          const active = exchanges.includes(ex);
          const c = EXCHANGE_COLORS[ex];
          return (
            <div key={ex} style={{
              ...styles.exBadge,
              borderColor: active ? c.border : "#1a2d42",
              opacity: active ? 1 : 0.35,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: active ? c.border : "#3d5a78",
                display: "inline-block",
                boxShadow: active ? `0 0 6px ${c.border}` : "none",
                animation: active ? "pulse-green 2s infinite" : "none",
              }} />
              <span style={{ color: active ? c.text : "#3d5a78" }}>
                {EXCHANGE_LABELS[ex]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Métricas */}
      <div style={styles.metrics}>
        <Metric label="P&L" value={fmtUSD(profit)} color={profit >= 0 ? "#00d395" : "#ff3b6b"} />
        <Metric label="TRADES" value={trades} />
        <Metric label="LATENCY" value={fmtMs(latencyMs)} />
      </div>

      {/* Reloj + status */}
      <div style={styles.right}>
        <span style={{
          ...styles.liveBadge,
          background: connected ? "#00d39520" : "#ff3b6b20",
          borderColor: connected ? "#00d395" : "#ff3b6b",
          color: connected ? "#00d395" : "#ff3b6b",
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: "50%",
            background: connected ? "#00d395" : "#ff3b6b",
            display: "inline-block",
            animation: connected ? "pulse-green 1.5s infinite" : "none",
          }} />
          {connected ? "LIVE" : "OFFLINE"}
        </span>
        <span style={styles.clock}>
          {clock}<span style={{ animation: "blink-cursor 1s infinite" }}>_</span>
        </span>
      </div>
    </header>
  );
}

function Metric({ label, value, color }) {
  return (
    <div style={styles.metric}>
      <span style={styles.metricLabel}>{label}</span>
      <span style={{ ...styles.metricValue, color: color || "#e2eaf4" }}>{value}</span>
    </div>
  );
}

const styles = {
  root: {
    display: "flex", alignItems: "center", gap: 24,
    padding: "12px 20px",
    background: "#0a1220",
    borderBottom: "1px solid #1a2d42",
    flexWrap: "wrap",
    position: "sticky", top: 0, zIndex: 100,
  },
  logo: { display: "flex", alignItems: "baseline", gap: 6 },
  logoText: { fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: 3, color: "#e2eaf4" },
  logoBTC: { fontFamily: "'Bebas Neue'", fontSize: 26, color: "#F0B90B", lineHeight: 1 },
  logoSub: { fontFamily: "'Bebas Neue'", fontSize: 13, color: "#3d5a78", letterSpacing: 4 },
  exchanges: { display: "flex", gap: 8 },
  exBadge: {
    display: "flex", alignItems: "center", gap: 5,
    padding: "3px 8px", borderRadius: 3,
    border: "1px solid", fontSize: 11, fontWeight: 500,
    letterSpacing: 0.5,
  },
  metrics: { display: "flex", gap: 20, marginLeft: "auto" },
  metric: { display: "flex", flexDirection: "column", alignItems: "flex-end" },
  metricLabel: { fontSize: 9, color: "#3d5a78", letterSpacing: 1, textTransform: "uppercase" },
  metricValue: { fontSize: 14, fontWeight: 600, letterSpacing: 0.5 },
  right: { display: "flex", alignItems: "center", gap: 12 },
  liveBadge: {
    display: "flex", alignItems: "center", gap: 5,
    padding: "3px 8px", borderRadius: 3,
    border: "1px solid", fontSize: 10,
    fontWeight: 600, letterSpacing: 1,
  },
  clock: { fontFamily: "'IBM Plex Mono'", fontSize: 13, color: "#6b8aab" },
};
