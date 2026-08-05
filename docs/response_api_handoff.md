# Responses API Handoff & Contract Freeze

> **Status:** Contract Frozen & Production Ready  
> **Backend Package:** `onboard_backend`  
> **Date:** 2026-08-05  

---

## Executive Summary

The Responses API routes (`/api/responses`) are fully implemented, workspace-scoped, and validated against PBT properties. All endpoints enforce workspace isolation via JWT, paginate using 50-item limits, store client IP hashes (SHA-256), and perform physical disk file sweeps on deletion.

---

## API Endpoints & Payloads

### 1. List Responses
- **Method / Path:** `GET /api/responses`
- **Query Params:**
  - `formId` *(optional, string)*: Filter by form ID (must belong to authenticated workspace)
  - `status` *(optional, string)*: Filter by status (`new` | `in_progress` | `completed`)
  - `search` *(optional, string)*: Case-insensitive search across answer values
  - `page` *(optional, number, default 1)*
  - `limit` *(optional, number, default 10, max 50)*

- **Success Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "6a704c06e5fa4bb56691f87c",
      "formId": "6a704c06e5fa4bb56691f87a",
      "answers": {
        "Email": "alice@example.com",
        "Feedback": "Great product"
      },
      "status": "new",
      "submittedAt": "2026-08-05T06:00:00.000Z",
      "ipHash": "a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890",
      "createdAt": "2026-08-05T06:00:00.000Z",
      "updatedAt": "2026-08-05T06:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

---

### 2. Get Response Detail
- **Method / Path:** `GET /api/responses/:id`
- **Success Response (200 OK):**
```json
{
  "success": true,
  "response": {
    "_id": "6a704c06e5fa4bb56691f87c",
    "formId": "6a704c06e5fa4bb56691f87a",
    "answers": {
      "Email": "alice@example.com"
    },
    "status": "new",
    "submittedAt": "2026-08-05T06:00:00.000Z",
    "ipHash": "a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890",
    "response_files": [
      {
        "id": "6a704c06e5fa4bb56691f87d",
        "name": "attached_document.pdf",
        "size": 10240,
        "type": "application/pdf",
        "url": "http://localhost:5000/api/upload/file/user1/form1/responses/resp1/attached_document.pdf",
        "uploadTime": "2026-08-05T06:00:00.000Z"
      }
    ],
    "createdAt": "2026-08-05T06:00:00.000Z",
    "updatedAt": "2026-08-05T06:00:00.000Z"
  }
}
```
*Note: Internal storage keys (`path` / `r2Key`) are never exposed in `response_files`.*

---

### 3. Update Response Status
- **Method / Path:** `PATCH /api/responses/:id`
- **Request Body:**
```json
{
  "status": "in_progress"
}
```
*(Valid status values: `"new"`, `"in_progress"`, `"completed"`)*

- **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Response status updated successfully",
  "response": {
    "_id": "6a704c06e5fa4bb56691f87c",
    "status": "in_progress",
    "updatedAt": "2026-08-05T06:10:00.000Z"
  }
}
```

- **Validation Error (422 Unprocessable Entity):**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "status",
      "message": "status must be one of 'new', 'in_progress', or 'completed'"
    }
  ]
}
```

---

### 4. Delete Response
- **Method / Path:** `DELETE /api/responses/:id`
- **Success Response (204 No Content):** Empty body.
- **Behavior:** Permanently deletes response document from DB, cascade-deletes `Upload` metadata, and unlinks all physical files from local disk storage.

---

### 5. Get File Download URL
- **Method / Path:** `GET /api/responses/:id/file/:fileId`
- **Success Response (200 OK):**
```json
{
  "success": true,
  "url": "http://localhost:5000/api/upload/file/user1/form1/responses/resp1/attached_document.pdf"
}
```

---

### 6. Get Response Stats (Summary Cards)
- **Method / Path:** `GET /api/responses/stats`
- **Query Params:** `formId` *(required, string)*
- **Success Response (200 OK):**
```json
{
  "success": true,
  "stats": {
    "total": 42,
    "new": 10,
    "in_progress": 5,
    "completed": 27
  }
}
```
*Note: `total` always equals `new + in_progress + completed`. Counts reflect all responses for the form regardless of search/status/page filters.*

---

## Error Codes Matrix

| HTTP Status | Message | Description |
|-------------|---------|-------------|
| `401` | `Not authorized` | Missing or invalid Bearer token |
| `403` | `Forbidden: You do not own this response's workspace` | Request attempted on cross-workspace resource |
| `404` | `Response not found` / `File not found for this response` | Resource missing or not matching workspace |
| `422` | `Validation failed` | Invalid Zod status enum value |
| `500` | `Internal Server Error` | Unexpected system error (stack trace hidden in prod) |
