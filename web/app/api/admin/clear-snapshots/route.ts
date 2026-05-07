import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export async function POST(req: NextRequest) {
  try {
    const adminSecret = req.headers.get("x-admin-secret");

    if (adminSecret !== process.env.BETA_ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const keys = await redis.keys("snapshot:*");

    for (const key of keys) {
      await redis.del(key);
    }

    return NextResponse.json({
      ok: true,
      deleted: keys.length,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Failed to clear snapshots" },
      { status: 500 }
    );
  }
}