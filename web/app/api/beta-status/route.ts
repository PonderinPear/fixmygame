import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const redis = Redis.fromEnv();

const ACTIVE_BETA_VERSION = "1.0.9";
const BUILD_CHANNEL = "beta";

export async function GET() {
  let betaOpen = true;
  let redisValue: unknown = null;
  let redisReadError = "";

  try {
    redisValue = await redis.get("beta:open");

if (redisValue !== null) {
  betaOpen = String(redisValue) === "1";
}
  } catch (error) {
    redisReadError =
      error instanceof Error ? error.message : "Failed to read Redis.";
  }

  return NextResponse.json(
  {
  betaOpen,
  redisValue,
  redisReadError,
  activeVersion: ACTIVE_BETA_VERSION,
  minimumVersion: ACTIVE_BETA_VERSION,
  buildChannel: BUILD_CHANNEL,
  updateRequired: false,
  debug: "beta-status-v4-version-gate",
  message: betaOpen
    ? "FixMyGame beta is active."
    : "The FixMyGame beta period has ended. Access is currently closed.",
},
  {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Cache-Control": "no-store",
    },
  }
);
}
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}