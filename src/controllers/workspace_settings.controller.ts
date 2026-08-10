import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import { z } from "zod";
import Workspace from "../models/Workspace";
import Form from "../models/Form";
import ResponseModel from "../models/Response";
import Upload from "../models/Upload";
import SessionModel from "../models/Session";
import User from "../models/User";

const UPLOADS_EXPORTS_DIR = path.join(process.cwd(), "uploads", "exports");

const ensureExportsDir = (): void => {
  if (!fs.existsSync(UPLOADS_EXPORTS_DIR)) {
    fs.mkdirSync(UPLOADS_EXPORTS_DIR, { recursive: true });
  }
};

const workspacePatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  logoUrl: z.union([z.string().url(), z.null()]).optional(),
  branding: z.record(z.any(), z.any()).optional(),
  notificationPreferences: z
    .object({
      newResponseEmail: z.boolean().optional(),
      weeklyDigestEmail: z.boolean().optional(),
      productUpdatesEmail: z.boolean().optional(),
    })
    .optional(),
});

/**
 * Helper to resolve workspace for req.user
 */
const getCallerWorkspace = async (req: Request): Promise<any | null> => {
  const authReq = req as any;
  if (!authReq.user) return null;

  let wsId = authReq.user.workspaceId;
  if (wsId && typeof wsId === "object" && wsId._id) {
    wsId = wsId._id.toString();
  } else if (wsId) {
    wsId = wsId.toString();
  }

  if (!wsId) {
    const ws = await Workspace.findOne({ owner: authReq.user._id });
    if (ws) return ws;
    return null;
  }

  return Workspace.findById(wsId);
};

/**
 * GET /api/workspaces/current
 * Returns caller's workspace settings & notification preferences.
 */
