import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function safeFilePart(input: string) {
  return String(input || "unknown")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 80);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const consentEnabled = Boolean(body?.consent?.supportTelemetryEnabled);
    if (!consentEnabled) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const createdAt = new Date().toISOString();
    const gameKey = safeFilePart(body?.game?.key || "unknown_game");
    const sessionId = safeFilePart(body?.sessionId || "unknown_session");
    const eventType = safeFilePart(body?.eventType || "snapshot");

    const snapshotsRoot = path.join(process.cwd(), "support-snapshots");
    ensureDir(snapshotsRoot);

    const fileName = `${createdAt
      .replace(/[:.]/g, "-")}-${gameKey}-${eventType}-${sessionId}.json`;

    const fullPath = path.join(snapshotsRoot, fileName);

    fs.writeFileSync(fullPath, JSON.stringify(body, null, 2), "utf8");

    return NextResponse.json({
      ok: true,
      fileName,
    });
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