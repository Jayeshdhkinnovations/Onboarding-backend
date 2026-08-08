import { Router } from "express";
import {
  getStats,
  getAbuse,
  getLogs,
  getMailLogs,
  getAdmins,
  getAdminDetail,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  getAuditLogs,
} from "../controllers/superadmin.controller";
import { protect, requireSuperAdmin } from "../middleware/auth.middleware";

const router = Router();

// Protect all routes in this router with both protect and requireSuperAdmin guards
router.use(protect as any, requireSuperAdmin as any);

router.get("/stats", getStats);
router.get("/abuse", getAbuse);
router.get("/logs", getLogs);
router.get("/mail-logs", getMailLogs);
router.get("/admins", getAdmins);
router.get("/admins/:id", getAdminDetail);
router.post("/admins", createAdmin);
router.patch("/admins/:id", updateAdmin);
router.delete("/admins/:id", deleteAdmin);
router.get("/audit", getAuditLogs);

export default router;
