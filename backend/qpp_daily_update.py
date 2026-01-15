#!/usr/bin/env python3
import argparse
import json
import os
import sys
import time
import datetime


BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
DEFAULT_OUTPUT_DIR = os.environ.get("QPP_OUTPUT_DIR", os.path.join(BASE_DIR, "data", "levels"))
DEFAULT_ASSETS_PATH = os.environ.get("QPP_ASSET_CONFIG", os.path.join(os.path.dirname(__file__), "assets.json"))
DEFAULT_DAILY_CONFIG_PATH = os.environ.get(
    "QPP_DAILY_CONFIG",
    os.path.join(os.path.dirname(__file__), "daily_data_assets.json"),
)
DEFAULT_DOWNLOAD_BARS = os.environ.get("QPP_DOWNLOAD_BARS", "5000")
DEFAULT_DOWNLOAD_COOLDOWN = os.environ.get("QPP_DOWNLOAD_COOLDOWN", "0.4")


def load_env_file(path):
    if not path:
        return
    if not os.path.exists(path):
        raise FileNotFoundError(f"Env file not found: {path}")
    with open(path, "r") as f:
        for line in f:
            raw = line.strip()
            if not raw or raw.startswith("#") or "=" not in raw:
                continue
            key, value = raw.split("=", 1)
            key = key.strip()
            value = value.strip().strip("'").strip('"')
            if key and key not in os.environ:
                os.environ[key] = value


def load_assets(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"Assets config not found: {path}")
    with open(path, "r") as f:
        data = json.load(f)
    if isinstance(data, dict) and "assets" in data:
        assets = data["assets"]
    elif isinstance(data, list):
        assets = data
    else:
        raise ValueError("Assets config must be a list or an object with an 'assets' key")
    for item in assets:
        if "asset_name" not in item or "file_path" not in item:
            raise ValueError("Each asset needs 'asset_name' and 'file_path'")
    return assets


def resolve_asset_paths(assets, base_dir):
    out = []
    for item in assets:
        resolved = dict(item)
        file_path = item["file_path"]
        if not os.path.isabs(file_path):
            file_path = os.path.abspath(os.path.join(base_dir, file_path))
        resolved["file_path"] = file_path
        out.append(resolved)
    return out


def load_daily_assets(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"Daily data config not found: {path}")
    with open(path, "r") as f:
        data = json.load(f)
    if isinstance(data, dict) and "assets" in data:
        assets = data["assets"]
    elif isinstance(data, list):
        assets = data
    else:
        raise ValueError("Daily data config must be a list or an object with an 'assets' key")
    for item in assets:
        if "file_path" not in item or "tv_symbol" not in item or "tv_exchange" not in item:
            raise ValueError("Each daily asset needs 'file_path', 'tv_symbol', and 'tv_exchange'")
    return assets


def normalize_ohlc_frame(df, drop_weekdays=None):
    import pandas as pd

    cols = {str(c).lower(): c for c in df.columns}
    time_col = cols.get("time") or cols.get("date") or cols.get("datetime")
    open_col = cols.get("open")
    high_col = cols.get("high")
    low_col = cols.get("low")
    close_col = cols.get("close")
    if not time_col or not open_col or not high_col or not low_col or not close_col:
        raise ValueError("Missing required OHLC columns for normalization")

    time_vals = pd.to_datetime(df[time_col], errors="coerce")
    if getattr(time_vals.dt, "tz", None) is not None:
        time_vals = time_vals.dt.tz_convert(None)
    out = pd.DataFrame(
        {
            "time": time_vals,
            "open": pd.to_numeric(df[open_col], errors="coerce"),
            "high": pd.to_numeric(df[high_col], errors="coerce"),
            "low": pd.to_numeric(df[low_col], errors="coerce"),
            "close": pd.to_numeric(df[close_col], errors="coerce"),
        }
    )
    out = out.dropna(subset=["time"])
    if drop_weekdays:
        out = out[~out["time"].dt.weekday.isin(drop_weekdays)]
    out["time"] = out["time"].dt.strftime("%Y-%m-%d")
    out = out.dropna(subset=["time", "open", "high", "low", "close"])
    out = out.drop_duplicates(subset=["time"], keep="last").sort_values("time")
    return out


