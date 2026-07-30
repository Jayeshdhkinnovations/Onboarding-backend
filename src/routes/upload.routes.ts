import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { protect, blockSuspended } from "../middleware/auth.middleware";
import { uploadFile, getFile, getUploadDir, cleanEmptyDirs } from "../controllers/upload.controller";

const router = Router();

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req: any, file, cb) => {
    const uploadDir = getUploadDir();
    const userId = req.user?._id?.toString() || "branding";
    const formId = req.query.formId || req.body.formId;

    // Determine subfolder based on branding type
    const isLogo = file.fieldname === "logo" || req.query.type === "logo" || req.body.type === "logo";
    const isBanner = file.fieldname === "cover" || file.fieldname === "banner" || req.query.type === "cover" || req.body.type === "cover" || req.query.type === "banner" || req.body.type === "banner";

    let subfolder = "brand";
    if (isLogo) {
      subfolder = path.join("brand", "brand_logo");
    } else if (isBanner) {
      subfolder = path.join("brand", "brand_banner");
    }

    // Structure: uploads/<userId>/[formId]/brand/brand_logo/ OR brand_banner/
    const targetDir = formId
      ? path.join(uploadDir, userId, String(formId), subfolder)
      : path.join(uploadDir, userId, subfolder);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    // Generate stable stored filename/path (avoid collisions and path traversal)
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    // Sanitize extension (only allow normal alphanumeric extension characters to prevent traversal/obfuscation)
    const rawExt = path.extname(file.originalname);
    const ext = rawExt.replace(/[^a-zA-Z0-9.]/g, "").toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// Configure Multer Upload Middleware to accept any fieldname (logo, cover, file, etc.)
const uploadAny = multer({
  storage,
  limits: {
    // Enforce the file-size limit before the file is fully written
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
}).any();

router.post("/", protect as any, blockSuspended as any, (req: any, res: any, next: any) => {
  uploadAny(req, res, async (err: any) => {
    if (err) {
      // Clean up any empty directory created by this request
      try {
        const userId = req.user?._id?.toString() || "branding";
        const formId = req.query.formId || req.body.formId;
        const uploadDir = getUploadDir();
        const targetDir = formId
          ? path.join(uploadDir, userId, String(formId), "brand")
          : path.join(uploadDir, userId, "brand");

        await cleanEmptyDirs(path.join(targetDir, "brand_logo"), uploadDir);
        await cleanEmptyDirs(path.join(targetDir, "brand_banner"), uploadDir);
        await cleanEmptyDirs(targetDir, uploadDir);
      } catch (cleanupErr) {
        // Ignore silently
      }

      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            message: "File size limit exceeded. Maximum size is 5MB.",
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }
      return res.status(500).json({
        success: false,
        message: "An error occurred during file upload initialization.",
        error: err.message,
      });
    }

    // Since we used any(), let's map the first file to req.file for uploadFile controller compatibility
    if (req.files && req.files.length > 0) {
      req.file = req.files[0];
    }

    uploadFile(req, res);
  });
});

// Route to serve/stream the stored file for preview/download
router.get(/^\/file\/(.+)$/, getFile as any);

export default router;
