import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function getApprovedTesters(): ApprovedTester[] {
  try {
    const parsed = JSON.parse(process.env.BETA_TESTERS_JSON || "[]");

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

    const betaId = normalizeBetaId(body?.betaId);
    const email = normalizeEmail(body?.email);
    const deviceId =
      req.headers.get("x-fmg-device-id") ||
      String(body?.deviceId || "").trim();

    if (!betaId || !email || !deviceId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Beta access must be verified before approval can be saved.",
        },
        { status: 400, headers: corsHeaders },
      );
    }

    const approvedTester = getApprovedTesters().find(
      (tester) =>
        tester.betaId === betaId &&
        tester.email === email &&
        String(tester.status || "active").toLowerCase() === "active",
    );

    if (!approvedTester) {
      return NextResponse.json(
        {
          ok: false,
          error: "This beta account is not approved.",
        },
        { status: 403, headers: corsHeaders },
      );
    }

    const redis = getRedisClient();

    const acceptedAt = new Date().toISOString();

    await redis.set(`beta:authorization:${betaId}`, {
      betaId,
      email,
      accepted: true,
      acceptedAt,
    });

    return NextResponse.json(
      {
        ok: true,
        authorizationAccepted: true,
        acceptedAt,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("BETA AUTHORIZATION ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Unable to save beta approval. Please try again.",
      },
      { status: 503, headers: corsHeaders },
    );
  }
}
