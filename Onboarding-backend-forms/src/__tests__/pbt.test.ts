// Mock Firebase Admin Authentication offline
jest.mock("firebase-admin/auth", () => {
  return {
    getAuth: () => {
      return {
        createUser: async (data: any) => {
          return { uid: `mock-uid-${data.email}` };
        },
        verifyIdToken: async (token: string) => {
          if (token === "invalid-token") {
            throw new Error("Invalid Firebase token.");
          }
          return {
            uid: "mock-uid-session",
            email: "sessionuser@test.com",
            name: "Session User",
          };
        },
        deleteUser: async () => {
          return {};
        },
      };
    },
  };
});

jest.mock("firebase-admin/app", () => {
  return {
    initializeApp: () => {},
    cert: () => {},
    getApps: () => [],
  };
});

process.env.JWT_SECRET = "test-secret-key-pbt-1234567890-test-key-long-enough";

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import app from "../app";
import User from "../models/User";
import Workspace from "../models/Workspace";
import Form from "../models/Form";
import jwt from "jsonwebtoken";
import fc from "fast-check";

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  await mongoose.disconnect();
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
}, 900000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe("Form API Property-Based Testing", () => {
  let adminA: any;
  let adminB: any;
  let wsA: any;
  let wsB: any;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    // Disconnect and clean
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }

    adminA = await User.create({
      firebaseUid: "admin-a-pbt",
      fullName: "Admin A",
      email: "admina.pbt@test.com",
      role: "admin",
    });

    adminB = await User.create({
      firebaseUid: "admin-b-pbt",
      fullName: "Admin B",
      email: "adminb.pbt@test.com",
      role: "admin",
    });

    wsA = await Workspace.create({ name: "Workspace A", owner: adminA._id });
    wsB = await Workspace.create({ name: "Workspace B", owner: adminB._id });

    adminA.workspaceId = wsA._id;
    await adminA.save();

    adminB.workspaceId = wsB._id;
    await adminB.save();

    tokenA = jwt.sign(
      { id: adminA._id.toString(), email: adminA.email, role: adminA.role },
      process.env.JWT_SECRET!
    );

    tokenB = jwt.sign(
      { id: adminB._id.toString(), email: adminB.email, role: adminB.role },
      process.env.JWT_SECRET!
    );
  });

  const baseArb = {
    label: fc.string({ minLength: 3, maxLength: 20 }).map(s => s.trim().replace(/[^a-zA-Z0-9 ]/g, "A") + "a"),
    required: fc.boolean(),
    deleted: fc.constant(false),
  };

  const textArb = fc.record({
    ...baseArb,
    type: fc.constant("text" as const),
    minLength: fc.integer({ min: 0, max: 5 }),
    maxLength: fc.integer({ min: 6, max: 50 }),
  });

  const textareaArb = fc.record({
    ...baseArb,
    type: fc.constant("textarea" as const),
    minLength: fc.integer({ min: 0, max: 5 }),
    maxLength: fc.integer({ min: 6, max: 50 }),
  });

  const emailArb = fc.record({
    ...baseArb,
    type: fc.constant("email" as const),
  });

  const phoneArb = fc.record({
    ...baseArb,
    type: fc.constant("phone" as const),
    pattern: fc.constant("^\\+?[0-9]{10,15}$"),
  });

  const numberArb = fc.record({
    ...baseArb,
    type: fc.constant("number" as const),
    min: fc.integer({ min: -50, max: 0 }),
    max: fc.integer({ min: 1, max: 50 }),
  });

  const dateArb = fc.record({
    ...baseArb,
    type: fc.constant("date" as const),
    minDate: fc.constant("2026-01-01"),
    maxDate: fc.constant("2026-12-31"),
  });

  const dropdownArb = fc.record({
    ...baseArb,
    type: fc.constant("dropdown" as const),
    options: fc.array(fc.string({ minLength: 1, maxLength: 8 }).map(s => s.trim().replace(/[^a-zA-Z0-9]/g, "O") + "o"), { minLength: 1, maxLength: 3 }),
  });

  const multipleChoiceArb = fc.record({
    ...baseArb,
    type: fc.constant("multiple_choice" as const),
    options: fc.array(fc.string({ minLength: 1, maxLength: 8 }).map(s => s.trim().replace(/[^a-zA-Z0-9]/g, "O") + "o"), { minLength: 1, maxLength: 3 }),
  });

  const checkboxArb = fc.record({
    ...baseArb,
    type: fc.constant("checkbox" as const),
    options: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 8 }).map(s => s.trim().replace(/[^a-zA-Z0-9]/g, "O") + "o"), { minLength: 1, maxLength: 3 }), { nil: undefined }),
  });

  const fileArb = fc.record({
    ...baseArb,
    type: fc.constant("file" as const),
    maxFileSize: fc.integer({ min: 1, max: 10 }),
    allowedMimeTypes: fc.array(fc.constantFrom("image/png", "image/jpeg", "application/pdf"), { minLength: 1, maxLength: 2 }),
  });

  const validFieldArb: fc.Arbitrary<any> = fc.oneof(
    textArb,
    textareaArb,
    emailArb,
    phoneArb,
    numberArb,
    dateArb,
    dropdownArb,
    multipleChoiceArb,
    checkboxArb,
    fileArb
  );

  const validFormArb = fc.record({
    title: fc.string({ minLength: 4, maxLength: 30 }).map(s => s.trim().replace(/[^a-zA-Z0-9 ]/g, "T") + "t"),
    description: fc.string({ minLength: 0, maxLength: 100 }).map(s => s.trim().replace(/[^a-zA-Z0-9 ]/g, "D")),
    status: fc.constantFrom("active", "inactive"),
    fields: fc.array(validFieldArb, { minLength: 1, maxLength: 5 }),
  });

  // 1. Create -> Read Round-Trip Property Test
  it("Property: create->read round-trip invariant", async () => {
    await fc.assert(
      fc.asyncProperty(validFormArb, async (formInput) => {
        // Create Form
        const createRes = await request(app)
          .post("/api/forms")
          .set("Authorization", `Bearer ${tokenA}`)
          .send(formInput);

        expect(createRes.status).toBe(201);
        expect(createRes.body.success).toBe(true);
        const formId = createRes.body.form._id;

        // Read Form
        const readRes = await request(app)
          .get(`/api/forms/${formId}`)
          .set("Authorization", `Bearer ${tokenA}`);

        expect(readRes.status).toBe(200);
        const readForm = readRes.body.form;

        // Roundtrip checks
        expect(readForm.title).toBe(formInput.title);
        expect(readForm.description).toBe(formInput.description);
        expect(readForm.status).toBe(formInput.status);
        expect(readForm.fields).toHaveLength(formInput.fields.length);

        for (let i = 0; i < readForm.fields.length; i++) {
          const expected = formInput.fields[i] as any;
          const actual = readForm.fields[i] as any;
          expect(actual.label).toBe(expected.label);
          expect(actual.type).toBe(expected.type);
          expect(actual.required).toBe(expected.required);
        }

        // Cleanup after each iteration to prevent DB bloat/collisions
        await Form.findByIdAndDelete(formId);
      }),
      { numRuns: 20 } // Limit runs for test suite execution speed
    );
  });

  // 2. Update Idempotency Property Test
  it("Property: update-idempotency invariant", async () => {
    // Setup a static form first
    const createRes = await request(app)
      .post("/api/forms")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        title: "Initial Form",
        fields: [{ label: "Original Text", type: "text" }]
      });
    const formId = createRes.body.form._id;

    await fc.assert(
      fc.asyncProperty(validFormArb, async (formUpdateInput) => {
        // Run update 1
        const updateRes1 = await request(app)
          .put(`/api/forms/${formId}`)
          .set("Authorization", `Bearer ${tokenA}`)
          .send(formUpdateInput);

        expect(updateRes1.status).toBe(200);
        const state1 = updateRes1.body.form;

        // Run update 2 (sending back the fields with server-generated fieldIds to preserve identity)
        const updateRes2 = await request(app)
          .put(`/api/forms/${formId}`)
          .set("Authorization", `Bearer ${tokenA}`)
          .send({
            ...formUpdateInput,
            fields: state1.fields
          });

        expect(updateRes2.status).toBe(200);
        const state2 = updateRes2.body.form;

        // Compare state1 and state2
        expect(state2.title).toBe(state1.title);
        expect(state2.description).toBe(state1.description);
        expect(state2.status).toBe(state1.status);
        expect(state2.schemaVersion).toBe(state1.schemaVersion); // Should NOT increment schemaVersion since no changes occurred
        expect(state2.fields).toHaveLength(state1.fields.length);

        for (let i = 0; i < state2.fields.length; i++) {
          expect(state2.fields[i].label).toBe(state1.fields[i].label);
          expect(state2.fields[i].type).toBe(state1.fields[i].type);
          expect(state2.fields[i].fieldId).toBe(state1.fields[i].fieldId);
        }
      }),
      { numRuns: 20 }
    );

    // Cleanup
    await Form.findByIdAndDelete(formId);
  });

  // 3. Workspace Isolation Invariant Property Test
  it("Property: workspace-isolation invariant under adversarial requests", async () => {
    // Setup Form under Admin A
    const createRes = await request(app)
      .post("/api/forms")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        title: "Admin A Form",
        fields: [{ label: "A Text", type: "text" }]
      });
    const formId = createRes.body.form._id;

    // Generate random actions: GET, PUT, PATCH, DELETE, duplicate
    const actionArb = fc.constantFrom("GET", "PUT", "PATCH", "DELETE", "duplicate");

    await fc.assert(
      fc.asyncProperty(actionArb, validFormArb, async (action, updatePayload) => {
        let res: any;

        if (action === "GET") {
          res = await request(app)
            .get(`/api/forms/${formId}`)
            .set("Authorization", `Bearer ${tokenB}`);
        } else if (action === "PUT") {
          res = await request(app)
            .put(`/api/forms/${formId}`)
            .set("Authorization", `Bearer ${tokenB}`)
            .send(updatePayload);
        } else if (action === "PATCH") {
          res = await request(app)
            .patch(`/api/forms/${formId}`)
            .set("Authorization", `Bearer ${tokenB}`)
            .send({ title: "Mutated Title" });
        } else if (action === "DELETE") {
          res = await request(app)
            .delete(`/api/forms/${formId}`)
            .set("Authorization", `Bearer ${tokenB}`);
        } else {
          // duplicate
          res = await request(app)
            .post(`/api/forms/${formId}/duplicate`)
            .set("Authorization", `Bearer ${tokenB}`);
        }

        // Assert that all operations on Admin A's form by Admin B are 403 Forbidden
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error.message).toContain("Forbidden");
      }),
      { numRuns: 30 }
    );

    // Cleanup
    await Form.findByIdAndDelete(formId);
  });
});
