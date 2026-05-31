/** utils/format.js — helpers de presentación */

export const fmtUSD = (n, decimals = 2) =>
  n == null ? "—" : `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

export const fmtPct = (n, decimals = 3) =>
  n == null ? "—" : `${Number(n).toFixed(decimals)}%`;

export const fmtBTC = (n) =>
  n == null ? "—" : `${Number(n).toFixed(6)} BTC`;

export const fmtMs = (n) =>
  n == null ? "—" : `${Math.round(n)}ms`;

export const fmtTime = (ts) => {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("en-US", { hour12: false });
};

export const EXCHANGE_COLORS = {
  binance:  { bg: "#F0B90B22", border: "#F0B90B", text: "#F0B90B" },
  kraken:   { bg: "#5741D922", border: "#5741D9", text: "#8B78F7" },
  coinbase: { bg: "#0052FF22", border: "#0052FF", text: "#4D8BFF" },
};

export const EXCHANGE_LABELS = {
  binance:  "Binance",
  kraken:   "Kraken",
  coinbase: "Coinbase",
};
