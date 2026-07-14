import mongoose from "mongoose";
import dotenv from "dotenv";
import Template from "../models/Template";

dotenv.config();

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/onboarding";

const seedTemplates = async () => {
  try {
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB for seeding");

    // Clear existing templates
    await Template.deleteMany({});
    console.log("🗑️ Cleared existing templates");

    const templates = [
      {
        name: "Contact Information Form",
        category: "General",
        theme: "classic-light",
        isActive: true,
        fields: [
          { label: "Full Name", type: "short_text" as const, required: true },
          { label: "Email Address", type: "email" as const, required: true },
          { label: "Phone Number", type: "phone" as const, required: false },
          { label: "Additional Comments", type: "long_text" as const, required: false },
        ],
      },
      {
        name: "Customer Feedback Survey",
        category: "Feedback",
        theme: "ocean-breeze",
        isActive: true,
        fields: [
          { label: "Overall Rating (1-5)", type: "number" as const, required: true, min: 1, max: 5 },
          { label: "What did you like most?", type: "long_text" as const, required: true },
          { label: "Would you recommend us?", type: "dropdown" as const, required: true, options: ["Yes", "No", "Maybe"] },
        ],
      },
      {
        name: "Job Application",
        category: "HR",
        theme: "professional-slate",
        isActive: true,
        fields: [
          { label: "Applicant Name", type: "short_text" as const, required: true },
          { label: "Email", type: "email" as const, required: true },
          { label: "Portfolio URL", type: "short_text" as const, required: false },
          { label: "Years of Experience", type: "number" as const, required: true, min: 0 },
          { label: "Expected Join Date", type: "date" as const, required: true },
        ],
      },
      {
        name: "Event Registration",
        category: "Events",
        theme: "sunset-glow",
        isActive: true,
        fields: [
          { label: "Attendee Name", type: "short_text" as const, required: true },
          { label: "Ticket Type", type: "multiple_choice" as const, required: true, options: ["VIP", "General Admission", "Student"] },
          { label: "Dietary Restrictions", type: "checkbox" as const, required: false, options: ["Vegan", "Gluten-Free", "Nut-Free"] },
        ],
      },
      {
        name: "Product Order Form",
        category: "Sales",
        theme: "forest-emerald",
        isActive: true,
        fields: [
          { label: "Product Choice", type: "dropdown" as const, required: true, options: ["Product A", "Product B", "Product C"] },
          { label: "Quantity", type: "number" as const, required: true, min: 1, max: 10 },
          { label: "Delivery Date", type: "date" as const, required: true },
          { label: "Delivery Notes", type: "long_text" as const, required: false },
        ],
      },
    ];

    const inserted = await Template.insertMany(templates);
    console.log(`✅ Successfully seeded ${inserted.length} templates!`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding templates:", error);
    process.exit(1);
  }
};

seedTemplates();
