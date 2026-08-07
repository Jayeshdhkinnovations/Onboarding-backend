import nodemailer from "nodemailer";

export type AuthMailType = "verify_email" | "verify_email_otp" | "reset_password";

export interface SendMailOptions {
  to: string;
  template: AuthMailType;
  actionUrl?: string;
  code?: string;
}

class MailService {
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      const host = process.env.SMTP_HOST || "email.toowix.com";
      const port = Number(process.env.SMTP_PORT) || 587;
      const secure = process.env.SMTP_SECURE === "true";
      const user = process.env.SMTP_USER || "";
      const pass = process.env.SMTP_PASS || "";

      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined,
        tls: {
          rejectUnauthorized: false,
        },
      });
    }
    return this.transporter;
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    const fromName = process.env.SMTP_FROM_NAME || "Beginso";
    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "no-reply@beginso.com";
    const from = `"${fromName}" <${fromEmail}>`;
    const appUrl = process.env.APP_URL || "https://beginso.com";

    const { to, template, actionUrl, code } = options;

    let subject = "";
    let htmlContent = "";
    let textContent = "";

    if (template === "verify_email" || template === "verify_email_otp") {
      subject = "Your Beginso verification code";
      const rawCode = (code || "123456").replace(/\s+/g, "");
      const formattedCode = rawCode.length === 6 ? `${rawCode.slice(0, 3)} ${rawCode.slice(3)}` : rawCode;
      const verifyReturnUrl = `${appUrl}/verify-email`;

      textContent = `Verify your email\n\nWelcome to Beginso.\n\nUse the verification code below to complete your account setup.\n\n${formattedCode}\n\nThis code expires in 10 minutes.\n\nReturn to Beginso: ${verifyReturnUrl}\n\nIf you didn't create this account, you can safely ignore this email.`;

      htmlContent = `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F9FAFB; padding: 40px 20px; color: #1F2937;">
          <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #E5E7EB; border-radius: 12px; padding: 36px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="margin-bottom: 24px;">
              <span style="font-size: 24px; font-weight: 800; color: #1D4ED8; letter-spacing: -0.5px;">Beginso</span>
            </div>
            <h1 style="font-size: 24px; font-weight: 700; color: #111827; margin: 0 0 12px 0;">Verify your email</h1>
            <p style="font-size: 15px; color: #4B5563; line-height: 1.6; margin: 0 0 8px 0;">Welcome to Beginso.</p>
            <p style="font-size: 15px; color: #4B5563; line-height: 1.6; margin: 0 0 24px 0;">Use the verification code below to complete your account setup.</p>
            
            <div style="margin: 28px 0; padding: 20px; background-color: #F3F4F6; border-radius: 10px; text-align: center;">
              <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1D4ED8; font-family: monospace;">${formattedCode}</span>
            </div>

            <p style="font-size: 14px; color: #6B7280; margin: 0 0 28px 0;">This code expires in 10 minutes.</p>
            
            <div style="margin: 28px 0 32px 0;">
              <a href="${verifyReturnUrl}" style="background-color: #2563EB; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">Return to Beginso</a>
            </div>

            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0 24px 0;" />
            <p style="font-size: 13px; color: #9CA3AF; margin: 0; line-height: 1.5;">If you didn't create this account, you can safely ignore this email.</p>
          </div>
        </div>
      `;
    } else if (template === "reset_password") {
      subject = "Reset your Beginso password";
      const resetUrl = actionUrl || `${appUrl}/reset-password`;

      textContent = `Reset your password\n\nWe received a request to reset your Beginso password.\n\nClick the link below to create a new password:\n${resetUrl}\n\nIf you didn't request this change, you can safely ignore this email.`;

      htmlContent = `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F9FAFB; padding: 40px 20px; color: #1F2937;">
          <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #E5E7EB; border-radius: 12px; padding: 36px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="margin-bottom: 24px;">
              <span style="font-size: 24px; font-weight: 800; color: #1D4ED8; letter-spacing: -0.5px;">Beginso</span>
            </div>
            <h1 style="font-size: 24px; font-weight: 700; color: #111827; margin: 0 0 12px 0;">Reset your password</h1>
            <p style="font-size: 15px; color: #4B5563; line-height: 1.6; margin: 0 0 8px 0;">We received a request to reset your Beginso password.</p>
            <p style="font-size: 15px; color: #4B5563; line-height: 1.6; margin: 0 0 28px 0;">Click the button below to create a new password.</p>
            
            <div style="margin: 28px 0 32px 0;">
              <a href="${resetUrl}" style="background-color: #2563EB; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">Reset password</a>
            </div>

            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0 24px 0;" />
            <p style="font-size: 13px; color: #9CA3AF; margin: 0; line-height: 1.5;">If you didn't request this change, you can safely ignore this email.</p>
          </div>
        </div>
      `;
    }

    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from,
        to,
        subject,
        text: textContent,
        html: htmlContent,
      });
      console.log(`✉️ Email sent successfully to ${to} [template: ${template}]`);
    } catch (err: any) {
      console.error(`❌ Failed to send ${template} email to ${to}:`, err.message);
      // Log internally without leaking credentials or details to caller
    }
  }
}

export const mailService = new MailService();
