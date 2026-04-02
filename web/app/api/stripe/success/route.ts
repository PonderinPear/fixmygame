import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { markVidAsPro } from "@/lib/pro";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.redirect(new URL("/?canceled=1", req.url));
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.redirect(new URL("/?canceled=1", req.url));
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const paid =
      session.payment_status === "paid" ||
      session.status === "complete";

    if (!paid) {
      return NextResponse.redirect(new URL("/?canceled=1", req.url));
    }

    const vid =
      session.metadata?.vid ||
      session.client_reference_id ||
      null;

    if (vid) {
      await markVidAsPro(vid, typeof session.subscription === "string" ? session.subscription : null);
    }

    const res = NextResponse.redirect(new URL("/?success=1", req.url));

    if (vid) {
      res.cookies.set("vid", vid, {
        httpOnly: false,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    res.cookies.set("fmg_pro", "1", {
      httpOnly: false,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(new URL("/?canceled=1", req.url));
  }
}