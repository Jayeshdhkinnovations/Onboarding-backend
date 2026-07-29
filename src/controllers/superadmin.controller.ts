import { Request, Response, NextFunction } from "express";
import { superAdminService } from "../services/superadmin.service";

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
    res.status(501).json({ message: "Not Implemented" });
  } catch (error) {
    next(error);
  }
};

export const createAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(501).json({ message: "Not Implemented" });
  } catch (error) {
    next(error);
  }
};

export const updateAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(501).json({ message: "Not Implemented" });
  } catch (error) {
    next(error);
  }
};

export const deleteAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(501).json({ message: "Not Implemented" });
  } catch (error) {
    next(error);
  }
};

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(501).json({ message: "Not Implemented" });
  } catch (error) {
    next(error);
  }
};
