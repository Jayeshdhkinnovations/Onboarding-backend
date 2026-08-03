import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app";
import User from "../models/User";
import Workspace from "../models/Workspace";
import Form from "../models/Form";
import ResponseModel from "../models/Response";
import { generateToken } from "../utils/generateToken";

let mongoServer: MongoMemoryServer;
let userAToken: string;
let userBToken: string;
let userAId: string;
let userBId: string;
let workspaceAId: string;
let workspaceBId: string;
let formAId: string;
let formBId: string;

beforeAll(async () => {
  process.env.JWT_SECRET = "testsecret";
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // User A setup
  const userA = await User.create({
    firebaseUid: "user-a-uid-responses",
    fullName: "User A",
    email: "usera-resp@test.com",
    role: "admin",
  });
  userAId = userA._id.toString();

  const wsA = await Workspace.create({
    name: "Workspace A",
    owner: userA._id,
  });
  workspaceAId = wsA._id.toString();
  userA.workspaceId = wsA._id as any;
  await userA.save();

  userAToken = generateToken({
    id: userAId,
    email: userA.email,
    role: userA.role,
  });

  // User B setup
  const userB = await User.create({
    firebaseUid: "user-b-uid-responses",
    fullName: "User B",
    email: "userb-resp@test.com",
    role: "admin",
  });
  userBId = userB._id.toString();

  const wsB = await Workspace.create({
    name: "Workspace B",
    owner: userB._id,
  });
  workspaceBId = wsB._id.toString();
  userB.workspaceId = wsB._id as any;
  await userB.save();

  userBToken = generateToken({
    id: userBId,
    email: userB.email,
    role: userB.role,
  });

  // Create Form A for User A
  const formA = await Form.create({
    title: "Form A",
    workspaceId: new mongoose.Types.ObjectId(workspaceAId),
    status: "published",
    publishedSlug: "form-a-slug",
    fields: [
      { fieldId: "f1", label: "Email", type: "email", required: false },
      { fieldId: "f2", label: "Feedback", type: "short_text", required: false },
    ],
  });
  formAId = (formA._id as mongoose.Types.ObjectId).toString();

  // Create Form B for User B
  const formB = await Form.create({
    title: "Form B",
    workspaceId: new mongoose.Types.ObjectId(workspaceBId),
    status: "published",
    publishedSlug: "form-b-slug",
    fields: [
      { fieldId: "f3", label: "Name", type: "short_text", required: false },
    ],
  });
  formBId = (formB._id as mongoose.Types.ObjectId).toString();

  // Seed responses for Form A
  const now = Date.now();
  await ResponseModel.create({
    formId: formA._id,
    answers: { Email: "alice@example.com", Feedback: "Great platform" },
    status: "completed",
    submittedAt: new Date(now - 3000),
  });

  await ResponseModel.create({
    formId: formA._id,
    answers: { Email: "bob@example.com", Feedback: "Needs improvement" },
    status: "completed",
    submittedAt: new Date(now - 2000),
  });

  await ResponseModel.create({
    formId: formA._id,
    answers: { Email: "charlie@example.com", Feedback: "Excellent customer service" },
    status: "flagged",
    submittedAt: new Date(now - 1000),
  });

  // Seed response for Form B
  await ResponseModel.create({
    formId: formB._id,
    answers: { Name: "David" },
    status: "completed",
    submittedAt: new Date(now),
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe("GET /api/responses Integration & Security Tests", () => {
  it("should fetch responses for a workspace form with pagination and submittedAt desc order", async () => {
    const res = await request(app)
      .get(`/api/responses?formId=${formAId}&page=1&limit=2`)
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.length).toBe(2);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(2);
    expect(res.body.totalPages).toBe(2);

    // Verify ordering: newest first (charlie -> bob -> alice)
    const timestamps = res.body.data.map((r: any) => new Date(r.submittedAt).getTime());
    expect(timestamps[0]).toBeGreaterThanOrEqual(timestamps[1]);
  });

  it("should cap limit at 50 per page max", async () => {
    const res = await request(app)
      .get(`/api/responses?formId=${formAId}&limit=200`)
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(50);
  });

  it("should filter responses by status", async () => {
    const res = await request(app)
      .get(`/api/responses?formId=${formAId}&status=flagged`)
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].status).toBe("flagged");
    expect(res.body.data[0].answers.Email).toBe("charlie@example.com");
  });

  it("should search against answers content", async () => {
    const res = await request(app)
      .get(`/api/responses?formId=${formAId}&search=customer`)
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].answers.Email).toBe("charlie@example.com");
  });

  it("should return 403 when formId belongs to another workspace", async () => {
    // User A trying to access Form B (owned by User B)
    const res = await request(app)
      .get(`/api/responses?formId=${formBId}`)
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Forbidden");
  });

  it("should return 404 when formId does not exist", async () => {
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/responses?formId=${nonExistentId}`)
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Form not found");
  });

  it("should verify compound index exists on ResponseModel", async () => {
    const indexes = ResponseModel.schema.indexes();
    const hasCompoundIndex = indexes.some((item: any) => {
      const indexSpec = item[0];
      return (
        indexSpec &&
        indexSpec.formId === 1 &&
        indexSpec.submittedAt === -1
      );
    });
    expect(hasCompoundIndex).toBe(true);
  });
});
