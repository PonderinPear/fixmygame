import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

type Snapshot = {
  id?: string;
  routeVersion?: string;
  appVersion?: string;
  buildChannel?: string;
  vid?: string;
  game?: string;
  gameTitle?: string;
  eventType?: string;
  eventDetail?: string;
  issue?: string;
  cause?: string;
  quickFix?: string;
  logSnippet?: string;
  suspectedMods?: string[];
  createdAt?: number;
  system?: Record<string, unknown>;
  limits?: Record<string, unknown>;
  raw?: unknown;
};

export async function GET(req: NextRequest) {
  const adminSecret = req.headers.get("x-admin-secret");

  if (!process.env.BETA_ADMIN_SECRET || adminSecret !== process.env.BETA_ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

    const keys = await redis.keys("snapshot:*");
  const snapshots: Snapshot[] = [];

  for (const key of keys) {
    const data = await redis.get<Snapshot>(key);
    if (data) snapshots.push(data);
  }

    const sortedAll = snapshots.sort((a, b) => {
    return Number(b.createdAt || 0) - Number(a.createdAt || 0);
  });

  const sorted = sortedAll.slice(0, 100);

  const issueCounts: Record<string, number> = {};
  const gameCounts: Record<string, number> = {};
  const versionCounts: Record<string, number> = {};

  for (const snap of sortedAll) {
    const issue = snap.issue || "Unknown issue";
    const game = snap.gameTitle || snap.game || "Unknown game";
    
    const version =
      snap.appVersion ||
      (snap.system?.appVersion as string) ||
      (
  typeof snap.raw === "object" &&
  snap.raw !== null &&
  "appVersion" in snap.raw
    ? String(snap.raw.appVersion)
    : ""
) ||
      "unknown";

    issueCounts[issue] = (issueCounts[issue] || 0) + 1;
    gameCounts[game] = (gameCounts[game] || 0) + 1;
    versionCounts[version] = (versionCounts[version] || 0) + 1;
  }

  return NextResponse.json({
    
  total: snapshots.length,
  showing: sorted.length,

    topIssues: Object.entries(issueCounts)
      .map(([issue, count]) => ({ issue, count }))
      .sort((a, b) => b.count - a.count),

    topGames: Object.entries(gameCounts)
      .map(([game, count]) => ({ game, count }))
      .sort((a, b) => b.count - a.count),

    topVersions: Object.entries(versionCounts)
      .map(([version, count]) => ({ version, count }))
      .sort((a, b) => b.count - a.count),

    snapshots: sorted,
  });
}