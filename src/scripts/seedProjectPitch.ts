import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import Form from "../models/Form";
import User from "../models/User";

dotenv.config();

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/onboarding";

const seedProjectPitchForm = async () => {
  try {
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB for seeding project pitch form");

    // 1. Find user with email piyush270205@gmail.com
    const email = "piyush270205@gmail.com";
    const user = await User.findOne({ email });
    if (!user) {
      console.error(`❌ User with email ${email} not found in database!`);
      process.exit(1);
    }
    console.log(`👤 Found user: ${user.fullName} (${user.email})`);

    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      console.error(`❌ User ${email} does not have an associated workspaceId!`);
      process.exit(1);
    }
    console.log(`📁 Using workspaceId: ${workspaceId}`);

    // 2. Read seeds.json
    const seedsPath = path.join(__dirname, "../../seeds.json");
    if (!fs.existsSync(seedsPath)) {
      console.error(`❌ Seeds file not found at ${seedsPath}`);
      process.exit(1);
    }

    const rawData = fs.readFileSync(seedsPath, "utf-8");
    const formData = JSON.parse(rawData);

    // 3. Check if form already exists and delete to avoid duplicate slug issues
    const existingForm = await Form.findOne({ 
      workspaceId, 
      title: formData.title 
    });
    if (existingForm) {
      console.log("ℹ️ Form already exists in this workspace. Deleting it first...");
      await Form.deleteOne({ _id: existingForm._id });
    }

    // 4. Create the Form
    const form = await Form.create({
      title: formData.title,
      description: formData.description,
      workspaceId,
      status: formData.status,
      slug: "to-pitch-a-project",
      publishedSlug: "to-pitch-a-project",
      publishedAt: new Date(),
      fields: formData.fields,
      pages: formData.pages,
      settings: formData.settings,
      schemaVersion: 1
    });

    console.log(`\n🎉 Successfully seeded form: "${form.title}"!`);
    console.log(`🔗 Slug: ${form.slug}`);
    console.log(`📂 ID: ${form._id}`);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding project pitch form:", error);
    process.exit(1);
  }
};

seedProjectPitchForm();
