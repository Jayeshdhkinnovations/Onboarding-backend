import { z } from "zod";

export const fieldSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1, "Field label must be at least 1 character")
      .max(100, "Field label cannot exceed 100 characters"),
    type: z.enum(["text", "number", "dropdown", "textarea", "checkbox", "email"]),
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1, "Option value cannot be empty")).optional().default([]),
  })
  .refine(
    (data) => {
      if (data.type === "dropdown") {
        return Array.isArray(data.options) && data.options.length > 0;
      }
      return true;
    },
    {
      message: "Options are required and must not be empty for dropdown field type",
      path: ["options"],
    }
  );

export const createFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Form title must be at least 3 characters")
    .max(100, "Form title cannot exceed 100 characters"),
  description: z.string().trim().max(500, "Description cannot exceed 500 characters").optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  fields: z.array(fieldSchema).default([]),
});
