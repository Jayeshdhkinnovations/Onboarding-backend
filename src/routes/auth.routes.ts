import { Router } from "express";
import { signup, getMe, session, logout } from "../controllers/auth.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.post("/signup", signup);
router.post("/session", session);
router.post("/logout", protect as any, logout);
router.get("/me", protect as any, getMe);

export default router;