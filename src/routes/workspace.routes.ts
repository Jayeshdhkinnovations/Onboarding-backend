import { Router } from "express";
import { createWorkspace, getWorkspace, updateWorkspace, deleteWorkspace } from "../controllers/workspace.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.post("/", protect as any, createWorkspace);
router.get("/:id", protect as any, getWorkspace);
router.put("/:id", protect as any, updateWorkspace);
router.delete("/:id", protect as any, deleteWorkspace);

export default router;
