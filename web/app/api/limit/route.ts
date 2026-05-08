import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { isProUser } from "@/lib/pro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const redis = Redis.fromEnv();

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

async function isBetaOpen() {
  const betaValue = await redis.get("beta:open");
  return String(betaValue) === "1";
}

export async function GET(req: NextRequest) {
  try {
    const betaOpen = await isBetaOpen();

    if (betaOpen) {
      return jsonResponse({
        isPro: false,
        remaining: 999,
        limit: 999,
        isBeta: true,
      });
    }

    const redisPro = await isProUser(req);
    const cookiePro = req.cookies.get("fmg_pro")?.value === "1";
    const isPro = redisPro || cookiePro;

    if (isPro) {
      return jsonResponse({
        isPro: true,
        remaining: 999,
        limit: 999,
        isBeta: false,
      });
    }

    const clientKey = getClientKey(req);
    const key = `limit:${today()}:${clientKey}`;

    const raw = await redis.get(key);
    const count = raw ? Number(raw) : 0;

    return jsonResponse({
      isPro: false,
      remaining: Math.max(0, DAILY_LIMIT - count),
      limit: DAILY_LIMIT,
      isBeta: false,
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load usage limit.",
      },
      500
    );
  }
}