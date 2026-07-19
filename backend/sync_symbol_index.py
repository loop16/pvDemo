#!/usr/bin/env python3
"""Build and optionally upload the terminal symbol index from the asset manifest."""

import argparse
import json
import os
import tempfile


BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DEFAULT_MANIFEST = os.path.join(os.path.dirname(__file__), "combined_daily_assets.json")
DEFAULT_OUTPUT = os.path.join(BASE_DIR, "data", "levels", "symbols", "index.json")


def load_env_file(path):
    if not path:
        return
    if not os.path.exists(path):
        raise FileNotFoundError(f"Environment file not found: {path}")
    with open(path, "r", encoding="utf-8") as env_file:
        for line in env_file:
            raw = line.strip()
            if not raw or raw.startswith("#") or "=" not in raw:
                continue
            key, value = raw.split("=", 1)
            key = key.strip()
            value = value.strip().strip("'").strip('"')
            if key and key not in os.environ:
                os.environ[key] = value


def load_manifest(path):
    with open(path, "r", encoding="utf-8") as manifest_file:
        payload = json.load(manifest_file)
    entries = payload.get("assets") if isinstance(payload, dict) else payload
    if not isinstance(entries, list):
        raise ValueError(f"Expected an asset list in {path}")
    return entries


def build_symbol_index(entries):
    symbols = {}
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        symbol = str(entry.get("asset_name") or entry.get("tv_symbol") or "").strip().upper()
        if not symbol:
            continue
        label = str(entry.get("label") or symbol).strip() or symbol
        symbols.setdefault(symbol, {"id": symbol, "label": label})
    return [symbols[symbol] for symbol in sorted(symbols)]


def atomic_write_json(payload, path):
    destination_dir = os.path.dirname(path) or "."
    os.makedirs(destination_dir, exist_ok=True)
    fd, temp_path = tempfile.mkstemp(
        dir=destination_dir,
        prefix=f".{os.path.basename(path)}.",
        suffix=".tmp",
        text=True,
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as output_file:
            json.dump(payload, output_file, indent=2)
            output_file.write("\n")
            output_file.flush()
            os.fsync(output_file.fileno())
        os.replace(temp_path, path)
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)


def upload_index(path, dry_run=False):
    try:
        import boto3
    except ImportError as exc:
        raise RuntimeError("Missing boto3 in the selected Python environment") from exc

    bucket = os.environ.get("WASABI_BUCKET")
    access_key = os.environ.get("WASABI_ACCESS_KEY_ID")
    secret_key = os.environ.get("WASABI_SECRET_ACCESS_KEY")
    endpoint = os.environ.get("WASABI_ENDPOINT", "https://s3.us-east-1.wasabisys.com")
    region = os.environ.get("WASABI_REGION", "us-east-1")
    prefix = os.environ.get("WASABI_PREFIX", "levels").strip("/")
    missing = [
        name
        for name, value in (
            ("WASABI_BUCKET", bucket),
            ("WASABI_ACCESS_KEY_ID", access_key),
            ("WASABI_SECRET_ACCESS_KEY", secret_key),
        )
        if not value
    ]
    if missing:
        raise RuntimeError(f"Missing Wasabi environment values: {', '.join(missing)}")

    key = f"{prefix}/symbols/index.json" if prefix else "symbols/index.json"
    if dry_run:
        print(f"[dry-run] Upload {path} -> s3://{bucket}/{key}")
        return

    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )
    client.upload_file(
        path,
        bucket,
        key,
        ExtraArgs={
            "ContentType": "application/json",
            "CacheControl": "public, max-age=300",
        },
    )
    print(f"Uploaded {path} -> s3://{bucket}/{key}")


def main():
    parser = argparse.ArgumentParser(description="Synchronize the terminal symbol index with an asset manifest.")
    parser.add_argument("--manifest", default=DEFAULT_MANIFEST, help="Asset manifest used as the source of truth.")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="Local symbol index output path.")
    parser.add_argument("--env", default="", help="Optional environment file containing Wasabi credentials.")
    parser.add_argument("--upload", action="store_true", help="Upload symbols/index.json to Wasabi.")
    parser.add_argument("--dry-run", action="store_true", help="Show the upload destination without uploading.")
    args = parser.parse_args()

    load_env_file(args.env)
    entries = load_manifest(args.manifest)
    index = build_symbol_index(entries)
    if not index:
        raise RuntimeError(f"No symbols found in {args.manifest}")
    atomic_write_json(index, args.output)
    print(f"Wrote {len(index)} symbols to {args.output}")

    if args.upload:
        upload_index(args.output, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
