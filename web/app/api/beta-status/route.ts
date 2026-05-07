import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";

const redis = Redis.fromEnv();

export async function GET() {
  let betaOpen = process.env.BETA_OPEN === "0";

  try {
    const redisValue = await redis.get<string>("beta:open");

    if (redisValue === "1") betaOpen = true;
    if (redisValue === "0") betaOpen = false;
  } catch (error) {
    console.error("Failed to read beta status from Redis:", error);
  }

  return NextResponse.json({
    betaOpen,
    message: betaOpen
      ? "FixMyGame beta is active."
      : "The FixMyGame beta period has ended. Access is currently closed.",
  });
}