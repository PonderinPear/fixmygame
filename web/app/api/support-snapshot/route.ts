import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const consentEnabled = Boolean(body?.consent?.supportTelemetryEnabled);

    if (!consentEnabled) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const id = crypto.randomUUID();

    const snapshot = {
      id,

      routeVersion: "v2-diagnostic-mapping",
      
      // identity
      vid: body?.vid || "unknown",
      sessionId: body?.sessionId || "unknown_session",

      // game info
      game: body?.game?.key || "unknown",
      gameTitle: body?.game?.title || "Unknown Game",

      // event
      eventType: body?.eventType || "snapshot",
      eventDetail: body?.eventDetail || "",

      // 🔥 THIS IS THE IMPORTANT FIX
      issue: body?.diagnostic?.analysis?.issue || "",
      cause: body?.diagnostic?.analysis?.mostLikelyCause || "",
      quickFix: body?.diagnostic?.analysis?.quickFixFirst || "",

      // logs + mods
      logSnippet: String(body?.diagnostic?.crashLog || "").slice(0, 1200),
      suspectedMods:
        body?.diagnostic?.detectedSignals?.suspectedMods ||
        body?.diagnostic?.liveMods ||
        [],

      // system + limits
      system: body?.system || {},
      limits: body?.limits || {},

      createdAt: Date.now(),

      // full raw (for debugging later)
      raw: body,
    };

    await redis.set(`snapshot:${id}`, snapshot);

    return NextResponse.json({ ok: true, id });
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
      { status: 500 }
    );
  }
}