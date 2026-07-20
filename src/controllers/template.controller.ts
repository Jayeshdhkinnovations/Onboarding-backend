import { Request, Response } from "express";
import Template from "../models/Template";
import { FormService } from "../services/form.service";
import Workspace from "../models/Workspace";
import mongoose from "mongoose";

const formService = new FormService();

const getWorkspaceIdFromUser = async (user: any): Promise<string> => {
  if (user.workspaceId) {
    return user.workspaceId._id ? user.workspaceId._id.toString() : user.workspaceId.toString();
  }
  const workspace = await Workspace.findOne({ owner: user._id });
  return workspace ? workspace._id.toString() : "";
};

// GET /api/templates - Returns all active templates
export const getTemplates = async (req: Request, res: Response): Promise<void> => {
  try {
    const templates = await Template.find({ isActive: true });
    res.status(200).json({
      success: true,
      data: templates.map((t) => ({
        _id: t._id.toString(),
        id: t._id.toString(),
        name: t.name,
        category: t.category,
        fields: t.fields,
        theme: t.theme,
        isActive: t.isActive,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching templates:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching templates",
      error: error.message,
    });
  }
};

// POST /api/templates/:id/use - Use a template to create a new form
export const useTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    const authReq = req as any;

    if (!authReq.user) {
      res.status(401).json({
        success: false,
        message: "Not authorized",
      });
      return;
    }

    // Reject use on non-existent template
    if (!id || typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(404).json({
        success: false,
        message: "Template not found",
      });
      return;
    }

    const template = await Template.findOne({ _id: id, isActive: true });
    if (!template) {
      res.status(404).json({
        success: false,
        message: "Template not found or is inactive",
      });
      return;
    }

    // Scope the new form to the caller's workspace (from the JWT)
    const workspaceId = await getWorkspaceIdFromUser(authReq.user);
    if (!workspaceId) {
      res.status(400).json({
        success: false,
        message: "No active workspace found for this user",
      });
      return;
    }

    // Map template fields, omitting any preset fieldId or _id to allow FormService to generate fresh ones
    const formFields = template.fields.map((f: any) => {
      const raw = f.toObject ? f.toObject() : f;
      return {
        label: raw.label,
        type: raw.type,
        required: raw.required,
        deleted: raw.deleted ?? false,
        minLength: raw.minLength,
        maxLength: raw.maxLength,
        pattern: raw.pattern,
        min: raw.min,
        max: raw.max,
        minDate: raw.minDate,
        maxDate: raw.maxDate,
        options: raw.options,
        maxFileSize: raw.maxFileSize,
        allowedMimeTypes: raw.allowedMimeTypes,
        logicRules: raw.logicRules,
      };
    });

    const formDetails = {
      title: template.name,
      description: `Created from template: ${template.name}`,
      fields: formFields,
      status: "draft" as const, // Default to draft, or active as per project standard (Form default is draft/active, let's keep draft since "a duplicate always starts as a draft" in duplicate controller)
    };

    // Create the new form
    const newForm = await formService.createForm(workspaceId, formDetails as any);

    res.status(201).json({
      success: true,
      message: "Form created from template successfully",
      data: newForm,
    });
  } catch (error: any) {
    console.error("Error using template:", error);
    res.status(500).json({
      success: false,
      message: "Error creating form from template",
      error: error.message,
    });
  }
};
