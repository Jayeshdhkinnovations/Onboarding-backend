import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import healthRoutes from "./routes/health.routes";
import testRoutes from "./routes/test.routes";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import workspaceRoutes from "./routes/workspace.routes";
import formRoutes from "./routes/form.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import uploadRoutes from "./routes/upload.routes";
import templateRoutes from "./routes/template.routes";
import { errorHandler } from "./middleware/error.middleware";

// Continuous Deployment Test Comment
const app = express();

app.use(cors());
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" }
}));
app.use(express.json());
app.use(morgan("dev"));

// Test comment to trigger CD self-hosted deployment verification
app.get("/", (req, res) => {
    res.json({
        message: "Backend Running Successfully"
    });
});
app.use("/api/test", testRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/forms", formRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api", healthRoutes);

app.use(errorHandler as any);

export default app;
