import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import app from "../app";
import User from "../models/User";
import Workspace from "../models/Workspace";
import Form from "../models/Form";
import ResponseModel from "../models/Response";
import { generateToken } from "../utils/generateToken";

let mongoServer: MongoMemoryServer;
let userAToken: string;
let mockUserId: string;
let mockWorkspaceId: string;

process.env.JWT_SECRET = "test-secret-key-1234567890-test-key-long-enough";

beforeAll(async () => {
  await mongoose.disconnect();
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  const userA = await User.create({
    firebaseUid: "auth-mail-user-a",
    fullName: "Auth Mail User",
    email: "authmail@example.com",
    role: "admin",
  });
  mockUserId = userA._id.toString();

  const workspaceA = await Workspace.create({
    name: "Auth Mail Workspace",
    owner: userA._id,
  });
  mockWorkspaceId = workspaceA._id.toString();

  userA.workspaceId = workspaceA._id as any;
  await userA.save();

  userAToken = generateToken({
    id: mockUserId,
    email: userA.email,
    role: userA.role,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe("Auth Email & Session Enforcement Endpoints", () => {
  it("should return 401 on /api/auth/email-verification without token", async () => {
    const res = await request(app).post("/api/auth/email-verification").send({});

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("should return 202 Accepted on /api/auth/forgot-password for any input", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "randomuser@example.com" });

    expect(res.status).toBe(202);
    expect(res.body.message).toContain("password-reset link will be sent");
  });

  it("should return updated dashboard analytics with required totalForms, publishedForms, totalResponses, responsesThisMonth, recentActivity", async () => {
    // Create a form & response
    const form = await Form.create({
      title: "Analytics Form",
      workspaceId: mockWorkspaceId,
      status: "published",
      pages: [{ id: new mongoose.Types.ObjectId().toString(), order: 0, title: "Page 1" }],
      fields: [],
    });

    await ResponseModel.create({
      formId: form._id,
      answers: { "Full Name": "Test User" },
      status: "new",
      submittedAt: new Date(),
    });

    const res = await request(app)
      .get("/api/dashboard/analytics")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.analytics).toBeDefined();
    expect(res.body.analytics.totalForms).toBeGreaterThanOrEqual(1);
    expect(res.body.analytics.publishedForms).toBeGreaterThanOrEqual(1);
    expect(res.body.analytics.totalResponses).toBeGreaterThanOrEqual(1);
    expect(res.body.analytics.responsesThisMonth).toBeGreaterThanOrEqual(1);
    expect(res.body.analytics.recentActivity).toBeDefined();
    expect(Array.isArray(res.body.analytics.recentActivity)).toBe(true);
  });
});
