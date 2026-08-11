# Beginso Backend Email Infrastructure & Template Reference

**Document Version:** 3.0 (Master Handoff & Complete System Specification)  
**Last Updated:** 10 August 2026  
**Status:** 100% Implemented, Tested & Deployed Live on Production  
**Primary Engine File:** [`src/services/mail.service.ts`](file:///c:/Users/xeon5/Downloads/Onboarding-backend-forms/src/services/mail.service.ts)

---

## 1. System Overview & Core Principles

The Beginso backend features a custom, high-reliability transactional email delivery engine built on **Nodemailer**, **SMTP**, **HMAC-SHA256 privacy hashing**, and **MongoDB-backed delivery audit logs**.

### Fundamental Architecture Rules:
1. **Zero Firebase Default Email**: Firebase Client SDK email methods (`sendEmailVerification`, `sendPasswordResetEmail`) are strictly disabled client-side. All emails are rendered and dispatched by the backend Nodemailer SMTP service (`email.toowix.com`).
2. **Domain Integrity**: All links embedded in emails route exclusively to the primary domain (`https://beginso.com`) or custom application host. No `firebaseapp.com` links exist.
3. **Recipient Privacy Guarantee**: Recipient email addresses are **never stored raw** in system mail logs or analytics. Every email address is hashed using **HMAC-SHA256** with a secret server pepper (`AUTH_EMAIL_HASH_PEPPER`).
4. **Top 1% Design Aesthetics**: Every email uses a responsive HTML template with gradient branding headers, Inter typography, explicit CTA buttons, direct fallback links, security alert callouts, and clean plain-text alternatives.
5. **Rate Limiting & Abuse Prevention**: Built-in memory rate limiters enforce cooldown periods and hourly caps on verification and reset requests to protect SMTP quotas.

---

## 2. Environment & Transport Configuration

### Environment Variables (`.env`)

```dotenv
# Application Public URL
APP_URL=https://beginso.com

# Production SMTP Gateway
SMTP_HOST=email.toowix.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=jayesh@dhkinnovations.com
SMTP_PASS=Jayesh@45
SMTP_FROM_NAME="Beginso"
SMTP_FROM_EMAIL=no-reply@beginso.com

# Security Pepper for Recipient Hashing & OTP Storage
AUTH_EMAIL_HASH_PEPPER=beginso-mail-pepper-secret
```

### Transport Setup (`src/services/mail.service.ts`)
* **Transport**: Nodemailer SMTP transport over port `587` (STARTTLS).
* **TLS Policy**: `tls: { rejectUnauthorized: false }` for mail server connection resilience.
* **From Address**: `"Beginso" <no-reply@beginso.com>` (configurable via `SMTP_FROM_NAME` and `SMTP_FROM_EMAIL`).

---

## 3. Comprehensive Inventory of All Backend Email Types

The backend supports **6 transactional auth/security email types** plus workspace response notification emails:

| # | Template Key | Purpose / Trigger | Primary CTA / Action | Rate Limit / Cooldown |
|---|---|---|---|---|
| 1 | `verify_email` / `verify_email_otp` | 6-Digit OTP code email verification upon signup or re-verification request | "View verification code" link (`/verification-code?ticket=...`) | 30s cooldown, max 5/hr per UID |
| 2 | `reset_password` | Password reset link request | "Reset password" link (`/reset-password?oobCode=...`) | 60s cooldown, max 5/hr per email |
| 3 | `welcome_user` | Welcome onboarding message on successful account creation | "Go to Dashboard" (`/dashboard`) | None (once per account) |
| 4 | `email_verified_success` | Notification sent when email address verification is confirmed | "Open Beginso Workspace" (`/dashboard`) | None (triggered on completion) |
| 5 | `password_changed_success` | Security alert sent immediately after password reset or update | "Sign In to Your Account" (`/login`) | None (triggered on security event) |
| 6 | Workspace Response Email | Notification sent to workspace admins when a public form gets a new response | "View Form Responses" | Controlled by `Workspace.notificationPreferences.newResponseEmail` |

---

## 4. Deep-Dive Specification of Each Email Type

---

### 4.1 `verify_email` / `verify_email_otp` — Email Verification (6-Digit OTP)

* **Trigger**: `POST /api/auth/email-verification` (User requests email verification)
* **Subject**: `Verify your Beginso email`
* **Recipient**: User's pending email address
* **Header Style**: Blue gradient bar (`linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)`)
* **Key Copy & Elements**:
  * **Heading**: "Verify your email address"
  * **CTA Button**: "View verification code" (links to `${APP_URL}/verification-code?ticket=${ticketId}`)
  * **Expiration Note**: ⏱️ Secure link and 6-digit OTP expire in **10 minutes**.
  * **Fallback Box**: Raw URL fallback for manual copy-pasting.
  * **Security Shield Card**: Explains that the 6-digit code is generated and rendered securely on the Beginso website upon button click.
* **Rate Limits**:
  * 30-second cooldown between consecutive requests.
  * Maximum 5 requests per hour per Firebase UID.
* **Security Safeguard**:
  * 6-digit OTP is hashed with HMAC-SHA256 before saving to MongoDB (`AuthOtp` collection).
  * Validation uses constant-time comparison (`crypto.timingSafeEqual`).
  * Locked out permanently after 5 failed verification attempts.

---

### 4.2 `reset_password` — Password Reset Request

* **Trigger**: `POST /api/auth/forgot-password`
* **Subject**: `Reset your Beginso password`
* **Recipient**: User's email address
* **Header Style**: Blue gradient bar (`linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)`)
* **Key Copy & Elements**:
  * **Heading**: "Reset your password"
  * **CTA Button**: "Reset password" (links to `${APP_URL}/reset-password?oobCode=${oobCode}`)
  * **Fallback Box**: Raw reset URL fallback box.
  * **Security Card (Red/Rose alert)**: 🔒 "If you didn't request a password reset, your password remains secure and unchanged. You can safely ignore this message."
* **Rate Limits**:
  * 60-second cooldown between requests.
  * Maximum 5 requests per hour per hashed email.
* **Security Safeguard**:
  * Returns `202 Accepted` generically even if the email does not exist (prevents email enumeration attacks).

---

### 4.3 `welcome_user` — Welcome & Onboarding Email

* **Trigger**: Account creation / signup completion (`POST /api/auth/signup` or Super Admin creation)
* **Subject**: `Welcome to Beginso! 🎉`
* **Recipient**: New user
* **Header Style**: Purple/Blue gradient bar (`linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)`)
* **Key Copy & Elements**:
  * **Heading**: "Welcome to Beginso, {Name}! 👋"
  * **Feature Grid Box**: Highlighted platform capabilities:
    * ⚡ **Instant Form Builder**: Create customized multi-step forms in seconds.
    * 📊 **Real-time Analytics**: Track submission trends and conversion performance live.
    * 🔒 **Enterprise Security**: Encrypted data & strict session controls.
  * **CTA Button**: "Go to Dashboard" (links to `${APP_URL}/dashboard`)

---

### 4.4 `email_verified_success` — Email Verification Confirmation

* **Trigger**: `POST /api/auth/email-verification/verify` (When OTP is successfully verified)
* **Subject**: `Your email has been verified! ✅`
* **Recipient**: Verified user
* **Header Style**: Emerald green gradient bar (`linear-gradient(135deg, #059669 0%, #10B981 100%)`)
* **Key Copy & Elements**:
  * **Visual Graphic**: Centered green checkmark badge (✅).
  * **Heading**: "Email Verified Successfully!"
  * **Copy**: "Your email address **{email}** has been confirmed. Your account is fully active and ready to use."
  * **CTA Button**: "Open Beginso Workspace" (links to `${APP_URL}/dashboard`)

---

### 4.5 `password_changed_success` — Password Changed Security Alert

* **Trigger**: `POST /api/auth/confirm-password-reset` or `POST /api/auth/password-changed`
* **Subject**: `Security Alert: Your Beginso password was updated`
* **Recipient**: Account owner
* **Header Style**: Red/Amber security alert gradient bar (`linear-gradient(135deg, #DC2626 0%, #F59E0B 100%)`)
* **Key Copy & Elements**:
  * **Heading**: "Password Updated Successfully 🔐"
  * **Timestamp**: Exact UTC timestamp of password change.
  * **Red Security Alert Box**: 🚨 "If you performed this change, you can safely ignore this message. If you did NOT authorize this change, someone may have accessed your account. Reset your password immediately."
  * **CTA Button**: Dark high-contrast button "Sign In to Your Account" (links to `${APP_URL}/login`).

---

### 4.6 Workspace Response Notification Emails

* **Trigger**: Public form submission (`POST /api/public/forms/:slug/submissions`) when workspace has notifications enabled.
* **Preference Check**: Evaluated against `Workspace.notificationPreferences.newResponseEmail` (stored on workspace document).
* **Subject**: `New Form Submission: {Form Title}`
* **Recipient**: Workspace owner / admin email.
* **Content**: Summary of response submission ID, form title, submission timestamp, and link to view response drawer in Beginso dashboard.

---

## 5. Mail Delivery Audit Log (`MailLog` Model)

Every email dispatch attempt (success or failure) writes an immutable audit record to the `MailLog` collection in MongoDB.

### Schema (`src/models/MailLog.ts`)

```typescript
export interface IMailLog extends Document {
  template: "verification" | "password_reset" | "welcome";
  outcome: "sent" | "failed" | "queued" | "rate_limited";
  emailHash: string;      // HMAC-SHA256(email, pepper) — NEVER raw email
  firebaseUid?: string;   // Optional Firebase UID reference
  requestId: string;     // Unique request ID (e.g. req_a1b2c3d4)
  provider: "resend" | "sendgrid" | "ses" | "postmark" | "smtp";
  errorCode?: string;     // e.g. ECONNREFUSED, AUTH_FAILED, RATE_LIMITED
  latencyMs?: number;     // Round-trip dispatch time in milliseconds
  createdAt: Date;        // Automatically purged after 30 days (TTL Index)
}
```

### Privacy Hashing Implementation
```typescript
export const computeEmailHash = (email: string): string => {
  const normalized = (email || "").trim().toLowerCase();
  const pepper = process.env.AUTH_EMAIL_HASH_PEPPER || "beginso-mail-pepper-secret";
  return crypto.createHmac("sha256", pepper).update(normalized).digest("hex");
};
```

### Super Admin Inspection Endpoint
* **Route**: `GET /api/superadmin/mail-logs?template=&outcome=&search=&page=&limit=`
* **Auth**: Super Admin credentials required (`requireSuperAdmin`).
* **Purpose**: Allows system administrators to inspect delivery success rates, SMTP latency, rate-limit hits, and provider errors without violating user email privacy.

---

## 6. Verification & Test Suite

The email system is covered by automated unit and integration tests:
* `src/__tests__/auth_mail.test.ts`: Tests OTP generation, rate-limit enforcement, 60s cooldown, invalid code rejection, and password reset flows.
* `src/__tests__/password_changed.test.ts`: Tests `password_changed_success` email triggers.
* `src/__tests__/maillogs.test.ts`: Tests HMAC hashing, `MailLog` creation, TTL index, and Super Admin mail log filtering.

Run tests:
```bash
npx jest src/__tests__/auth_mail.test.ts src/__tests__/password_changed.test.ts src/__tests__/maillogs.test.ts
```
