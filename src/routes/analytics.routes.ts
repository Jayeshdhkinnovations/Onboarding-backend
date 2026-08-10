import { Router } from "express";
import {
  getOverview,
  getQuestions,
  getTrends,
  getForms,
} from "../controllers/analytics.controller";
import { protect, blockSuspended } from "../middleware/auth.middleware";

const router = Router();

router.get("/overview", protect as any, blockSuspended as any, getOverview);
router.get("/questions", protect as any, blockSuspended as any, getQuestions);
router.get("/trends", protect as any, blockSuspended as any, getTrends);
router.get("/forms", protect as any, blockSuspended as any, getForms);

export default router;
