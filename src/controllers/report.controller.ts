import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import { z } from "zod";
import ReportModel from "../models/Report";
import Workspace from "../models/Workspace";
import { generateReportAsync } from "../services/report.service";

const reportCreateSchema = z.object({
  format: z.enum(["csv", "pdf"]),
  formId: z.string().optional(),
  status: z.enum(["new", "in_progress", "completed"]).optional(),
  search: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

/**
 * Helper to resolve workspaceId from req.user
 */
const getWorkspaceId = async (req: Request): Promise<string | null> => {
  const authReq = req as any;
  if (!authReq.user) return null;

  let wsId = authReq.user.workspaceId;
  if (wsId && typeof wsId === "object" && wsId._id) {
    wsId = wsId._id.toString();
  } else if (wsId) {
    wsId = wsId.toString();
  }

  if (!wsId) {
    const workspace = await Workspace.findOne({ owner: authReq.user._id });
    if (workspace) {
      wsId = workspace._id.toString();
    }
  }

  return wsId ? wsId.toString() : null;
};

/**
 * POST /api/reports
 * Creates a queued report job and returns immediately (non-blocking)
 */
export const createReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userWorkspaceId = await getWorkspaceId(req);
    if (!userWorkspaceId) {
      res.status(403).json({ success: false, message: "Workspace not found or access denied" });
      return;
    }

    const parseResult = reportCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        message: "Invalid report creation payload",
        error: parseResult.error.format(),
      });
      return;
    }

    const { format, formId, status, search, from, to } = parseResult.data;

    // 24 hours expiration window
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const report = await ReportModel.create({
      workspaceId: new mongoose.Types.ObjectId(userWorkspaceId),
      format,
      filters: { formId, status, search, from, to },
      status: "queued",
      expiresAt,
    });

    // Kick off asynchronous background report generation
    setImmediate(() => {
      generateReportAsync(report._id.toString()).catch((err) =>
        console.error("Background report generation error:", err)
      );
    });

    res.status(202).json({
      success: true,
      message: "Report job queued successfully",
      report: {
        id: report._id.toString(),
        workspaceId: report.workspaceId.toString(),
        format: report.format,
        filters: report.filters,
        status: report.status,
        expiresAt: report.expiresAt,
        createdAt: report.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reports?page=&limit=
 * Workspace-scoped report job listing (newest first)
 */
export const getReports = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userWorkspaceId = await getWorkspaceId(req);
    if (!userWorkspaceId) {
      res.status(403).json({ success: false, message: "Workspace not found or access denied" });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const rawLimit = parseInt(req.query.limit as string, 10) || 10;
    const limit = Math.min(50, Math.max(1, rawLimit));
    const skip = (page - 1) * limit;

    const query = { workspaceId: new mongoose.Types.ObjectId(userWorkspaceId) };

    const total = await ReportModel.countDocuments(query);
    const reports = await ReportModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);

    const now = new Date();
    const formattedReports = reports.map((r) => {
      let currentStatus = r.status;
      if (r.expiresAt && r.expiresAt < now && currentStatus === "completed") {
        currentStatus = "expired";
      }
      return {
        id: r._id.toString(),
        workspaceId: r.workspaceId.toString(),
        format: r.format,
        filters: r.filters,
        status: currentStatus,
        errorMessage: r.errorMessage || null,
        fileSize: r.fileSize || null,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    res.status(200).json({
      success: true,
      data: formattedReports,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reports/:id
 * Workspace-scoped report detail
 */
export const getReportById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userWorkspaceId = await getWorkspaceId(req);
    if (!userWorkspaceId) {
      res.status(403).json({ success: false, message: "Workspace not found or access denied" });
      return;
    }

    const reportId = req.params.id as string;
    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      res.status(400).json({ success: false, message: "Invalid report ID" });
      return;
    }

    const report = await ReportModel.findById(reportId);
    if (!report) {
      res.status(404).json({ success: false, message: "Report not found" });
      return;
    }

    if (report.workspaceId.toString() !== userWorkspaceId) {
      res.status(403).json({ success: false, message: "Access denied to report from another workspace" });
      return;
    }

    const now = new Date();
    let currentStatus = report.status;
    if (report.expiresAt && report.expiresAt < now && currentStatus === "completed") {
      currentStatus = "expired";
    }

    res.status(200).json({
      success: true,
      report: {
        id: report._id.toString(),
        workspaceId: report.workspaceId.toString(),
        format: report.format,
        filters: report.filters,
        status: currentStatus,
        errorMessage: report.errorMessage || null,
        fileSize: report.fileSize || null,
        expiresAt: report.expiresAt,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reports/:id/file
 * Streams generated file (authenticated, path traversal guarded, 410 for expired)
 */
export const getReportFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userWorkspaceId = await getWorkspaceId(req);
    if (!userWorkspaceId) {
      res.status(403).json({ success: false, message: "Workspace not found or access denied" });
      return;
    }

    const reportId = req.params.id as string;
    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      res.status(400).json({ success: false, message: "Invalid report ID" });
      return;
    }

    const report = await ReportModel.findById(reportId);
    if (!report) {
      res.status(404).json({ success: false, message: "Report not found" });
      return;
    }

    if (report.workspaceId.toString() !== userWorkspaceId) {
      res.status(403).json({ success: false, message: "Access denied to report from another workspace" });
      return;
    }

    const now = new Date();
    if (report.status === "expired" || (report.expiresAt && report.expiresAt < now)) {
      res.status(410).json({
        success: false,
        message: "Report download link has expired.",
      });
      return;
    }

    if (report.status !== "completed" || !report.filePath) {
      res.status(404).json({
        success: false,
        message: `Report is not ready yet (current status: ${report.status})`,
      });
      return;
    }

    // Path traversal guard
    const uploadsDir = path.resolve(process.cwd(), "uploads", "reports");
    const resolvedPath = path.resolve(report.filePath);
    if (!resolvedPath.startsWith(uploadsDir)) {
      res.status(403).json({ success: false, message: "Forbidden file path" });
      return;
    }

    if (!fs.existsSync(resolvedPath)) {
      res.status(404).json({ success: false, message: "Report file not found on disk" });
      return;
    }

    const contentType = report.format === "csv" ? "text/csv" : "application/pdf";
    const filename = `beginso_report_${report._id.toString()}.${report.format}`;

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const readStream = fs.createReadStream(resolvedPath);
    readStream.pipe(res);
  } catch (error) {
    next(error);
  }
};
