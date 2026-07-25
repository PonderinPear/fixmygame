import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getRedisClient() {
  return Redis.fromEnv();
}
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-fmg-device-id",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req: Request) {
  if (
  process.env.NODE_ENV === "development" &&
  (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN)
) {
  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "Support snapshot skipped locally because Redis is not configured.",
  });
}
  try {
    const body = await req.json();

    const consentEnabled = Boolean(body?.consent?.supportTelemetryEnabled);

    if (!consentEnabled) {
      return NextResponse.json(
        { ok: true, skipped: true },
        { headers: corsHeaders }
      );
    }

    const id = crypto.randomUUID();

    const snapshot = {
  id,
  routeVersion: "v2-diagnostic-mapping",

  appVersion:
    body?.appVersion ||
    body?.system?.appVersion ||
    "unknown",

  buildChannel:
    body?.buildChannel ||
    body?.system?.buildChannel ||
    "unknown",

   vid:
  req.headers.get("x-fmg-device-id") ||
  body?.vid ||
  body?.deviceId ||
  body?.system?.vid ||
  body?.system?.deviceId ||
  "unknown",

      betaId:
        body?.betaAccess?.betaId ||
        body?.betaId ||
        "unknown",

      betaEmail:
        body?.betaAccess?.email ||
        body?.betaEmail ||
        "",

      betaVerifiedUntil:
        body?.betaAccess?.verifiedUntil ||
        "",

      sessionId: body?.sessionId || "unknown_session",

      game: body?.game?.key || "unknown",
      gameTitle: body?.game?.title || "Unknown Game",

      eventType: body?.eventType || "snapshot",
      eventDetail: body?.eventDetail || "",

            issue:
        body?.diagnosticSummary?.issue ||
        body?.diagnostic?.analysis?.issue ||
        body?.diagnostic?.result?.resultTitle ||
        body?.diagnostic?.quickSignals?.issue ||
        "",

      cause:
        body?.diagnosticSummary?.cause ||
        body?.diagnostic?.analysis?.mostLikelyCause ||
        body?.diagnostic?.result?.resultText ||
        body?.diagnostic?.quickSignals?.error ||
        "",

      quickFix:
        body?.diagnosticSummary?.quickFix ||
        body?.diagnostic?.analysis?.quickFixFirst ||
        "",

      category:
        body?.diagnosticSummary?.category ||
        body?.diagnostic?.analysis?.likelyCategory ||
        body?.diagnostic?.quickSignals?.likelyCategory ||
        "",

      confidence:
        body?.diagnosticSummary?.confidence ||
        body?.diagnostic?.analysis?.confidence ||
        "",

      probabilityBreakdown:
        body?.diagnosticSummary?.probabilityBreakdown ||
        body?.diagnostic?.analysis?.probabilityBreakdown ||
        [],

      resultTitle:
        body?.diagnosticSummary?.resultTitle ||
        body?.diagnostic?.result?.resultTitle ||
        "",

      resultText:
        body?.diagnosticSummary?.resultText ||
        body?.diagnostic?.result?.resultText ||
        "",

      crashLogFingerprint:
        body?.diagnosticSummary?.crashLogFingerprint ||
        body?.diagnostic?.crashLogFingerprint ||
        "",

      logSnippet: String(body?.diagnostic?.crashLog || "").slice(0, 1200),

      suspectedMods:
        body?.diagnostic?.detectedSignals?.suspectedMods ||
        body?.diagnostic?.liveMods ||
        [],

      system: body?.system || {},
      limits: body?.limits || {},

      createdAt: Date.now(),
      raw: body,
    };

    const redis = getRedisClient();
await redis.set(`snapshot:${snapshot.id}`, snapshot);

    return NextResponse.json(
      { ok: true, id: snapshot.id },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("SNAPSHOT SAVE ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to save support snapshot.",
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}