import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-fmg-device-id",
};

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: corsHeaders,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export const runtime = "nodejs";

function getOrCreateVid(req: NextRequest) {
  const headerVid = req.headers.get("x-fmg-device-id")?.trim();
  if (headerVid) return headerVid;

  const cookieVid = req.cookies.get("vid")?.value;
  if (cookieVid) return cookieVid;

  return crypto.randomUUID();
}

export async function POST(req: NextRequest) {
  try {
    await req.json().catch(() => ({}));

    if (!process.env.STRIPE_SECRET_KEY) {
      return jsonResponse({ error: "Missing STRIPE_SECRET_KEY" }, 500);
    }

    if (!process.env.STRIPE_PRICE_PRO_ID) {
      return jsonResponse({ error: "Missing STRIPE_PRICE_PRO_ID" }, 500);
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const vid = getOrCreateVid(req);
    const origin = req.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_PRO_ID,
          quantity: 1,
        },
      ],
      client_reference_id: vid,
      metadata: {
        vid,
      },
      success_url: `${origin}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=1`,
      allow_promotion_codes: true,
    });

    return jsonResponse({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Checkout error";
    return jsonResponse({ error: message }, 500);
  }
}