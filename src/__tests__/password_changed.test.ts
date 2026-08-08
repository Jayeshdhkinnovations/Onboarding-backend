import request from "supertest";
import app from "../app";
import { mailService } from "../services/mail.service";

jest.mock("../services/mail.service", () => ({
  mailService: {
    sendMail: jest.fn().mockResolvedValue({ messageId: "test-msg-id" }),
  },
}));

describe("Password Changed Success Email Endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 on /api/auth/confirm-password-reset when missing oobCode or newPassword", async () => {
    const res = await request(app)
      .post("/api/auth/confirm-password-reset")
      .send({ oobCode: "" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("should return 400 on /api/auth/password-changed when missing email", async () => {
    const res = await request(app)
      .post("/api/auth/password-changed")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("should successfully trigger password_changed_success email on /api/auth/password-changed with valid email", async () => {
    const res = await request(app)
      .post("/api/auth/password-changed")
      .send({ email: "user@beginso.com" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mailService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@beginso.com",
        template: "password_changed_success",
      })
    );
  });
});
