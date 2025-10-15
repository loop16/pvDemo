import { NextRequest } from "next/server";
import { UNIVERSE } from "../_universe";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = (new URL(req.url).searchParams.get("query") || "").toUpperCase();
  const rows = UNIVERSE
    .filter(s => s.id.includes(q) || s.label.toUpperCase().includes(q))
    .map(s => ({
      symbol: s.id,
      full_name: s.id,
      description: s.label,
      exchange: s.exchange,
      ticker: s.id,
      type: s.type,
    }));
  return Response.json(rows);
}