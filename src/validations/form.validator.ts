import { z } from "zod";

const baseFieldSchema = z.object({
  fieldId: z.string().trim().optional(),
  label: z
    .string()
    .trim()
    .min(1, "Field label must be at least 1 character")
    .max(100, "Field label cannot exceed 100 characters"),
  required: z.boolean().default(false),
  deleted: z.boolean().default(false),
});

const shortTextObj = baseFieldSchema.extend({
  type: z.literal("text"),
  minLength: z.number().nonnegative("minLength must be non-negative").optional(),
  maxLength: z.number().nonnegative("maxLength must be non-negative").optional(),
});

const longTextObj = baseFieldSchema.extend({
  type: z.literal("textarea"),
  minLength: z.number().nonnegative("minLength must be non-negative").optional(),
  maxLength: z.number().nonnegative("maxLength must be non-negative").optional(),
});

const emailObj = baseFieldSchema.extend({
  type: z.literal("email"),
});

const phoneObj = baseFieldSchema.extend({
  type: z.literal("phone"),
  pattern: z.string().trim().optional(),
});

const numberObj = baseFieldSchema.extend({
  type: z.literal("number"),
  min: z.number().optional(),
  max: z.number().optional(),
});

const dateObj = baseFieldSchema.extend({
  type: z.literal("date"),
  minDate: z.string().optional(),
  maxDate: z.string().optional(),
});

const dropdownObj = baseFieldSchema.extend({
  type: z.literal("dropdown"),
  options: z
    .array(z.string().trim().min(1, "Option value cannot be empty"))
    .min(1, "Dropdown must have at least one option"),
});

const multipleChoiceObj = baseFieldSchema.extend({
  type: z.literal("multiple_choice"),
  options: z
    .array(z.string().trim().min(1, "Option value cannot be empty"))
    .min(1, "Multiple choice must have at least one option"),
});

const checkboxObj = baseFieldSchema.extend({
  type: z.literal("checkbox"),
  options: z.array(z.string().trim().min(1, "Option value cannot be empty")).optional(),
});

const fileUploadObj = baseFieldSchema.extend({
  type: z.literal("file"),
  maxFileSize: z.number().positive("maxFileSize must be positive").optional(), // in MB
  allowedMimeTypes: z.array(z.string().trim().min(1, "MIME type cannot be empty")).optional(),
});

export const fieldSchema = z
  .discriminatedUnion("type", [
    shortTextObj,
    longTextObj,
    emailObj,
    phoneObj,
    numberObj,
    dateObj,
    dropdownObj,
    multipleChoiceObj,
    checkboxObj,
    fileUploadObj,
  ])
  .superRefine((data, ctx) => {
    if (data.type === "text" || data.type === "textarea") {
      if (data.minLength !== undefined && data.maxLength !== undefined && data.minLength > data.maxLength) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "minLength cannot be greater than maxLength",
          path: ["minLength"],
        });
      }
    }
    if (data.type === "number") {
      if (data.min !== undefined && data.max !== undefined && data.min > data.max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "min cannot be greater than max",
          path: ["min"],
        });
      }
    }
    if (data.type === "date") {
      if (data.minDate !== undefined && data.maxDate !== undefined) {
        const minD = new Date(data.minDate);
        const maxD = new Date(data.maxDate);
        if (isNaN(minD.getTime())) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "minDate must be a valid date",
            path: ["minDate"],
          });
        }
        if (isNaN(maxD.getTime())) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "maxDate must be a valid date",
            path: ["maxDate"],
          });
        }
        if (!isNaN(minD.getTime()) && !isNaN(maxD.getTime()) && minD > maxD) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "minDate cannot be greater than maxDate",
            path: ["minDate"],
          });
        }
      } else {
        if (data.minDate !== undefined && isNaN(new Date(data.minDate).getTime())) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "minDate must be a valid date",
            path: ["minDate"],
          });
        }
        if (data.maxDate !== undefined && isNaN(new Date(data.maxDate).getTime())) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "maxDate must be a valid date",
            path: ["maxDate"],
          });
        }
      }
    }
  });

export const createFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Form title must be at least 3 characters")
    .max(100, "Form title cannot exceed 100 characters"),
  description: z.string().trim().max(500, "Description cannot exceed 500 characters").optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  fields: z.array(fieldSchema).default([]),
  slug: z.string().trim().optional(),
  publishedSlug: z.string().trim().optional(),
});

export const patchFormSchema = z.object({
  title: z
    .string()
    .trim()
    .max(100, "Form title cannot exceed 100 characters")
    .optional(),
  description: z.string().trim().max(500, "Description cannot exceed 500 characters").optional(),
  status: z.enum(["active", "inactive"]).optional(),
  fields: z.array(fieldSchema).optional(),
  slug: z.string().trim().optional(),
  publishedSlug: z.string().trim().optional(),
});


