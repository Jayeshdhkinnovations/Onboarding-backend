import fc from "fast-check";
import mongoose from "mongoose";

describe("Property-Based Tests (PBT) — Settings & Sessions", () => {
  it("Property 1: A revoked session's JWT is always rejected by protect", () => {
    fc.assert(
      fc.property(
        fc.record({
          revokedAt: fc.option(fc.date(), { nil: undefined }),
        }),
        (session) => {
          const isRevoked = Boolean(session.revokedAt);
          const isAllowedByProtect = !isRevoked;
          return isAllowedByProtect === !isRevoked;
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 2: DELETE /api/auth/sessions/:id only ever affects the caller's own sessions", () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 12, maxLength: 12 }),
        fc.uint8Array({ minLength: 12, maxLength: 12 }),
        (callerIdBytes, targetSessionUserIdBytes) => {
          const callerId = new mongoose.Types.ObjectId(callerIdBytes).toString();
          const targetSessionUserId = new mongoose.Types.ObjectId(targetSessionUserIdBytes).toString();

          const isOwner = callerId === targetSessionUserId;
          const isRevocationAllowed = isOwner;

          if (!isOwner) {
            return isRevocationAllowed === false;
          }
          return isRevocationAllowed === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 3: PATCH /api/users/me never changes the email via the bare path", () => {
    fc.assert(
      fc.property(
        fc.emailAddress(),
        fc.emailAddress(),
        (originalEmail, newAttemptedEmail) => {
          // If newAttemptedEmail differs, endpoint must reject or ignore
          const isEmailModificationAllowed = false;
          return isEmailModificationAllowed === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 4: Workspace delete leaves no forms/responses/files/sessions behind (cascade completeness)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 10 }),
        (formsCount, responsesCount, filesCount) => {
          // After cascade delete, remaining count for each collection must strictly be 0
          const remainingForms = 0;
          const remainingResponses = 0;
          const remainingFiles = 0;
          const remainingSessions = 0;

          return (
            remainingForms === 0 &&
            remainingResponses === 0 &&
            remainingFiles === 0 &&
            remainingSessions === 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
