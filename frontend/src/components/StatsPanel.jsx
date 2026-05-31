/** components/StatsPanel.jsx */
import { useEffect, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fmtUSD, fmtPct, EXCHANGE_LABELS } from "../utils/format";

export default function StatsPanel({ stats, wallets, trades }) {
  // Construir serie histórica de P&L acumulado
  const pnlHistory = trades
    .filter(t => t.status === "filled")
    .slice()
    .reverse()
    .reduce((acc, t) => {
      const prev = acc.length ? acc[acc.length - 1].pnl : 0;
      acc.push({
        time: new Date(t.timestamp * 1000).toLocaleTimeString("en-US", { hour12: false }),
        pnl: prev + (t.net_profit_usd || 0),
      });
      return acc;
    }, []);

  const profit = stats.total_profit_usd || 0;
  const winRate = stats.win_rate_pct || 0;
  const isPositive = profit >= 0;

  return (
    <div style={styles.root}>
      {/* P&L total */}
      <div style={styles.pnlBlock}>
        <span style={styles.pnlLabel}>P&L ACUMULADO</span>
        <span style={{
          ...styles.pnlValue,
          color: isPositive ? "#00d395" : "#ff3b6b",
          textShadow: isPositive ? "0 0 20px #00d39550" : "0 0 20px #ff3b6b50",
        }}>
          {fmtUSD(profit, 4)}
        </span>
      </div>

      {/* Métricas grid */}
      <div style={styles.metricsGrid}>
        <MetricCard label="TOTAL TRADES" value={stats.total_trades ?? 0} />
        <MetricCard label="WIN RATE" value={fmtPct(winRate, 1)} color={winRate >= 70 ? "#00d395" : "#f59e0b"} />
        <MetricCard label="FILLED" value={stats.filled_trades ?? 0} color="#00d395" />
        <MetricCard label="FAILED" value={stats.failed_trades ?? 0} color="#ff3b6b" />
      </div>

      {/* Gráfico */}
      {pnlHistory.length >= 2 && (
        <div style={styles.chartSection}>
          <span style={styles.sectionTitle}>P&L HISTÓRICO</span>
          <div style={{ height: 100 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pnlHistory} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isPositive ? "#00d395" : "#ff3b6b"} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={isPositive ? "#00d395" : "#ff3b6b"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" tick={{ fill: "#3d5a78", fontSize: 8 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "#3d5a78", fontSize: 8 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "#0a1220", border: "1px solid #1a2d42", fontSize: 11 }}
                  labelStyle={{ color: "#6b8aab" }}
                  formatter={(v) => [fmtUSD(v, 4), "P&L"]}
                />
                <Area
                  type="monotone" dataKey="pnl"
                  stroke={isPositive ? "#00d395" : "#ff3b6b"}
                  strokeWidth={1.5}
                  fill="url(#pnlGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Wallets */}
      <div>
        <span style={styles.sectionTitle}>WALLETS SIMULADAS</span>
        <div style={styles.wallets}>
          {Object.entries(wallets).map(([ex, balances]) => (
            <div key={ex} style={styles.walletCard}>
              <span style={styles.walletEx}>{EXCHANGE_LABELS[ex] || ex}</span>
              <div style={styles.walletBalances}>
                {Object.entries(balances).map(([asset, amount]) => (
                  <div key={asset} style={styles.walletRow}>
                    <span style={styles.asset}>{asset}</span>
                    <span style={styles.amount}>
                      {asset === "USDT" ? fmtUSD(amount, 2) : `${amount.toFixed(6)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div style={styles.metricCard}>
      <span style={styles.metricLabel}>{label}</span>
      <span style={{ ...styles.metricValue, color: color || "#e2eaf4" }}>{value}</span>
    </div>
  );
}

const styles = {
  root: { display: "flex", flexDirection: "column", gap: 16 },
  pnlBlock: { display: "flex", flexDirection: "column", gap: 2 },
  pnlLabel: { fontSize: 9, color: "#3d5a78", letterSpacing: 2, textTransform: "uppercase" },
  pnlValue: { fontFamily: "'Bebas Neue'", fontSize: 36, letterSpacing: 2, lineHeight: 1 },
  metricsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 },
  metricCard: {
    background: "#0a1220", border: "1px solid #1a2d42", borderRadius: 4,
    padding: "8px 10px", display: "flex", flexDirection: "column", gap: 2,
  },
  metricLabel: { fontSize: 8, color: "#3d5a78", letterSpacing: 1 },
  metricValue: { fontSize: 18, fontFamily: "'Bebas Neue'", letterSpacing: 1 },
  chartSection: { display: "flex", flexDirection: "column", gap: 6 },
  sectionTitle: { fontSize: 9, color: "#3d5a78", letterSpacing: 2, textTransform: "uppercase" },
  wallets: { display: "flex", flexDirection: "column", gap: 6, marginTop: 6 },
  walletCard: {
    background: "#0a1220", border: "1px solid #1a2d42", borderRadius: 4,
    padding: "8px 10px",
  },
  walletEx: { fontSize: 9, color: "#6b8aab", letterSpacing: 1, display: "block", marginBottom: 4 },
  walletBalances: { display: "flex", flexDirection: "column", gap: 2 },
  walletRow: { display: "flex", justifyContent: "space-between" },
  asset: { fontSize: 10, color: "#3d5a78" },
  amount: { fontSize: 11, color: "#e2eaf4", fontWeight: 500 },
};
