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
      vid: body?.vid || "unknown",
      game: body?.game?.key || "unknown",
      issue: body?.analysis?.issue || "",
      cause: body?.analysis?.mostLikelyCause || "",
      logSnippet: (body?.rawLog || "").slice(0, 800),
      createdAt: Date.now(),
    };

    await redis.set(`snapshot:${id}`, snapshot);

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}