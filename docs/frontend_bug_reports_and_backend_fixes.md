# Master Frontend Bug Reports & Backend Resolutions Ledger

> **Status:** All Reported Bugs Resolved, Tested & Deployed  
> **Backend Package:** `onboard_backend`  
> **Repository:** `Jayeshdhkinnovations/Onboarding-backend`  
> **Date Updated:** 2026-08-06  

---

## Executive Summary

This master document tracks all bug reports submitted by the frontend team alongside their technical root causes, backend fixes applied, verification status, and updated integration instructions for the frontend developer.

---

## Master Triage & Status Summary

| Bug ID | Feature / Route | Severity | Reported Issue | Backend Status | Resolution Summary |
|---|---|---|---|---|---|
| **BUG-01** | `POST /api/public/:slug/submit` | Critical | Submit rejected all payloads with 422 "required fields missing" | **FIXED & DEPLOYED** | Multi-key answer matching (`fieldId`, `_id`, `label`) for all 6 submission payload shapes. |
| **BUG-02** | `GET /api/public/:slug` & Submit | High | `closeDate` & `responseLimit` not enforced server-side | **FIXED & DEPLOYED** | Added submit-time and fetch-time limit checks; status auto-flips to `"closed"` returning `404`. |
| **BUG-03** | `PATCH /api/responses/:id` | High | Response status update query matching zero docs | **FIXED & DEPLOYED** | Scoped update via `Form.exists` ownership check + `findByIdAndUpdate` with `$set`. |
| **BUG-04** | `PATCH /api/responses/:id` | Medium | Frontend asked if reverting status to `"new"` fails | **VERIFIED & TESTED** | Reverting from `completed` or `in_progress` back to `new` is fully supported (`200 OK`). |
| **BUG-05** | `GET /api/responses/:id/file/:fileId` | High | File download returned `401 Unauthorized access to private files` | **FIXED & DEPLOYED** | Multi-channel token parser (headers, `?token=`, cookies) + pre-attached `?token=` in returned URLs. |
| **BUG-06** | Auth & Email Verification | High | Alignment conflict between Frontend & Backend mail verification | **DOCUMENTED & DEPLOYED** | Built 6-digit OTP verification + fallback signed links (`POST /api/auth/email-verification` & `/verify`), session gate `email_verified` enforcement, and created `docs/auth_email_verification_flow.md`. |

---

## Detailed Bug Reports & Resolutions

### 1. BUG-01 & BUG-02: Public Form Submit & Availability Enforcement

* **Endpoints**: `POST /api/public/:slug/submit`, `GET /api/public/:slug`
* **Severity**: Critical

#### Problem Description
- Every submission to a published form's `/submit` endpoint failed with `422 Unprocessable Content` ("all required fields missing"), regardless of payload structure.
- Form `responseLimit` and `closeDate` were not enforced on submit, allowing submissions after expiry.

#### Root Cause
- Field normalization in `submitPublicForm` matched against `fieldId` string properties, but Mongoose subdocuments inside `form.fields` stored field IDs in `_id` hex format or un-trimmed labels. `answers` object remained empty before validation.

#### Backend Resolution Applied
1. **Payload Extraction**: Updated `submitPublicForm` (`src/controllers/form.controller.ts`) to match incoming fields across `fieldId`, `_id`, `label`, `ans.fieldId`, `ans.fieldLabel`, and `ans.label`. Sets values on all keys so required field checks pass reliably across all 6 payload shapes.
2. **Availability Checks**: Integrated `checkFormAvailability` in `form.service.ts`:
   - Checks if `closeDate` has passed (`now > closeTime`).
   - Checks if total responses $\ge$ `responseLimit` (when `responseLimitEnabled: true`).
   - Automatically flips `form.status` to `"closed"` in MongoDB and returns `404 Not Found` ("Form is no longer accepting responses").

#### Frontend Integration Guidance
- The frontend can submit public forms using any of the standard shapes:
  - `{ answers: [{ fieldId, value }] }`
  - `{ answers: [{ fieldId, fieldType, fieldLabel, value }] }`
  - Direct key-value map `{ [fieldId]: value }` or multipart form-data.

---

### 2. BUG-03 & BUG-04: Response Status Update & Reverting to "New"

* **Endpoints**: `PATCH /api/responses/:id`, `PUT /api/responses/:id`
* **Severity**: High