def update_daily_csvs(config_path, n_bars, cooldown, only_missing=False):
    import pandas as pd
    from quarterly_and_downloader_bundle import Downloader

    assets = load_daily_assets(config_path)
    assets = resolve_asset_paths(assets, os.path.dirname(config_path))

    for idx, item in enumerate(assets, start=1):
        tv_symbol = item["tv_symbol"]
        tv_exchange = item["tv_exchange"]
        file_path = item["file_path"]
        label = item.get("asset_name") or tv_symbol
        item_bars = int(item.get("n_bars", n_bars))
        item_cooldown = float(item.get("cooldown", cooldown))

        print(f"[daily {idx:02d}/{len(assets)}] Fetching {tv_exchange}:{tv_symbol} -> {label}")
        df_new, used_exch = Downloader.fetch_symbol(
            Downloader.tv,
            tv_symbol,
            tv_exchange,
            n_bars=item_bars,
        )
        if df_new is None or df_new.empty:
            print(f"   -> No data returned for {tv_symbol}")
            time.sleep(item_cooldown)
            continue

        drop_weekdays = None
        if str(tv_exchange).upper().startswith("CME"):
            drop_weekdays = {6}
        try:
            new_norm = normalize_ohlc_frame(df_new, drop_weekdays=drop_weekdays)
        except ValueError as exc:
            print(f"   -> Skipped {tv_symbol}: {exc}")
            time.sleep(item_cooldown)
            continue

        existing_rows = 0
        if os.path.exists(file_path):
            if only_missing:
                print(f"   -> Skipped (exists) {os.path.basename(file_path)}")
                time.sleep(item_cooldown)
                continue
            try:
                existing = pd.read_csv(file_path)
                existing_norm = normalize_ohlc_frame(existing, drop_weekdays=drop_weekdays)
                existing_rows = len(existing_norm)
            except Exception as exc:
                # Avoid clobbering history if the existing file cannot be parsed.
                print(f"   -> Skipped {os.path.basename(file_path)}: failed to read existing CSV ({exc})")
                time.sleep(item_cooldown)
                continue

            merged = pd.concat([existing_norm, new_norm], ignore_index=True)
            merged = merged.drop_duplicates(subset=["time"], keep="last").sort_values("time")
        else:
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            merged = new_norm

        if existing_rows and len(merged) < existing_rows:
            print(f"   -> Skipped write for {os.path.basename(file_path)}: merged rows smaller than existing history")
            time.sleep(item_cooldown)
            continue

        merged.to_csv(file_path, index=False)
        print(f"   -> Updated {os.path.basename(file_path)} via {used_exch or 'default'} ({len(merged)} rows)")
        time.sleep(item_cooldown)


def run_analysis(assets, output_dir):
    from quarterly_and_downloader_bundle.Multi_Asset_Quarterly_Analysis import process_multiple_assets

    process_multiple_assets(assets, output_dir=output_dir)


