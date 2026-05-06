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
      sessionId: body?.sessionId || "unknown_session",
      eventType: body?.eventType || "snapshot",
      eventDetail: body?.eventDetail || "",
      game: body?.game?.key || "unknown",
      gameTitle: body?.game?.title || "Unknown Game",
      issue: body?.diagnostic?.analysis?.issue || "",
      cause: body?.diagnostic?.analysis?.mostLikelyCause || "",
      quickFix: body?.diagnostic?.analysis?.quickFixFirst || "",
      suspectedMods:
        body?.diagnostic?.detectedSignals?.suspectedMods ||
        body?.diagnostic?.liveMods ||
        [],
      logSnippet: String(body?.diagnostic?.crashLog || "").slice(0, 1200),
      system: body?.system || {},
      limits: body?.limits || {},
      createdAt: Date.now(),
      raw: body,
    };

    await redis.set(`snapshot:${id}`, snapshot);

    return NextResponse.json({ ok: true, id });
  } catch (error) {
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