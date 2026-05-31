/** App.jsx */
import "./styles/global.css";
import { useArbitrageWS } from "./hooks/useArbitrageWS";
import Header from "./components/Header";
import PricePanel from "./components/PricePanel";
import OpportunitiesPanel from "./components/OpportunitiesPanel";
import StatsPanel from "./components/StatsPanel";
import TradeLog from "./components/TradeLog";

export default function App() {
  const { connected, latencyMs, orderbook, opportunities, stats, wallets, trades } =
    useArbitrageWS();

  return (
    <div style={styles.app}>
      <Header
        connected={connected}
        latencyMs={latencyMs}
        orderbook={orderbook}
        stats={stats}
      />

      <main style={styles.main}>
        <section style={styles.col}>
          <PricePanel orderbook={orderbook} />
        </section>

        <section style={{ ...styles.col, flex: 2 }}>
          <OpportunitiesPanel opportunities={opportunities} />
          <div style={{ height: 1, background: "#1a2d42", margin: "16px 0" }} />
          <TradeLog trades={trades} />
        </section>

        <section style={styles.col}>
          <StatsPanel stats={stats} wallets={wallets} trades={trades} />
        </section>
      </main>

      {!connected && (
        <div style={styles.offlineBanner}>
          ⚠ Backend desconectado — reconectando…
        </div>
      )}
    </div>
  );
}

const styles = {
  app: { minHeight: "100vh", display: "flex", flexDirection: "column", background: "#060b12" },
  main: { display: "flex", gap: 0, flex: 1, overflow: "hidden" },
  col: {
    flex: 1, padding: 16, borderRight: "1px solid #1a2d42",
    overflowY: "auto", display: "flex", flexDirection: "column", gap: 16,
  },
  offlineBanner: {
    position: "fixed", bottom: 0, left: 0, right: 0,
    background: "#ff3b6b20", border: "1px solid #ff3b6b",
    color: "#ff3b6b", textAlign: "center", padding: "6px",
    fontSize: 11, letterSpacing: 1, zIndex: 200,
  },
};
