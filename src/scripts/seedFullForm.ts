import mongoose from "mongoose";
import dotenv from "dotenv";
import Form from "../models/Form";
import Workspace from "../models/Workspace";
import User from "../models/User";

dotenv.config();

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/onboarding";

const seedFullForm = async () => {
  try {
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB for seeding full form");

    // 1. Get or create a User and Workspace
    let user = await User.findOne({});
    if (!user) {
      user = await User.create({
        fullName: "System Seed User",
        email: "seed-user@test.com",
        firebaseUid: "seed-firebase-uid-12345",
        role: "admin",
      });
      console.log(`👤 Created user: ${user.email}`);
    }

    let workspace = await Workspace.findOne({ owner: user._id });
    if (!workspace) {
      workspace = await Workspace.create({
        name: "Seed Master Workspace",
        owner: user._id,
      });
      console.log(`📁 Created workspace: ${workspace.name}`);
      user.workspaceId = workspace._id as any;
      await user.save();
    }

    // 2. Create the Form with all 10 field types
    const fullFormTitle = "Comprehensive Master Form";
    // Check if it already exists to avoid duplicates
    const existingForm = await Form.findOne({ title: fullFormTitle });
    if (existingForm) {
      console.log("ℹ️ Form already exists. Deleting it first...");
      await Form.deleteOne({ _id: existingForm._id });
    }

    const formFields = [
      { fieldId: "f-short-text", label: "Short Text Field", type: "short_text" as const, required: true, minLength: 3, maxLength: 50 },
      { fieldId: "f-long-text", label: "Long Text Field", type: "long_text" as const, required: false, minLength: 10, maxLength: 500 },
      { fieldId: "f-email", label: "Email Field", type: "email" as const, required: true },
      { fieldId: "f-phone", label: "Phone Field", type: "phone" as const, required: false, pattern: "^\\+[1-9]\\d{1,14}$" },
      { fieldId: "f-number", label: "Number Field", type: "number" as const, required: true, min: 1, max: 100 },
      { fieldId: "f-date", label: "Date Field", type: "date" as const, required: true, minDate: "2026-01-01", maxDate: "2026-12-31" },
      { fieldId: "f-dropdown", label: "Dropdown Field", type: "dropdown" as const, required: true, options: ["Option X", "Option Y", "Option Z"] },
      { fieldId: "f-multiple-choice", label: "Multiple Choice Field", type: "multiple_choice" as const, required: true, options: ["Choice A", "Choice B"] },
      { fieldId: "f-checkbox", label: "Checkbox Field", type: "checkbox" as const, required: false, options: ["Check 1", "Check 2"] },
      { fieldId: "f-file-upload", label: "File Upload Field", type: "file_upload" as const, required: true, maxFileSize: 5, allowedMimeTypes: ["image/jpeg", "image/png"] }
    ];

    const form = await Form.create({
      title: fullFormTitle,
      description: "A master form template containing all 10 supported field types (Short Text, Long Text, Email, Phone, Number, Date, Dropdown, Multiple Choice, Checkbox, File Upload) for system demonstrations.",
      workspaceId: workspace._id,
      status: "published",
      slug: "master-comprehensive-form-slug",
      publishedSlug: "master-comprehensive-form-slug",
      publishedAt: new Date(),
      fields: formFields,
      pages: [],
      schemaVersion: 1,
      settings: {
        honeypotEnabled: true,
        layout: "single_column"
      }
    });

    console.log(`✅ Successfully seeded form: "${form.title}" into database!`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding form:", error);
    process.exit(1);
  }
};

seedFullForm();
