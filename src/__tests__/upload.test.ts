import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import fs from "fs";
import path from "path";
import app from "../app";
import User from "../models/User";
import Upload from "../models/Upload";
import { generateToken } from "../utils/generateToken";

let mongoServer: MongoMemoryServer;
let authToken: string;
let mockUserId: string;

// Set UPLOAD_DIR env for testing to avoid polluting actual uploads
const testUploadDir = path.join(process.cwd(), "test_uploads");
process.env.UPLOAD_DIR = testUploadDir;
process.env.JWT_SECRET = "test-secret-key-1234567890-test-key-long-enough";

beforeAll(async () => {
  await mongoose.disconnect();
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // Setup directory
  if (!fs.existsSync(testUploadDir)) {
    fs.mkdirSync(testUploadDir, { recursive: true });
  }

  // Create a mock user
  const user = await User.create({
    firebaseUid: "upload-test-uid",
    fullName: "Upload Tester",
    email: "uploadtester@test.com",
    role: "admin",
  });
  mockUserId = user._id.toString();

  // Generate JWT token
  authToken = generateToken({
    id: mockUserId,
    email: user.email,
    role: user.role,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }

  // Cleanup test upload directory
  if (fs.existsSync(testUploadDir)) {
    fs.rmSync(testUploadDir, { recursive: true, force: true });
  }
});

beforeEach(async () => {
  // Clear uploads table
  await Upload.deleteMany({});
  // Clean files in testUploadDir
  if (fs.existsSync(testUploadDir)) {
    const files = fs.readdirSync(testUploadDir);
    for (const file of files) {
      try {
        fs.unlinkSync(path.join(testUploadDir, file));
      } catch (err) {
        // ignore
      }
    }
  }
});

describe("Upload API Integration Tests", () => {
  it("should successfully upload a valid image and serve/stream it", async () => {
    const imageBuffer = Buffer.from("fake-image-binary-data");

    // Upload
    const res = await request(app)
      .post("/api/upload")
      .set("Authorization", `Bearer ${authToken}`)
      .attach("logo", imageBuffer, "test_logo.png");

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.url).toBeDefined();
    expect(res.body.metadata).toBeDefined();
    expect(res.body.metadata.name).toBe("test_logo.png");
    expect(res.body.metadata.type).toBe("image/png");
    expect(res.body.metadata.owner).toBe(mockUserId);

    // Verify it is saved in Mongo
    const dbUpload = await Upload.findById(res.body.metadata.id);
    expect(dbUpload).not.toBeNull();
    expect(dbUpload!.path).toBe(res.body.metadata.path);

    // Verify the file exists on disk
    const filePath = path.join(testUploadDir, dbUpload!.path);
    expect(fs.existsSync(filePath)).toBe(true);

    // Retrieve file
    const getRes = await request(app)
      .get(`/api/upload/file/${dbUpload!.path}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body).toBeDefined();
  });

  it("should reject non-image MIME types for branding uploads and clean up file", async () => {
    const textBuffer = Buffer.from("fake text content");

    // Upload text file under 'logo' field (branding)
    const res = await request(app)
      .post("/api/upload")
      .set("Authorization", `Bearer ${authToken}`)
      .attach("logo", textBuffer, "test_text.txt");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("must be image files");

    // Verify no files remain in the test uploads directory
    const files = fs.readdirSync(testUploadDir);
    expect(files.length).toBe(0);

    // Verify no DB metadata is stored
    const dbUploads = await Upload.find({});
    expect(dbUploads.length).toBe(0);
  });

  it("should enforce file size limits", async () => {
    // 5MB limit. Create a buffer larger than 5MB
    const largeBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024);

    const res = await request(app)
      .post("/api/upload")
      .set("Authorization", `Bearer ${authToken}`)
      .attach("file", largeBuffer, "large_image.png");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("File size limit exceeded");

    // Verify no files are kept
    const files = fs.readdirSync(testUploadDir);
    expect(files.length).toBe(0);
  });

  it("should reject path traversal attempts when fetching files", async () => {
    // Multer/Express doesn't route URL path traversals if resolved as route params usually,
    // but doing GET /api/upload/file/..%2f..%2fpackage.json will be processed.
    const res = await request(app)
      .get("/api/upload/file/..%2f..%2fpackage.json");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Invalid file path");
  });
});
