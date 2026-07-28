import { Router } from "express";
import { updateProfile, deleteProfile } from "../controllers/user.controller";
import { protect, blockSuspended } from "../middleware/auth.middleware";

const router = Router();

router.put("/profile", protect as any, blockSuspended as any, updateProfile);
router.delete("/profile", protect as any, blockSuspended as any, deleteProfile);

export default router;
