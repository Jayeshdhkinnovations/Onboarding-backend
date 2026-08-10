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
let userToken: string;
let otherUserToken: string;
let workspace: any;
let otherWorkspace: any;
let testForm: any;
let otherForm: any;

process.env.JWT_SECRET = "test-secret-key-1234567890-test-key-long-enough";

beforeAll(async () => {
  await mongoose.disconnect();
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // Create primary workspace owner & workspace
  const user = await User.create({
    firebaseUid: "analytics-uid-1",
    fullName: "Analytics Admin",
    email: "analytics1@test.com",
    role: "admin",
    status: "active",
  });
  workspace = await Workspace.create({
    name: "Analytics Workspace",
    owner: user._id,
  });
  user.workspaceId = workspace._id as any;
  await user.save();
  userToken = generateToken({ id: user._id.toString(), email: user.email, role: user.role });

  // Create second workspace owner & workspace (for 403 cross-workspace tests)
  const otherUser = await User.create({
    firebaseUid: "analytics-uid-2",
    fullName: "Other Admin",
    email: "analytics2@test.com",
    role: "admin",
    status: "active",
  });
  otherWorkspace = await Workspace.create({
    name: "Other Workspace",
    owner: otherUser._id,
  });
  otherUser.workspaceId = otherWorkspace._id as any;
  await otherUser.save();
  otherUserToken = generateToken({ id: otherUser._id.toString(), email: otherUser.email, role: otherUser.role });

  // Create form in primary workspace
  testForm = await Form.create({
    title: "Customer Feedback",
    workspaceId: workspace._id,
    status: "published",
    publishedSlug: "feedback-slug",
    fields: [
      {
        fieldId: "field_rating",
        label: "Overall Satisfaction",
        type: "dropdown",
        required: false,
        options: ["Great", "Average", "Poor"],
      },
      {
        fieldId: "field_comments",
        label: "Additional Comments",
        type: "short_text",
        required: false,
      },
    ],
  });

  // Create form in second workspace
  otherForm = await Form.create({
    title: "Other Form",
    workspaceId: otherWorkspace._id,
    status: "published",
    publishedSlug: "other-slug",
    fields: [],
  });

  // Seed responses for testForm
  await ResponseModel.create([
    {
      formId: testForm._id,
      status: "completed",
      submittedAt: new Date("2026-08-05T10:00:00Z"),
      answers: { field_rating: "Great", field_comments: "Awesome product!" },
    },
    {
      formId: testForm._id,
      status: "completed",
      submittedAt: new Date("2026-08-06T12:00:00Z"),
      answers: { field_rating: "Great", field_comments: "Very good" },
    },
    {
      formId: testForm._id,
      status: "in_progress",
      submittedAt: new Date("2026-08-07T14:00:00Z"),
      answers: { field_rating: "Average" },
    },
    {
      formId: testForm._id,
      status: "new",
      submittedAt: new Date("2026-08-08T16:00:00Z"),
      answers: {},
    },
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe("GET /api/analytics/overview", () => {
  it("should return 400 if formId query param is missing or invalid", async () => {
    const res1 = await request(app)
      .get("/api/analytics/overview")
      .set("Authorization", `Bearer ${userToken}`);
    expect(res1.status).toBe(400);

    const res2 = await request(app)
      .get("/api/analytics/overview?formId=invalid-id")
      .set("Authorization", `Bearer ${userToken}`);
    expect(res2.status).toBe(400);
  });

  it("should return 404 if form does not exist", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/analytics/overview?formId=${fakeId}`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(404);
  });

  it("should return 403 if form belongs to another workspace", async () => {
    const res = await request(app)
      .get(`/api/analytics/overview?formId=${otherForm._id}`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("should return KPI totals, real completionRate, and statusDistribution using MongoDB $group", async () => {
    const res = await request(app)
      .get(`/api/analytics/overview?formId=${testForm._id}&from=2026-08-01T00:00:00.000Z&to=2026-08-31T23:59:59.999Z&timezone=UTC`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.formId).toBe(testForm._id.toString());
    expect(data.total).toBe(4);
    expect(data.completed).toBe(2);
    expect(data.in_progress).toBe(1);
    expect(data.new).toBe(1);
    expect(data.completionRate).toBe(50); // 2 completed / 4 total = 50%
    expect(Array.isArray(data.statusDistribution)).toBe(true);

    const completedDist = data.statusDistribution.find((s: any) => s.status === "completed");
    expect(completedDist).toEqual({ status: "completed", count: 2, percentage: 50 });
  });
});

describe("GET /api/analytics/questions", () => {
  it("should return question summary contract response", async () => {
    const res = await request(app)
      .get(`/api/analytics/questions?formId=${testForm._id}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.formId).toBe(testForm._id.toString());
    expect(data.totalResponses).toBe(4);
    expect(Array.isArray(data.questions)).toBe(true);
    expect(data.questions.length).toBe(2);

    const ratingQ = data.questions.find((q: any) => q.fieldId === "field_rating");
    expect(ratingQ).toBeDefined();
    expect(ratingQ.totalAnswered).toBe(3);
    expect(ratingQ.responseRate).toBe(75); // 3 / 4 = 75%
    expect(ratingQ.summary.options).toBeDefined();
  });
});

describe("GET /api/analytics/trends", () => {
  it("should return trend points aggregated by date interval", async () => {
    const res = await request(app)
      .get(`/api/analytics/trends?formId=${testForm._id}&interval=day`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.points)).toBe(true);
  });
});

describe("GET /api/analytics/forms", () => {
  it("should return per-form analytics for the workspace", async () => {
    const res = await request(app)
      .get("/api/analytics/forms")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalForms).toBe(1);
    expect(res.body.data.totalResponses).toBe(4);
    expect(res.body.data.forms[0].completionRate).toBe(50);
  });
});
