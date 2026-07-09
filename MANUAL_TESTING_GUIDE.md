# Manual Testing Guide: Forms & Workspace Isolation

This guide outlines step-by-step instructions for testing the new forms features and cross-workspace isolation security boundaries using an API client like Postman or cURL.

---

## 🛠️ Step 1: Start the Backend Server

Run the development server locally:
```bash
npm run dev
```
By default, the backend will be available at `http://localhost:5000` (or the port defined in your environment config).

---

## 🔑 Step 2: Sign Up Admins & Retrieve JWT Tokens

To test workspace boundaries, we need to create two separate users: **Admin A** and **Admin B**.

### Request A: Create Admin A (User A)
* **HTTP Method**: `POST`
* **URL**: `http://localhost:5000/api/auth/signup`
* **Headers**: `Content-Type: application/json`
* **Body (JSON)**:
  ```json
  {
    "fullName": "Admin Alpha",
    "email": "admin.alpha@test.com",
    "password": "Password123!"
  }
  ```

#### 📌 Where is the JWT Token?
In the response payload, copy the value of the `"token"` field. This is the **JWT Token for Admin A** (referred to below as `JWT_TOKEN_ALPHA`).

**Example Response**:
```json
{
  "success": true,
  "message": "Signup successful.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", // 👈 COPY THIS LONG STRING
  "user": { ... }
}
```

---

### Request B: Create Admin B (User B)
* **HTTP Method**: `POST`
* **URL**: `http://localhost:5000/api/auth/signup`
* **Headers**: `Content-Type: application/json`
* **Body (JSON)**:
  ```json
  {
    "fullName": "Admin Beta",
    "email": "admin.beta@test.com",
    "password": "Password123!"
  }
  ```

#### 📌 Copy Token B:
Copy the `"token"` value from the response payload for Admin B (referred to below as `JWT_TOKEN_BETA`).

---

## 📝 Step 3: Admin A Creates a Form & Retrieves Form ID

Using Admin A's token, create a form in Workspace A.

* **HTTP Method**: `POST`
* **URL**: `http://localhost:5000/api/forms`
* **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer <JWT_TOKEN_ALPHA>`
* **Body (JSON)**:
  ```json
  {
    "title": "Alpha Feedback Form",
    "description": "Form for Workspace Alpha",
    "fields": [
      { "label": "Full Name", "type": "text", "required": true }
    ]
  }
  ```

#### 📌 Where is the Form ID?
In the response payload, copy the value of the `_id` key inside the `"form"` object. This is the **Form ID** (referred to below as `FORM_ID_ALPHA`).

**Example Response**:
```json
{
  "success": true,
  "message": "Form created successfully",
  "form": {
    "_id": "668a15b3c588a44b1bcfd12a", // 👈 COPY THIS FORM ID
    "title": "Alpha Feedback Form",
    "workspaceId": "668a11e3b...",
    "status": "active",
    "fields": [ ... ]
  }
}
```

---

## 🔒 Step 4: Verify Cross-Workspace Boundary Isolation (403 Checks)

Confirm that Admin B cannot access or modify Admin A's form.

### Request A: Admin B tries to GET Admin A's Form
* **HTTP Method**: `GET`
* **URL**: `http://localhost:5000/api/forms/668a15b3c588a44b1bcfd12a` (Use your copied `FORM_ID_ALPHA`)
* **Headers**: 
  - `Authorization: Bearer <JWT_TOKEN_BETA>`
* **Expected Response**: `403 Forbidden`
  ```json
  {
    "success": false,
    "message": "Forbidden: You do not own this form's workspace",
    "error": {
      "message": "Forbidden: You do not own this form's workspace"
    }
  }
  ```

### Request B: Admin B tries to PATCH Admin A's Form
* **HTTP Method**: `PATCH`
* **URL**: `http://localhost:5000/api/forms/668a15b3c588a44b1bcfd12a`
* **Headers**: 
  - `Authorization: Bearer <JWT_TOKEN_BETA>`
* **Body (JSON)**:
  ```json
  {
    "title": "Hijacked Title"
  }
  ```
* **Expected Response**: `403 Forbidden`

### Request C: Admin B tries to DELETE Admin A's Form
* **HTTP Method**: `DELETE`
* **URL**: `http://localhost:5000/api/forms/668a15b3c588a44b1bcfd12a`
* **Headers**: 
  - `Authorization: Bearer <JWT_TOKEN_BETA>`
* **Expected Response**: `403 Forbidden`

---

## 🍪 Step 5: Verify Cookie Authentication Support

### Request A: GET without credentials
* **HTTP Method**: `GET`
* **URL**: `http://localhost:5000/api/forms/668a15b3c588a44b1bcfd12a`
* **Expected Response**: `401 Unauthorized`
  ```json
  {
    "success": false,
    "message": "Not authorized, no token provided",
    "error": {
      "message": "Not authorized, no token provided"
    }
  }
  ```

### Request B: GET with cookie credentials
* **HTTP Method**: `GET`
* **URL**: `http://localhost:5000/api/forms/668a15b3c588a44b1bcfd12a`
* **Headers**: 
  - `Cookie: jwt=<JWT_TOKEN_ALPHA>` (or `token=<JWT_TOKEN_ALPHA>`)
* **Expected Response**: `200 OK`
  ```json
  {
    "success": true,
    "form": {
      "title": "Alpha Feedback Form",
      ...
    }
  }
  ```

---

## 💾 Step 6: Verify Autosave / Partial Updates on PATCH

Autosave updates the form continuously, potentially sending shorter titles (e.g. 1 character) during background saves.

* **HTTP Method**: `PATCH`
* **URL**: `http://localhost:5000/api/forms/668a15b3c588a44b1bcfd12a`
* **Headers**: 
  - `Authorization: Bearer <JWT_TOKEN_ALPHA>`
* **Body (JSON)**:
  ```json
  {
    "title": "A"
  }
  ```
* **Expected Response**: `200 OK` (Title matches `"A"`)

---

## 🚫 Step 7: Verify workspaceId Injection Prevention

Ensure that workspaceId can never be injected through body inputs or parameters.

* **HTTP Method**: `PATCH`
* **URL**: `http://localhost:5000/api/forms/668a15b3c588a44b1bcfd12a`
* **Headers**: 
  - `Authorization: Bearer <JWT_TOKEN_ALPHA>`
* **Body (JSON)**:
  ```json
  {
    "workspaceId": "some-other-workspace-id"
  }
  ```
* **Expected Response**: `400 Bad Request`
  ```json
  {
    "success": false,
    "message": "workspaceId must not be provided in body or params",
    "error": {
      "message": "workspaceId must not be provided in body or params"
    }
  }
  ```

---

## 🗑️ Step 8: Verify Deletion & Cascade Cleanups

Using Admin A's token, delete the form and automatically clear all associated submissions.

* **HTTP Method**: `DELETE`
* **URL**: `http://localhost:5000/api/forms/668a15b3c588a44b1bcfd12a`
* **Headers**: 
  - `Authorization: Bearer <JWT_TOKEN_ALPHA>`
* **Expected Response**: `200 OK`
  ```json
  {
    "success": true,
    "message": "Form and all its submissions deleted successfully"
  }
  ```
