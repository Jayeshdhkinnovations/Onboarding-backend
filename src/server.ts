import dotenv from "dotenv";
import app from "./app";
import connectDB from "./config/database";

dotenv.config();

if (!process.env.JWT_SECRET) {
    console.warn("⚠️ JWT_SECRET environment variable is missing. Using default development secret key.");
    process.env.JWT_SECRET = "default_development_secret_key_1234567890";
}

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Server failed to start");
    }
};

startServer();