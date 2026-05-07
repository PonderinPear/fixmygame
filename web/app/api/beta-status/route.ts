import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const redis = Redis.fromEnv();

export async function GET() {
  let betaOpen = true;
  let redisValue: string | null = null;
  let redisReadError = "";

  try {
    redisValue = await redis.get<string>("beta:open");

    if (redisValue === "1") betaOpen = true;
    if (redisValue === "0") betaOpen = false;
  } catch (error) {
    redisReadError =
      error instanceof Error ? error.message : "Failed to read Redis.";
  }

  return NextResponse.json(
    {
      betaOpen,
      redisValue,
      redisReadError,
      debug: "beta-status-v3-live-redis",
      message: betaOpen
        ? "FixMyGame beta is active."
        : "The FixMyGame beta period has ended. Access is currently closed.",
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}