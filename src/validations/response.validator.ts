import { z } from "zod";

export const updateResponseStatusSchema = z.object({
  status: z.enum(["new", "in_progress", "completed"], {
    error: "status must be one of 'new', 'in_progress', or 'completed'",
  }),
});
