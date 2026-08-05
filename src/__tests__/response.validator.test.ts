import { updateResponseStatusSchema } from "../validations/response.validator";

describe("updateResponseStatusSchema - Unit Tests", () => {
  it("should accept valid status values: 'new', 'in_progress', 'completed'", () => {
    const valid1 = updateResponseStatusSchema.safeParse({ status: "new" });
    expect(valid1.success).toBe(true);

    const valid2 = updateResponseStatusSchema.safeParse({ status: "in_progress" });
    expect(valid2.success).toBe(true);

    const valid3 = updateResponseStatusSchema.safeParse({ status: "completed" });
    expect(valid3.success).toBe(true);
  });

  it("should reject invalid status values like 'draft', 'archived', 'invalid'", () => {
    const invalid1 = updateResponseStatusSchema.safeParse({ status: "draft" });
    expect(invalid1.success).toBe(false);

    const invalid2 = updateResponseStatusSchema.safeParse({ status: "archived" });
    expect(invalid2.success).toBe(false);

    const invalid3 = updateResponseStatusSchema.safeParse({ status: "invalid" });
    expect(invalid3.success).toBe(false);
  });

  it("should reject missing status field or empty payload", () => {
    const empty = updateResponseStatusSchema.safeParse({});
    expect(empty.success).toBe(false);
  });

  it("should reject non-string status values", () => {
    const numeric = updateResponseStatusSchema.safeParse({ status: 123 });
    expect(numeric.success).toBe(false);

    const nullValue = updateResponseStatusSchema.safeParse({ status: null });
    expect(nullValue.success).toBe(false);
  });
});
