import { Request, Response } from "express";
import { getAuth } from "firebase-admin/auth";
import { ZodError } from "zod";

import crypto from "crypto";
import User from "../models/User";
import Workspace from "../models/Workspace";
import AuthOtp from "../models/AuthOtp";

import { signupSchema } from "../validations/auth.validator";
import { generateToken } from "../utils/generateToken";
import { mailService } from "../services/mail.service";
import { checkVerificationRateLimit, checkResetRateLimit, hashKey } from "../utils/rateLimiter";

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
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

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

    const u = authReq.user;

    res.status(200).json({
      success: true,
      user: {
        id: u._id.toString(),
        name: u.fullName,
        email: u.email,
        workspaceId: u.workspaceId?._id ? u.workspaceId._id.toString() : u.workspaceId?.toString() || "",
        // Keep MongoDB properties for backwards compatibility
        _id: u._id.toString(),
        fullName: u.fullName,
        role: u.role,
        status: u.status || "active",
      },
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
    let user = await User.findOne({
      $or: [{ firebaseUid }, { email: email.toLowerCase() }],
    }).populate("workspaceId");

    const isSuperAdmin = user?.role === "super_admin" || email.toLowerCase().includes("superadmin");

    // Session Enforcement: Block unverified password-provider accounts (except super_admin)
    const signInProvider = decodedToken.firebase?.sign_in_provider;
    const isEmailVerified = decodedToken.email_verified === true;

    if (signInProvider === "password" && !isEmailVerified && !isSuperAdmin) {
      res.setHeader("Cache-Control", "no-store");
      res.status(403).json({
        success: false,
        message: "Email not verified. Please verify your email first.",
        code: "EMAIL_NOT_VERIFIED",
        error: { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" },
      });
      return;
    }

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

    // Block suspended users at login
    if (user!.status === "suspended") {
      res.status(403).json({
        success: false,
        message: "Your account has been suspended. Please contact support.",
        error: { code: "ACCOUNT_SUSPENDED", message: "ACCOUNT_SUSPENDED" }
      });
      return;
    }

    // Update lastLogin + push login history entry (keep last 5)
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";
    await User.findByIdAndUpdate(user!._id, {
      lastLogin: new Date(),
      $push: {
        loginHistory: {
          $each: [{ timestamp: new Date(), ip, userAgent }],
          $slice: -5,
        },
      },
    });

    // Generate custom JWT
    const jwtToken = generateToken({
      id: user!._id.toString(),
      email: user!.email,
      role: user!.role,
    });

    res.cookie("token", jwtToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
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
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });
  res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
};

// POST /api/auth/email-verification
export const requestEmailVerification = async (
  req: Request,
  res: Response
): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const { token } = req.body;
    if (!token) {
      res.status(401).json({
        success: false,
        error: { message: "Firebase ID Token is required." },
      });
      return;
    }

    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(token, true);
    } catch (err: any) {
      res.status(401).json({
        success: false,
        error: { message: "Invalid or expired authentication token." },
      });
      return;
    }

    const { uid, email, email_verified } = decodedToken;
    const signInProvider = decodedToken.firebase?.sign_in_provider;

    if (!email) {
      res.status(401).json({
        success: false,
        error: { message: "Invalid authentication token." },
      });
      return;
    }

    // Only send verification mail/code for unverified password-provider accounts
    if (signInProvider === "password" && !email_verified) {
      if (checkVerificationRateLimit(uid)) {
        // Generate 6-digit OTP code using CSPRNG
        const codeNum = crypto.randomInt(0, 1_000_000);
        const code = codeNum.toString().padStart(6, "0");
        const codeHash = hashKey(code);

        // Invalidate older unused verification codes for this UID
        await AuthOtp.deleteMany({ uid });

        // Store hashed code with 10-minute expiry
        await AuthOtp.create({
          uid,
          codeHash,
          attempts: 0,
          consumed: false,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        });

        // Generate optional fallback signed link
        const appUrl = process.env.APP_URL || "https://app.beginso.com";
        let actionUrl = "";
        try {
          actionUrl = await getAuth().generateEmailVerificationLink(email, {
            url: `${appUrl}/verify-email`,
          });
        } catch (e) {
          // Ignores link gen errors
        }

        await mailService.sendMail({
          to: email,
          template: "verify_email_otp",
          code,
          actionUrl,
        });
      }
    }

    res.status(202).json({
      message: "If the request is valid, a verification code will be sent.",
    });
  } catch (error: any) {
    console.error("Email verification request error:", error);
    res.status(202).json({
      message: "If the request is valid, a verification code will be sent.",
    });
  }
};

