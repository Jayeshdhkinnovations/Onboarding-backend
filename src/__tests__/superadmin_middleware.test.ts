import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import app from "../app";
import User from "../models/User";
import Workspace from "../models/Workspace";
import { generateToken } from "../utils/generateToken";

let mongoServer: MongoMemoryServer;
let adminToken: string;
let suspendedAdminToken: string;
let superAdminToken: string;
let suspendedSuperAdminToken: string;

let adminUser: any;
let suspendedAdmin: any;
let superAdmin: any;
let suspendedSuperAdmin: any;

process.env.JWT_SECRET = "test-secret-key-1234567890-test-key-long-enough";

beforeAll(async () => {
  await mongoose.disconnect();
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // 1. Create Normal Admin (Active)
  adminUser = await User.create({
    firebaseUid: "uid-normal-admin",
    fullName: "Normal Admin",
    email: "admin@test.com",
    role: "admin",
    status: "active",
  });
  const ws1 = await Workspace.create({ name: "Admin Workspace", owner: adminUser._id });
  adminUser.workspaceId = ws1._id;
  await adminUser.save();
  adminToken = generateToken({ id: adminUser._id.toString(), email: adminUser.email, role: adminUser.role });

  // 2. Create Normal Admin (Suspended)
  suspendedAdmin = await User.create({
    firebaseUid: "uid-suspended-admin",
    fullName: "Suspended Admin",
    email: "suspended@test.com",
    role: "admin",
    status: "suspended",
  });
  const ws2 = await Workspace.create({ name: "Suspended Workspace", owner: suspendedAdmin._id });
  suspendedAdmin.workspaceId = ws2._id;
  await suspendedAdmin.save();
  suspendedAdminToken = generateToken({ id: suspendedAdmin._id.toString(), email: suspendedAdmin.email, role: suspendedAdmin.role });

  // 3. Create Super Admin (Active)
  superAdmin = await User.create({
    firebaseUid: "uid-super-admin",
    fullName: "Super Admin User",
    email: "super@test.com",
    role: "super_admin",
    status: "active",
  });
  const ws3 = await Workspace.create({ name: "Super Workspace", owner: superAdmin._id });
  superAdmin.workspaceId = ws3._id;
  await superAdmin.save();
  superAdminToken = generateToken({ id: superAdmin._id.toString(), email: superAdmin.email, role: superAdmin.role });

  // 4. Create Super Admin (Suspended status - though practically not possible, for testing boundary checks)
  suspendedSuperAdmin = await User.create({
    firebaseUid: "uid-suspended-super",
    fullName: "Suspended Super User",
    email: "suspended-super@test.com",
    role: "super_admin",
    status: "suspended",
  });
  const ws4 = await Workspace.create({ name: "Suspended Super Workspace", owner: suspendedSuperAdmin._id });
  suspendedSuperAdmin.workspaceId = ws4._id;
  await suspendedSuperAdmin.save();
  suspendedSuperAdminToken = generateToken({ id: suspendedSuperAdmin._id.toString(), email: suspendedSuperAdmin.email, role: suspendedSuperAdmin.role });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe("Super Admin & Suspended Gating Middleware Tests", () => {
  describe("requireSuperAdmin middleware", () => {
    it("should return 403 FORBIDDEN_SUPER_ADMIN_REQUIRED if normal admin tries to access superadmin routes", async () => {
      const res = await request(app)
        .get("/api/superadmin/stats")
        .set("Authorization", `Bearer ${adminToken}`);
      
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN_SUPER_ADMIN_REQUIRED");
    });

    it("should allow super admin to pass requireSuperAdmin guard", async () => {
      const res = await request(app)
        .get("/api/superadmin/stats")
        .set("Authorization", `Bearer ${superAdminToken}`);
      
      // Responds with 200 Success since the controller has been implemented!
      expect(res.status).toBe(200);
    });
  });

  describe("blockSuspended middleware", () => {
    it("should allow active normal admin to access admin-facing routes", async () => {
      const res = await request(app)
        .get("/api/forms")
        .set("Authorization", `Bearer ${adminToken}`);
      
      // Should bypass the suspended check and return forms (200 success, or any form-specific status since they are not blocked)
      expect(res.status).not.toBe(403);
    });

    it("should return 403 ACCOUNT_SUSPENDED if suspended normal admin tries to access admin-facing routes", async () => {
      const res = await request(app)
        .get("/api/forms")
        .set("Authorization", `Bearer ${suspendedAdminToken}`);
      
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("ACCOUNT_SUSPENDED");
    });

    it("should exempt super admins from suspension checks on admin-facing routes", async () => {
      const res = await request(app)
        .get("/api/forms")
        .set("Authorization", `Bearer ${suspendedSuperAdminToken}`);
      
      // Suspended Super Admin should be exempted and not receive a 403 suspension block
      expect(res.status).not.toBe(403);
    });

    it("should exempt all users from suspension checks on superadmin routes", async () => {
      const res = await request(app)
        .get("/api/superadmin/stats")
        .set("Authorization", `Bearer ${suspendedSuperAdminToken}`);
      
      // Accessing superadmin route bypasses suspension check for Super Admins
      expect(res.status).toBe(200);
    });
  });
});
