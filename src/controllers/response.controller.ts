import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { ResponseService } from "../services/response.service";
import { updateResponseStatusSchema } from "../validations/response.validator";
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

export const getResponseDetail = async (
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

    const workspaceId = await getWorkspaceIdFromUser(authReq.user);
    const { id } = req.params;

    const host = req.get("host") || "localhost";
    const protocol = req.protocol || "http";

    const response = await responseService.getResponseDetail(
      workspaceId,
      String(id),
      host,
      protocol
    );

    res.status(200).json({
      success: true,
      response,
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

export const updateResponseStatus = async (
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

    const workspaceId = await getWorkspaceIdFromUser(authReq.user);
    const { id } = req.params;

    // Validate request body status using Zod schema
    const validated = updateResponseStatusSchema.parse(req.body);

    const updatedResponse = await responseService.updateResponseStatus(
      workspaceId,
      String(id),
      validated.status
    );

    res.status(200).json({
      success: true,
      message: "Response status updated successfully",
      response: updatedResponse,
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
        error: { message: "Validation failed" },
      });
      return;
    }
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

export const deleteResponse = async (
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

    const workspaceId = await getWorkspaceIdFromUser(authReq.user);
    const { id } = req.params;

    await responseService.deleteResponse(workspaceId, String(id));

    // Return HTTP 204 No Content on successful deletion
    res.status(204).send();
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

export const getResponseFileUrl = async (
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

    const workspaceId = await getWorkspaceIdFromUser(authReq.user);
    const { id, fileId } = req.params;

    const host = req.get("host") || "localhost";
    const protocol = req.protocol || "http";

    const result = await responseService.getResponseFileUrl(
      workspaceId,
      String(id),
      String(fileId),
      host,
      protocol
    );

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
