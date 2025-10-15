import { NextRequest } from "next/server";
import path from "path";
import { promises as fs } from "fs";
export const runtime = "nodejs"; // allow fs

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawSym = (searchParams.get("symbol") || "SPY").toUpperCase();
  // Bars alias map so SPX/NDX/BTC resolve to existing files
  const alias: Record<string,string> = {
    SPX: 'ES',
    NDX: 'NQ',
    BTC: 'BTCUSD',
  };
  const symbol = alias[rawSym] ?? rawSym;
  const file = path.join(process.cwd(), "public", "mock", "ohlcv", `${symbol}.json`);

  try {
    const json = await fs.readFile(file, "utf-8");
    
    // Validate JSON before returning
    try {
      const data = JSON.parse(json);
      return Response.json(data, {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=60, s-maxage=60"
        }
      });
    } catch (parseError) {
      console.error('Invalid JSON in file:', file, parseError);
      return Response.json([], { status: 500 });
    }
  } catch (fileError) {
    console.error('File read error:', file, fileError);
    return Response.json([], { status: 404 });
  }
}