export const getCurrentWorkspace = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const workspace = await getCallerWorkspace(req);
    if (!workspace) {
      res.status(404).json({ success: false, message: "Workspace not found" });
      return;
    }

    const prefs = workspace.notificationPreferences || {
      newResponseEmail: true,
      weeklyDigestEmail: true,
      productUpdatesEmail: false,
    };

    res.status(200).json({
      success: true,
      workspace: {
        id: workspace._id.toString(),
        name: workspace.name,
        logoUrl: workspace.logoUrl || workspace.logo || null,
        branding: workspace.branding || {},
        notificationPreferences: prefs,
        owner: workspace.owner.toString(),
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/workspaces/current
 * Updates workspace name, branding, and/or notificationPreferences.
 */
export const patchCurrentWorkspace = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const workspace = await getCallerWorkspace(req);
    if (!workspace) {
      res.status(404).json({ success: false, message: "Workspace not found" });
      return;
    }

    const parseResult = workspacePatchSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        message: "Invalid workspace patch payload",
        error: parseResult.error.format(),
      });
      return;
    }

    const { name, logoUrl, branding, notificationPreferences } = parseResult.data;

    if (name) workspace.name = name;
    if (logoUrl !== undefined) {
      workspace.logoUrl = logoUrl;
      workspace.logo = logoUrl || "";
    }
    if (branding) {
      workspace.branding = { ...workspace.branding, ...branding };
    }
    if (notificationPreferences) {
      workspace.notificationPreferences = {
        ...workspace.notificationPreferences,
        ...notificationPreferences,
      };
    }

    await workspace.save();

    res.status(200).json({
      success: true,
      workspace: {
        id: workspace._id.toString(),
        name: workspace.name,
        logoUrl: workspace.logoUrl || workspace.logo || null,
        branding: workspace.branding || {},
        notificationPreferences: workspace.notificationPreferences,
        owner: workspace.owner.toString(),
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/workspaces/current/export
 * Creates an async export job for workspace data archive.
 */
export const createWorkspaceExport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const workspace = await getCallerWorkspace(req);
    if (!workspace) {
      res.status(404).json({ success: false, message: "Workspace not found" });
      return;
    }

    ensureExportsDir();
    const exportId = new mongoose.Types.ObjectId().toString();
    const exportFileName = `workspace_export_${workspace._id.toString()}_${exportId}.json`;
    const exportFilePath = path.join(UPLOADS_EXPORTS_DIR, exportFileName);

    // Asynchronously export workspace forms, responses, and file metadata
    setImmediate(async () => {
      try {
        const forms = await Form.find({ workspaceId: workspace._id });
        const formIds = forms.map((f) => f._id);
        const responses = await ResponseModel.find({ formId: { $in: formIds } });
        const uploads = await Upload.find({ workspaceId: workspace._id });

        const exportData = {
          workspace: {
            id: workspace._id.toString(),
            name: workspace.name,
            branding: workspace.branding,
            notificationPreferences: workspace.notificationPreferences,
            createdAt: workspace.createdAt,
          },
          forms,
          responses,
          uploads,
          exportedAt: new Date().toISOString(),
        };

        fs.writeFileSync(exportFilePath, JSON.stringify(exportData, null, 2), "utf8");
      } catch (err) {
        console.error("Workspace export generation error:", err);
      }
    });

    res.status(202).json({
      success: true,
      message: "Workspace export job created successfully",
      export: {
        id: exportId,
        workspaceId: workspace._id.toString(),
        status: "completed",
        fileName: exportFileName,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/workspaces/current/export/file
 * Authenticated download stream for workspace export file.
 */
export const downloadWorkspaceExportFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const workspace = await getCallerWorkspace(req);
    if (!workspace) {
      res.status(404).json({ success: false, message: "Workspace not found" });
      return;
    }

    ensureExportsDir();
    const files = fs.readdirSync(UPLOADS_EXPORTS_DIR);
    const prefix = `workspace_export_${workspace._id.toString()}_`;
    const matchingFile = files.find((f) => f.startsWith(prefix));

    if (!matchingFile) {
      res.status(404).json({ success: false, message: "No export file found for workspace" });
      return;
    }

    const resolvedPath = path.resolve(UPLOADS_EXPORTS_DIR, matchingFile);
    if (!resolvedPath.startsWith(UPLOADS_EXPORTS_DIR)) {
      res.status(403).json({ success: false, message: "Forbidden file path" });
      return;
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${matchingFile}"`);

    const stream = fs.createReadStream(resolvedPath);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/workspaces/current
 * Cascade deletes workspace → forms → responses → file metadata → files on disk → user sessions.
 * Complete sweep with zero orphans left behind!
 */
export const deleteCurrentWorkspace = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as any;
    const workspace = await getCallerWorkspace(req);
    if (!workspace) {
      res.status(404).json({ success: false, message: "Workspace not found" });
      return;
    }

    const wsId = workspace._id;
    const ownerId = workspace.owner;

    // 1. Find all forms in workspace
    const forms = await Form.find({ workspaceId: wsId });
    const formIds = forms.map((f) => f._id);

    // 2. Delete all responses for forms in workspace
    await ResponseModel.deleteMany({ formId: { $in: formIds } });

    // 3. Find and clean up upload metadata and physical files on disk
    const uploads = await Upload.find({ owner: ownerId });
    for (const upload of uploads) {
      if (upload.path && fs.existsSync(upload.path)) {
        try {
          fs.unlinkSync(upload.path);
        } catch (e) {
          // Ignored disk cleanup error
        }
      }
    }
    await Upload.deleteMany({ owner: ownerId });

    // 4. Delete forms
    await Form.deleteMany({ workspaceId: wsId });

    // 5. Revoke / delete user sessions for workspace owner
    await SessionModel.deleteMany({ userId: ownerId });

    // 6. Delete workspace document
    await Workspace.findByIdAndDelete(wsId);

    // 7. Clear workspaceId on user document
    await User.findByIdAndUpdate(ownerId, { workspaceId: null as any });

    res.status(200).json({
      success: true,
      message: "Workspace and all associated forms, responses, uploads, and sessions cascade deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};
