# Backend Contract: Settings, Sessions & Notifications API Reference

**Document Version:** 1.0.0  
**Updated:** 2026-08-10  
**Canonical Scope:** §4 Settings, Sessions, User Profiles, Workspaces, Exports & Notifications.

---

## 1. Decision: Notification Preferences Storage Location

**Decision:** Stored directly on the **`Workspace`** model document (`Workspace.notificationPreferences`).  
**Rationale:** Notification rules in Beginso apply per workspace. Storing preferences on the workspace model ensures workspace-wide consistency, eliminates redundant schema duplication, and allows seamless team workspace preferences in multi-user setups.

### Notification Preferences Schema (`Workspace.notificationPreferences`)
```json
{
  "newResponseEmail": true,
  "weeklyDigestEmail": true,
  "productUpdatesEmail": false
}
```

---

## 2. User Profile API Reference

### 2.1 GET `/api/users/me`
* **Auth Required:** Yes (`Bearer <token>` or session cookie)
* **Response `200 OK`**:
```json
{
  "success": true,
  "user": {
    "id": "6a5de6fe9b64998c9c56b47b",
    "name": "Jane Admin",
    "fullName": "Jane Admin",
    "email": "jane@example.com",
    "avatarUrl": "https://example.com/avatar.png",
    "emailVerified": true,
    "role": "admin",
    "status": "active",
    "createdAt": "2026-07-20T09:14:38.742Z",
    "lastLoginAt": "2026-08-10T12:00:00.000Z"
  }
}
```

### 2.2 PATCH `/api/users/me`
* **Auth Required:** Yes
* **Request Body**:
```json
{
  "name": "Jane Smith",
  "avatarUrl": "https://example.com/new_avatar.png"
}
```
* Note: Pass `"avatarUrl": null` to clear avatar.
* **Email Safeguard**: Any payload attempting to modify `"email"` directly via this endpoint will be rejected with `400 Bad Request`. Email changes require the dedicated re-verification flow.

---

## 3. Session Management & Revocation API Reference

### 3.1 GET `/api/auth/sessions`
* **Auth Required:** Yes
* **Response `200 OK`**:
```json
{
  "success": true,
  "sessions": [
    {
      "id": "6a79d1f2286032bb0abf3293",
      "deviceLabel": "Chrome on macOS",
      "approxLocation": {
        "city": "Mumbai",
        "region": "Maharashtra",
        "country": "India",
        "latitude": 19.076,
        "longitude": 72.8777
      },
      "lastActiveAt": "2026-08-10T13:00:00.000Z",
      "createdAt": "2026-08-10T10:00:00.000Z",
      "revokedAt": null,
      "isCurrent": true
    }
  ]
}
```
* **Privacy Guarantee**: Raw IP addresses are **never** returned or stored. IP addresses are hashed using SHA-256 (first 16 hex chars).

### 3.2 DELETE `/api/auth/sessions/:id`
* **Auth Required:** Yes
* **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Session revoked successfully"
}
```
* **Access Control**: Scoped strictly to the caller's own sessions. Attempts to revoke sessions belonging to another user return `403 Forbidden`. Revoked sessions cause subsequent requests using that session's JWT to be rejected immediately (`401 Unauthorized`).

---

## 4. Workspace Settings & Exports API Reference

### 4.1 GET `/api/workspaces/current`
* **Auth Required:** Yes
* **Response `200 OK`**:
```json
{
  "success": true,
  "workspace": {
    "id": "6a5de6fe9b64998c9c56b47c",
    "name": "Acme Corp Workspace",
    "logoUrl": "https://example.com/logo.png",
    "branding": {
      "primaryColor": "#1E40AF"
    },
    "notificationPreferences": {
      "newResponseEmail": true,
      "weeklyDigestEmail": true,
      "productUpdatesEmail": false
    },
    "owner": "6a5de6fe9b64998c9c56b47b",
    "createdAt": "2026-07-20T09:14:38.742Z",
    "updatedAt": "2026-08-10T13:00:00.000Z"
  }
}
```

### 4.2 PATCH `/api/workspaces/current`
* **Auth Required:** Yes
* **Request Body**:
```json
{
  "name": "Updated Acme Corp Workspace",
  "notificationPreferences": {
    "newResponseEmail": true,
    "weeklyDigestEmail": false,
    "productUpdatesEmail": true
  }
}
```

### 4.3 POST `/api/workspaces/current/export`
* **Auth Required:** Yes
* **Response `202 Accepted`**:
```json
{
  "success": true,
  "message": "Workspace export job created successfully",
  "export": {
    "id": "6a79d27fedd9b461f44698e3",
    "workspaceId": "6a5de6fe9b64998c9c56b47c",
    "status": "completed",
    "fileName": "workspace_export_6a5de6fe9b64998c9c56b47c_6a79d27fedd9b461f44698e3.json",
    "expiresAt": "2026-08-11T13:00:00.000Z"
  }
}
```

### 4.4 GET `/api/workspaces/current/export/file`
* **Auth Required:** Yes
* **Behavior:** Streams the exported workspace archive file with `Content-Type: application/json` and `Content-Disposition: attachment; filename="..."`. Token is passed via `Authorization: Bearer <token>` (never in query parameters).

### 4.5 DELETE `/api/workspaces/current`
* **Auth Required:** Yes
* **Behavior:** Performs complete workspace cascade deletion:
  1. Deletes all forms in the workspace.
  2. Deletes all responses associated with those forms.
  3. Cleans up file metadata and physical upload files from local disk (`uploads/`).
  4. Revokes all active user sessions for the workspace owner.
  5. Deletes the workspace document.
* **Guarantee:** Zero orphaned files or sessions remain after deletion.
