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
          if (token === "google-token") {
            return {
              uid: "google-uid-123",
              email: "googleuser@test.com",
              name: "Google User",
            };
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

// Configure testing variables
process.env.JWT_SECRET = "test-secret-key-1234567890-test-key-long-enough";

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import app from "../app";
import User from "../models/User";
import Workspace from "../models/Workspace";
import Form from "../models/Form";
import ResponseModel from "../models/Response";
import jwt from "jsonwebtoken";

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  // Disconnect standard connections first
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

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe("Onboarding Platform Integration Tests", () => {
  
  // ==========================================
  // SIGNUP API TESTS (3 Cases)
  // ==========================================
  
  describe("Signup API", () => {
    it("Successful signup, workspace provisioning, and JWT return", async () => {
      const signupData = {
        fullName: "Jayesh Chaudhary",
        email: "jayesh@test.com",
        password: "Password123!",
      };
      
      const res = await request(app)
        .post("/api/auth/signup")
        .send(signupData);
        
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(signupData.email);
      expect(res.body.user.workspaceId).toBeDefined();

      // Validate workspace exists and points to user
      const workspace = await Workspace.findById(res.body.user.workspaceId);
      expect(workspace).toBeDefined();
      expect(workspace!.owner.toString()).toBe(res.body.user._id);
    });

    it("Catch malformed passwords (Zod checks)", async () => {
      const signupData = {
        fullName: "Jayesh Chaudhary",
        email: "jayesh@test.com",
        password: "weak",
      };
      
      const res = await request(app)
        .post("/api/auth/signup")
        .send(signupData);
        
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it("Catch email duplicates", async () => {
      await User.create({
        firebaseUid: "firebase-existing-123",
        fullName: "Existing User",
        email: "existing@test.com",
      });

      const signupData = {
        fullName: "Another User",
        email: "existing@test.com",
        password: "Password123!",
      };
      
      const res = await request(app)
        .post("/api/auth/signup")
        .send(signupData);
        
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("already exists");
    });
  });

  // ==========================================
  // LOGIN API TESTS (1 Case)
  // ==========================================

  describe("Login API", () => {
    it("Verify Firebase login exchange & customized JWT issuance", async () => {
      const res = await request(app)
        .post("/api/auth/session")
        .send({ token: "session-token", name: "Session User" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.isNewUser).toBe(true);
      expect(res.body.user.email).toBe("sessionuser@test.com");
    });
  });

  // ==========================================
  // GOOGLE SIGN-IN TESTS (2 Cases)
  // ==========================================

  describe("Google Sign-In API", () => {
    it("Verify login/registration via Firebase Google Auth token", async () => {
      const res = await request(app)
        .post("/api/auth/session")
        .send({ token: "google-token", name: "Google User" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isNewUser).toBe(true);
      expect(res.body.user.email).toBe("googleuser@test.com");
    });

    it("Reject missing Firebase session token", async () => {
      const res = await request(app)
        .post("/api/auth/session")
        .send({ name: "No Token" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain("Token is required");
    });
  });

  // ==========================================
  // LOGOUT API TESTS (1 Case)
  // ==========================================

  describe("Logout API", () => {
    it("Logout endpoint token clearance response", async () => {
      const user = await User.create({
        firebaseUid: "logout-uid",
        fullName: "Logout User",
        email: "logout@test.com",
      });

      const token = jwt.sign(
        { id: user._id.toString(), email: user.email, role: user.role },
        process.env.JWT_SECRET!
      );

      const res = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("Logged out successfully");
    });
  });

  // ==========================================
  // AUTH MIDDLEWARE TESTS (3 Cases)
  // ==========================================

  describe("Auth Middleware (protect)", () => {
    it("Reject requests without Authorization headers", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("no token provided");
    });

    it("Reject malformed or expired JWT Bearer token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer bad-token-format");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("token failed");
    });

    it("Allow access to protected resource with valid JWT Bearer token", async () => {
      const user = await User.create({
        firebaseUid: "valid-auth-uid",
        fullName: "Valid User",
        email: "valid@test.com",
      });

      const token = jwt.sign(
        { id: user._id.toString(), email: user.email, role: user.role },
        process.env.JWT_SECRET!
      );

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user._id).toBe(user._id.toString());
    });
  });

  // ==========================================
  // USER API TESTS (2 Cases)
  // ==========================================

  describe("User API", () => {
    it("Perform profile modifications", async () => {
      const user = await User.create({
        firebaseUid: "mod-uid",
        fullName: "Original Name",
        email: "original@test.com",
      });

      const token = jwt.sign(
        { id: user._id.toString(), email: user.email, role: user.role },
        process.env.JWT_SECRET!
      );

      const res = await request(app)
        .put("/api/users/profile")
        .set("Authorization", `Bearer ${token}`)
        .send({ fullName: "Modified Name", isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.fullName).toBe("Modified Name");
      expect(res.body.user.isActive).toBe(false);
    });

    it("Cascade delete profile, workspace, forms, and responses", async () => {
      const user = await User.create({
        firebaseUid: "cascade-uid",
        fullName: "Cascade User",
        email: "cascade@test.com",
      });

      const workspace = await Workspace.create({
        name: "Cascade Workspace",
        owner: user._id,
      });

      user.workspaceId = workspace._id as any;
      await user.save();

      const form = await Form.create({
        title: "Cascade Form",
        workspaceId: workspace._id,
      });

      const response = await ResponseModel.create({
        formId: form._id,
        answers: { question: "answer" },
      });

      const token = jwt.sign(
        { id: user._id.toString(), email: user.email, role: user.role },
        process.env.JWT_SECRET!
      );

      const res = await request(app)
        .delete("/api/users/profile")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify cascading database deletion
      expect(await User.findById(user._id)).toBeNull();
      expect(await Workspace.findById(workspace._id)).toBeNull();
      expect(await Form.findById(form._id)).toBeNull();
      expect(await ResponseModel.findById(response._id)).toBeNull();
    });
  });

  // ==========================================
  // WORKSPACE API TESTS (1 Case)
  // ==========================================

  describe("Workspace API", () => {
    it("Complete workspace CRUD lifecycle tests", async () => {
      const user = await User.create({
        firebaseUid: "ws-uid",
        fullName: "WS Owner",
        email: "ws-owner@test.com",
      });

      const token = jwt.sign(
        { id: user._id.toString(), email: user.email, role: user.role },
        process.env.JWT_SECRET!
      );

      // 1. Create Workspace
      const createRes = await request(app)
        .post("/api/workspaces")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Lifecycle Workspace", description: "Fresh start" });

      expect(createRes.status).toBe(201);
      const wsId = createRes.body.workspace._id;

      // 2. Read Workspace
      const readRes = await request(app)
        .get(`/api/workspaces/${wsId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(readRes.status).toBe(200);
      expect(readRes.body.workspace.name).toBe("Lifecycle Workspace");

      // 3. Update Workspace
      const updateRes = await request(app)
        .put(`/api/workspaces/${wsId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Updated Workspace Title", description: "Modified desc" });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.workspace.name).toBe("Updated Workspace Title");

      // 4. Delete Workspace
      const deleteRes = await request(app)
        .delete(`/api/workspaces/${wsId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(deleteRes.status).toBe(200);
      expect(await Workspace.findById(wsId)).toBeNull();
    });
  });

  // ==========================================
  // FORM API TESTS (1 Case)
  // ==========================================

  describe("Form API", () => {
    it("Form CRUD operations, submission validation, and submissions GET", async () => {
      const user = await User.create({
        firebaseUid: "form-uid",
        fullName: "Form Builder",
        email: "builder@test.com",
      });

      const workspace = await Workspace.create({
        name: "Form Workspace",
        owner: user._id,
      });

      user.workspaceId = workspace._id as any;
      await user.save();

      const token = jwt.sign(
        { id: user._id.toString(), email: user.email, role: user.role },
        process.env.JWT_SECRET!
      );

      // 1. Create Form
      const fields = [
        { label: "Full Name", type: "text", required: true },
        { label: "Favorite color", type: "dropdown", required: false, options: ["Red", "Blue", "Green"] }
      ];

      const createRes = await request(app)
        .post("/api/forms")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Feedback Form", fields });

      expect(createRes.status).toBe(201);
      const formId = createRes.body.form._id;

      // 2. Read Form
      const readRes = await request(app)
        .get(`/api/forms/${formId}`)
        .set("Authorization", `Bearer ${token}`);
      expect(readRes.status).toBe(200);
      expect(readRes.body.form.title).toBe("Feedback Form");

      // 3. Submit Form (fails validation because required field 'Full Name' is missing)
      const badSubRes1 = await request(app)
        .post(`/api/forms/${formId}/submissions`)
        .send({ answers: { "Favorite color": "Blue" } });

      expect(badSubRes1.status).toBe(400);
      expect(badSubRes1.body.success).toBe(false);
      expect(badSubRes1.body.message).toContain("required");

      // 4. Submit Form (fails validation because dropdown selection is invalid)
      const badSubRes2 = await request(app)
        .post(`/api/forms/${formId}/submissions`)
        .send({ answers: { "Full Name": "Jayesh", "Favorite color": "Yellow" } });

      expect(badSubRes2.status).toBe(400);
      expect(badSubRes2.body.success).toBe(false);
      expect(badSubRes2.body.message).toContain("not a valid option");

      // 5. Submit Form (Success)
      const goodSubRes = await request(app)
        .post(`/api/forms/${formId}/submissions`)
        .send({ answers: { "Full Name": "Jayesh", "Favorite color": "Blue" } });

      expect(goodSubRes.status).toBe(201);
      expect(goodSubRes.body.success).toBe(true);

      // 6. Get Submissions
      const subRes = await request(app)
        .get(`/api/forms/${formId}/submissions`)
        .set("Authorization", `Bearer ${token}`);

      expect(subRes.status).toBe(200);
      expect(subRes.body.submissions.length).toBe(1);
      expect(subRes.body.submissions[0].answers["Full Name"]).toBe("Jayesh");
    });

    it("Support querying forms by search, status, and pagination", async () => {
      const user = await User.create({
        firebaseUid: "query-uid",
        fullName: "Query Builder",
        email: "query@test.com",
      });

      const workspace = await Workspace.create({
        name: "Query Workspace",
        owner: user._id,
      });

      user.workspaceId = workspace._id as any;
      await user.save();

      const token = jwt.sign(
        { id: user._id.toString(), email: user.email, role: user.role },
        process.env.JWT_SECRET!
      );

      // Create forms with different statuses and titles
      await Form.create({ title: "Registration Form", workspaceId: workspace._id, status: "active" });
      await Form.create({ title: "Feedback Survey", workspaceId: workspace._id, status: "active" });
      await Form.create({ title: "Contact Us", workspaceId: workspace._id, status: "inactive" });

      // 1. Search Query
      const searchRes = await request(app)
        .get("/api/forms?search=Survey")
        .set("Authorization", `Bearer ${token}`);
      expect(searchRes.status).toBe(200);
      expect(searchRes.body.forms.length).toBe(1);
      expect(searchRes.body.forms[0].title).toBe("Feedback Survey");

      // 2. Status Filter Query
      const statusRes = await request(app)
        .get("/api/forms?status=inactive")
        .set("Authorization", `Bearer ${token}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.forms.length).toBe(1);
      expect(statusRes.body.forms[0].title).toBe("Contact Us");

      // 3. Pagination Query
      const pagRes = await request(app)
        .get("/api/forms?page=2&limit=2")
        .set("Authorization", `Bearer ${token}`);
      expect(pagRes.status).toBe(200);
      expect(pagRes.body.page).toBe(2);
      expect(pagRes.body.limit).toBe(2);
      expect(pagRes.body.forms.length).toBe(1); // Page 2 with limit 2 returns 1 form
    });
  });

  // ==========================================
  // AUTHORIZATION TESTS (1 Case)
  // ==========================================

  describe("Authorization Boundary Checks", () => {
    it("Verify User B cannot modify/delete User A's workspace or forms", async () => {
      const userA = await User.create({ firebaseUid: "ua", fullName: "User A", email: "a@test.com" });
      const userB = await User.create({ firebaseUid: "ub", fullName: "User B", email: "b@test.com" });

      const wsA = await Workspace.create({ name: "Workspace A", owner: userA._id });
      const formA = await Form.create({ title: "Form A", workspaceId: wsA._id });

      const tokenB = jwt.sign(
        { id: userB._id.toString(), email: userB.email, role: userB.role },
        process.env.JWT_SECRET!
      );

      // 1. User B updates User A's workspace -> Forbidden
      const wsRes = await request(app)
        .put(`/api/workspaces/${wsA._id}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .send({ name: "Hijacked" });

      expect(wsRes.status).toBe(403);

      // 2. User B updates User A's form -> Forbidden
      const formRes = await request(app)
        .put(`/api/forms/${formA._id}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .send({ title: "Hijacked Form" });

      expect(formRes.status).toBe(403);
    });
  });

  // ==========================================
  // DASHBOARD API TESTS (1 Case)
  // ==========================================

  describe("Dashboard Analytics API", () => {
    it("Aggregate total forms, responses, and activity breakdown", async () => {
      const user = await User.create({
        firebaseUid: "dash-uid",
        fullName: "Dash User",
        email: "dash@test.com",
      });

      const workspace = await Workspace.create({
        name: "Dash Workspace",
        owner: user._id,
      });

      user.workspaceId = workspace._id as any;
      await user.save();

      const form1 = await Form.create({ title: "Form 1", workspaceId: workspace._id });
      const form2 = await Form.create({ title: "Form 2", workspaceId: workspace._id });

      await ResponseModel.create({ formId: form1._id, answers: { key: "a" } });
      await ResponseModel.create({ formId: form1._id, answers: { key: "b" } });

      const token = jwt.sign(
        { id: user._id.toString(), email: user.email, role: user.role },
        process.env.JWT_SECRET!
      );

      const res = await request(app)
        .get("/api/dashboard/analytics")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.analytics.totalForms).toBe(2);
      expect(res.body.analytics.totalResponses).toBe(2);
      
      const breakdown = res.body.analytics.formsBreakdown;
      expect(breakdown.length).toBe(2);
      expect(breakdown.find((f: any) => f.title === "Form 1").responseCount).toBe(2);
      expect(breakdown.find((f: any) => f.title === "Form 2").responseCount).toBe(0);
    });
  });

  // ==========================================
  // ERROR HANDLING TESTS (1 Case)
  // ==========================================

  describe("Global Error Handling Middleware", () => {
    it("Catch mongoose invalid ObjectId casts globally", async () => {
      // requesting a form submission with malformed/invalid ObjectId format
      const res = await request(app)
        .post("/api/forms/invalid-objectid-format/submissions")
        .send({ answers: {} });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Cast to ObjectId failed");
    });
  });

  // ==========================================
  // RESPONSE TIME TESTS (1 Case)
  // ==========================================

  describe("API Response Time SLA Check", () => {
    it("Assert endpoint response times are within limits (<200ms)", async () => {
      const startTime = Date.now();
      const res = await request(app).get("/api/health");
      const duration = Date.now() - startTime;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(200); // Should be well under 200ms
    });
  });

  // ==========================================
  // PERFORMANCE TESTS (1 Case)
  // ==========================================

  describe("API Concurrent Load Performance Check", () => {
    it("Concurrent execution of 21 requests without performance degradation", async () => {
      const requests = Array.from({ length: 21 }, () =>
        request(app).get("/api/health")
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      for (const res of responses) {
        expect(res.status).toBe(200);
      }

      // Assert total concurrent execution finishes in a reasonable time
      expect(totalTime).toBeLessThan(1000); 
    });
  });

  // ==========================================
  // CROSS-WORKSPACE ISOLATION & COOKIE TESTS
  // ==========================================

  describe("Cross-Workspace Isolation & Cookie Authentication", () => {
    let adminA: any;
    let adminB: any;
    let wsA: any;
    let wsB: any;
    let formA: any;
    let tokenA: string;
    let tokenB: string;

    beforeEach(async () => {
      // Create Admin A and Admin B users
      adminA = await User.create({
        firebaseUid: "admin-a-uid",
        fullName: "Admin A",
        email: "admina@test.com",
        role: "admin",
      });

      adminB = await User.create({
        firebaseUid: "admin-b-uid",
        fullName: "Admin B",
        email: "adminb@test.com",
        role: "admin",
      });

      // Create workspaces
      wsA = await Workspace.create({
        name: "Workspace A",
        owner: adminA._id,
      });

      wsB = await Workspace.create({
        name: "Workspace B",
        owner: adminB._id,
      });

      adminA.workspaceId = wsA._id;
      await adminA.save();

      adminB.workspaceId = wsB._id;
      await adminB.save();

      // Create a form belonging to Workspace A
      formA = await Form.create({
        title: "Admin A's Form",
        description: "Form belonging to Workspace A",
        workspaceId: wsA._id,
        status: "active",
        fields: [{ label: "Name", type: "text", required: true }],
      });

      // Generate tokens
      tokenA = jwt.sign(
        { id: adminA._id.toString(), email: adminA.email, role: adminA.role },
        process.env.JWT_SECRET!
      );

      tokenB = jwt.sign(
        { id: adminB._id.toString(), email: adminB.email, role: adminB.role },
        process.env.JWT_SECRET!
      );
    });

    it("Confirm Admin B cannot GET Admin A's form (403)", async () => {
      const res = await request(app)
        .get(`/api/forms/${formA._id}`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.message).toContain("Forbidden");
    });

    it("Confirm Admin B cannot PATCH Admin A's form (403)", async () => {
      const res = await request(app)
        .patch(`/api/forms/${formA._id}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .send({ title: "Hijacked Title" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.message).toContain("Forbidden");
    });

    it("Confirm Admin B cannot DELETE Admin A's form (403)", async () => {
      const res = await request(app)
        .delete(`/api/forms/${formA._id}`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.message).toContain("Forbidden");
    });

    it("Confirm Admin A can PATCH their own form (autosave partial validation checks)", async () => {
      // Autosave sending a short/partial title should be allowed on patch
      const res = await request(app)
        .patch(`/api/forms/${formA._id}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ title: "A" }); // short title is permitted

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.form.title).toBe("A");

      // Form status change and field update
      const resFields = await request(app)
        .patch(`/api/forms/${formA._id}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ status: "inactive" });

      expect(resFields.status).toBe(200);
      expect(resFields.body.form.status).toBe("inactive");
    });

    it("Confirm Admin A can DELETE their own form (removes form and its responses)", async () => {
      // Submit a response to the form first
      const sub = await ResponseModel.create({
        formId: formA._id,
        answers: { Name: "Jayesh" },
      });

      const res = await request(app)
        .delete(`/api/forms/${formA._id}`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Confirm both form and its responses are deleted
      expect(await Form.findById(formA._id)).toBeNull();
      expect(await ResponseModel.findById(sub._id)).toBeNull();
    });

    it("Return 401 when the JWT cookie or Authorization header is missing", async () => {
      const res = await request(app).get(`/api/forms/${formA._id}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.message).toContain("no token provided");
    });

    it("Allow access when the JWT cookie is present (cookie authorization support)", async () => {
      // Test sending jwt cookie
      const resJwt = await request(app)
        .get(`/api/forms/${formA._id}`)
        .set("Cookie", `jwt=${tokenA}`);

      expect(resJwt.status).toBe(200);
      expect(resJwt.body.success).toBe(true);
      expect(resJwt.body.form.title).toBe("Admin A's Form");

      // Test sending token cookie
      const resToken = await request(app)
        .get(`/api/forms/${formA._id}`)
        .set("Cookie", `token=${tokenA}`);

      expect(resToken.status).toBe(200);
      expect(resToken.body.success).toBe(true);
    });

    it("Return 404 when the form is not in the workspace (not in database/non-existent)", async () => {
      const nonExistentFormId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/forms/${nonExistentFormId}`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.message).toContain("Form not found");
    });

    it("Reject when workspaceId is explicitly passed in body or params", async () => {
      const resBody = await request(app)
        .patch(`/api/forms/${formA._id}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ workspaceId: wsA._id.toString() });

      expect(resBody.status).toBe(400);
      expect(resBody.body.success).toBe(false);
      expect(resBody.body.message).toContain("workspaceId must not be provided");
    });
  });
});
