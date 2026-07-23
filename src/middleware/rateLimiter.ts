import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const submitRateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const maxLimit = process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX, 10) : 100;
  const windowMs = process.env.RATE_LIMIT_WINDOW_MS ? parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) : 60000; // 1 minute

  if (maxLimit === 0) {
    return next();
  }

  const slug = req.params.slug;
  if (!slug) {
    return next();
  }

  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const ipStr = Array.isArray(ip) ? ip[0] : (typeof ip === "string" ? ip : "unknown");
  const hashedIp = crypto.createHash("sha256").update(ipStr).digest("hex");
  const key = `${hashedIp}:${slug}`;

  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return next();
  }

  record.count += 1;
  if (record.count > maxLimit) {
    res.status(429).json({
      success: false,
      message: "Too many requests. Please try again later.",
    });
    return;
  }

  next();
};

export const clearRateLimitStore = (): void => {
  rateLimitStore.clear();
};
