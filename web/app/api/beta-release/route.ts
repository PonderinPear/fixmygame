import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const redis = Redis.fromEnv();

type BetaTester = {
  betaId: string;
  email: string;
  status?: string;
};

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function getApprovedTesters(): BetaTester[] {
  try {
    const raw = process.env.BETA_TESTERS_JSON || "[]";
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((tester) => ({
        betaId: String(tester?.betaId || "").trim().toUpperCase(),
        email: String(tester?.email || "").trim().toLowerCase(),
        status: String(tester?.status || "active").trim().toLowerCase(),
      }))
      .filter((tester) => tester.betaId && tester.email);
  } catch {
    return [];
  }
}

function findApprovedTester(betaId: string, email: string) {
  const normalizedBetaId = betaId.trim().toUpperCase();
  const normalizedEmail = email.trim().toLowerCase();

  return getApprovedTesters().find(
    (tester) =>
      tester.betaId === normalizedBetaId &&
      tester.email === normalizedEmail &&
      tester.status !== "inactive" &&
      tester.status !== "revoked",
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    const betaId = String(body?.betaId || "").trim().toUpperCase();
    const email = String(body?.email || "").trim().toLowerCase();
    const bodyDeviceId = String(body?.deviceId || "").trim();
    const headerDeviceId = req.headers.get("x-fmg-device-id")?.trim() || "";
    const deviceId = bodyDeviceId || headerDeviceId;

    if (!betaId || !email || !deviceId) {
      return jsonResponse(
        {
          ok: false,
          error: "Beta ID, approved email, and device ID are required.",
        },
        400,
      );
    }

    const tester = findApprovedTester(betaId, email);

    if (!tester) {
      return jsonResponse(
        {
          ok: false,
          error:
            "This Beta ID and email combination is not approved for FixMyGame beta access.",
        },
        403,
      );
    }

    const lockKey = `beta:device-lock:${betaId}`;
    const existingLock = await redis.get<{
      betaId?: string;
      email?: string;
      deviceId?: string;
      lockedAt?: string;
    }>(lockKey);

    if (
      existingLock?.deviceId &&
      existingLock.deviceId !== deviceId
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "This Beta ID is currently locked to another device. Contact FixMyGame support if you need it reset.",
        },
        409,
      );
    }

    await redis.del(lockKey);

    await redis.set(
      `beta:released:${betaId}:${Date.now()}`,
      {
        betaId,
        email,
        deviceId,
        releasedAt: new Date().toISOString(),
      },
      {
        ex: 60 * 60 * 24 * 30,
      },
    );

    return jsonResponse({
      ok: true,
      betaId,
      email,
      deviceId,
      released: true,
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to release beta access from this device.",
      },
      500,
    );
  }
}