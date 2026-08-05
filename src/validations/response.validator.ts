import { z } from "zod";

export const normalizeStatus = (rawStatus: any): string => {
  if (typeof rawStatus !== "string") return "";
  let s = rawStatus.trim().toLowerCase();
  s = s.replace(/-/g, "_");
  if (s === "pending" || s === "partial" || s === "flagged") {
    return "in_progress";
  }
  if (s === "done" || s === "complete") {
    return "completed";
  }
  return s;
};

export const updateResponseStatusSchema = z.object({
  status: z
    .any()
    .transform((val) => normalizeStatus(val))
    .refine(
      (val) => ["new", "in_progress", "completed"].includes(val),
      {
        message: "status must be one of 'new', 'in_progress', or 'completed'",
      }
    ),
});
