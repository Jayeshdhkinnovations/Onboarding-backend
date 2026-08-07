import dotenv from "dotenv";
dotenv.config();
import { mailService } from "../src/services/mail.service";

async function test() {
  console.log("Testing mail service with config:", {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    fromEmail: process.env.SMTP_FROM_EMAIL
  });

  try {
    await mailService.sendMail({
      to: "jayesh@dhkinnovations.com",
      template: "reset_password",
      actionUrl: "https://beginso.com/reset-password?mode=resetPassword&oobCode=12345"
    });
    console.log("✅ LIVE SMTP TEST SUCCESSFUL");
  } catch (err: any) {
    console.error("❌ LIVE SMTP TEST ERROR:", err);
  }
}

test();
