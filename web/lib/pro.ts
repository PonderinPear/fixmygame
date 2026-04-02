import { NextRequest } from "next/server";
import { getRedis } from "@/lib/redis";

export function getVidFromRequest(req: NextRequest): string | null {
  const headerVid = req.headers.get("x-fmg-device-id")?.trim();
  if (headerVid) return headerVid;

  return req.cookies.get("vid")?.value || null;
}

export async function isProUser(req: NextRequest): Promise<boolean> {
  const vid = getVidFromRequest(req);
  if (!vid) return false;

  const redis = await getRedis();
  const value = await redis.get(`pro:${vid}`);
  return value === "1";
}

export async function markVidAsPro(vid: string, subscriptionId?: string | null) {
  const redis = await getRedis();

  await redis.set(`pro:${vid}`, "1");

  if (subscriptionId) {
    await redis.set(`pro_sub:${vid}`, subscriptionId);
  }
}