def upload_json_files(output_dir, dry_run=False):
    try:
        import boto3
    except ImportError as exc:
        raise RuntimeError("Missing boto3. Run: python3 -m pip install boto3") from exc

    bucket = os.environ.get("WASABI_BUCKET")
    access_key = os.environ.get("WASABI_ACCESS_KEY_ID")
    secret_key = os.environ.get("WASABI_SECRET_ACCESS_KEY")
    endpoint = os.environ.get("WASABI_ENDPOINT", "https://s3.us-east-1.wasabisys.com")
    region = os.environ.get("WASABI_REGION", "us-east-1")
    prefix = os.environ.get("WASABI_PREFIX", "levels").strip("/")

    missing = [k for k, v in [
        ("WASABI_BUCKET", bucket),
        ("WASABI_ACCESS_KEY_ID", access_key),
        ("WASABI_SECRET_ACCESS_KEY", secret_key),
    ] if not v]
    if missing:
        raise RuntimeError(f"Missing Wasabi env vars: {', '.join(missing)}")

    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )

    files = []
    for root, _dirs, filenames in os.walk(output_dir):
        for name in filenames:
            if name.endswith(".json"):
                files.append(os.path.join(root, name))
    files.sort()
    if not files:
        raise RuntimeError(f"No JSON files found in {output_dir}")

    for local_path in files:
        rel_path = os.path.relpath(local_path, output_dir).replace(os.sep, "/")
        key = f"{prefix}/{rel_path}" if prefix else rel_path
        if dry_run:
            print(f"[dry-run] Upload {local_path} -> s3://{bucket}/{key}")
            continue
        s3.upload_file(
            local_path,
            bucket,
            key,
            ExtraArgs={
                "ContentType": "application/json",
                "CacheControl": "public, max-age=300",
            },
        )
        print(f"Uploaded {local_path} -> s3://{bucket}/{key}")


def write_ohlcv_json(assets, output_dir):
    import pandas as pd

    out_dir = os.path.join(output_dir, "ohlcv", "symbols")
    os.makedirs(out_dir, exist_ok=True)

    for item in assets:
        symbol = str(item.get("asset_name") or "").upper()
        file_path = item.get("file_path")
        if not symbol or not file_path:
            continue
        if not os.path.exists(file_path):
            print(f"   -> Missing CSV for {symbol}: {file_path}")
            continue
        try:
            df = pd.read_csv(file_path)
            basename = os.path.basename(file_path)
            drop_weekdays = {6} if basename.startswith(("CME_", "CME_MINI_")) else None
            normalized = normalize_ohlc_frame(df, drop_weekdays=drop_weekdays)
        except Exception as exc:
            print(f"   -> Skipped {symbol}: {exc}")
            continue

        records = normalized.to_dict(orient="records")
        out_path = os.path.join(out_dir, f"{symbol}.json")
        with open(out_path, "w") as f:
            json.dump(records, f, indent=2)
        print(f"   -> Wrote OHLCV JSON {symbol} ({len(records)} rows)")


def write_symbol_level_files(output_dir):
    label_map = {}
    daily_config = DEFAULT_DAILY_CONFIG_PATH
    if os.path.exists(daily_config):
        try:
            with open(daily_config, "r") as f:
                data = json.load(f)
            entries = data.get("assets") if isinstance(data, dict) else data
            if isinstance(entries, list):
                for entry in entries:
                    sym = (entry.get("asset_name") or entry.get("tv_symbol") or "").upper()
                    label = entry.get("label")
                    if sym and label:
                        label_map[sym] = label
        except Exception as exc:
            print(f"Failed to read labels from {daily_config}: {exc}")

    candidates = ["levels.json", "basic_levels.json", "detailed_levels.json"]
    symbols_for_index = None
    levels_path = os.path.join(output_dir, "levels.json")
    if os.path.exists(levels_path):
        with open(levels_path, "r") as f:
            levels_data = json.load(f)
        if isinstance(levels_data, dict):
            symbols_for_index = sorted(str(k) for k in levels_data.keys())

    for name in candidates:
        path = os.path.join(output_dir, name)
        if not os.path.exists(path):
            continue
        with open(path, "r") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            continue
        for symbol, payload in data.items():
            symbol_dir = os.path.join(output_dir, "symbols", str(symbol))
            os.makedirs(symbol_dir, exist_ok=True)
            out_path = os.path.join(symbol_dir, name)
            with open(out_path, "w") as out:
                json.dump(payload, out, indent=2)

    if symbols_for_index:
        index_path = os.path.join(output_dir, "symbols", "index.json")
        os.makedirs(os.path.dirname(index_path), exist_ok=True)
        index_payload = [{"id": sym, "label": label_map.get(sym, sym)} for sym in symbols_for_index]
        with open(index_path, "w") as out:
            json.dump(index_payload, out, indent=2)


