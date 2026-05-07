import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const redis = Redis.fromEnv();

export async function GET() {
  let betaOpen = true;

  try {
    const redisValue = await redis.get<string>("beta:open");

    if (redisValue === "1") betaOpen = true;
    if (redisValue === "0") betaOpen = false;
  } catch (error) {
    console.error("Failed to read beta status from Redis:", error);
  }

  return NextResponse.json(
    {
      betaOpen,
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