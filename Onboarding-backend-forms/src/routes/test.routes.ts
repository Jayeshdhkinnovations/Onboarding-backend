import { Router } from "express";
import "../config/firebase";
import { getAuth } from "firebase-admin/auth";
import { createDummyUser } from "../controllers/test.controller";

const router = Router();

router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Test routes are available",
    routes: ["GET /api/test/", "GET /api/test/firebase", "POST /api/test/create-user"],
  });
});

router.get("/firebase", async (req, res) => {
  try {
    const auth = getAuth();

    res.status(200).json({
      success: true,
      message: "Firebase Connected Successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/create-user", createDummyUser);

export default router;
