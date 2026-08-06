# Response File Download & User Seed Integration Guide

> **Status:** Production Ready & Verified  
> **Backend Package:** `onboard_backend`  
> **Date:** 2026-08-06  

---

## Executive Summary

This document serves as the definitive reference for the frontend team regarding:
1. **File Download & Preview Authorization**: Resolution for the `401 Unauthorized access to private files` issue across `GET /api/responses/:id/file/:fileId` and direct file serving `/api/upload/file/...`.
2. **User & Form Response Seeding**: Standardized CLI tool to populate real responses and file attachments for `test@gmail.com` under the `"Master Comprehensive Template"`.

---

## 1. File Download & Preview Endpoint Specifications

### A. Get Response File Download URL
* **Method / Path:** `GET /api/responses/:id/file/:fileId`
* **Headers:** `Authorization: Bearer <SESSION_TOKEN>`
* **Success Response (200 OK):**
```json
{
  "success": true,
  "url": "http://localhost:5000/api/upload/file/workspace1/form1/responses/resp1/attached_doc.pdf?token=SESSION_TOKEN"
}
```
* **Key Behavior**:
  - Validates that the caller's JWT token owns the workspace associated with `:id`.
  - Returns an authenticated, direct preview/download link with `?token=` pre-attached as a fallback for direct browser navigation (`window.open()`, `<a href download>`, `<img src>`, `<iframe src>`).

---

### B. Direct File Serving Endpoint
* **Method / Path:** `GET /api/upload/file/*`
* **Authentication Options (Flexible & Multi-Channel):**
  1. **Authorization Header**: `Authorization: Bearer <SESSION_TOKEN>` (case-insensitive `Bearer` / `bearer`).
  2. **URL Query Parameter**: `GET /api/upload/file/path?token=<SESSION_TOKEN>` or `?access_token=<SESSION_TOKEN>`.
  3. **Custom Header**: `x-access-token: <SESSION_TOKEN>`.
  4. **Cookies**: `token=<SESSION_TOKEN>` or `access_token=<SESSION_TOKEN>`.

* **Access Rules**:
  - **Branding Files** (`logo`, `coverImage`): Publicly accessible without any authentication header or token.
  - **Private Response Files**: Requires a valid user session belonging to the workspace owner, a workspace member, or a `super_admin`.

---

## 2. Response Data Seeding (`test@gmail.com`)

A dedicated npm seed command is available to generate real responses with uploaded physical files for `test@gmail.com`.

### How to Run the Seed Command

```bash
# Run via npm script
npm run seed:user-responses

# Or directly via ts-node
npx ts-node src/scripts/seedUserResponses.ts
```

### Seed Behavior & Data Scope
* **Target User**: `test@gmail.com` (creates user if not found).
* **Target Form**: `"Master Comprehensive Template"` / `"master compresenive template"` (creates form with all 10 field types if not found).
* **Response Generation**: Creates **5 diverse responses** with:
  - Realistic values for all fields (Text, Email, Phone, Number, Date, Dropdown, Choice, Checkboxes).
  - Attached physical files on local disk under `uploads/<workspaceId>/<formId>/responses/<responseId>/`.
  - Created `Upload` metadata records properly linked to each response.
  - Diverse status values (`new`, `in_progress`, `completed`) and distributed timestamps over the last 5 days.

---

## 3. Frontend Integration Checklist

1. **File Preview / Download Buttons**:
   - Call `GET /api/responses/:id/file/:fileId` with `Authorization: Bearer <token>`.
   - Use the returned `res.data.url` directly with `window.open(url)` or `<a href={url} download>`.
   - The returned URL contains `?token=` parameter, guaranteeing seamless downloads even without custom header support in standard browser anchors.

2. **Status Updates (`PATCH /api/responses/:id`)**:
   - Body shape: `{ "status": "new" | "in_progress" | "completed" }`.
   - Both `PATCH` and `PUT` methods are active on the backend.
   - Status updates return status `200 OK` with payload `{ "success": true, "response": updatedDoc, "data": updatedDoc }`.
