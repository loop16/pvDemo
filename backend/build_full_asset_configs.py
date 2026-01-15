#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
APP_DIR = (BASE_DIR / "..").resolve()
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from quarterly_and_downloader_bundle import Downloader


DAILY_DIR = (BASE_DIR / ".." / "Daily data csv").resolve()
DAILY_CONFIG = BASE_DIR / "daily_data_assets.json"
ASSETS_CONFIG = BASE_DIR / "assets.json"


def load_existing(path):
    if not path.exists():
        return []
    with path.open("r") as f:
        data = json.load(f)
    if isinstance(data, dict) and "assets" in data:
        return data["assets"]
    if isinstance(data, list):
        return data
    raise ValueError(f"Unexpected config shape in {path}")


def ensure_unique(entries):
    seen = set()
    out = []
    for item in entries:
        key = item.get("tv_symbol") or item.get("asset_name") or item.get("file_path")
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def build_file_path(prefix, symbol):
    name = f"{prefix}_{symbol}, 1D.csv"
    return os.path.join("..", "Daily data csv", name)


FUTURES_LABELS = {
    "ES1!": "S&P 500 E-mini Futures (ES1!)",
    "NQ1!": "Nasdaq 100 E-mini Futures (NQ1!)",
    "YM1!": "Dow Jones Futures (YM1!)",
    "RTY1!": "Russell 2000 Futures (RTY1!)",
    "CL1!": "WTI Crude Oil Futures (CL1!)",
    "NG1!": "Natural Gas Futures (NG1!)",
    "GC1!": "Gold Futures (GC1!)",
    "SI1!": "Silver Futures (SI1!)",
    "HG1!": "Copper Futures (HG1!)",
    "PL1!": "Platinum Futures (PL1!)",
    "ZB1!": "30Y Treasury Bond Futures (ZB1!)",
    "ZN1!": "10Y Treasury Note Futures (ZN1!)",
    "ZF1!": "5Y Treasury Note Futures (ZF1!)",
    "ZT1!": "2Y Treasury Note Futures (ZT1!)",
    "ZC1!": "Corn Futures (ZC1!)",
    "ZS1!": "Soybeans Futures (ZS1!)",
    "ZW1!": "Wheat Futures (ZW1!)",
    "LE1!": "Live Cattle Futures (LE1!)",
    "HE1!": "Lean Hogs Futures (HE1!)",
    "GF1!": "Feeder Cattle Futures (GF1!)",
    "6E1!": "Euro FX Futures (6E1!)",
    "6B1!": "British Pound Futures (6B1!)",
    "6J1!": "Japanese Yen Futures (6J1!)",
    "6A1!": "Australian Dollar Futures (6A1!)",
    "6C1!": "Canadian Dollar Futures (6C1!)",
    "6N1!": "New Zealand Dollar Futures (6N1!)",
    "DX1!": "US Dollar Index Futures (DX1!)",
    "KC1!": "Coffee Futures (KC1!)",
    "SB1!": "Sugar Futures (SB1!)",
    "CC1!": "Cocoa Futures (CC1!)",
    "CT1!": "Cotton Futures (CT1!)",
}

INDEX_LABELS = {
    "SPX": "S&P 500 Index (SPX)",
    "NDX": "Nasdaq 100 Index (NDX)",
    "DJI": "Dow Jones Industrial Average (DJI)",
    "RUT": "Russell 2000 Index (RUT)",
    "VIX": "CBOE Volatility Index (VIX)",
    "HSI": "Hang Seng Index (HSI)",
    "HSCEI": "Hang Seng China Enterprises (HSCEI)",
    "UKX": "FTSE 100 (UKX)",
    "DAX": "DAX 40 (DAX)",
    "CAC40": "CAC 40 (CAC40)",
    "EU50": "Euro Stoxx 50 (EU50)",
    "IBEX": "IBEX 35 (IBEX)",
    "SMI": "Swiss Market Index (SMI)",
    "AEX": "AEX 25 (AEX)",
    "OMXS30": "OMXS30 (OMXS30)",
    "OMXC25": "OMXC25 (OMXC25)",
    "XJO": "ASX 200 (XJO)",
    "NI225": "Nikkei 225 (NI225)",
    "KOSPI": "KOSPI (KOSPI)",
    "NIFTY": "Nifty 50 (NIFTY)",
}

def format_fx_label(symbol):
    if len(symbol) == 6 and symbol.isalpha():
        return f"{symbol[:3]}/{symbol[3:]} (FX)"
    return f"{symbol} (FX)"

def format_crypto_label(symbol):
    if symbol.endswith("USDT") and len(symbol) > 4:
        return f"{symbol[:-4]}/USDT (Crypto)"
    return f"{symbol} (Crypto)"

def resolve_label(symbol, category):
    if symbol in Downloader.SP500_SYMBOLS:
        return f"{Downloader.SP500_SYMBOLS[symbol]} ({symbol})"
    if symbol in FUTURES_LABELS:
        return FUTURES_LABELS[symbol]
    if symbol in INDEX_LABELS:
        return INDEX_LABELS[symbol]
    if category == "fx_top20":
        return format_fx_label(symbol)
    if category == "crypto_top20":
        return format_crypto_label(symbol)
    return symbol


def append_category(entries, symbols, prefix, category):
    existing = {e.get("tv_symbol") for e in entries if e.get("tv_symbol")}
    for sym, exchanges in symbols.items():
        if sym in existing:
            continue
        label = resolve_label(sym, category)
        entries.append(
            {
                "asset_name": sym,
                "file_path": build_file_path(prefix, sym),
                "tv_symbol": sym,
                "tv_exchange": exchanges,
                "label": label,
            }
        )


def main():
    DAILY_DIR.mkdir(parents=True, exist_ok=True)

    daily_entries = load_existing(DAILY_CONFIG)

    append_category(daily_entries, Downloader.FUTURES_TOP30, "FUTURES", "futures_top30")
    append_category(daily_entries, Downloader.CRYPTO_TOP20, "CRYPTO", "crypto_top20")
    append_category(daily_entries, Downloader.FX_TOP20, "FX", "fx_top20")
    append_category(daily_entries, Downloader.INDEX_TOP20, "INDEX", "indices_top20")
    append_category(daily_entries, Downloader.SP500_SYMBOLS_WITH_EXCHANGES, "SP500", "sp500")

    daily_entries = ensure_unique(daily_entries)

    with DAILY_CONFIG.open("w") as f:
        json.dump(daily_entries, f, indent=2)

    assets = []
    seen_assets = set()
    for item in daily_entries:
        asset_name = item.get("asset_name") or item.get("tv_symbol")
        if not asset_name or asset_name in seen_assets:
            continue
        seen_assets.add(asset_name)
        assets.append(
            {
                "asset_name": asset_name,
                "file_path": item["file_path"],
            }
        )

    with ASSETS_CONFIG.open("w") as f:
        json.dump(assets, f, indent=2)

    print(f"Wrote {len(daily_entries)} daily entries to {DAILY_CONFIG}")
    print(f"Wrote {len(assets)} assets to {ASSETS_CONFIG}")


if __name__ == "__main__":
    main()
