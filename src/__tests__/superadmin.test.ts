import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import app from "../app";
import User from "../models/User";
import Workspace from "../models/Workspace";
import Form from "../models/Form";
import ResponseModel from "../models/Response";
import Upload from "../models/Upload";
import { SystemLog } from "../models/SystemLog";
import { generateToken } from "../utils/generateToken";

let mongoServer: MongoMemoryServer;
let superAdminToken: string;
let normalAdminToken: string;

process.env.JWT_SECRET = "test-secret-key-1234567890-test-key-long-enough";

beforeAll(async () => {
  await mongoose.disconnect();
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // 1. Create a Super Admin
  const superUser = await User.create({
    firebaseUid: "super-uid",
    fullName: "Main Super Admin",
    email: "superadmin@test.com",
    role: "super_admin",
    status: "active",
  });
  superAdminToken = generateToken({ id: superUser._id.toString(), email: superUser.email, role: superUser.role });

  // 2. Create standard Admin Users
  const admin1 = await User.create({
    firebaseUid: "admin1-uid",
    fullName: "John Active",
    email: "john@test.com",
    role: "admin",
    status: "active",
  });
  const ws1 = await Workspace.create({ name: "Workspace Active", owner: admin1._id });
  admin1.workspaceId = ws1._id;
  await admin1.save();
  normalAdminToken = generateToken({ id: admin1._id.toString(), email: admin1.email, role: admin1.role });

  const admin2 = await User.create({
    firebaseUid: "admin2-uid",
    fullName: "Dave Suspended",
    email: "dave@test.com",
    role: "admin",
    status: "suspended",
  });
  const ws2 = await Workspace.create({ name: "Workspace Suspended", owner: admin2._id });
  admin2.workspaceId = ws2._id;
  await admin2.save();

  // 3. Create Forms
  const form1 = await Form.create({
    title: "Form Alpha",
    workspaceId: ws1._id,
    status: "published",
    publishedSlug: "slug-alpha",
  });

  // 4. Create Responses
  await ResponseModel.create({
    formId: form1._id,
    answers: { "some-key": "some-val" },
    createdAt: new Date(),
  });

  // 5. Create Upload (Storage)
  await Upload.create({
    name: "resume.pdf",
    size: 2048,
    type: "application/pdf",
    path: "resume-path.pdf",
    owner: admin1._id,
  });

  // 6. Create SystemLogs representing Abuse
  await SystemLog.create({
    level: "warn",
    message: "Rate limit exceeded",
    meta: {
      type: "rate_limit",
      ipHash: "ip-hash-1-abcdefghij",
      slug: "slug-alpha",
    },
    createdAt: new Date(),
  });

  await SystemLog.create({
    level: "warn",
    message: "Honeypot silent drop triggered",
    meta: {
      type: "honeypot_drop",
      ipHash: "ip-hash-bot-xyz",
      slug: "slug-alpha",
    },
    createdAt: new Date(),
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe("Super Admin Stats & Abuse Endpoints Integration Tests", () => {
  describe("GET /api/superadmin/stats", () => {
    it("should reject normal admins", async () => {
      const res = await request(app)
        .get("/api/superadmin/stats")
        .set("Authorization", `Bearer ${normalAdminToken}`);
      
      expect(res.status).toBe(403);
    });

    it("should return correct platform health metrics and recent signups", async () => {
      const res = await request(app)
        .get("/api/superadmin/stats")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      
      // Stats checks
      expect(res.body.stats.totalAdmins.active).toBe(1);
      expect(res.body.stats.totalAdmins.suspended).toBe(1);
      expect(res.body.stats.totalWorkspaces).toBe(2);
      expect(res.body.stats.totalForms).toBe(1);
      expect(res.body.stats.totalResponses).toBe(1);
      expect(res.body.stats.totalStorageUsed).toBe(2048);
      expect(res.body.stats.responsesLast24h).toBe(1);

      // Recent Signups checks
      expect(res.body.recentSignups).toBeInstanceOf(Array);
      expect(res.body.recentSignups.length).toBe(2);
      expect(res.body.recentSignups[0].workspaceName).toBe("Workspace Suspended");
      expect(res.body.recentSignups[1].workspaceName).toBe("Workspace Active");
    });
  });

  describe("GET /api/superadmin/abuse", () => {
    it("should reject normal admins", async () => {
      const res = await request(app)
        .get("/api/superadmin/abuse")
        .set("Authorization", `Bearer ${normalAdminToken}`);
      
      expect(res.status).toBe(403);
    });

    it("should return rate-limiting and honeypot stats over the last 7 days", async () => {
      const res = await request(app)
        .get("/api/superadmin/abuse")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      expect(res.body.abuse.honeypotDrops).toBe(1);
      expect(res.body.abuse.topBlockedIps).toHaveLength(1);
      expect(res.body.abuse.topBlockedIps[0].hits).toBe(1);
      // first 16 characters of ip-hash-1-abcdefghij => ip-hash-1-abcdef
      expect(res.body.abuse.topBlockedIps[0].ipHash).toBe("ip-hash-1-abcdef");

      expect(res.body.abuse.topBlockedSlugs).toHaveLength(1);
      expect(res.body.abuse.topBlockedSlugs[0].slug).toBe("slug-alpha");
      expect(res.body.abuse.topBlockedSlugs[0].hits).toBe(1);
    });
  });
});
