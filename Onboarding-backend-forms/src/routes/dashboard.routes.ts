import { Router } from "express";
import { getAnalytics } from "../controllers/dashboard.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.get("/analytics", protect as any, getAnalytics);

export default router;
