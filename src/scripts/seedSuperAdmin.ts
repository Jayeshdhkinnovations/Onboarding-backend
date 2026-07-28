import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User";
import Workspace from "../models/Workspace";
import { auth } from "../config/firebase";

dotenv.config();

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/onboarding";

const seedSuperAdmin = async () => {
  try {
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB for seeding Super Admin");

    const emailsStr = process.env.SUPER_ADMIN_EMAILS;
    if (!emailsStr) {
      console.error("❌ SUPER_ADMIN_EMAILS env variable is not defined");
      process.exit(1);
    }

    const emails = emailsStr.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    const password = process.env.SUPER_ADMIN_PASSWORD;

    for (const email of emails) {
      let firebaseUid = `super-admin-uid-${Buffer.from(email).toString("hex").substring(0, 15)}`;

      // Try to create/update Firebase User if password is provided
      if (password) {
        try {
          const fbUser = await auth.createUser({
            email,
            password,
            displayName: "Super Admin",
          });
          firebaseUid = fbUser.uid;
          console.log(`🔥 Created Firebase user for Super Admin: ${email}`);
        } catch (fbErr: any) {
          if (fbErr.code === "auth/email-already-exists") {
            const fbUser = await auth.getUserByEmail(email);
            firebaseUid = fbUser.uid;
            await auth.updateUser(firebaseUid, { password });
            console.log(`🔥 Updated Firebase password for Super Admin: ${email}`);
          } else {
            console.warn(`⚠️ Firebase Admin SDK error (using fallback UID):`, fbErr.message);
          }
        }
      } else {
        console.log("ℹ️ No SUPER_ADMIN_PASSWORD provided; skipping Firebase Auth synchronization");
      }

      let user = await User.findOne({ email });
      if (user) {
        user.role = "super_admin";
        user.status = "active";
        user.firebaseUid = firebaseUid;
        await user.save();
        console.log(`🚀 Promoted existing user to Super Admin: ${email}`);
      } else {
        // Create a new Super Admin user
        user = await User.create({
          fullName: "Super Admin",
          email,
          firebaseUid,
          role: "super_admin",
          status: "active",
        });
        console.log(`✨ Created new Super Admin user in DB: ${email}`);
      }

      // Ensure they have a Workspace
      let workspace = await Workspace.findOne({ owner: user._id });
      if (!workspace) {
        workspace = await Workspace.create({
          name: "Super Admin Workspace",
          owner: user._id,
        });
        user.workspaceId = workspace._id as any;
        await user.save();
        console.log(`📁 Created workspace for Super Admin: ${email}`);
      }
    }

    console.log("✅ Super Admin seeding completed successfully");
    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error seeding Super Admin:", error);
    process.exit(1);
  }
};

seedSuperAdmin();
