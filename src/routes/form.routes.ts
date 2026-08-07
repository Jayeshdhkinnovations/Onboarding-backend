import { Router } from "express";
import {
  createForm,
  getForm,
  listForms,
  updateForm,
  patchForm,
  deleteForm,
  submitForm,
  getSubmissions,
  duplicateForm,
  publishForm,
  closeForm,
} from "../controllers/form.controller";
import { protect, blockSuspended } from "../middleware/auth.middleware";

const router = Router();

router.post("/", protect as any, blockSuspended as any, createForm);
router.get("/", protect as any, blockSuspended as any, listForms);
router.get("/:formId", protect as any, blockSuspended as any, getForm);
router.put("/:formId", protect as any, blockSuspended as any, updateForm);
router.patch("/:formId", protect as any, blockSuspended as any, patchForm);
router.delete("/:formId", protect as any, blockSuspended as any, deleteForm);
router.post("/:formId/duplicate", protect as any, blockSuspended as any, duplicateForm);
router.post("/:formId/publish", protect as any, blockSuspended as any, publishForm);
router.post("/:formId/close", protect as any, blockSuspended as any, closeForm);

router.post("/:formId/submissions", protect as any, blockSuspended as any, submitForm);
router.get("/:formId/submissions", protect as any, blockSuspended as any, getSubmissions);

export default router;
