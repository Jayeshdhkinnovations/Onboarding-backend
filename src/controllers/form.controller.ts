import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { FormService } from "../services/form.service";
import { createFormSchema, patchFormSchema } from "../validations/form.validator";
import mongoose from "mongoose";
import Workspace from "../models/Workspace";
import Upload from "../models/Upload";
import path from "path";
import fs from "fs";
import { getUploadDir } from "./upload.controller";

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
      res.status(401).json({
        success: false,
        message: "Not authorized",
        error: { message: "Not authorized" }
      });
      return;
    }

    if (req.body?.workspaceId || req.params?.workspaceId) {
      res.status(400).json({
        success: false,
        message: "workspaceId must not be provided in body or params",
        error: { message: "workspaceId must not be provided in body or params" }
      });
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
        error: { message: "No active workspace found for this user" }
      });
      return;
    }

    // Step 3: Delegate to FormService
    const form = await formService.createForm(workspaceId, validatedData);

    res.status(201).json({
      _id: form._id,
      title: form.title,
      description: form.description,
      workspaceId: form.workspaceId,
      status: form.status,
      fields: form.fields,
      pages: form.pages,
      branding: form.branding,
      settings: form.settings,
      slug: form.status === "published" ? (form.publishedSlug || form.slug) : form.slug,
      publishedSlug: form.publishedSlug,
      publishedAt: form.publishedAt,
      schemaVersion: form.schemaVersion,
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
      // For compatibility
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
    const formId = req.params.formId || req.params.id;

    if (!authReq.user) {
      res.status(401).json({
        success: false,
        message: "Not authorized",
        error: { message: "Not authorized" }
      });
      return;
    }

    if (req.body?.workspaceId || req.params?.workspaceId) {
      res.status(400).json({
        success: false,
        message: "workspaceId must not be provided in body or params",
        error: { message: "workspaceId must not be provided in body or params" }
      });
      return;
    }

    const workspaceId = await getWorkspaceIdFromUser(authReq.user);
    if (!workspaceId) {
      res.status(403).json({
        success: false,
        message: "Forbidden: No active workspace found for this user",
        error: { message: "Forbidden: No active workspace found for this user" }
      });
      return;
    }

    const form = await formService.getFormById(formId as string, workspaceId);

    res.status(200).json({
      _id: form._id,
      title: form.title,
      description: form.description,
      workspaceId: form.workspaceId,
      status: form.status,
      fields: form.fields,
      pages: form.pages,
      branding: form.branding,
      settings: form.settings,
      slug: form.status === "published" ? (form.publishedSlug || form.slug) : form.slug,
      publishedSlug: form.publishedSlug,
      publishedAt: form.publishedAt,
      schemaVersion: form.schemaVersion,
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
      // For compatibility
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
      res.status(401).json({
        success: false,
        message: "Not authorized",
        error: { message: "Not authorized" }
      });
      return;
    }

    if (req.body?.workspaceId || req.params?.workspaceId) {
      res.status(400).json({
        success: false,
        message: "workspaceId must not be provided in body or params",
        error: { message: "workspaceId must not be provided in body or params" }
      });
      return;
    }

    const workspaceId = await getWorkspaceIdFromUser(authReq.user);

    if (!workspaceId) {
      res.status(403).json({
        success: false,
        message: "Forbidden: No active workspace found for this user",
        error: { message: "Forbidden: No active workspace found for this user" }
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
      res.status(401).json({
        success: false,
        message: "Not authorized",
        error: { message: "Not authorized" }
      });
      return;
    }

    if (req.body?.workspaceId || req.params?.workspaceId) {
      res.status(400).json({
        success: false,
        message: "workspaceId must not be provided in body or params",
        error: { message: "workspaceId must not be provided in body or params" }
      });
      return;
    }

    const formId = req.params.formId || req.params.id;
    const workspaceId = await getWorkspaceIdFromUser(authReq.user);
    if (!workspaceId) {
      res.status(403).json({
        success: false,
        message: "Forbidden: No active workspace found for this user",
        error: { message: "Forbidden: No active workspace found for this user" }
      });
      return;
    }

    const form = await formService.updateForm(formId as string, workspaceId, req.body);

    res.status(200).json({
      _id: form._id,
      title: form.title,
      description: form.description,
      workspaceId: form.workspaceId,
      status: form.status,
      fields: form.fields,
      schemaVersion: form.schemaVersion,
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
      // For compatibility
      success: true,
      message: "Form updated successfully",
      form,
    });
  } catch (error) {
    next(error);
  }
};

export const patchForm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as any;
    if (!authReq.user) {
      res.status(401).json({
        success: false,
        message: "Not authorized",
        error: { message: "Not authorized" }
      });
      return;
    }

    if (req.body?.workspaceId || req.params?.workspaceId) {
      res.status(400).json({
        success: false,
        message: "workspaceId must not be provided in body or params",
        error: { message: "workspaceId must not be provided in body or params" }
      });
      return;
    }

    const formId = req.params.formId || req.params.id;
    const workspaceId = await getWorkspaceIdFromUser(authReq.user);
    if (!workspaceId) {
      res.status(403).json({
        success: false,
        message: "Forbidden: No active workspace found for this user",
        error: { message: "Forbidden: No active workspace found for this user" }
      });
      return;
    }

    // Validate payload using Zod patch schema
    const validatedData = patchFormSchema.parse(req.body);

    if (validatedData.status === "published") {
      const form = await formService.publishForm(formId as string, workspaceId, validatedData);
      res.status(200).json({
        _id: form._id,
        status: form.status,
        slug: form.publishedSlug,
        publishedAt: form.publishedAt,
        success: true,
      });
      return;
    }

    const form = await formService.patchForm(formId as string, workspaceId, validatedData);

    res.status(200).json({
      _id: form._id,
      title: form.title,
      description: form.description,
      workspaceId: form.workspaceId,
      status: form.status,
      fields: form.fields,
      pages: form.pages,
      branding: form.branding,
      settings: form.settings,
      slug: form.status === "published" ? (form.publishedSlug || form.slug) : form.slug,
      publishedSlug: form.publishedSlug,
      publishedAt: form.publishedAt,
      schemaVersion: form.schemaVersion,
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
      // For compatibility
      success: true,
      message: "Form updated successfully",
      form,
    });
  } catch (error) {
    next(error);
  }
};

export const publishForm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as any;
    if (!authReq.user) {
      res.status(401).json({
        success: false,
        message: "Not authorized",
        error: { message: "Not authorized" }
      });
      return;
    }

    if (req.body?.workspaceId || req.params?.workspaceId) {
      res.status(400).json({
        success: false,
        message: "workspaceId must not be provided in body or params",
        error: { message: "workspaceId must not be provided in body or params" }
      });
      return;
    }

    const formId = req.params.formId || req.params.id;
    const workspaceId = await getWorkspaceIdFromUser(authReq.user);
    if (!workspaceId) {
      res.status(403).json({
        success: false,
        message: "Forbidden: No active workspace found for this user",
        error: { message: "Forbidden: No active workspace found for this user" }
      });
      return;
    }

    const form = await formService.publishForm(formId as string, workspaceId);

    res.status(200).json({
      _id: form._id,
      status: form.status,
      slug: form.publishedSlug,
      publishedAt: form.publishedAt,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

export const closeForm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as any;
    if (!authReq.user) {
      res.status(401).json({
        success: false,
        message: "Not authorized",
        error: { message: "Not authorized" }
      });
      return;
    }

    if (req.body?.workspaceId || req.params?.workspaceId) {
      res.status(400).json({
        success: false,
        message: "workspaceId must not be provided in body or params",
        error: { message: "workspaceId must not be provided in body or params" }
      });
      return;
    }

    const formId = req.params.formId || req.params.id;
    const workspaceId = await getWorkspaceIdFromUser(authReq.user);
    if (!workspaceId) {
      res.status(403).json({
        success: false,
        message: "Forbidden: No active workspace found for this user",
        error: { message: "Forbidden: No active workspace found for this user" }
      });
      return;
    }

    const form = await formService.closeForm(formId as string, workspaceId);

    res.status(200).json({
      _id: form._id,
      status: form.status,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteForm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as any;
    if (!authReq.user) {
      res.status(401).json({
        success: false,
        message: "Not authorized",
        error: { message: "Not authorized" }
      });
      return;
    }

    if (req.body?.workspaceId || req.params?.workspaceId) {
      res.status(400).json({
        success: false,
        message: "workspaceId must not be provided in body or params",
        error: { message: "workspaceId must not be provided in body or params" }
      });
      return;
    }

    const formId = req.params.formId || req.params.id;
    const workspaceId = await getWorkspaceIdFromUser(authReq.user);
    if (!workspaceId) {
      res.status(403).json({
        success: false,
        message: "Forbidden: No active workspace found for this user",
        error: { message: "Forbidden: No active workspace found for this user" }
      });
      return;
    }

    await formService.deleteForm(formId as string, workspaceId);

    res.status(204).send();
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
      res.status(401).json({
        success: false,
        message: "Not authorized",
        error: { message: "Not authorized" }
      });
      return;
    }

    if (req.body?.workspaceId || req.params?.workspaceId) {
      res.status(400).json({
        success: false,
        message: "workspaceId must not be provided in body or params",
        error: { message: "workspaceId must not be provided in body or params" }
      });
      return;
    }

    const { formId } = req.params;
    const workspaceId = await getWorkspaceIdFromUser(authReq.user);
    if (!workspaceId) {
      res.status(403).json({
        success: false,
        message: "Forbidden: No active workspace found for this user",
        error: { message: "Forbidden: No active workspace found for this user" }
      });
      return;
    }

    const submissions = await formService.getSubmissions(formId as string, workspaceId);

    res.status(200).json({
      success: true,
      submissions,
    });
  } catch (error) {
    next(error);
  }
};

export const duplicateForm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as any;
    if (!authReq.user) {
      res.status(401).json({
        success: false,
        message: "Not authorized",
        error: { message: "Not authorized" }
      });
      return;
    }

    if (req.body?.workspaceId || req.params?.workspaceId) {
      res.status(400).json({
        success: false,
        message: "workspaceId must not be provided in body or params",
        error: { message: "workspaceId must not be provided in body or params" }
      });
      return;
    }

    const formId = req.params.formId || req.params.id;
    const workspaceId = await getWorkspaceIdFromUser(authReq.user);
    if (!workspaceId) {
      res.status(403).json({
        success: false,
        message: "Forbidden: No active workspace found for this user",
        error: { message: "Forbidden: No active workspace found for this user" }
      });
      return;
    }

    const form = await formService.duplicateForm(formId as string, workspaceId);

    res.status(201).json({
      _id: form._id,
      title: form.title,
      description: form.description,
      workspaceId: form.workspaceId,
      status: form.status,
      fields: form.fields,
      pages: form.pages,
      branding: form.branding,
      settings: form.settings,
      slug: form.status === "published" ? (form.publishedSlug || form.slug) : form.slug,
      publishedSlug: form.publishedSlug,
      publishedAt: form.publishedAt,
      schemaVersion: form.schemaVersion,
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
      // For compatibility
      success: true,
      message: "Form duplicated successfully",
      form,
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicFormBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const slug = req.params.slug as string;
    const formDoc = await formService.getPublicFormBySlug(slug);
    const form = formDoc.toObject();

    // Set cache headers compatible with frontend revalidate: 60 (ISR friendly)
    res.set("Cache-Control", "public, max-age=60, s-maxage=60, stale-while-revalidate=60");

    // Strip internal properties (workspaceId, preview slug, honeypot settings) and soft-deleted fields
    const fields = (form.fields || []).filter((f: any) => !f.deleted);
    const publicFields = fields.map((raw: any) => {
      const cleanField: any = {
        fieldId: raw.fieldId,
        pageId: raw.pageId,
        label: raw.label,
        type: raw.type,
        required: raw.required,
        placeholder: raw.placeholder !== undefined ? raw.placeholder : "",
        helpText: raw.helpText !== undefined ? raw.helpText : "",
      };
      if (raw.minLength !== undefined) cleanField.minLength = raw.minLength;
      if (raw.maxLength !== undefined) cleanField.maxLength = raw.maxLength;
      if (raw.pattern !== undefined) cleanField.pattern = raw.pattern;
      if (raw.min !== undefined) cleanField.min = raw.min;
      if (raw.max !== undefined) cleanField.max = raw.max;
      if (raw.minDate !== undefined) cleanField.minDate = raw.minDate;
      if (raw.maxDate !== undefined) cleanField.maxDate = raw.maxDate;
      if (raw.options !== undefined && raw.options.length > 0) cleanField.options = raw.options;
      if (raw.maxFileSize !== undefined) cleanField.maxFileSize = raw.maxFileSize;
      if (raw.allowedMimeTypes !== undefined && raw.allowedMimeTypes.length > 0) {
        cleanField.allowedMimeTypes = raw.allowedMimeTypes;
      }
      if (raw.logicRules !== undefined && raw.logicRules.length > 0) {
        cleanField.logicRules = raw.logicRules.map((rule: any) => ({
          ruleId: rule.ruleId,
          targetFieldId: rule.targetFieldId,
          condition: rule.condition,
          operator: rule.operator,
          value: rule.value,
          action: rule.action,
        }));
      }
      return cleanField;
    });

    const pages = (form.pages || []).map((raw: any) => {
      return {
        id: raw.id,
        order: raw.order,
        title: raw.title,
        description: raw.description,
      };
    });

    const branding = form.branding || {};
    const cleanBranding: any = {
      primaryColor: branding.primaryColor,
      logoUrl: branding.logoUrl,
      coverImageUrl: branding.coverImageUrl,
    };

    const settings = form.settings || {};
    const cleanSettings: any = {};
    if (settings.successMessage !== undefined) cleanSettings.successMessage = settings.successMessage;
    if (settings.layout !== undefined) cleanSettings.layout = settings.layout;
    if (settings.responseLimitEnabled !== undefined) cleanSettings.responseLimitEnabled = settings.responseLimitEnabled;
    if (settings.responseLimit !== undefined) cleanSettings.responseLimit = settings.responseLimit;
    if (settings.closeDate !== undefined) cleanSettings.closeDate = settings.closeDate;

    res.status(200).json({
      success: true,
      _id: form._id,
      title: form.title,
      description: form.description,
      status: form.status,
      fields: publicFields,
      pages,
      branding: cleanBranding,
      settings: cleanSettings,
      publishedSlug: form.publishedSlug,
      publishedAt: form.publishedAt,
    });
  } catch (error) {
    next(error);
  }
};

const cleanupUploadedFiles = async (files: Express.Multer.File[], deleteFromDb = false) => {
  if (!files || files.length === 0) return;
  const uploadDir = getUploadDir();
  for (const file of files) {
    const filePath = path.resolve(uploadDir, file.filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error("Failed to delete physical file during cleanup:", e);
      }
    }
    if (deleteFromDb) {
      try {
        await Upload.deleteOne({ path: file.filename });
      } catch (e) {
        console.error("Failed to delete Upload document during cleanup:", e);
      }
    }
  }
};

export const submitPublicForm = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let submissionSuccess = false;
  try {
    const slug = req.params.slug as string;
    const { data, _hp } = req.body;

    // Retrieve the published form first to use its fields for answers normalization
    const formDoc = await formService.getPublicFormBySlug(slug);
    const form = formDoc.toObject();

    // Parse answers JSON
    let answers: Record<string, any> = {};
    let parsed: any = null;

    if (data) {
      try {
        parsed = JSON.parse(data);
      } catch (e) {
        res.status(422).json({
          success: false,
          message: "Validation failed",
          errors: [{ field: "data", message: "Invalid JSON format in data field" }],
          error: { message: "Validation failed" }
        });
        return;
      }
    } else if (req.body && typeof req.body === "object") {
      parsed = req.body;
    }

    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.answers)) {
        // Array of answer objects (reconciled frontend shape)
        for (const ans of parsed.answers) {
          if (ans && typeof ans === "object") {
            const field = form.fields.find(
              (f: any) =>
                (f.fieldId && f.fieldId === ans.fieldId) ||
                f.label === ans.fieldLabel ||
                f.label === ans.label
            );
            if (field) {
              if (field.fieldId) answers[field.fieldId] = ans.value;
              answers[field.label] = ans.value;
            } else {
              if (ans.fieldId !== undefined) answers[ans.fieldId] = ans.value;
              if (ans.fieldLabel !== undefined) answers[ans.fieldLabel] = ans.value;
              if (ans.label !== undefined) answers[ans.label] = ans.value;
            }
          }
        }
      } else {
        // Flat key-value map inside JSON / body object
        for (const key of Object.keys(parsed)) {
          if (key !== "data" && key !== "_hp") {
            const field = form.fields.find(
              (f: any) => (f.fieldId && f.fieldId === key) || f.label === key
            );
            if (field) {
              if (field.fieldId) answers[field.fieldId] = parsed[key];
              answers[field.label] = parsed[key];
            } else {
              answers[key] = parsed[key];
            }
          }
        }
      }
    }

    // Flat multipart keys directly in req.body (e.g. key=value form-data)
    if (Object.keys(answers).length === 0 && req.body && typeof req.body === "object") {
      for (const key of Object.keys(req.body)) {
        if (key !== "data" && key !== "_hp") {
          const field = form.fields.find(
            (f: any) => (f.fieldId && f.fieldId === key) || f.label === key
          );
          if (field) {
            if (field.fieldId) answers[field.fieldId] = req.body[key];
            answers[field.label] = req.body[key];
          } else {
            answers[key] = req.body[key];
          }
        }
      }
    }

    // Honeypot check for bots (silent discard)
    if (_hp) {
      res.status(200).json({
        success: true,
        message: "Response submitted successfully",
        submission: {
          _id: new mongoose.Types.ObjectId().toString(),
          formId: form._id,
          answers: answers,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      return;
    }

    // Enforce 100 MB absolute limit on all uploaded files
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files as Express.Multer.File[]) {
        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB > 100) {
          res.status(422).json({
            success: false,
            message: "Validation failed",
            errors: [{
              field: file.fieldname,
              message: `File size exceeds the absolute limit of 100 MB.`
            }],
            error: { message: "Validation failed" }
          });
          return;
        }
      }
    }

    // Map and validate files matching file_upload fields
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      for (const field of form.fields) {
        if (field.type === "file_upload" && !field.deleted) {
          const file = (req.files as Express.Multer.File[]).find(
            (f) => f.fieldname === field.label || f.fieldname === field.fieldId
          );
          if (file) {
            // Validate file size limit (in MB)
            if (field.maxFileSize !== undefined) {
              const fileSizeMB = file.size / (1024 * 1024);
              if (fileSizeMB > field.maxFileSize) {
                res.status(422).json({
                  success: false,
                  message: "Validation failed",
                  errors: [{
                    field: field.label,
                    message: `Field "${field.label}" file size exceeds the limit of ${field.maxFileSize} MB.`
                  }],
                  error: { message: "Validation failed" }
                });
                return;
              }
            }
            // Validate file MIME types
            if (field.allowedMimeTypes && field.allowedMimeTypes.length > 0) {
              if (!field.allowedMimeTypes.includes(file.mimetype)) {
                res.status(422).json({
                  success: false,
                  message: "Validation failed",
                  errors: [{
                    field: field.label,
                    message: `Field "${field.label}" file type "${file.mimetype}" is not allowed. Allowed types: ${field.allowedMimeTypes.join(", ")}.`
                  }],
                  error: { message: "Validation failed" }
                });
                return;
              }
            }

            // Create Upload metadata document
            const workspace = await Workspace.findById(form.workspaceId);
            if (!workspace) {
              res.status(400).json({
                success: false,
                message: "Workspace not found",
              });
              return;
            }

            await Upload.create({
              name: file.originalname,
              size: file.size,
              type: file.mimetype,
              path: file.filename,
              owner: workspace.owner,
              uploadTime: new Date(),
              isBranding: false,
            });

            // Map safe file URL to response answers key
            const fileUrl = `${req.protocol}://${req.get("host")}/api/upload/file/${file.filename}`;
            answers[field.label] = {
              fileName: fileUrl,
              fileSize: file.size,
              mimeType: file.mimetype,
            };

            // Link each stored file's key/path to its answer fieldId on the response record
            if (field.fieldId) {
              answers[field.fieldId] = file.filename;
            }
          }
        }
      }
    }

    // Calculate client IP hash
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const ipStr = Array.isArray(ip) ? ip[0] : (typeof ip === "string" ? ip : "unknown");
    const hashedIp = crypto.createHash("sha256").update(ipStr).digest("hex");

    // Call dynamic validation and persistence routine in formService
    const submission = await formService.submitForm(form._id.toString(), answers, hashedIp);
    submissionSuccess = true;
    const submissionObj = submission.toObject();
    delete (submissionObj as any).ipHash;

    res.status(200).json({
      success: true,
      message: "Response submitted successfully",
      submission: submissionObj,
    });
  } catch (error) {
    next(error);
  } finally {
    if (!submissionSuccess && req.files && Array.isArray(req.files) && req.files.length > 0) {
      await cleanupUploadedFiles(req.files as Express.Multer.File[], true);
    }
  }
};

