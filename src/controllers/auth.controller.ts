import { Request, Response } from "express";
import { getAuth } from "firebase-admin/auth";
import { ZodError } from "zod";

import User from "../models/User";
import Workspace from "../models/Workspace";

import { signupSchema } from "../validations/auth.validator";
import { generateToken } from "../utils/generateToken";

export const signup = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Step 1: Validate Request
    const validatedData = signupSchema.parse(req.body);

    // Step 2: Check Existing User
    const existingUser = await User.findOne({
      email: validatedData.email,
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "User already exists.",
      });
      return;
    }

    // Step 3: Create User in Firebase Authentication
    const firebaseUser = await getAuth().createUser({
      displayName: validatedData.fullName,
      email: validatedData.email,
      password: validatedData.password,
    });

    // Step 4: Save User in MongoDB (initially without workspace)
    const user = await User.create({
      fullName: validatedData.fullName,
      email: validatedData.email,
      firebaseUid: firebaseUser.uid,
      role: "admin",
    });

    // Step 5: Create Workspace with owner
    const workspace = await Workspace.create({
      name: `${validatedData.fullName}'s Workspace`,
      owner: user._id,
    });

    // Step 6: Link Workspace ID to User
    user.workspaceId = workspace._id as any;
    await user.save();

    // Step 7: Generate JWT
    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    // Step 8: Send Response
    res.status(201).json({
      success: true,
      message: "Signup successful.",
      token,
      user,
    });

  } catch (error: any) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
        error: { message: "Validation failed" }
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMe = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as any;
    if (!authReq.user) {
      res.status(401).json({
        success: false,
        message: "Not authorized",
        error: { message: "Not authorized" }
      });
      return;
    }

    res.status(200).json({
      success: true,
      user: authReq.user,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: { message: error.message }
    });
  }
};

export const session = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { token, name } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        error: { message: "Firebase ID Token is required." },
      });
      return;
    }

    // Verify Firebase ID Token
    const decodedToken = await getAuth().verifyIdToken(token);
    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email;

    if (!email) {
      res.status(400).json({
        success: false,
        error: { message: "Email not provided in token." },
      });
      return;
    }

    // Check if user already exists in MongoDB
    let user = await User.findOne({ firebaseUid }).populate("workspaceId");

    let isNewUser = false;
    if (!user) {
      isNewUser = true;

      // 1. Create User in MongoDB first
      user = await User.create({
        firebaseUid,
        fullName: name || decodedToken.name || "New User",
        email: email,
        role: "admin",
      });

      // 2. Create Workspace
      const workspace = await Workspace.create({
        name: `${user.fullName}'s Workspace`,
        owner: user._id,
      });

      // 3. Update User with Workspace ID
      user.workspaceId = workspace._id as any;
      await user.save();

      // Populate workspaceId
      user = await User.findById(user._id).populate("workspaceId") as any;
    }

    // Generate custom JWT
    const jwtToken = generateToken({
      id: user!._id.toString(),
      email: user!.email,
      role: user!.role,
    });

    res.status(200).json({
      success: true,
      token: jwtToken,
      user,
      isNewUser,
    });
  } catch (error: any) {
    console.error("Session Error:", error);
    res.status(401).json({
      success: false,
      error: { message: error.message || "Invalid or expired Firebase token." },
    });
  }
};

export const logout = async (
  req: Request,
  res: Response
): Promise<void> => {
  res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
};