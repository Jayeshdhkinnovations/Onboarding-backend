import { Router } from "express";
import {
  signup,
  getMe,
  session,
  logout,
  requestEmailVerification,
  revealEmailCode,
  verifyEmailCode,
  requestForgotPassword,
  confirmPasswordReset,
  notifyPasswordChanged,
} from "../controllers/auth.controller";
import { protect, blockSuspended } from "../middleware/auth.middleware";

const router = Router();

router.post("/signup", signup);
router.post("/session", session);
router.post("/email-verification", requestEmailVerification);
router.post("/email-verification/reveal", revealEmailCode);
router.post("/email-verification/verify", verifyEmailCode);
router.post("/forgot-password", requestForgotPassword);
router.post("/confirm-password-reset", confirmPasswordReset);
router.post("/password-changed", notifyPasswordChanged);
router.post("/notify-password-changed", notifyPasswordChanged);
router.post("/logout", protect as any, blockSuspended as any, logout);
router.get("/me", protect as any, getMe);

export default router;