import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { getPublicFormBySlug, submitPublicForm } from "../controllers/form.controller";
import { getUploadDir } from "../controllers/upload.controller";

const router = Router();

// Multer Storage Configuration for Public Form Submissions
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = getUploadDir();
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
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
router.post("/:slug/submit", uploadAny, submitPublicForm);

export default router;
