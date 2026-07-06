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
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];

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
      });
    }
  } else {
    res.status(401).json({
      success: false,
      message: "Not authorized, no token provided",
    });
  }
};
