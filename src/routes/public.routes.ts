import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { getPublicFormBySlug, submitPublicForm } from "../controllers/form.controller";
import { getUploadDir } from "../controllers/upload.controller";
import { submitRateLimiter } from "../middleware/rateLimiter";
import { prepareUploadContext } from "../middleware/uploadContext.middleware";

const router = Router();
// Multer Storage Configuration for Public Form Submissions
const storage = multer.diskStorage({
  destination: (req: any, file, cb) => {
    const uploadDir = getUploadDir();
    const ctx = req.uploadContext || { userId: "unknown", formId: "unknown", responseId: "unknown" };
    const targetDir = path.join(uploadDir, ctx.userId, ctx.formId, "responses", ctx.responseId);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const rawExt = path.extname(file.originalname);
    const ext = rawExt.replace(/[^a-zA-Z0-9.]/g, "").toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const uploadAny = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // Enforce 100MB per-file limit server-side via Multer
  },
}).any();

router.get("/:slug", getPublicFormBySlug);
router.post("/:slug/submit", submitRateLimiter, prepareUploadContext as any, uploadAny, submitPublicForm);

export default router;
