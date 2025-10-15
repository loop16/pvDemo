import { NextRequest } from "next/server";
import { UNIVERSE, SUPPORTED_RESOLUTIONS } from "../_universe";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const symbol = new URL(req.url).searchParams.get("symbol") || "";
  const s = UNIVERSE.find(x => x.id === symbol.toUpperCase());
  if (!s) return Response.json({ s: "error", errmsg: "Unknown symbol" }, { status: 404 });

  const meta = {
    name: s.id,
    ticker: s.id,
    description: s.label,
    exchange: s.exchange,
    type: s.type,
    session: s.session,
    timezone: s.timezone,
    minmov: s.minmov,
    pricescale: s.pricescale,
    has_intraday: false,
    has_seconds: false,
    has_daily: true,
    has_weekly_and_monthly: true,
    supported_resolutions: SUPPORTED_RESOLUTIONS,
    data_status: "endofday" as const,
  };
  return Response.json(meta);
}