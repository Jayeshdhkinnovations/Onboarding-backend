import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import User from "../models/User";

const profilePatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  fullName: z.string().min(1).max(100).optional(),
  avatarUrl: z.union([z.string().url(), z.null()]).optional(),
  email: z.string().optional(),
});

/**
 * GET /api/users/me
 * Returns profile fields including avatarUrl, verification state, created/last-login dates.
 */
export const getProfileMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as any;
    if (!authReq.user) {
      res.status(401).json({ success: false, message: "Not authorized" });
      return;
    }

    const u = authReq.user;
    res.status(200).json({
      success: true,
      user: {
        id: u._id.toString(),
        name: u.fullName,
        fullName: u.fullName,
        email: u.email,
        avatarUrl: u.avatarUrl || null,
        emailVerified: true,
        role: u.role,
        status: u.status || "active",
        createdAt: u.createdAt,
        lastLoginAt: u.lastLogin || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/users/me { name?, avatarUrl? }
 * Updates name and/or avatarUrl. Rejects email changes (400).
 */
export const patchProfileMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as any;
    if (!authReq.user) {
      res.status(401).json({ success: false, message: "Not authorized" });
      return;
    }

    if (req.body && req.body.email && req.body.email.toLowerCase() !== authReq.user.email.toLowerCase()) {
      res.status(400).json({
        success: false,
        message: "Email changes are not supported via this endpoint. Please use the re-verification flow.",
      });
      return;
    }

    const parseResult = profilePatchSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        message: "Invalid user profile update payload",
        error: parseResult.error.format(),
      });
      return;
    }

    const updates: any = {};
    const { name, fullName, avatarUrl } = parseResult.data;

    const newName = name || fullName;
    if (newName) {
      updates.fullName = newName;
    }

    if (avatarUrl !== undefined) {
      updates.avatarUrl = avatarUrl;
    }

    const updatedUser = await User.findByIdAndUpdate(authReq.user._id, updates, {
      returnDocument: "after",
    });

    res.status(200).json({
      success: true,
      user: {
        id: updatedUser!._id.toString(),
        name: updatedUser!.fullName,
        fullName: updatedUser!.fullName,
        email: updatedUser!.email,
        avatarUrl: updatedUser!.avatarUrl || null,
        emailVerified: true,
        role: updatedUser!.role,
        status: updatedUser!.status || "active",
        createdAt: updatedUser!.createdAt,
        lastLoginAt: updatedUser!.lastLogin || null,
      },
    });
  } catch (error) {
    next(error);
  }
};
