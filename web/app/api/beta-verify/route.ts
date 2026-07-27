import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const VERIFY_DAYS = 7;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-fmg-device-id",
};

type ApprovedTester = {
  betaId: string;
  email: string;
  status?: string;
};

function getRedisClient() {
  return Redis.fromEnv();
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeBetaId(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function isValidBetaId(betaId: string) {
  return /^FMG-\d{4}$/.test(betaId);
}

function getApprovedTesters(): ApprovedTester[] {
  const raw = process.env.BETA_TESTERS_JSON || "[]";

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((tester) => ({
        betaId: normalizeBetaId(tester?.betaId),
        email: normalizeEmail(tester?.email),
        status: String(tester?.status || "active").toLowerCase(),
      }))
      .filter((tester) => tester.betaId && tester.email);
  } catch (error) {
    console.error("Invalid BETA_TESTERS_JSON:", error);
    return [];
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const email = normalizeEmail(body?.email);
    const betaId = normalizeBetaId(body?.betaId);
    const deviceId =
      req.headers.get("x-fmg-device-id") ||
      String(body?.deviceId || "").trim();

    if (!email || !betaId || !deviceId) {
      return NextResponse.json(
        {
          ok: false,
          code: "missing_beta_access_info",
          error: "Enter your approved beta email and Beta ID.",
        },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!isValidBetaId(betaId)) {
      return NextResponse.json(
        {
          ok: false,
          code: "invalid_beta_id_format",
          error: "Beta ID should look like FMG-0001.",
        },
        { status: 400, headers: corsHeaders },
      );
    }

    const approvedTesters = getApprovedTesters();

    const approvedTester = approvedTesters.find(
      (tester) =>
        tester.betaId === betaId &&
        tester.email === email &&
        String(tester.status || "active").toLowerCase() === "active",
    );

    if (!approvedTester) {
      return NextResponse.json(
        {
          ok: false,
          code: "beta_access_not_approved",
          error:
            "This Beta ID and email combination is not approved for FixMyGame beta access.",
        },
        { status: 403, headers: corsHeaders },
      );
    }

    const redis = getRedisClient();
    const deviceLockKey = `beta:device-lock:${betaId}`;
    const existingDeviceId = await redis.get<string>(deviceLockKey);

    if (existingDeviceId && existingDeviceId !== deviceId) {
      return NextResponse.json(
        {
          ok: false,
          code: "beta_id_locked_to_other_device",
          error:
            "This Beta ID is already active on another device. If this is your new device, contact FixMyGame support to reset beta access.",
        },
        { status: 403, headers: corsHeaders },
      );
    }

    const now = new Date();
    const verifiedUntil = new Date(
      now.getTime() + VERIFY_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    await redis.set(deviceLockKey, deviceId);

    await redis.set(`beta:last-seen:${betaId}`, {
      betaId,
      email,
      deviceId,
      lastSeenAt: now.toISOString(),
      verifiedUntil,
    });

    return NextResponse.json(
      {
        ok: true,
        betaId,
        email,
        deviceId,
        verifiedUntil,
        deviceLocked: true,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("BETA VERIFY ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        code: "beta_verify_failed",
        error:
          "Beta verification is temporarily unavailable. Please try again in a few minutes.",
      },
      { status: 503, headers: corsHeaders },
    );
  }
}