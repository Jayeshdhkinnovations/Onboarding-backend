import { Request, Response, NextFunction } from "express";
import Form from "../models/Form";
import Workspace from "../models/Workspace";
import mongoose from "mongoose";

export const prepareUploadContext = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { slug } = req.params;
    
    // Look up the form by publishedSlug or fallback to preview slug
    let form = await Form.findOne({ publishedSlug: slug }).populate("workspaceId");
    if (!form) {
      form = await Form.findOne({ slug }).populate("workspaceId");
    }

    if (!form) {
      res.status(404).json({ success: false, message: "Form not found" });
      return;
    }

    const workspace = form.workspaceId as any;
    const userId = workspace?.owner?.toString() || "unknown-user";
    const formId = form._id.toString();
    const responseId = new mongoose.Types.ObjectId().toString(); // Pre-generate Response ID

    // Attach to the request object so Multer can read it
    req.uploadContext = {
      userId,
      formId,
      responseId,
    };

    next();
  } catch (error) {
    console.error("prepareUploadContext error:", error);
    next(error);
  }
};
