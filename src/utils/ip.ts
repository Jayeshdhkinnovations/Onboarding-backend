import { Request } from "express";
import crypto from "crypto";

/**
 * Extracts the real client IP address from request headers (Cloudflare, Nginx reverse proxy, multi-hop x-forwarded-for, or socket IP).
 */
export const getRealClientIp = (req: Request): string => {
  if (!req) return "unknown";

  // 1. Direct Edge Client Headers (Cloudflare, Akamai, Vercel, Custom Proxy)
  const candidateHeaders = [
    req.headers["cf-connecting-ip"],
    req.headers["true-client-ip"],
    req.headers["x-client-ip"],
    req.headers["x-vercel-forwarded-for"],
  ];

  for (const h of candidateHeaders) {
    if (h) {
      const raw = Array.isArray(h) ? h[0] : h;
      if (typeof raw === "string" && raw.trim() !== "") {
        const clean = raw.split(",")[0].trim();
        if (clean) return clean;
      }
    }
  }

  // 2. Standard X-Forwarded-For header (the VERY FIRST hop is the original client IP)
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const rawStr = Array.isArray(forwarded) ? forwarded.join(",") : forwarded;
    if (typeof rawStr === "string" && rawStr.trim() !== "") {
      const firstIp = rawStr.split(",")[0].trim();
      if (firstIp) return firstIp;
    }
  }

  // 3. Fallback: Nginx X-Real-IP (only if X-Forwarded-For is absent)
  const realIp = req.headers["x-real-ip"];
  if (realIp && typeof realIp === "string" && realIp.trim() !== "") {
    return realIp.trim();
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
