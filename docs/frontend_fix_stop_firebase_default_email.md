# CRITICAL FRONTEND FIX: How to Stop Firebase Default Email & Use Beginso SMTP Mail

**Issue**: Signup is sending a default plain-text email from `noreply@onboarding-plateform.firebaseapp.com` with link `https://onboarding-plateform.firebaseapp.com/__/auth/action...`.

**Cause**: The frontend code is calling Firebase Client SDK's `sendEmailVerification(user)` directly upon signup. When called on the client, Firebase Auth triggers its own default template and ignores the backend.

---

## Exact Code Change Required in Frontend Signup Page (`/signup` or `/register`)

### ❌ WRONG CODE (Currently in Frontend):
```typescript
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";

// ON SIGNUP SUBMIT:
const userCredential = await createUserWithEmailAndPassword(auth, email, password);

// ❌ DELETE THIS LINE! This triggers Firebase's default plain email:
await sendEmailVerification(userCredential.user);

router.push("/verify-email");
```

---

### ✅ CORRECT CODE (Replace with this):
```typescript
import { createUserWithEmailAndPassword } from "firebase/auth";

// ON SIGNUP SUBMIT:
const userCredential = await createUserWithEmailAndPassword(auth, email, password);

// 1. Get Firebase ID Token
const token = await userCredential.user.getIdToken();

// 2. Call Beginso Backend to send custom branded OTP email via SMTP
const res = await fetch("https://backend-obp.dhkinnovations.com/api/auth/email-verification", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ token }),
});

if (res.status === 202) {
  // 3. Redirect to /verify-email to enter 6-digit OTP
  router.push("/verify-email");
} else {
  // Handle error
  console.error("Failed to send verification email");
}
```

---

## Flow Summary for Frontend Developer

1. **User Sign Up**: Frontend calls `createUserWithEmailAndPassword(auth, email, password)`.
2. **Trigger Beginso Email**: Frontend calls `POST /api/auth/email-verification` with `{ token }`.
3. **Backend Sends Branded Email**: Backend generates 6-digit OTP code and emails it from `Beginso <no-reply@beginso.com>` via SMTP (`email.toowix.com`).
4. **User Verifies**: User enters 6-digit OTP on `/verify-email`. Frontend calls `POST /api/auth/email-verification/verify` with `{ token, code: "123456" }`.
5. **Session Creation**: On `{ verified: true }`, frontend calls `await user.getIdToken(true)` (force refresh) and posts to `POST /api/auth/session`.
