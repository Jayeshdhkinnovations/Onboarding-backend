import { Router } from "express";
import {
  createForm,
  getForm,
  listForms,
  updateForm,
  deleteForm,
  submitForm,
  getSubmissions,
} from "../controllers/form.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.post("/", protect as any, createForm);
router.get("/", protect as any, listForms);
router.get("/:id", protect as any, getForm);
router.put("/:id", protect as any, updateForm);
router.delete("/:id", protect as any, deleteForm);

router.post("/:formId/submissions", submitForm);
router.get("/:formId/submissions", protect as any, getSubmissions);

export default router;
