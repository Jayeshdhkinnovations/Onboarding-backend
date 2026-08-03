import { Router } from "express";
import { getResponses } from "../controllers/response.controller";
import { protect, blockSuspended } from "../middleware/auth.middleware";

const router = Router();

// GET /api/responses - List responses with workspace scoping, filtering & pagination
router.get("/", protect as any, blockSuspended as any, getResponses);

export default router;
