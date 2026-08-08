import { Request } from "express";
import crypto from "crypto";

/**
 * Extracts the real client IP address from request headers (Cloudflare, Nginx reverse proxy, multi-hop x-forwarded-for, or socket IP).
 */
export const getRealClientIp = (req: Request): string => {
  if (!req) return "unknown";

  // 1. Cloudflare header
  const cfIp = req.headers["cf-connecting-ip"];
  if (cfIp && typeof cfIp === "string" && cfIp.trim() !== "") {
    return cfIp.trim();
  }

  // 2. Nginx / reverse proxy header
  const realIp = req.headers["x-real-ip"];
  if (realIp && typeof realIp === "string" && realIp.trim() !== "") {
    return realIp.trim();
  }

  // 3. Standard x-forwarded-for header (take first hop)
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const rawStr = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    if (typeof rawStr === "string" && rawStr.trim() !== "") {
      const firstIp = rawStr.split(",")[0].trim();
      if (firstIp) return firstIp;
    }
  }

  // 4. Express req.ip or socket remoteAddress fallback
  const directIp = req.ip || (req.socket && req.socket.remoteAddress);
  if (directIp && typeof directIp === "string" && directIp.trim() !== "") {
    return directIp.trim();
  }

  return "unknown";
};

/**
 * Computes SHA-256 hash of IP address for privacy-compliant logging and rate limiting keys.
 */
export const hashIp = (ip: string): string => {
  if (!ip || ip === "unknown") return "unknown";
  return crypto.createHash("sha256").update(ip.trim()).digest("hex");
};
