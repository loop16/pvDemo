# Daily backend update (local laptop)

This pipeline updates long-history CSVs, generates `levels.json` + `basic_levels.json`, and uploads them to Wasabi.

## Prereqs
- Python 3
- Python packages: `pandas`, `numpy`, `matplotlib`, `tvdatafeed`, `boto3`

Example install:
```
python3 -m pip install pandas numpy matplotlib tvdatafeed boto3
```

## Setup
1) Copy the daily data config and keep it aligned with `Daily data csv`:
```
cp namely-site/backend/daily_data_assets.example.json namely-site/backend/daily_data_assets.json
```
2) Copy the assets file and point it at your daily CSVs (these drive the levels output):
```
cp namely-site/backend/assets.example.json namely-site/backend/assets.json
```
3) Create an env file with your Wasabi credentials:
```
cp namely-site/backend/env.example namely-site/backend/env.local
```
Fill in `TV_USERNAME` and `TV_PASSWORD` in `namely-site/backend/env.local` for TradingView data.
4) Run the job once manually (downloads + analysis + upload):
```
python3 namely-site/backend/qpp_daily_update.py \
  --download \
  --daily-config namely-site/backend/daily_data_assets.json \
  --assets namely-site/backend/assets.json \
  --env namely-site/backend/env.local \
  --output-dir namely-site/data/levels \
  --upload
```

## Security notes
- Use a dedicated Wasabi access key with bucket-limited write access.
- Keep `env.local` out of git (never commit secrets).
- Set your bucket policy for read access if the app should fetch directly.

## Scheduling (17:15 ET)
Launchd runs in the Mac's local timezone. Set your system to America/New_York.

1) Create a logs folder:
```
mkdir -p namely-site/backend/logs
```
2) Copy `namely-site/backend/com.qpp.daily-update.plist` to `~/Library/LaunchAgents/`
3) Replace `__REPO_ROOT__` in the plist with your repo path.
4) Load it:
```
launchctl load -w ~/Library/LaunchAgents/com.qpp.daily-update.plist
```

## Cron alternative
```
15 17 * * * /usr/bin/python3 /ABSOLUTE/PATH/namely-site/backend/qpp_daily_update.py --download --daily-config /ABSOLUTE/PATH/namely-site/backend/daily_data_assets.json --assets /ABSOLUTE/PATH/namely-site/backend/assets.json --env /ABSOLUTE/PATH/namely-site/backend/env.local --output-dir /ABSOLUTE/PATH/namely-site/data/levels --upload >> /ABSOLUTE/PATH/namely-site/backend/logs/daily-update.log 2>&1
```
