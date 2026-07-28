# Requirements Document: Super Admin Backend APIs

This document defines the functional and non-functional requirements for the shared backend endpoints supporting the **Super Admin Console** platform features.

---

## 1. Authentication & Middleware Security

### [REQ-1.1] Role-Based Access Control (RBAC)
* **Description:** Only authenticated users with `role: 'super_admin'` are allowed to access any endpoint under the `/api/superadmin/*` prefix.
* **Middleware Name:** `requireSuperAdmin`
* **Behavior:**
  * Must run after token verification (`verifyToken`).
  * If the resolved user's `role` is not exactly `"super_admin"`, return HTTP `403 Forbidden` with the error code `FORBIDDEN_SUPER_ADMIN_REQUIRED`.
  * Ensure the role check is performed against the database-backed user record, not from client-modifiable cookies or query strings.

### [REQ-1.2] Suspended Account Gating
* **Description:** Suspended normal admins must be blocked from executing any operations.
* **Middleware Name:** `blockSuspended`
* **Behavior:**
  * Applied to all admin-facing routes (e.g. `/api/forms`, `/api/workspaces`).
  * If the resolved user's `status` is `"suspended"`, immediately return HTTP `403 Forbidden` with the error code `ACCOUNT_SUSPENDED`.
  * Super Admin console routes (`/api/superadmin/*`) are exempt from this check.

---

## 2. Dashboard Analytics & Monitor

### [REQ-2.1] Platform Statistics (`GET /api/superadmin/stats`)
* **Description:** Provide high-level platform health KPIs and metrics.
* **Response Requirements:**
  * `totalAdmins`: Total count of admin accounts, split into `active` and `suspended` counts.
  * `totalWorkspaces`: Total workspaces initialized.
  * `totalForms`: Total forms created across all workspaces.
  * `totalResponses`: Total form submissions recorded.
  * `totalStorageUsed`: Cumulative byte-size of all uploaded file attachments.
  * `recentSignups`: List of the last 10 registered admins (name, email, workspace title, signup date).

### [REQ-2.2] Abuse & Attack Monitoring (`GET /api/superadmin/abuse`)
* **Description:** Track rate-limiting triggers and bot prevention signals.
* **Response Requirements:**
  * Top 5 rate-limited Client IP Hashes (first 16 chars of SHA-256 of the IP) in the last 7 days.
  * Top 5 rate-limited published form slugs (last 7 days).
  * Total count of honeypot silent drops (last 7 days).

---

## 3. System Logs Viewer

### [REQ-3.1] Log Auditing (`GET /api/superadmin/logs`)
* **Description:** Paginated system logs viewer supporting full filtering.
* **Query Parameters:** `level`, `from`, `to`, `route`, `search`, `page`, `limit`.
* **Behavior:**
  * Returns logs matching the filters, sorted by timestamp descending.
  * System logs are automatically purged after 30 days via a TTL index.
  * Error-level logs must include full metadata objects. Stack traces should be included in non-production environments but **must be stripped** in production responses.

---

## 4. Admin Management (CRUD)

### [REQ-4.1] List Admins (`GET /api/superadmin/admins`)
* **Description:** Paginated table listing of all Admin users with name, email, workspace name, form count, response count, storage used, last login, and status.

### [REQ-4.2] Create Admin (`POST /api/superadmin/admins`)
* **Description:** Boostraps a new customer workspace.
* **Behavior:**
  1. Creates the user in Firebase Auth.
  2. Creates a MongoDB `users` document with `role: 'admin'` and `status: 'active'`.
  3. Creates a bootstrapped `workspaces` document owned by the new user.
  4. Automatically records an audit log entry.

### [REQ-4.3] Edit Admin (`PATCH /api/superadmin/admins/:id`)
* **Description:** Updates the admin's name, status (`active` / `suspended`), or workspace name. 

### [REQ-4.4] Hard Delete Guard (`DELETE /api/superadmin/admins/:id`)
* **Description:** Destructive operation requiring explicit confirmation.
* **Input Body:** `{ confirm: "<email>" }`
* **Behavior:**
  * Must check that the `confirm` parameter matches the target admin's email exactly (case-sensitive).
  * Cascade-deletes: MongoDB user document, workspace, forms, responses, upload records, and deletes corresponding physical objects in storage (e.g. AWS S3/Cloudflare R2).
  * Returns `207 Multi-Status` if a partial deletion failure occurs (e.g., storage deletion fails, but database is cleared).

---

## 5. Audit Log Viewer

### [REQ-5.1] Read-Only Audit Log (`GET /api/superadmin/audit`)
* **Description:** Read-only immutable record of all Super Admin mutations.
* **Parameters:** `actor`, `action`, `from`, `to`, `page`, `limit`.
* **Behavior:**
  * Each log record includes actor info, target identifier, operation type (create/edit/suspend/delete), and before/after JSON diff states.
  * **Strict Isolation:** No mutation endpoints (PUT/PATCH/DELETE) exist for `audit_logs`. The database schema must be append-only.
