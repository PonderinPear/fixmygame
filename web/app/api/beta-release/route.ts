import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ApprovedTester = {
  betaId: string;
  email: string;
  status?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-fmg-device-id",
};

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeBetaId(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function getApprovedTesters(): ApprovedTester[] {
  try {
    const raw = process.env.BETA_TESTERS_JSON || "[]";
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((tester) => ({
        betaId: normalizeBetaId(tester?.betaId),
        email: normalizeEmail(tester?.email),
        status: String(tester?.status || "active").trim().toLowerCase(),
      }))
      .filter((tester) => tester.betaId && tester.email);
  } catch (error) {
    console.error("BETA_TESTERS_JSON parse error:", error);
    return [];
  }
}

function getRedisClient() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    if (process.env.NODE_ENV === "development") return null;
    throw new Error("Beta device lock storage is not configured.");
  }

  return Redis.fromEnv();
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const betaId = normalizeBetaId(body?.betaId);
    const email = normalizeEmail(body?.email);
    const deviceId = String(
      req.headers.get("x-fmg-device-id") || body?.deviceId || "",
    ).trim();

    if (!betaId || !email || !deviceId) {
      return NextResponse.json(
        {
          ok: false,
          code: "missing_release_info",
          error: "Missing Beta ID, email, or device ID.",
        },
        { status: 400, headers: corsHeaders },
      );
    }

    const approvedTester = getApprovedTesters().find(
      (tester) =>
        tester.betaId === betaId &&
        tester.email === email &&
        tester.status !== "inactive" &&
        tester.status !== "disabled",
    );

    if (!approvedTester) {
      return NextResponse.json(
        {
          ok: false,
          code: "beta_access_not_found",
          error: "That Beta ID and email are not approved for this beta.",
        },
        { status: 403, headers: corsHeaders },
      );
    }

    const redis = getRedisClient();

    if (!redis) {
      return NextResponse.json(
        {
          ok: true,
          released: true,
          devMode: true,
        },
        { headers: corsHeaders },
      );
    }

    const lockKey = `beta:device-lock:${betaId}`;
    const existingDeviceId = await redis.get<string>(lockKey);

    if (existingDeviceId && existingDeviceId !== deviceId) {
      return NextResponse.json(
        {
          ok: false,
          code: "cannot_release_other_device",
          error:
            "This Beta ID is locked to another device. Contact FixMyGame support to reset it.",
        },
        { status: 403, headers: corsHeaders },
      );
    }

    await redis.del(lockKey);
    await redis.set(`beta:released:${betaId}:${Date.now()}`, {
      betaId,
      email,
      deviceId,
      releasedAt: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        ok: true,
        released: true,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("BETA RELEASE ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        code: "beta_release_failed",
        error:
          error instanceof Error
            ? error.message
            : "Beta access could not be removed from this device.",
      },
      { status: 500, headers: corsHeaders },
    );
  }
}