#### Problem Description
- `PATCH /api/responses/:id` failed to update response status.
- Frontend reported uncertainty about whether reverting a response's status back to `"new"` from `"in_progress"` or `"completed"` was restricted.

#### Root Cause
- Response documents in MongoDB do not store a top-level `workspaceId` field. Direct queries matching `Response.findOneAndUpdate({ _id, workspaceId })` failed to match existing documents.

#### Backend Resolution Applied
1. **Query & Authorization Refactor**:
   - Fetches response by ID first (`ResponseModel.findById`).
   - Verifies workspace ownership through the response's form (`Form.exists({ _id: response.formId, workspaceId })`).
   - Updates status using `ResponseModel.findByIdAndUpdate(id, { $set: { status } }, { new: true, runValidators: true })`.
2. **HTTP Method Compatibility**: Enabled both `PATCH` and `PUT` routes on `/api/responses/:id`.
3. **Status Enum Validation**: Strict Zod validation `z.enum(["new", "in_progress", "completed"])`.
4. **Reverting to `"new"`**: Confirmed and added automated unit tests verifying that reverting from `"completed"` $\rightarrow$ `"new"` or `"in_progress"` $\rightarrow$ `"new"` returns `200 OK` and updates MongoDB correctly.

#### Frontend Integration Guidance
- Frontend can freely change status to any of the 3 valid states: `"new"`, `"in_progress"`, `"completed"`.
- Response payload structure:
```json
{
  "success": true,
  "message": "Response status updated successfully",
  "response": {
    "_id": "6a704c06e5fa4bb56691f87c",
    "status": "new",
    "updatedAt": "2026-08-06T09:00:00.000Z"
  },
  "data": {
    "_id": "6a704c06e5fa4bb56691f87c",
    "status": "new",
    "updatedAt": "2026-08-06T09:00:00.000Z"
  }
}
```

---

### 3. BUG-05: Response File Download Returns 401 Unauthorized

* **Endpoints**: `GET /api/responses/:id/file/:fileId`, `GET /api/upload/file/*`
* **Severity**: High

#### Problem Description
- Clicking Download/Preview on attached files in the Response Detail drawer failed with `401 Unauthorized access to private files`.

#### Root Cause
- Direct browser navigations (`window.open(url)`, `<a href={url} download>`, `<img src>`, `<iframe src>`) cannot send custom `Authorization: Bearer` headers. Header-only authentication in `getFile` failed whenever browser anchors or direct links accessed private response files.

#### Backend Resolution Applied
1. **Multi-Channel Authentication**: Updated `upload.controller.ts` and `auth.middleware.ts` to extract session tokens from:
   - Case-insensitive `Authorization` headers (`Bearer <token>`, `bearer <token>`).
   - URL query parameters (`?token=<token>`, `?access_token=<token>`, `?auth=<token>`).
   - Custom header `x-access-token`.
   - Cookies (`token`, `jwt`, `access_token`).
2. **Pre-Attached Download URLs**: `GET /api/responses/:id/file/:fileId` appends `?token=<SESSION_TOKEN>` to the returned download URL.
3. **Workspace Authorization**: Verifies user workspace membership or owner ID on private file serving.

#### Frontend Integration Guidance
- For file preview/download, fetch the file URL via:
  `GET /api/responses/:id/file/:fileId` with `Authorization: Bearer <token>`
- Use the returned `res.data.url` directly with `window.open(url)` or `<a href={url} download>`. The URL contains the pre-attached `?token=` parameter, ensuring standard browser navigations work smoothly.

---

## 4. Response Seeding Tool for Testing

To assist frontend integration testing, a CLI seed command is available to populate test data under `test@gmail.com`.

### Seeding Command
```bash
npm run seed:user-responses
# Or: npx ts-node src/scripts/seedUserResponses.ts
```

### Seeded Resources
* **User**: `test@gmail.com`
* **Form**: `"Master Comprehensive Template"`
* **Responses**: 5 complete responses with realistic values for all 10 field types and physical attached files on local disk (`uploads/<workspaceId>/<formId>/responses/<responseId>/`).

---

## 5. Verification & Test Suite Summary

- **Total Test Suites**: `14 / 14 Passed`
- **Total Test Cases**: `187 / 187 Passed`
- **Git Commit**: `b0ce724` on `main`
