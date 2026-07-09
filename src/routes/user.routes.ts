import { Router } from "express";
import { updateProfile, deleteProfile } from "../controllers/user.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.put("/profile", protect as any, updateProfile);
router.delete("/profile", protect as any, deleteProfile);

export default router;
