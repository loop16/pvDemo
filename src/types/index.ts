// Minimal shared types used by client components and API responses

export type OhlcBar = {
  time: number | string; // ISO string or unix seconds used by API
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type LevelLine = {
  name: string; // e.g. "Long_High_20"
  value: number; // price or percent-derived price depending on model
  style?: 'solid' | 'dotted' | 'dashed' | string;
  color?: string;
};

export type Levels = {
  daily: {
    lines: LevelLine[];
  };
  asof?: string;
};

 