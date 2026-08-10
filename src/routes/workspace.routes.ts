import { Router } from "express";
import { createWorkspace, getWorkspace, updateWorkspace, deleteWorkspace } from "../controllers/workspace.controller";
import {
  getCurrentWorkspace,
  patchCurrentWorkspace,
  createWorkspaceExport,
  downloadWorkspaceExportFile,
  deleteCurrentWorkspace,
} from "../controllers/workspace_settings.controller";
import { protect, blockSuspended } from "../middleware/auth.middleware";

const router = Router();

router.get("/current", protect as any, blockSuspended as any, getCurrentWorkspace);
router.patch("/current", protect as any, blockSuspended as any, patchCurrentWorkspace);
router.post("/current/export", protect as any, blockSuspended as any, createWorkspaceExport);
router.get("/current/export", protect as any, blockSuspended as any, getCurrentWorkspace);
router.get("/current/export/file", protect as any, blockSuspended as any, downloadWorkspaceExportFile);
router.delete("/current", protect as any, blockSuspended as any, deleteCurrentWorkspace);

router.post("/", protect as any, blockSuspended as any, createWorkspace);
router.get("/:id", protect as any, blockSuspended as any, getWorkspace);
router.put("/:id", protect as any, blockSuspended as any, updateWorkspace);
router.delete("/:id", protect as any, blockSuspended as any, deleteWorkspace);

export default router;
