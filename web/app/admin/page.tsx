"use client";

import { useState } from "react";

type Snapshot = {
  id: string;
  routeVersion?: string;
  appVersion?: string;
  buildChannel?: string;
  vid?: string;

  betaId?: string;
  betaEmail?: string;
  betaVerifiedUntil?: string;

  game?: string;
  gameTitle?: string;
  eventType?: string;
  eventDetail?: string;

  issue?: string;
  cause?: string;
  quickFix?: string;
  category?: string;
  confidence?: string;
  probabilityBreakdown?: string[];
  resultTitle?: string;
  resultText?: string;
  crashLogFingerprint?: string;

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
  const [search, setSearch] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);

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
    snap.vid === "08a45473-d92c-4024-8532-955f777061ba"
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

  function formatSnapshotTime(createdAt?: number) {
    if (!createdAt) return "No timestamp";
    return new Date(createdAt).toLocaleString();
  }

  function getTesterLabel(snap: Snapshot) {
    if (snap.betaId && snap.betaId !== "unknown") {
      return snap.betaEmail
        ? `${snap.betaId} • ${snap.betaEmail}`
        : snap.betaId;
    }

    if (snap.vid === "08a45473-d92c-4024-8532-955f777061ba") {
      return "Owner test";
    }

    if (snap.vid && snap.vid !== "unknown") {
      return "Beta user";
    }

    return "Unknown source";
  }

  function needsAttention(snap: Snapshot) {
    const text = [
      snap.eventType,
      snap.eventDetail,
      snap.issue,
      snap.cause,
      snap.quickFix,
      snap.category,
      snap.confidence,
      snap.resultText,
    ]
      .join(" ")
      .toLowerCase();

    return (
      text.includes("still crashing") ||
      text.includes("failed") ||
      text.includes("needs work") ||
      text.includes("error") ||
      text.includes("unknown issue") ||
      text.includes("no cause recorded")
    );
  }

  function getEventLabel(eventType?: string) {
    return String(eventType || "snapshot")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  const filteredSnapshots = snapshots.filter((snap) => {
    const haystack = [
      snap.betaId,
      snap.betaEmail,
      snap.vid,
      snap.gameTitle,
      snap.game,
      snap.eventType,
      snap.eventDetail,
      snap.issue,
      snap.cause,
      snap.quickFix,
      snap.category,
      snap.confidence,
      snap.resultText,
      snap.crashLogFingerprint,
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = haystack.includes(search.trim().toLowerCase());
    const matchesAttention = attentionOnly ? needsAttention(snap) : true;

    return matchesSearch && matchesAttention;
  });

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
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-bold">Recent Snapshots</h2>
              <p className="mt-1 text-sm text-white/50">
                Showing {filteredSnapshots.length} of {snapshots.length} loaded snapshots.
              </p>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={attentionOnly}
                onChange={(event) => setAttentionOnly(event.target.checked)}
                className="h-4 w-4 accent-cyan-400"
              />
              Needs attention only
            </label>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search Beta ID, email, game, issue, category, event..."
            className="mt-4 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40"
          />

          <div className="mt-4 grid gap-3">
            {filteredSnapshots.map((snap) => (
              <div key={snap.id} className={getSnapshotStyle(snap)}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                                        <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-xs font-medium text-cyan-100">
                        {snap.gameTitle || snap.game || "Unknown Game"}
                      </span>

                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70">
                        {getTesterLabel(snap)}
                      </span>

                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/60">
                        {getEventLabel(snap.eventType)}
                      </span>

                      {snap.category ? (
                        <span className="rounded-full border border-purple-400/20 bg-purple-400/10 px-2 py-1 text-xs text-purple-100">
                          {snap.category}
                        </span>
                      ) : null}

                      {needsAttention(snap) ? (
                        <span className="rounded-full border border-red-400/20 bg-red-400/10 px-2 py-1 text-xs font-semibold text-red-100">
                          Needs attention
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 text-lg font-bold">
                      {snap.issue || snap.resultTitle || "Unknown issue"}
                    </div>

                    <div className="mt-1 text-sm text-white/60">
                      {snap.cause || "No cause recorded"}
                    </div>

                    {snap.confidence ? (
                      <div className="mt-2 text-xs text-white/40">
                        Confidence: {snap.confidence}
                      </div>
                    ) : null}
                  </div>

                  <button
                    onClick={() => setExpandedId(expandedId === snap.id ? null : snap.id)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                  >
                    {expandedId === snap.id ? "Hide" : "View"}
                  </button>
                </div>

                <div className="mt-3 text-xs text-white/40">
  {formatSnapshotTime(snap.createdAt)}
</div>

                {expandedId === snap.id ? (
                  <div className="mt-4 grid gap-3">
                    <div className="rounded-xl bg-white/5 p-3">
                      <div className="text-xs text-white/40">Quick Fix</div>
                      <div className="mt-1">{snap.quickFix || "None"}</div>
                    </div>

                                      <div className="rounded-xl bg-white/5 p-3">
                      <div className="text-xs text-white/40">Event Detail</div>
                      <div className="mt-1">{snap.eventDetail || "None"}</div>
                    </div>

                    <div className="rounded-xl bg-white/5 p-3">
                      <div className="text-xs text-white/40">Tester</div>
                      <div className="mt-1">{getTesterLabel(snap)}</div>
                    </div>

                    {snap.probabilityBreakdown?.length ? (
                      <div className="rounded-xl bg-white/5 p-3">
                        <div className="text-xs text-white/40">
                          Probability Breakdown
                        </div>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/75">
                          {snap.probabilityBreakdown.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {snap.suspectedMods?.length ? (
                      <div className="rounded-xl bg-white/5 p-3">
                        <div className="text-xs text-white/40">Suspected Mods</div>
                        <div className="mt-1 text-sm text-white/75">
                          {snap.suspectedMods.join(", ")}
                        </div>
                      </div>
                    ) : null}

                    {snap.crashLogFingerprint ? (
                      <div className="rounded-xl bg-white/5 p-3">
                        <div className="text-xs text-white/40">
                          Crash Log Fingerprint
                        </div>
                        <div className="mt-1 font-mono text-sm">
                          {snap.crashLogFingerprint}
                        </div>
                      </div>
                    ) : null}

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