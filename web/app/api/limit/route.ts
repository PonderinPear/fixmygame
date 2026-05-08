import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { isProUser } from "@/lib/pro";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-fmg-device-id",
};

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: corsHeaders,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export const runtime = "nodejs";

const DAILY_LIMIT = 3;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function getClientKey(req: NextRequest) {
  const headerVid = req.headers.get("x-fmg-device-id")?.trim();
  if (headerVid) return `vid:${headerVid}`;

  const cookieVid = req.cookies.get("vid")?.value;
  if (cookieVid) return `vid:${cookieVid}`;

  const xff = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const ip = (xff?.split(",")[0] || realIp || "").trim();

  if (ip) return `ip:${ip}`;
  return `unknown:${crypto.randomUUID()}`;
}

export async function GET(req: NextRequest) {
  const redis = await getRedis();

  // ✅ BETA OVERRIDE (ADD THIS)
  const isBetaOpen = (await redis.get("beta:open")) === "1";

  if (isBetaOpen) {
    return jsonResponse({
      isPro: false,
      remaining: Infinity,
      isBeta: true,
    });
  }

  // existing logic continues...
  const redisPro = await isProUser(req);
  const cookiePro = req.cookies.get("fmg_pro")?.value === "1";

  if (redisPro || cookiePro) {
    return jsonResponse({ isPro: true, remaining: Infinity });
  }

  const clientKey = getClientKey(req);
  const key = `limit:${today()}:${clientKey}`;

  const raw = await redis.get(key);
  const count = raw ? Number(raw) : 0;

  return jsonResponse({
    isPro: false,
    remaining: Math.max(0, DAILY_LIMIT - count),
  });
}