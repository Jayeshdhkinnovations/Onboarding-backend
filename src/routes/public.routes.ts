import { Router } from "express";
import { getPublicFormBySlug } from "../controllers/form.controller";

const router = Router();

router.get("/:slug", getPublicFormBySlug);

export default router;