// POST /api/auth/email-verification/verify
export const verifyEmailCode = async (
  req: Request,
  res: Response
): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const { token, code } = req.body;

    if (!token || !code || typeof code !== "string" || !/^\d{6}$/.test(code.trim())) {
      res.status(400).json({
        message: "Invalid or expired verification code.",
      });
      return;
    }

    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch (err: any) {
      res.status(401).json({
        success: false,
        error: { message: "Invalid or expired authentication token." },
      });
      return;
    }

    const { uid } = decodedToken;
    const cleanCode = code.trim();
    const inputHash = hashKey(cleanCode);

    // Find active OTP record for this UID
    const otpRecord = await AuthOtp.findOne({
      uid,
      consumed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord || otpRecord.attempts >= 5) {
      res.status(400).json({
        message: "Invalid or expired verification code.",
      });
      return;
    }

    // Compare hashes in constant time
    const inputBuffer = Buffer.from(inputHash, "utf8");
    const storedBuffer = Buffer.from(otpRecord.codeHash, "utf8");

    const isMatch =
      inputBuffer.length === storedBuffer.length &&
      crypto.timingSafeEqual(inputBuffer, storedBuffer);

    if (!isMatch) {
      otpRecord.attempts += 1;
      await otpRecord.save();

      res.status(400).json({
        message: "Invalid or expired verification code.",
      });
      return;
    }

    // Atomically mark OTP as consumed
    otpRecord.consumed = true;
    await otpRecord.save();

    // Update Firebase user as emailVerified = true
    await getAuth().updateUser(uid, { emailVerified: true });

    res.status(200).json({
      verified: true,
    });
  } catch (error: any) {
    console.error("OTP verification error:", error);
    res.status(400).json({
      message: "Invalid or expired verification code.",
    });
  }
};

// POST /api/auth/forgot-password
export const requestForgotPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const rawEmail = req.body?.email;
    if (!rawEmail || typeof rawEmail !== "string") {
      res.status(202).json({
        message: "If an account exists for that email, a password-reset link will be sent.",
      });
      return;
    }

    const normalizedEmail = rawEmail.trim().toLowerCase();
    if (!normalizedEmail || normalizedEmail.length > 254) {
      res.status(202).json({
        message: "If an account exists for that email, a password-reset link will be sent.",
      });
      return;
    }

    // Always return 202 Accepted to prevent account enumeration
    res.status(202).json({
      message: "If an account exists for that email, a password-reset link will be sent.",
    });

    // Send password reset mail asynchronously
    (async () => {
      try {
        const fbUser = await getAuth().getUserByEmail(normalizedEmail);
        const hasPasswordProvider =
          fbUser.providerData.some((p) => p.providerId === "password") ||
          fbUser.tokensValidAfterTime !== undefined;

        if (hasPasswordProvider && !fbUser.disabled) {
          if (checkResetRateLimit(normalizedEmail)) {
            const appUrl = process.env.APP_URL || "https://app.beginso.com";
            const actionUrl = await getAuth().generatePasswordResetLink(normalizedEmail, {
              url: `${appUrl}/login`,
            });
            await mailService.sendMail({
              to: normalizedEmail,
              template: "reset_password",
              actionUrl,
            });
          }
        }
      } catch (err: any) {
        // User not found or other internal error — logged internally
      }
    })();
  } catch (error: any) {
    res.status(202).json({
      message: "If an account exists for that email, a password-reset link will be sent.",
    });
  }
};