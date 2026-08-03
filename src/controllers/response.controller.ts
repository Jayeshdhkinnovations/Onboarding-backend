import { Request, Response, NextFunction } from "express";
import { ResponseService } from "../services/response.service";
import Workspace from "../models/Workspace";

const responseService = new ResponseService();

const getWorkspaceIdFromUser = async (user: any): Promise<string> => {
  if (user.workspaceId) {
    return user.workspaceId._id ? user.workspaceId._id.toString() : user.workspaceId.toString();
  }
  const workspace = await Workspace.findOne({ owner: user._id });
  return workspace ? workspace._id.toString() : "";
};

export const getResponses = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as any;
    if (!authReq.user) {
      res.status(401).json({
        success: false,
        message: "Not authorized",
        error: { message: "Not authorized" },
      });
      return;
    }

    // Workspace scoping: workspaceId strictly derived from JWT user context
    const workspaceId = await getWorkspaceIdFromUser(authReq.user);
    if (!workspaceId) {
      res.status(400).json({
        success: false,
        message: "User is not associated with any workspace",
        error: { message: "User is not associated with any workspace" },
      });
      return;
    }

    const { formId, status, search, page, limit } = req.query;

    const result = await responseService.getResponses({
      workspaceId,
      formId: formId ? String(formId) : undefined,
      status: status ? String(status) : undefined,
      search: search ? String(search) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        error: { message: error.message },
      });
      return;
    }
    next(error);
  }
};
