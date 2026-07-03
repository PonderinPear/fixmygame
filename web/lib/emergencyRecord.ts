import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export type EmergencyEventType =
  | "diagnostic_started"
  | "diagnostic_completed"
  | "safe_repair_previewed"
  | "safe_repair_completed"
  | "safe_repair_failed"
  | "undo_clicked"
  | "still_crashing_clicked"
  | "fixed_it_clicked"
  | "feedback_submitted"
  | "download_clicked"
  | "beta_access_requested"
  | "app_error"
  | "still_crashing_after_fix";

export type EmergencyEvent = {
  type: EmergencyEventType;

  sessionId?: string;
  userId?: string;
  email?: string;

  appVersion?: string;
  routeVersion?: string;
  game?: string;

  resultCategory?: string;
  resultTitle?: string;
  confidence?: string | number;
  mostLikelyCausePercent?: number;

  message?: string;
  metadata?: Record<string, unknown>;

  createdAt?: string;
};

export async function saveEmergencyEvent(event: EmergencyEvent) {
  try {
    const record = {
      ...event,
      createdAt: event.createdAt ?? new Date().toISOString(),
    };

    await redis.lpush("fixmygame:emergency_events", JSON.stringify(record));

    // Keeps only the latest 5,000 emergency records during beta.
    await redis.ltrim("fixmygame:emergency_events", 0, 4999);

    return { ok: true };
  } catch (error) {
    console.error("Emergency event backup failed:", error);

    return {
      ok: false,
      error: "Emergency event backup failed",
    };
  }
}