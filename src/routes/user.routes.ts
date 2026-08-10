import { Router } from "express";
import { updateProfile, deleteProfile } from "../controllers/user.controller";
import { getProfileMe, patchProfileMe } from "../controllers/user_settings.controller";
import { protect, blockSuspended } from "../middleware/auth.middleware";

const router = Router();

router.get("/me", protect as any, blockSuspended as any, getProfileMe);
router.patch("/me", protect as any, blockSuspended as any, patchProfileMe);
router.put("/profile", protect as any, blockSuspended as any, updateProfile);
router.delete("/profile", protect as any, blockSuspended as any, deleteProfile);

export default router;
