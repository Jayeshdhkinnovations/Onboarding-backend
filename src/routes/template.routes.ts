import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import { getTemplates, useTemplate } from "../controllers/template.controller";

const router = Router();

// GET /api/templates - Get all active templates
router.get("/", protect as any, getTemplates);

// POST /api/templates/:id/use - Create a form from a template
router.post("/:id/use", protect as any, useTemplate);

export default router;
