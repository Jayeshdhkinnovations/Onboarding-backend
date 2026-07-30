import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { superAdminService } from "../services/superadmin.service";
import { createAdminSchema, updateAdminSchema } from "../validations/superadmin.validator";

export const getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const statsData = await superAdminService.getPlatformStats();
    res.status(200).json({
      success: true,
      ...statsData,
    });
  } catch (error) {
    next(error);
  }
};

export const getAbuse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const abuseData = await superAdminService.getAbuseStats();
    res.status(200).json({
      success: true,
      ...abuseData,
    });
  } catch (error) {
    next(error);
  }
};

export const getLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { level, from, to, route, search, page, limit } = req.query;
    const logsData = await superAdminService.getLogs({
      level: level ? String(level) : undefined,
      from: from ? String(from) : undefined,
      to: to ? String(to) : undefined,
      route: route ? String(route) : undefined,
      search: search ? String(search) : undefined,
      page: page ? parseInt(String(page), 10) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined,
    });
    res.status(200).json({
      success: true,
      ...logsData,
    });
  } catch (error) {
    next(error);
  }
};

export const getAdmins = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit, search, status } = req.query;
    const adminsData = await superAdminService.getAdmins({
      page: page ? parseInt(String(page), 10) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined,
      search: search ? String(search) : undefined,
      status: status ? String(status) : undefined,
    });
    res.status(200).json({
      success: true,
      ...adminsData,
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const adminData = await superAdminService.getAdminDetail(String(id));
    res.status(200).json({
      success: true,
      ...adminData,
    });
  } catch (error) {
    next(error);
  }
};

export const createAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = createAdminSchema.parse(req.body);
    const actor = (req as any).user;
    const adminData = await superAdminService.createAdmin(
      { id: actor._id.toString(), email: actor.email, fullName: actor.fullName },
      validatedData
    );
    res.status(201).json({
      success: true,
      message: "Admin account provisioned successfully",
      ...adminData,
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      res.status(422).json({
        success: false,
        message: "Validation failed",
        errors: error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
        error: { message: "Validation failed" }
      });
      return;
    }
    if (error.message && error.message.includes("exists")) {
      res.status(400).json({ success: false, message: error.message });
    } else {
      next(error);
    }
  }
};

export const updateAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = updateAdminSchema.parse(req.body);
    const { id } = req.params;
    const actor = (req as any).user;
    const adminData = await superAdminService.updateAdmin(
      { id: actor._id.toString(), email: actor.email, fullName: actor.fullName },
      String(id),
      validatedData
    );
    res.status(200).json({
      success: true,
      message: "Admin updated successfully",
      ...adminData,
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      res.status(422).json({
        success: false,
        message: "Validation failed",
        errors: error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
        error: { message: "Validation failed" }
      });
      return;
    }
    next(error);
  }
};

export const deleteAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { confirm } = req.body;
    const actor = (req as any).user;
    if (!confirm) {
      res.status(422).json({ success: false, message: "Confirmation email is required" });
      return;
    }
    const cascadeData = await superAdminService.deleteAdmin(
      { id: actor._id.toString(), email: actor.email, fullName: actor.fullName },
      String(id),
      confirm
    );
    const hasFailedDeletions = cascadeData.cascadeResult.filesCleared.failedCount > 0;
    res.status(hasFailedDeletions ? 207 : 200).json({
      success: true,
      message: "Admin deleted completely",
      ...cascadeData,
    });
  } catch (error: any) {
    if (error.message && error.message.includes("Confirmation email")) {
      res.status(422).json({ success: false, message: error.message });
    } else {
      next(error);
    }
  }
};

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { actor: filterActor, action, from, to, page, limit } = req.query;
    const auditData = await superAdminService.getAuditLogs({
      actor: filterActor ? String(filterActor) : undefined,
      action: action ? String(action) : undefined,
      from: from ? String(from) : undefined,
      to: to ? String(to) : undefined,
      page: page ? parseInt(String(page), 10) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined,
    });
    res.status(200).json({
      success: true,
      ...auditData,
    });
  } catch (error) {
    next(error);
  }
};
