import { NextRequest, NextResponse } from "next/server";
import {
  EmergencyEventType,
  saveEmergencyEvent,
} from "@/lib/emergencyRecord";

const allowedTypes: EmergencyEventType[] = [
  "diagnostic_started",
  "diagnostic_completed",
  "safe_repair_previewed",
  "safe_repair_completed",
  "safe_repair_failed",
  "undo_clicked",
  "still_crashing_clicked",
  "fixed_it_clicked",
  "feedback_submitted",
  "download_clicked",
  "beta_access_requested",
  "app_error",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!allowedTypes.includes(body.type)) {
      return NextResponse.json(
        { ok: false, error: "Invalid emergency event type" },
        { status: 400 }
      );
    }

    const result = await saveEmergencyEvent({
      type: body.type,
      sessionId: body.sessionId,
      userId: body.userId,
      email: body.email,
      appVersion: body.appVersion,
      routeVersion: body.routeVersion,
      game: body.game,
      resultCategory: body.resultCategory,
      resultTitle: body.resultTitle,
      confidence: body.confidence,
      mostLikelyCausePercent: body.mostLikelyCausePercent,
      message: body.message,
      metadata: body.metadata,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Emergency record route failed:", error);

    return NextResponse.json(
      { ok: false, error: "Failed to save emergency record" },
      { status: 500 }
    );
  }
}