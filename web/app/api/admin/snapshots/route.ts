import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export async function GET() {
  const keys = await redis.keys("snapshot:*");

  const snapshots = [];

  for (const key of keys.slice(0, 20)) {
    const data = await redis.get(key);
    snapshots.push(data);
  }

  return NextResponse.json({ snapshots });
}