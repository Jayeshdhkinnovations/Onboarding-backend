import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import app from "../app";
import User from "../models/User";
import Workspace from "../models/Workspace";
import Notification from "../models/Notification";
import { generateToken } from "../utils/generateToken";

let mongoServer: MongoMemoryServer;

process.env.JWT_SECRET = "test-secret-key-1234567890-test-key-long-enough";

describe("Notifications & Onboarding API (/api/notifications, /api/users/me/onboarding-complete)", () => {
  let user: any;
  let workspace: any;
  let token: string;

  beforeAll(async () => {
    await mongoose.disconnect();
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    user = await User.create({
      firebaseUid: "uid_notif_onboarding_test",
      fullName: "Notif Test User",
      email: "notif_onboarding_test@example.com",
      role: "admin",
      onboardingCompleted: false,
    });

    workspace = await Workspace.create({
      name: "Notif Workspace",
      owner: user._id,
    });

    user.workspaceId = workspace._id;
    await user.save();

    token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Workspace.deleteMany({});
    await Notification.deleteMany({});
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it("POST /api/users/me/onboarding-complete - should mark onboarding as complete and create welcome notification", async () => {
    const res = await request(app)
      .post("/api/users/me/onboarding-complete")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.onboardingCompleted).toBe(true);

    const dbUser = await User.findById(user._id);
    expect(dbUser?.onboardingCompleted).toBe(true);

    const welcomeNotif = await Notification.findOne({ userId: user._id, type: "welcome" });
    expect(welcomeNotif).not.toBeNull();
    expect(welcomeNotif?.title).toBe("Welcome to Beginso!");
  });

  it("GET /api/users/me - should include onboardingCompleted: true", async () => {
    const res = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.onboardingCompleted).toBe(true);
    expect(res.body.user.role).toBe("admin");
  });

  it("GET /api/notifications - should return array of notifications", async () => {
    const res = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.notifications)).toBe(true);
    expect(res.body.notifications.length).toBeGreaterThan(0);
    expect(res.body.notifications[0].type).toBe("welcome");
  });

  it("POST /api/notifications/:id/read - should mark notification as read", async () => {
    const notif = await Notification.findOne({ userId: user._id });
    expect(notif).not.toBeNull();

    const res = await request(app)
      .post(`/api/notifications/${notif!._id}/read`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.notification.read).toBe(true);

    const updatedNotif = await Notification.findById(notif!._id);
    expect(updatedNotif?.read).toBe(true);
  });
});
