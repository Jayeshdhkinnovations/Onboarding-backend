# Beginso Life-Cycle Email Templates & Changelog Guide

**Document Version:** 3.0 (Master Handoff & Life-Cycle Templates Specification)  
**Last Updated:** 07 August 2026  
**Status:** 100% Implemented, Verified & Deployed  
**Target Audience:** Frontend Developers, Product Managers & System Administrators  

---

## Executive Summary

To deliver a top 1% world-class user experience, Beginso's email delivery engine includes full **account life-cycle transactional email templates**:

1. **Verification Request (`verify_email_otp`)**: Sent during signup or resend. Contains an opaque reveal button targeting the URL fragment: `${APP_URL}/verification-code#ticket=<OPAQUE_TICKET>`.
2. **Welcome Email (`welcome_user`)**: Sent to new users upon first sign-up or verification. Provides quick-start highlights and a direct button to open the dashboard (`${APP_URL}/dashboard`).
3. **Email Verification Success (`email_verified_success`)**: Sent automatically as soon as the 6-digit OTP is verified. Confirms account activation with a green shield graphic badge and CTA.
4. **Password Reset Request (`reset_password`)**: Sent during forgot password flow. Opens direct website URL `${APP_URL}/reset-password?mode=resetPassword&oobCode=...`.
5. **Password Changed Confirmation (`password_changed_success`)**: Sent after a password is updated. Provides security alerts, UTC timestamps, and immediate sign-in links.

---

## 1. Life-Cycle Email Overview & Matrix

| Template ID | Event Trigger | Subject Line | Header Accent | Primary Action Button Target |
|---|---|---|---|---|
| `verify_email_otp` | User registers or requests code resend | `Verify your Beginso email` | Blue Gradient (`#1E40AF` -> `#3B82F6`) | `${APP_URL}/verification-code#ticket=...` |
| `welcome_user` | First-time onboarding / account creation | `Welcome to Beginso! 🎉` | Purple-Blue Gradient (`#2563EB` -> `#7C3AED`) | `${APP_URL}/dashboard` |
| `email_verified_success` | 6-digit OTP verification completed | `Your email has been verified! ✅` | Green Gradient (`#059669` -> `#10B981`) | `${APP_URL}/dashboard` |
| `reset_password` | User requests password reset link | `Reset your Beginso password` | Blue Gradient (`#1E40AF` -> `#3B82F6`) | `${APP_URL}/reset-password?mode=resetPassword&oobCode=...` |
| `password_changed_success` | Password updated in Firebase Auth | `Security Alert: Your Beginso password was updated` | Red-Amber Gradient (`#DC2626` -> `#F59E0B`) | `${APP_URL}/login` |

---

## 2. Template HTML Design Specifications

### 2.1 Welcome Email (`welcome_user`)

```html
<!-- Design Features -->
- Header: 8px Top Bar linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)
- Card Container: Max 540px width, 16px border-radius, #ffffff background, 1px solid #E5E7EB
- Feature Highlight Box:
    ⚡ Instant Form Builder
    📊 Real-time Analytics
    🔒 Enterprise Security
- Button: "Go to Dashboard" -> ${APP_URL}/dashboard
```

---

### 2.2 Verification Success Email (`email_verified_success`)

```html
<!-- Design Features -->
- Header: 8px Top Bar linear-gradient(135deg, #059669 0%, #10B981 100%)
- Badge Graphic: 64px Circular Emerald Checkmark Container (#D1FAE5)
- Heading: "Email Verified Successfully!"
- Body Copy: Confirms email address ${to} is active.
- Button: "Open Beginso Workspace" -> ${APP_URL}/dashboard
```

---

### 2.3 Password Changed Confirmation (`password_changed_success`)

```html
<!-- Design Features -->
- Header: 8px Top Bar linear-gradient(135deg, #DC2626 0%, #F59E0B 100%)
- Heading: "Password Updated Successfully 🔐"
- Security Alert Card: #FEF2F2 container with warning text:
  "If you did NOT authorize this change, someone may have accessed your account. Reset your password immediately."
- Timestamp: Displays exact UTC timestamp of event.
- Button: "Sign In to Your Account" -> ${APP_URL}/login
```

---

## 3. Backend Integration & Trigger Helper

To trigger any of these emails from any backend service or controller:

```typescript
import { mailService } from "../services/mail.service";

// 1. Send Welcome Email
await mailService.sendMail({
  to: "user@example.com",
  template: "welcome_user",
  name: "Jane Doe",
  actionUrl: "https://beginso.com/dashboard",
});

// 2. Send Verification Confirmation Email
await mailService.sendMail({
  to: "user@example.com",
  template: "email_verified_success",
  actionUrl: "https://beginso.com/dashboard",
});

// 3. Send Password Change Security Alert Email
await mailService.sendMail({
  to: "user@example.com",
  template: "password_changed_success",
  actionUrl: "https://beginso.com/login",
});
```

---

## 4. Changelog of Modifications

* **`src/services/mail.service.ts`**:
  * Added `name?: string` property to `SendMailOptions`.
  * Expanded `AuthMailType` union type to include `welcome_user`, `email_verified_success`, and `password_changed_success`.
  * Implemented responsive HTML & plain-text templates with custom gradient headers, badges, feature boxes, and security alert cards.

* **`src/controllers/auth.controller.ts`**:
  * Integrated automatic `email_verified_success` email dispatch inside `verifyEmailCode` upon successful 6-digit OTP verification.

* **Documentation**:
  * Created `docs/additional_email_templates_and_changelog.md`.
  * Synchronized master specs in `docs/email_templates_and_delivery_specifications.md`.
