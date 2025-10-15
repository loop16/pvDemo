export type TvSymbol = {
  id: string;
  label: string;
  exchange: string;
  type: "futures" | "crypto" | "index" | "equity";
  session: string; // e.g., "24x7"
  timezone: string; // "Etc/UTC"
  minmov: number;
  pricescale: number; // 1 / tick_size
  hasIntraday?: boolean;
};

export const UNIVERSE: TvSymbol[] = [
  { id: "ES",     label: "S&P 500 (E-mini)", exchange: "CME",   type: "futures", session: "24x7", timezone: "Etc/UTC", minmov: 1, pricescale: 4 },   // 0.25 tick
  { id: "NQ",     label: "Nasdaq 100 (E-mini)", exchange: "CME", type: "futures", session: "24x7", timezone: "Etc/UTC", minmov: 1, pricescale: 4 },  // 0.25 tick
  { id: "BTCUSD", label: "Bitcoin / USD", exchange: "CRYPTO",  type: "crypto",  session: "24x7", timezone: "Etc/UTC", minmov: 1, pricescale: 1 },
  { id: "CL",     label: "Crude Oil Futures", exchange: "NYMEX", type: "futures", session: "24x7", timezone: "Etc/UTC", minmov: 1, pricescale: 100 }, // 0.01 tick
  { id: "GC",     label: "Gold Futures", exchange: "COMEX",    type: "futures", session: "24x7", timezone: "Etc/UTC", minmov: 1, pricescale: 10 },   // 0.1 tick
];

export const SUPPORTED_RESOLUTIONS = ["1", "5", "15", "60", "1D"];