import { Response } from "express";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import Upload from "../models/Upload";
import User from "../models/User";
import { UploadResponse } from "../types/upload";

// ponytail: This implementation utilizes local disk storage for keeping uploaded assets.
// This introduces a local-disk storage ceiling, has no CDN caching, and creates issues
// if we scale to multi-server stateless architectures.
// The upgrade path is to migrate to cloud object storage (like AWS S3 or Cloudflare R2) in the future.
export const getUploadDir = (): string => {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
};

export const uploadFile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const file = req.file;

  if (!file) {
    res.status(400).json({
      success: false,
      message: "No file uploaded",
    });
    return;
  }

  try {
    // Restrict branding uploads (logo/cover) to image MIME types
    const isBranding =
      file.fieldname === "logo" ||
      file.fieldname === "cover" ||
      req.body.type === "branding" ||
      req.body.uploadType === "branding" ||
      req.query.type === "branding" ||
      file.mimetype.startsWith("image/");

    if (isBranding && !file.mimetype.startsWith("image/")) {
      res.status(400).json({
        success: false,
        message: "Branding uploads (logo/cover) must be image files",
      });
      // Throwing an error will cause the catch block to run fs.promises.unlink
      throw new Error("MIME_TYPE_REJECTED");
    }

    if (!req.user || !req.user._id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      throw new Error("UNAUTHORIZED");
    }

    // Persist file metadata in MongoDB: name, size, type, path (safe filename only), owner, upload time
    const uploadDoc = await Upload.create({
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
      path: file.filename, // Serve via API, don't store raw disk path
      owner: req.user._id,
      uploadTime: new Date(),
      isBranding,
    });

    const fileUrl = `${req.protocol}://${req.get("host")}/api/upload/file/${file.filename}`;

    const response: UploadResponse = {
      success: true,
      message: "File uploaded successfully",
      url: fileUrl,
      metadata: {
        id: uploadDoc._id.toString(),
        name: uploadDoc.name,
        size: uploadDoc.size,
        type: uploadDoc.type,
        path: uploadDoc.path,
        owner: uploadDoc.owner.toString(),
        uploadTime: uploadDoc.uploadTime.toISOString(),
        isBranding: uploadDoc.isBranding,
      },
    };

    res.status(201).json(response);
  } catch (error: any) {
    // clean up the temp write on failure
    if (file && file.path && fs.existsSync(file.path)) {
      try {
        await fs.promises.unlink(file.path);
      } catch (err) {
        console.error("Failed to delete temp file:", err);
      }
    }

    if (error.message === "MIME_TYPE_REJECTED" || error.message === "UNAUTHORIZED") {
      return;
    }

    console.error("Error in uploadFile:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred during file upload",
      error: error.message,
    });
  }
};

export const getFile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const filename = req.params.filename;

    if (!filename || typeof filename !== "string") {
      res.status(400).json({
        success: false,
        message: "Filename is required and must be a string",
      });
      return;
    }

    // Explicitly reject path traversal attempts
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      res.status(400).json({
        success: false,
        message: "Invalid file path",
      });
      return;
    }

    // Stable stored filename/path (avoid collisions and path traversal)
    // Extract only base name to prevent traversal attacks
    const safeFilename = path.basename(filename);
    const uploadDir = getUploadDir();
    const filePath = path.resolve(uploadDir, safeFilename);

    // Double check that the resolved path is indeed inside the upload directory
    if (!filePath.startsWith(path.resolve(uploadDir))) {
      res.status(400).json({
        success: false,
        message: "Invalid file path",
      });
      return;
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).json({
        success: false,
        message: "File not found",
      });
      return;
    }

    const uploadDoc = await Upload.findOne({ path: safeFilename });

    // If it's a private file (not branding), check authentication
    if (!uploadDoc || !uploadDoc.isBranding) {
      let token: string | undefined;

      // 1. Check Authorization Header
      if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
      ) {
        token = req.headers.authorization.split(" ")[1];
      }

      // 2. Check Cookies
      if (!token && req.headers.cookie) {
        const cookies = req.headers.cookie.split(";").reduce((acc, c) => {
          const [name, ...val] = c.trim().split("=");
          acc[name] = val.join("=");
          return acc;
        }, {} as Record<string, string>);
        token = cookies.token || cookies.jwt || cookies.access_token;
      }

      if (!token || token === "undefined" || token === "null") {
        res.status(401).json({
          success: false,
          message: "Unauthorized access to private files",
          error: { message: "Unauthorized access to private files" },
        });
        return;
      }

      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET as string
        ) as { id: string; email: string; role: string };

        const user = await User.findById(decoded.id);
        if (!user) {
          res.status(401).json({
            success: false,
            message: "Unauthorized: Invalid user session",
            error: { message: "Unauthorized: Invalid user session" },
          });
          return;
        }
      } catch (err) {
        res.status(401).json({
          success: false,
          message: "Unauthorized: Invalid or expired token",
          error: { message: "Unauthorized: Invalid or expired token" },
        });
        return;
      }
    }

    // Serve/stream the stored file for preview/download
    res.sendFile(filePath);
  } catch (error: any) {
    console.error("Error serving file:", error);
    res.status(500).json({
      success: false,
      message: "Error serving file",
      error: error.message,
    });
  }
};
