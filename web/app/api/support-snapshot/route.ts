import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const redis = Redis.fromEnv();

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

      vid: body?.vid || "unknown",
      sessionId: body?.sessionId || "unknown_session",

      game: body?.game?.key || "unknown",
      gameTitle: body?.game?.title || "Unknown Game",

      eventType: body?.eventType || "snapshot",
      eventDetail: body?.eventDetail || "",

      issue: body?.diagnostic?.analysis?.issue || "",
      cause: body?.diagnostic?.analysis?.mostLikelyCause || "",
      quickFix: body?.diagnostic?.analysis?.quickFixFirst || "",

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

    await redis.set(`snapshot:${id}`, snapshot);

    return NextResponse.json(
      { ok: true, id },
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