import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import Form from "../models/Form";
import User from "../models/User";
import { nanoid } from "nanoid";

dotenv.config();

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/onboarding";

const seedProjectPitchForm = async () => {
  try {
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB for seeding project pitch form");

    const emails = ["piyush270205@gmail.com", "deepaknangalia@gmail.com"];

    // Read seeds.json template
    const seedsPath = path.join(__dirname, "../../seeds.json");
    if (!fs.existsSync(seedsPath)) {
      console.error(`❌ Seeds file not found at ${seedsPath}`);
      process.exit(1);
    }

    const rawData = fs.readFileSync(seedsPath, "utf-8");
    const formData = JSON.parse(rawData);

    for (const email of emails) {
      console.log(`\n--------------------------------------------------`);
      console.log(`👤 Processing email: ${email}`);
      
      const user = await User.findOne({ email });
      if (!user) {
        console.warn(`⚠️ User with email ${email} not found in database. Skipping.`);
        continue;
      }
      console.log(`👤 Found user: ${user.fullName} (${user.email})`);

      const workspaceId = user.workspaceId;
      if (!workspaceId) {
        console.warn(`⚠️ User ${email} does not have an associated workspaceId. Skipping.`);
        continue;
      }
      console.log(`📁 Using workspaceId: ${workspaceId}`);

      // Find the existing form to preserve its slug and publishedSlug
      const existingForm = await Form.findOne({ 
        workspaceId, 
        title: formData.title 
      });

      let targetSlug: string = "";
      let targetPublishedSlug: string = "";

      if (existingForm) {
        targetSlug = existingForm.slug || "";
        targetPublishedSlug = existingForm.publishedSlug || existingForm.slug || "";
        console.log(`ℹ   Existing form found. Preserving Slug: "${targetSlug}"`);
        console.log("ℹ   Deleting the old form version first...");
        await Form.deleteOne({ _id: existingForm._id });
      } else {
        // Fallback if form doesn't exist yet
        // Generate a new slug, checking if 'to-pitch-a-project' is already taken
        const slugIsTaken = await Form.findOne({ slug: "to-pitch-a-project" });
        if (slugIsTaken) {
          targetSlug = `to-pitch-a-project-${nanoid(4)}`;
        } else {
          targetSlug = "to-pitch-a-project";
        }
        targetPublishedSlug = targetSlug;
        console.log(`ℹ️ No existing form found. Generated new unique Slug: "${targetSlug}"`);
      }

      // Create the Form
      const form = await Form.create({
        title: formData.title,
        description: formData.description,
        workspaceId,
        status: formData.status,
        slug: targetSlug,
        publishedSlug: targetPublishedSlug,
        publishedAt: new Date(),
        fields: formData.fields,
        pages: formData.pages,
        settings: formData.settings,
        schemaVersion: 1
      });

      console.log(`🎉 Successfully seeded form: "${form.title}"!`);
      console.log(`🔗 Slug: ${form.slug}`);
      console.log(`📂 ID: ${form._id}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding project pitch forms:", error);
    process.exit(1);
  }
};

seedProjectPitchForm();
