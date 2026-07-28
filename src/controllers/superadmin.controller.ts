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
    res.status(501).json({ message: "Not Implemented" });
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
