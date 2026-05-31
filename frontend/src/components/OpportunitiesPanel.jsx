/** components/OpportunitiesPanel.jsx */
import { EXCHANGE_LABELS, fmtUSD, fmtPct } from "../utils/format";

export default function OpportunitiesPanel({ opportunities }) {
  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <span style={styles.title}>OPORTUNIDADES</span>
        <span style={{
          ...styles.badge,
          background: opportunities.length ? "#00d39520" : "#1a2d42",
          color: opportunities.length ? "#00d395" : "#3d5a78",
        }}>
          {opportunities.length} detectadas
        </span>
      </div>

      {opportunities.length === 0 ? (
        <div style={styles.empty}>
          <span style={{ color: "#3d5a78" }}>Sin oportunidades rentables</span>
          <span style={{ color: "#1a2d42", fontSize: 10 }}>spread mínimo no alcanzado</span>
        </div>
      ) : (
        <div style={styles.list}>
          {opportunities.map((opp, i) => (
            <OpportunityCard key={i} opp={opp} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function OpportunityCard({ opp, rank }) {
  const profitable = opp.net_profit_pct > 0;
  const hot = opp.net_profit_pct > 0.3;

  return (
    <div style={{
      ...styles.card,
      borderLeft: `3px solid ${hot ? "#00d395" : profitable ? "#00d39560" : "#ff3b6b40"}`,
      boxShadow: hot ? "0 0 12px #00d39520" : "none",
    }}>
      <div style={styles.cardTop}>
        <div style={styles.route}>
          <ExBadge name={opp.buy_exchange} action="BUY" />
          <span style={{ color: "#3d5a78", fontSize: 16 }}>→</span>
          <ExBadge name={opp.sell_exchange} action="SELL" />
        </div>

        <div style={styles.profit}>
          <span style={{
            ...styles.profitPct,
            color: profitable ? "#00d395" : "#ff3b6b",
          }}>
            {fmtPct(opp.net_profit_pct, 3)}
          </span>
          <span style={styles.profitUSD}>{fmtUSD(opp.net_profit_usd, 4)}</span>
        </div>
      </div>

      <div style={styles.details}>
        <Detail label="BUY @ " value={fmtUSD(opp.buy_price)} />
        <Detail label="SELL @" value={fmtUSD(opp.sell_price)} />
        <Detail label="GROSS" value={fmtPct(opp.gross_spread_pct, 3)} />
        <Detail label="FEES" value={`${fmtPct(opp.buy_fee_pct, 2)} + ${fmtPct(opp.sell_fee_pct, 2)}`} />
        <Detail label="VOL" value={`${opp.volume_available?.toFixed(4)} BTC`} />
      </div>
    </div>
  );
}

function ExBadge({ name, action }) {
  const COLORS = {
    binance:  { text: "#F0B90B", bg: "#F0B90B15" },
    kraken:   { text: "#8B78F7", bg: "#5741D915" },
    coinbase: { text: "#4D8BFF", bg: "#0052FF15" },
  };
  const c = COLORS[name] || { text: "#6b8aab", bg: "#1a2d42" };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <span style={{ fontSize: 8, color: "#3d5a78", letterSpacing: 1 }}>{action}</span>
      <span style={{
        fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
        padding: "2px 6px", borderRadius: 3,
        background: c.bg, color: c.text,
      }}>
        {EXCHANGE_LABELS[name] || name}
      </span>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{ fontSize: 8, color: "#3d5a78", letterSpacing: 1 }}>{label}</span>
      <span style={{ fontSize: 11, color: "#6b8aab" }}>{value}</span>
    </div>
  );
}

const styles = {
  root: { display: "flex", flexDirection: "column", gap: 8 },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    paddingBottom: 8, borderBottom: "1px solid #1a2d42",
  },
  title: { fontSize: 9, color: "#3d5a78", letterSpacing: 2, textTransform: "uppercase" },
  badge: { fontSize: 9, padding: "2px 6px", borderRadius: 2, letterSpacing: 1 },
  empty: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 4, padding: "24px 0",
  },
  list: { display: "flex", flexDirection: "column", gap: 6 },
  card: {
    background: "#0a1220", borderRadius: 4,
    border: "1px solid #1a2d42",
    padding: "10px 12px",
    display: "flex", flexDirection: "column", gap: 8,
    animation: "slide-in 0.25s ease-out",
  },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  route: { display: "flex", alignItems: "center", gap: 10 },
  profit: { display: "flex", flexDirection: "column", alignItems: "flex-end" },
  profitPct: { fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: 1, lineHeight: 1 },
  profitUSD: { fontSize: 10, color: "#6b8aab" },
  details: {
    display: "flex", gap: 16, flexWrap: "wrap",
    paddingTop: 6, borderTop: "1px solid #1a2d42",
  },
};
