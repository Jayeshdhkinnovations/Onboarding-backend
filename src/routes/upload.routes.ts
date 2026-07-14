import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { protect } from "../middleware/auth.middleware";
import { uploadFile, getFile, getUploadDir } from "../controllers/upload.controller";

const router = Router();

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = getUploadDir();
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
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

router.post("/", protect as any, (req: any, res: any, next: any) => {
  uploadAny(req, res, (err: any) => {
    if (err) {
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
router.get("/file/:filename", getFile as any);

export default router;
