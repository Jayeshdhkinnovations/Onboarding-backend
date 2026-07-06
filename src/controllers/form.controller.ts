import { Request, Response, NextFunction } from "express";
import { FormService } from "../services/form.service";
import { createFormSchema } from "../validations/form.validator";
import Workspace from "../models/Workspace";

const formService = new FormService();

const getWorkspaceIdFromUser = async (user: any): Promise<string> => {
  if (user.workspaceId) {
    return user.workspaceId._id ? user.workspaceId._id.toString() : user.workspaceId.toString();
  }
  const workspace = await Workspace.findOne({ owner: user._id });
  return workspace ? workspace._id.toString() : "";
};

export const createForm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as any;
    if (!authReq.user) {
      res.status(401).json({ success: false, message: "Not authorized" });
      return;
    }

    // Step 1: Validate payload using Zod
    const validatedData = createFormSchema.parse(req.body);

    // Step 2: Get workspaceId strictly from JWT user context
    const workspaceId = await getWorkspaceIdFromUser(authReq.user);

    if (!workspaceId) {
      res.status(400).json({
        success: false,
        message: "No active workspace found for this user",
      });
      return;
    }

    // Step 3: Delegate to FormService
    const form = await formService.createForm(workspaceId, validatedData);

    res.status(201).json({
      success: true,
      message: "Form created successfully",
      form,
    });
  } catch (error) {
    next(error);
  }
};

export const getForm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as any;
    const { id } = req.params;

    if (!authReq.user) {
      res.status(401).json({ success: false, message: "Not authorized" });
      return;
    }

    const workspaceId = await getWorkspaceIdFromUser(authReq.user);
    const form = await formService.getFormById(id as string, workspaceId);

    res.status(200).json({
      success: true,
      form,
    });
  } catch (error) {
    next(error);
  }
};

export const listForms = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as any;
    if (!authReq.user) {
      res.status(401).json({ success: false, message: "Not authorized" });
      return;
    }

    const workspaceId = await getWorkspaceIdFromUser(authReq.user);

    if (!workspaceId) {
      res.status(400).json({
        success: false,
        message: "No active workspace found for this user",
      });
      return;
    }

    // Extract query parameters for search, status, and pagination
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const result = await formService.listForms(workspaceId, {
      search,
      status,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateForm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as any;
    if (!authReq.user) {
      res.status(401).json({ success: false, message: "Not authorized" });
      return;
    }

    const { id } = req.params;
    const workspaceId = await getWorkspaceIdFromUser(authReq.user);

    const form = await formService.updateForm(id as string, workspaceId, req.body);

    res.status(200).json({
      success: true,
      message: "Form updated successfully",
      form,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteForm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as any;
    if (!authReq.user) {
      res.status(401).json({ success: false, message: "Not authorized" });
      return;
    }

    const { id } = req.params;
    const workspaceId = await getWorkspaceIdFromUser(authReq.user);

    await formService.deleteForm(id as string, workspaceId);

    res.status(200).json({
      success: true,
      message: "Form and all its submissions deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const submitForm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { formId } = req.params;
    const { answers } = req.body;

    const submission = await formService.submitForm(formId as string, answers);

    res.status(201).json({
      success: true,
      message: "Response submitted successfully",
      submission,
    });
  } catch (error) {
    next(error);
  }
};

export const getSubmissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as any;
    if (!authReq.user) {
      res.status(401).json({ success: false, message: "Not authorized" });
      return;
    }

    const { formId } = req.params;
    const workspaceId = await getWorkspaceIdFromUser(authReq.user);

    const submissions = await formService.getSubmissions(formId as string, workspaceId);

    res.status(200).json({
      success: true,
      submissions,
    });
  } catch (error) {
    next(error);
  }
};
