import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
    try {
        const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/onboarding";
        if (!process.env.MONGODB_URI) {
            console.warn("⚠️ MONGODB_URI environment variable is missing. Falling back to local MongoDB: mongodb://127.0.0.1:27017/onboarding");
        }
        await mongoose.connect(mongoUri);

        console.log("✅ MongoDB Connected Successfully");
    } catch (error) {
        console.error("❌ MongoDB Connection Failed");

        console.error(error);

        process.exit(1);
    }
};

export default connectDB;