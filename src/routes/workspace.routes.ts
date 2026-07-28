import { Router } from "express";
import { createWorkspace, getWorkspace, updateWorkspace, deleteWorkspace } from "../controllers/workspace.controller";
import { protect, blockSuspended } from "../middleware/auth.middleware";

const router = Router();

router.post("/", protect as any, blockSuspended as any, createWorkspace);
router.get("/:id", protect as any, blockSuspended as any, getWorkspace);
router.put("/:id", protect as any, blockSuspended as any, updateWorkspace);
router.delete("/:id", protect as any, blockSuspended as any, deleteWorkspace);

export default router;
