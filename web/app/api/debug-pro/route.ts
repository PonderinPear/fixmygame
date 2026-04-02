import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { getVidFromRequest } from "@/lib/pro";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    console.log("DEBUG ROUTE HIT");

    const headerVid = req.headers.get("x-fmg-device-id")?.trim() || null;
    const cookieVid = req.cookies.get("vid")?.value || null;
    const cookiePro = req.cookies.get("fmg_pro")?.value || null;

    const resolvedVid = getVidFromRequest(req);

    let redisPro = null;
    if (resolvedVid) {
      const redis = await getRedis();
      redisPro = await redis.get(`pro:${resolvedVid}`);
    }

    return NextResponse.json({
      headerVid,
      cookieVid,
      cookiePro,
      resolvedVid,
      redisPro,
    });

  } catch (error) {
    console.error("❌ DEBUG ROUTE ERROR:", error);

    return NextResponse.json(
      {
        error: "debug-pro failed",
        detail: error instanceof Error ? error.message : "unknown error",
      },
      { status: 500 }
    );
  }
}