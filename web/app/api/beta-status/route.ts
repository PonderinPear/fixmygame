import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const betaOpen = process.env.BETA_OPEN === "1";

  return NextResponse.json({
    betaOpen,
    message: betaOpen
      ? "FixMyGame beta is active."
      : "The FixMyGame beta period has ended. Access is currently closed.",
  });
}