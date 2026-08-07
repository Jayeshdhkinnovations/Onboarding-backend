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
} from "../controllers/auth.controller";
import { protect, blockSuspended } from "../middleware/auth.middleware";

const router = Router();

router.post("/signup", signup);
router.post("/session", session);
router.post("/email-verification", requestEmailVerification);
router.post("/email-verification/reveal", revealEmailCode);
router.post("/email-verification/verify", verifyEmailCode);
router.post("/forgot-password", requestForgotPassword);
router.post("/logout", protect as any, blockSuspended as any, logout);
router.get("/me", protect as any, getMe);

export default router;