def main():
    parser = argparse.ArgumentParser(description="Generate levels JSON and upload to Wasabi.")
    parser.add_argument("--assets", default=DEFAULT_ASSETS_PATH, help="Path to assets JSON config.")
    parser.add_argument("--output-dir", default=DEFAULT_OUTPUT_DIR, help="Output directory for JSON files.")
    parser.add_argument("--env", default="", help="Optional env file (KEY=VALUE per line).")
    parser.add_argument("--download", action="store_true", help="Update daily CSVs using Downloader.py.")
    parser.add_argument("--download-only-missing", action="store_true", help="Only download symbols missing a CSV.")
    parser.add_argument("--daily-config", default=DEFAULT_DAILY_CONFIG_PATH, help="Daily CSV update config.")
    parser.add_argument("--download-bars", default=DEFAULT_DOWNLOAD_BARS, help="Bars to fetch per symbol.")
    parser.add_argument("--download-cooldown", default=DEFAULT_DOWNLOAD_COOLDOWN, help="Delay between requests in seconds.")
    parser.add_argument("--upload", action="store_true", help="Upload JSON files to Wasabi.")
    parser.add_argument("--skip-analysis", action="store_true", help="Skip analysis and only upload.")
    parser.add_argument("--write-ohlcv", action="store_true", help="Write OHLCV JSON files from CSVs.")
    parser.add_argument("--dry-run", action="store_true", help="Show upload actions without sending files.")
    parser.add_argument("--log-file", default="", help="Write stdout/stderr to this file.")

    args = parser.parse_args()

    if args.log_file:
        os.makedirs(os.path.dirname(args.log_file), exist_ok=True)
        log_fh = open(args.log_file, "a", buffering=1)
        sys.stdout = log_fh
        sys.stderr = log_fh
        print(f"\n=== Log started {datetime.datetime.now().isoformat()} ===")

    load_env_file(args.env)

    if args.download:
        daily_config = args.daily_config
        if not os.path.exists(daily_config):
            fallback = os.path.join(os.path.dirname(__file__), "daily_data_assets.example.json")
            if os.path.exists(fallback):
                print(f"Daily config not found, falling back to {fallback}")
                daily_config = fallback
            else:
                raise FileNotFoundError(f"Daily data config not found: {daily_config}")

        update_daily_csvs(
            daily_config,
            n_bars=int(float(args.download_bars)),
            cooldown=float(args.download_cooldown),
            only_missing=args.download_only_missing,
        )

    assets_path = args.assets
    if not os.path.exists(assets_path):
        fallback = os.path.join(os.path.dirname(__file__), "assets.example.json")
        if os.path.exists(fallback):
            print(f"Assets config not found, falling back to {fallback}")
            assets_path = fallback
        else:
            raise FileNotFoundError(f"Assets config not found: {assets_path}")

    assets = None
    if not args.skip_analysis:
        assets = load_assets(assets_path)
        assets = resolve_asset_paths(assets, os.path.dirname(assets_path))
        os.makedirs(args.output_dir, exist_ok=True)
        run_analysis(assets, args.output_dir)

    if args.write_ohlcv:
        if assets is None:
            assets = load_assets(assets_path)
            assets = resolve_asset_paths(assets, os.path.dirname(assets_path))
        os.makedirs(args.output_dir, exist_ok=True)
        write_ohlcv_json(assets, args.output_dir)

    if args.upload:
        write_symbol_level_files(args.output_dir)
        upload_json_files(args.output_dir, dry_run=args.dry_run)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
