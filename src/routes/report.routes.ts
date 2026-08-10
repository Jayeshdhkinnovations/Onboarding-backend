import { Router } from "express";
import {
  createReport,
  getReports,
  getReportById,
  getReportFile,
} from "../controllers/report.controller";
import { protect, blockSuspended } from "../middleware/auth.middleware";

const router = Router();

router.post("/", protect as any, blockSuspended as any, createReport);
router.get("/", protect as any, blockSuspended as any, getReports);
router.get("/:id", protect as any, blockSuspended as any, getReportById);
router.get("/:id/file", protect as any, blockSuspended as any, getReportFile);

export default router;
