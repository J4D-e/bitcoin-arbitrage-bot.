/** components/PricePanel.jsx */
import { useEffect, useRef, useState } from "react";
import { EXCHANGE_COLORS, EXCHANGE_LABELS, fmtUSD, fmtPct } from "../utils/format";

export default function PricePanel({ orderbook }) {
  const exchanges = Object.entries(orderbook);
  const prevRef = useRef({});
  const [flashes, setFlashes] = useState({});

  useEffect(() => {
    const newFlashes = {};
    for (const [ex, q] of exchanges) {
      const prev = prevRef.current[ex] || {};
      if (prev.bid && q.bid !== prev.bid) newFlashes[`${ex}-bid`] = q.bid > prev.bid ? "up" : "down";
      if (prev.ask && q.ask !== prev.ask) newFlashes[`${ex}-ask`] = q.ask > prev.ask ? "up" : "down";
    }
    if (Object.keys(newFlashes).length) {
      setFlashes(f => ({ ...f, ...newFlashes }));
      const timer = setTimeout(() => setFlashes({}), 600);
      prevRef.current = Object.fromEntries(exchanges);
      return () => clearTimeout(timer);
    }
    prevRef.current = Object.fromEntries(exchanges);
  }, [orderbook]);

  return (
    <div style={styles.root}>
      <SectionTitle>ORDER BOOK</SectionTitle>

      <div style={styles.grid}>
        {exchanges.map(([ex, q]) => {
          const c = EXCHANGE_COLORS[ex] || {};
          const bidFlash = flashes[`${ex}-bid`];
          const askFlash = flashes[`${ex}-ask`];

          return (
            <div key={ex} style={{ ...styles.card, borderColor: q.is_stale ? "#1a2d42" : c.border }}>
              {/* Exchange header */}
              <div style={styles.cardHeader}>
                <span style={{ color: c.text, fontWeight: 600, letterSpacing: 1 }}>
                  {EXCHANGE_LABELS[ex]}
                </span>
                <span style={{
                  fontSize: 9, padding: "2px 6px", borderRadius: 2,
                  background: q.is_stale ? "#ff3b6b20" : "#00d39520",
                  color: q.is_stale ? "#ff3b6b" : "#00d395",
                  letterSpacing: 1,
                }}>
                  {q.is_stale ? "STALE" : "LIVE"}
                </span>
              </div>

              {/* Mid price */}
              <div style={styles.midPrice}>{fmtUSD(q.mid, 2)}</div>

              {/* Bid / Ask */}
              <div style={styles.bidAskRow}>
                <div style={{
                  ...styles.bidAskCell,
                  background: bidFlash === "up" ? "#00d39515" : bidFlash === "down" ? "#ff3b6b15" : "transparent",
                  transition: "background 0.3s",
                }}>
                  <span style={styles.baLabel}>BID</span>
                  <span style={{ color: "#00d395", fontWeight: 500 }}>{fmtUSD(q.bid, 2)}</span>
                  <span style={styles.volLabel}>{q.bid_volume?.toFixed(4)} BTC</span>
                </div>
                <div style={{ width: 1, background: "#1a2d42" }} />
                <div style={{
                  ...styles.bidAskCell,
                  background: askFlash === "up" ? "#ff3b6b15" : askFlash === "down" ? "#00d39515" : "transparent",
                  transition: "background 0.3s",
                }}>
                  <span style={styles.baLabel}>ASK</span>
                  <span style={{ color: "#ff3b6b", fontWeight: 500 }}>{fmtUSD(q.ask, 2)}</span>
                  <span style={styles.volLabel}>{q.ask_volume?.toFixed(4)} BTC</span>
                </div>
              </div>

              {/* Spread interno */}
              <div style={styles.spreadRow}>
                <span style={styles.spreadLabel}>SPREAD</span>
                <span style={styles.spreadVal}>{fmtPct(q.spread_pct, 4)}</span>
                <span style={{ ...styles.spreadLabel, marginLeft: "auto" }}>
                  {q.latency_ms?.toFixed(0)}ms
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabla comparativa cross-exchange */}
      {exchanges.length >= 2 && <CrossSpreadTable exchanges={exchanges} />}
    </div>
  );
}

function CrossSpreadTable({ exchanges }) {
  return (
    <div style={{ marginTop: 12 }}>
      <SectionTitle>CROSS-EXCHANGE SPREAD</SectionTitle>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>BUY AT</th>
            <th style={styles.th}>SELL AT</th>
            <th style={styles.th}>GROSS SPREAD</th>
            <th style={styles.th}>GROSS %</th>
          </tr>
        </thead>
        <tbody>
          {exchanges.flatMap(([ex1, q1]) =>
            exchanges
              .filter(([ex2]) => ex2 !== ex1)
              .map(([ex2, q2]) => {
                const spread = q2.bid - q1.ask;
                const pct = (spread / q1.ask) * 100;
                const pos = spread > 0;
                return (
                  <tr key={`${ex1}-${ex2}`}>
                    <td style={{ ...styles.td, color: EXCHANGE_COLORS[ex1]?.text }}>{EXCHANGE_LABELS[ex1]}</td>
                    <td style={{ ...styles.td, color: EXCHANGE_COLORS[ex2]?.text }}>{EXCHANGE_LABELS[ex2]}</td>
                    <td style={{ ...styles.td, color: pos ? "#00d395" : "#ff3b6b" }}>{fmtUSD(spread, 2)}</td>
                    <td style={{ ...styles.td, color: pos ? "#00d395" : "#ff3b6b", fontWeight: 600 }}>{fmtPct(pct, 4)}</td>
                  </tr>
                );
              })
          )}
        </tbody>
      </table>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 9, color: "#3d5a78", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

const styles = {
  root: { display: "flex", flexDirection: "column" },
  grid: { display: "grid", gridTemplateColumns: "1fr", gap: 8 },
  card: {
    background: "#0a1220",
    border: "1px solid",
    borderRadius: 4, overflow: "hidden",
  },
  cardHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 12px", borderBottom: "1px solid #1a2d42",
    fontSize: 11,
  },
  midPrice: {
    fontFamily: "'Bebas Neue'", fontSize: 28,
    padding: "8px 12px 4px",
    letterSpacing: 1,
  },
  bidAskRow: { display: "flex", borderTop: "1px solid #1a2d42" },
  bidAskCell: {
    flex: 1, display: "flex", flexDirection: "column",
    padding: "6px 12px", gap: 1,
  },
  baLabel: { fontSize: 9, color: "#3d5a78", letterSpacing: 1 },
  volLabel: { fontSize: 10, color: "#3d5a78" },
  spreadRow: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "4px 12px", borderTop: "1px solid #1a2d42",
    fontSize: 10,
  },
  spreadLabel: { color: "#3d5a78", letterSpacing: 1 },
  spreadVal: { color: "#6b8aab", fontWeight: 500 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 11 },
  th: {
    textAlign: "left", padding: "5px 8px",
    color: "#3d5a78", fontWeight: 400, letterSpacing: 1, fontSize: 9,
    borderBottom: "1px solid #1a2d42",
  },
  td: {
    padding: "5px 8px", borderBottom: "1px solid #0d1828",
  },
};
