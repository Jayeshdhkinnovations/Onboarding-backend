import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import app from "../app";
import User from "../models/User";
import Workspace from "../models/Workspace";
import Form from "../models/Form";
import { generateToken } from "../utils/generateToken";

let mongoServer: MongoMemoryServer;
let tokenA: string;
let adminA: any;
let wsA: any;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-key-1234567890-test-key-long-enough";
  await mongoose.disconnect();
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  adminA = await User.create({
    firebaseUid: "uid-a",
    fullName: "Admin A",
    email: "admina@test.com",
    role: "admin",
  });
  wsA = await Workspace.create({ name: "Workspace A", owner: adminA._id });
  adminA.workspaceId = wsA._id;
  await adminA.save();

  tokenA = generateToken({ id: adminA._id.toString(), email: adminA.email, role: adminA.role });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe("GET /api/public/:slug Integration Tests", () => {
  it("should fetch a published form by its publishedSlug successfully without authentication", async () => {
    // 1. Create a form
    const createRes = await request(app)
      .post("/api/forms")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        title: "Public Test Form",
        description: "This is a public test form",
        fields: [
          { label: "Email", type: "email", required: true, placeholder: "Enter email", helpText: "Must be a valid address" },
          { label: "Deleted Field", type: "short_text", required: false, deleted: true }
        ],
        settings: {
          honeypotEnabled: true,
          layout: "compact"
        }
      });
    expect(createRes.status).toBe(201);
    const formId = createRes.body.form._id;

    // 2. Publish the form
    const publishRes = await request(app)
      .post(`/api/forms/${formId}/publish`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(publishRes.status).toBe(200);
    const slug = publishRes.body.slug;
    expect(slug).toBeDefined();

    // 3. Fetch public form by slug (no Auth header)
    const publicRes = await request(app)
      .get(`/api/public/${slug}`);
    
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.success).toBe(true);
    expect(publicRes.body._id).toBe(formId);
    expect(publicRes.body.title).toBe("Public Test Form");
    expect(publicRes.body.description).toBe("This is a public test form");
    expect(publicRes.body.status).toBe("published");
    expect(publicRes.body.publishedSlug).toBe(slug);
    expect(publicRes.body.publishedAt).toBeDefined();

    // Assert cache control header
    expect(publicRes.headers["cache-control"]).toContain("public");
    expect(publicRes.headers["cache-control"]).toContain("max-age=60");

    // Assert soft-deleted field is stripped
    expect(publicRes.body.fields.length).toBe(1);
    expect(publicRes.body.fields[0].label).toBe("Email");
    expect(publicRes.body.fields[0].deleted).toBeUndefined();
    expect(publicRes.body.fields[0].placeholder).toBe("Enter email");
    expect(publicRes.body.fields[0].helpText).toBe("Must be a valid address");

    // Assert internal fields are stripped
    expect(publicRes.body.workspaceId).toBeUndefined();
    expect(publicRes.body.slug).toBeUndefined(); // Preview slug is stripped
    expect(publicRes.body.settings).toBeDefined();
    expect(publicRes.body.settings.honeypotEnabled).toBeUndefined(); // Honeypot config is stripped
    expect(publicRes.body.settings.layout).toBe("compact");
  });

  it("should return 404 for a draft slug", async () => {
    // 1. Create a draft form
    const createRes = await request(app)
      .post("/api/forms")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        title: "Draft Public Test Form",
        fields: [{ label: "Email", type: "email", required: true }],
      });
    expect(createRes.status).toBe(201);
    
    // Draft forms don't have a publishedSlug yet, but let's query the draft slug or direct slug
    const draftSlug = createRes.body.form.slug;

    const publicRes = await request(app)
      .get(`/api/public/${draftSlug}`);
    
    expect(publicRes.status).toBe(404);
  });

  it("should return 404 for a closed form slug", async () => {
    // 1. Create and publish form
    const createRes = await request(app)
      .post("/api/forms")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        title: "Closed Public Test Form",
        fields: [{ label: "Email", type: "email", required: true }],
      });
    expect(createRes.status).toBe(201);
    const formId = createRes.body.form._id;

    const publishRes = await request(app)
      .post(`/api/forms/${formId}/publish`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(publishRes.status).toBe(200);
    const slug = publishRes.body.slug;

    // 2. Close the form
    const closeRes = await request(app)
      .post(`/api/forms/${formId}/close`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(closeRes.status).toBe(200);

    // 3. Fetch public form by slug - must return 404
    const publicRes = await request(app)
      .get(`/api/public/${slug}`);
    
    expect(publicRes.status).toBe(404);
  });

  it("should return 404 for an unknown slug", async () => {
    const publicRes = await request(app)
      .get(`/api/public/non-existent-slug-12345678`);
    
    expect(publicRes.status).toBe(404);
  });
});
