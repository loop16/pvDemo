import { NextRequest } from "next/server";
import path from "path";
import { promises as fs } from "fs";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "SPY").toUpperCase();
  const model = searchParams.get("model") || "pro";
  
  // Map symbols to the consolidated levels file
  const symbolMap: Record<string, string> = {
    "NQ": "NDX",
    "BTCUSD": "BTC",
    "CL": "CL",
    "GC": "GC",
    "SPX": "SPX",
  };
  
  const mappedSymbol = symbolMap[symbol] || symbol;
  
  // Choose the appropriate levels file based on model
  const levelsFile = model === "simple" 
    ? path.join(process.cwd(), "public", "mock", "levels", "basic_levels.json")
    : path.join(process.cwd(), "public", "mock", "levels", "levels.json");

  try {
    const json = await fs.readFile(levelsFile, "utf-8");
    const allLevels = JSON.parse(json);
    
    if (allLevels[mappedSymbol]) {
      return Response.json(allLevels[mappedSymbol], {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=3600, s-maxage=3600"
        }
      });
    } else {
      return Response.json({ error: "symbol not found" }, { status: 404 });
    }
  } catch (error) {
    console.error('Error reading levels file:', error);
    return Response.json({ error: "not found" }, { status: 404 });
  }
}

