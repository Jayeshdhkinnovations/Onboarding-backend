import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User, { IUser } from "../models/User";

export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export const protect = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let token: string | undefined;

  // 1. Check Authorization Header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  // 2. Check Cookies (if token/jwt/access_token cookie exists)
  if (!token && req.headers.cookie) {
    const cookies = req.headers.cookie.split(";").reduce((acc, c) => {
      const [name, ...val] = c.trim().split("=");
      acc[name] = val.join("=");
      return acc;
    }, {} as Record<string, string>);
    token = cookies.token || cookies.jwt || cookies.access_token;
  }

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Not authorized, no token provided",
      error: { message: "Not authorized, no token provided" }
    });
    return;
  }

  try {
    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as { id: string; email: string; role: string };

    // Get user from database
    const user = await User.findById(decoded.id).populate("workspaceId");

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Not authorized, user not found",
        error: { message: "Not authorized, user not found" }
      });
      return;
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error("JWT Verification Error:", error);
    res.status(401).json({
      success: false,
      message: "Not authorized, token failed",
      error: { message: "Not authorized, token failed" }
    });
  }
};
