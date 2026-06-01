"use client";

import { useState } from "react";

type Snapshot = {
  id: string;
  routeVersion?: string;
  vid?: string;
  game?: string;
  gameTitle?: string;
  eventType?: string;
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

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [topIssues, setTopIssues] = useState<{ issue: string; count: number }[]>([]);
  const [topGames, setTopGames] = useState<{ game: string; count: number }[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function loadSnapshots() {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/snapshots", {
        headers: {
          "x-admin-secret": secret,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load snapshots.");
      }

      setSnapshots(data.snapshots || []);
      setTopIssues(data.topIssues || []);
      setTopGames(data.topGames || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load snapshots.");
    } finally {
      setLoading(false);
    }
  }

  function getSnapshotStyle(snap: Snapshot) {
  const source =
    snap.vid === "PUT_YOUR_VID_HERE"
      ? "owner"
      : snap.vid
      ? "beta"
      : "unknown";

  if (source === "owner") {
    return "relative overflow-hidden rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/[0.07] p-4 shadow-[0_0_24px_rgba(217,70,239,0.10)] before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-fuchsia-400";
  }

  if (source === "beta") {
    return "relative overflow-hidden rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.055] p-4 shadow-[0_0_24px_rgba(34,211,238,0.08)] before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-cyan-400";
  }

  return "relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-4 before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-white/10";
}

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <div className="text-xs font-semibold tracking-widest text-cyan-300">
            FIXMYGAME ADMIN
          </div>
          <h1 className="mt-2 text-4xl font-extrabold">Support Dashboard</h1>
          <p className="mt-2 text-white/60">
            View beta tester snapshots, top issues, and crash patterns.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <label className="text-sm text-white/70">Admin Secret</label>
          <div className="mt-2 flex gap-3">
            <input
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              type="password"
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
              placeholder="Paste BETA_ADMIN_SECRET"
            />
            <button
              onClick={loadSnapshots}
              disabled={loading || !secret}
              className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-black disabled:opacity-50"
            >
              {loading ? "Loading..." : "Load"}
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-red-100">
              {error}
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-white/60">Total Snapshots</div>
            <div className="mt-2 text-3xl font-bold">{total}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-white/60">Top Issue</div>
            <div className="mt-2 text-lg font-bold">
              {topIssues[0]?.issue || "None yet"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-white/60">Top Game</div>
            <div className="mt-2 text-lg font-bold">
              {topGames[0]?.game || "None yet"}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="font-bold">Top Issues</h2>
            <div className="mt-4 grid gap-2">
              {topIssues.map((item) => (
                <div key={item.issue} className="rounded-xl bg-black/30 p-3">
                  <div className="font-medium">{item.issue}</div>
                  <div className="text-sm text-white/50">{item.count} snapshot(s)</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="font-bold">Top Games</h2>
            <div className="mt-4 grid gap-2">
              {topGames.map((item) => (
                <div key={item.game} className="rounded-xl bg-black/30 p-3">
                  <div className="font-medium">{item.game}</div>
                  <div className="text-sm text-white/50">{item.count} snapshot(s)</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-bold">Recent Snapshots</h2>

          <div className="mt-4 grid gap-3">
            {snapshots.map((snap) => (
              <div key={snap.id} className={getSnapshotStyle(snap)}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-cyan-200">
                      {snap.gameTitle || snap.game || "Unknown Game"}
                    </div>
                    <div className="text-xs text-yellow-300">
                      VID: {snap.vid || "NO VID"}
                    </div>
                    <div className="mt-1 text-lg font-bold">
                      {snap.issue || "Unknown issue"}
                    </div>
                    <div className="mt-1 text-sm text-white/60">
                      {snap.cause || "No cause recorded"}
                    </div>
                  </div>

                  <button
                    onClick={() => setExpandedId(expandedId === snap.id ? null : snap.id)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                  >
                    {expandedId === snap.id ? "Hide" : "View"}
                  </button>
                </div>

                <div className="mt-3 text-xs text-white/40">
                  {snap.createdAt ? new Date(snap.createdAt).toLocaleString() : "No timestamp"}
                </div>

                {expandedId === snap.id ? (
                  <div className="mt-4 grid gap-3">
                    <div className="rounded-xl bg-white/5 p-3">
                      <div className="text-xs text-white/40">Quick Fix</div>
                      <div className="mt-1">{snap.quickFix || "None"}</div>
                    </div>

                    <div className="rounded-xl bg-white/5 p-3">
                      <div className="text-xs text-white/40">Log Snippet</div>
                      <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap text-sm">
                        {snap.logSnippet || "None"}
                      </pre>
                    </div>

                    <div className="rounded-xl bg-white/5 p-3">
                      <div className="text-xs text-white/40">Raw Snapshot</div>
                      <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap text-xs">
                        {JSON.stringify(snap, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}