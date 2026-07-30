import { z } from "zod";

export const createAdminSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Name must be at least 3 characters")
    .max(50, "Name cannot exceed 50 characters"),
  email: z.string().trim().email("Please enter a valid email address").toLowerCase(),
  workspaceName: z
    .string()
    .trim()
    .min(3, "Workspace name must be at least 3 characters")
    .max(100, "Workspace name cannot exceed 100 characters"),
});

export const updateAdminSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Name must be at least 3 characters")
    .max(50, "Name cannot exceed 50 characters")
    .optional(),
  workspaceName: z
    .string()
    .trim()
    .min(3, "Workspace name must be at least 3 characters")
    .max(100, "Workspace name cannot exceed 100 characters")
    .optional(),
  status: z.enum(["active", "suspended"]).optional(),
}).refine((data) => data.name !== undefined || data.workspaceName !== undefined || data.status !== undefined, {
  message: "At least one field (name, workspaceName, or status) must be provided for update",
});
