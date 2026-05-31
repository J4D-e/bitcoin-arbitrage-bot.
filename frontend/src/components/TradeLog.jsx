/** components/TradeLog.jsx */
import { fmtUSD, fmtPct, fmtTime, EXCHANGE_LABELS } from "../utils/format";

export default function TradeLog({ trades }) {
  const STATUS_STYLE = {
    filled:    { color: "#00d395", bg: "#00d39518", label: "FILLED" },
    failed:    { color: "#ff3b6b", bg: "#ff3b6b18", label: "FAILED" },
    partial:   { color: "#f59e0b", bg: "#f59e0b18", label: "PARTIAL" },
    pending:   { color: "#6b8aab", bg: "#6b8aab18", label: "PENDING" },
    cancelled: { color: "#3d5a78", bg: "#3d5a7818", label: "CANCEL" },
  };

  const filled = trades.filter(t => t.status === "filled");
  const totalProfit = filled.reduce((s, t) => s + (t.net_profit_usd || 0), 0);

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={styles.title}>TRADE LOG</span>
          <span style={{ fontSize: 10, color: "#6b8aab" }}>
            {trades.length} trades · profit: {" "}
            <span style={{ color: totalProfit >= 0 ? "#00d395" : "#ff3b6b" }}>
              {fmtUSD(totalProfit, 4)}
            </span>
          </span>
        </div>
      </div>

      {trades.length === 0 ? (
        <div style={styles.empty}>
          <span style={{ color: "#3d5a78" }}>Sin trades ejecutados</span>
          <span style={{ color: "#1a2d42", fontSize: 10 }}>esperando oportunidades…</span>
        </div>
      ) : (
        <div style={styles.list}>
          {trades.map((t) => {
            const s = STATUS_STYLE[t.status] || STATUS_STYLE.pending;
            const profit = t.net_profit_usd || 0;
            return (
              <div key={t.id} style={{ ...styles.row, animation: "slide-in 0.25s ease-out" }}>
                {/* Timestamp + ID */}
                <div style={styles.meta}>
                  <span style={styles.tradeId}>#{t.id}</span>
                  <span style={styles.tradeTime}>{fmtTime(t.timestamp)}</span>
                </div>

                {/* Route */}
                <div style={styles.route}>
                  <ExChip name={t.buy_exchange} />
                  <span style={{ color: "#3d5a78", fontSize: 12 }}>→</span>
                  <ExChip name={t.sell_exchange} />
                </div>

                {/* Prices */}
                <div style={styles.prices}>
                  <span style={{ color: "#ff3b6b", fontSize: 10 }}>
                    {fmtUSD(t.buy_price, 0)}
                  </span>
                  <span style={{ color: "#3d5a78", fontSize: 9 }}>→</span>
                  <span style={{ color: "#00d395", fontSize: 10 }}>
                    {fmtUSD(t.sell_price, 0)}
                  </span>
                </div>

                {/* Profit */}
                <div style={styles.profit}>
                  <span style={{
                    fontFamily: "'Bebas Neue'", fontSize: 16, letterSpacing: 0.5,
                    color: profit >= 0 ? "#00d395" : "#ff3b6b",
                  }}>
                    {fmtUSD(profit, 4)}
                  </span>
                  <span style={{ fontSize: 9, color: "#3d5a78" }}>{fmtPct(t.net_profit_pct, 3)}</span>
                </div>

                {/* Status badge */}
                <div style={{
                  padding: "2px 6px", borderRadius: 2, fontSize: 9,
                  fontWeight: 600, letterSpacing: 1,
                  background: s.bg, color: s.color,
                  minWidth: 50, textAlign: "center",
                }}>
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExChip({ name }) {
  const COLORS = {
    binance:  "#F0B90B", kraken: "#8B78F7", coinbase: "#4D8BFF",
  };
  return (
    <span style={{
      fontSize: 9, color: COLORS[name] || "#6b8aab",
      letterSpacing: 0.5, fontWeight: 600,
    }}>
      {EXCHANGE_LABELS[name] || name}
    </span>
  );
}

const styles = {
  root: { display: "flex", flexDirection: "column", gap: 8 },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    paddingBottom: 8, borderBottom: "1px solid #1a2d42",
  },
  title: { fontSize: 9, color: "#3d5a78", letterSpacing: 2, textTransform: "uppercase" },
  empty: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 4, padding: "24px 0",
  },
  list: {
    display: "flex", flexDirection: "column", gap: 4,
    maxHeight: 400, overflowY: "auto",
  },
  row: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "8px 10px",
    background: "#0a1220", borderRadius: 3,
    border: "1px solid #1a2d42",
    flexWrap: "wrap",
  },
  meta: { display: "flex", flexDirection: "column", minWidth: 60 },
  tradeId: { fontSize: 9, color: "#3d5a78", fontFamily: "'IBM Plex Mono'" },
  tradeTime: { fontSize: 9, color: "#6b8aab" },
  route: { display: "flex", alignItems: "center", gap: 5, minWidth: 120 },
  prices: { display: "flex", alignItems: "center", gap: 4, flex: 1 },
  profit: { display: "flex", flexDirection: "column", alignItems: "flex-end" },
};
