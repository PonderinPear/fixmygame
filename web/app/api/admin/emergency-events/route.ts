import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export async function GET(req: NextRequest) {
  const adminKey = process.env.FMG_ADMIN_EVENTS_KEY;
  const providedKey = req.headers.get("x-fmg-admin-key");

  if (!adminKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "Emergency events admin key is not configured.",
      },
      { status: 500 }
    );
  }

  if (!providedKey || providedKey !== adminKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized.",
      },
      { status: 401 }
    );
  }

  try {
    const rawEvents = await redis.lrange<string>(
      "fixmygame:emergency_events",
      0,
      4999
    );

    const events = rawEvents.map((event) => {
      try {
        return JSON.parse(event);
      } catch {
        return event;
      }
    });

    return NextResponse.json({
      ok: true,
      count: events.length,
      events,
    });
  } catch (error) {
    console.error("Emergency events export failed:", error);

    return NextResponse.json(
      { ok: false, error: "Failed to load emergency events" },
      { status: 500 }
    );
  }
}