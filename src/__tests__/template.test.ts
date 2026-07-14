import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import app from "../app";
import User from "../models/User";
import Workspace from "../models/Workspace";
import Form from "../models/Form";
import Template from "../models/Template";
import { generateToken } from "../utils/generateToken";

let mongoServer: MongoMemoryServer;
let authToken: string;
let mockUserId: string;
let mockWorkspaceId: string;
let activeTemplateId: string;
let inactiveTemplateId: string;

process.env.JWT_SECRET = "test-secret-key-1234567890-test-key-long-enough";

beforeAll(async () => {
  await mongoose.disconnect();
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // Create a mock user & workspace
  const user = await User.create({
    firebaseUid: "template-test-uid",
    fullName: "Template Tester",
    email: "templatetester@test.com",
    role: "admin",
  });
  mockUserId = user._id.toString();

  const workspace = await Workspace.create({
    name: "Tester's Workspace",
    owner: user._id,
  });
  mockWorkspaceId = workspace._id.toString();

  user.workspaceId = workspace._id as any;
  await user.save();

  // Generate JWT token
  authToken = generateToken({
    id: mockUserId,
    email: user.email,
    role: user.role,
  });

  // Seed two templates (one active, one inactive)
  const activeT = await Template.create({
    name: "Active Test Template",
    category: "Test",
    theme: "classic-light",
    isActive: true,
    fields: [
      { label: "Full Name", type: "short_text", required: true },
      { label: "Email Address", type: "email", required: true },
    ],
  });
  activeTemplateId = activeT._id.toString();

  const inactiveT = await Template.create({
    name: "Inactive Test Template",
    category: "Test",
    theme: "classic-dark",
    isActive: false,
    fields: [
      { label: "Phone Number", type: "phone", required: false },
    ],
  });
  inactiveTemplateId = inactiveT._id.toString();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe("Templates API Integration Tests", () => {
  it("should return a list of active templates", async () => {
    const res = await request(app)
      .get("/api/templates")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.length).toBe(1); // Only active template should be returned
    expect(res.body.data[0].name).toBe("Active Test Template");
    expect(res.body.data[0].isActive).toBe(true);
  });

  it("should block templates fetch if unauthorized", async () => {
    const res = await request(app)
      .get("/api/templates");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("should create a form from an active template scoped to workspace", async () => {
    const res = await request(app)
      .post(`/api/templates/${activeTemplateId}/use`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.title).toBe("Active Test Template");
    expect(res.body.data.workspaceId).toBe(mockWorkspaceId);
    expect(res.body.data.fields.length).toBe(2);
    expect(res.body.data.fields[0].label).toBe("Full Name");
    expect(res.body.data.fields[1].label).toBe("Email Address");

    // Verify it exists in Mongo
    const dbForm = await Form.findById(res.body.data._id);
    expect(dbForm).not.toBeNull();
    expect(dbForm!.title).toBe("Active Test Template");
  });

  it("should reject use request on non-existent template ID with 404", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post(`/api/templates/${fakeId}/use`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("should reject use request on inactive template ID with 404", async () => {
    const res = await request(app)
      .post(`/api/templates/${inactiveTemplateId}/use`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
