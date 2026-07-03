type EmergencyEventPayload = {
  type:
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
    | "still_crashing_after_fix"
    ;

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
};

export async function recordEmergencyEvent(payload: EmergencyEventPayload) {
  try {
    await fetch("/api/emergency-record", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Failed to record emergency event:", error);
  }
}