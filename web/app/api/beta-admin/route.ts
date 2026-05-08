import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";

const redis = Redis.fromEnv();

export async function POST(request: NextRequest) {
  const adminSecret = request.headers.get("x-beta-admin-secret");

  if (!process.env.BETA_ADMIN_SECRET) {
    return NextResponse.json(
      { error: "Missing BETA_ADMIN_SECRET on server." },
      { status: 500 }
    );
  }

  if (adminSecret !== process.env.BETA_ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const betaOpen = body?.betaOpen === true;

  await redis.set("beta:open", betaOpen ? "1" : "0");

  return NextResponse.json({
    success: true,
    betaOpen,
    message: betaOpen
      ? "FixMyGame beta is now open."
      : "FixMyGame beta is now closed.",
  });
}