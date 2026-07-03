import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export async function GET() {
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