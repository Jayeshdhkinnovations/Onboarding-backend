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
    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "noreply@beginso.com";
    const from = `"${fromName}" <${fromEmail}>`;

    const { to, template, actionUrl, code } = options;

    let subject = "";
    let htmlContent = "";
    let textContent = "";

    if (template === "verify_email" || template === "verify_email_otp") {
      subject = "Your Beginso verification code";
      const otpCode = code || "123456";
      textContent = `Your Beginso verification code\n\nEnter this code to verify your email address and finish setting up your workspace:\n\n${otpCode}\n\nThis code expires in 10 minutes. If you did not request this code, you can ignore this email.`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #1F2937; margin-bottom: 16px;">Your verification code</h2>
          <p style="color: #4B5563; font-size: 16px; line-height: 1.5;">Enter this code to verify your email address and finish creating your Beginso workspace:</p>
          <div style="margin: 24px 0; padding: 16px; background-color: #F3F4F6; border-radius: 8px; text-align: center;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1D4ED8;">${otpCode}</span>
          </div>
          <p style="color: #6B7280; font-size: 14px;">This code will expire in 10 minutes.</p>
          ${actionUrl ? `<p style="color: #6B7280; font-size: 14px;">Or click here: <a href="${actionUrl}" style="color: #2563EB;">${actionUrl}</a></p>` : ""}
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
          <p style="color: #9CA3AF; font-size: 12px;">If you did not create a Beginso account, you can ignore this email.</p>
        </div>
      `;
    } else if (template === "reset_password") {
      subject = "Reset your Beginso password";
      textContent = `Reset your password\n\nWe received a request to reset the password for your Beginso account.\n\nReset password: ${actionUrl}\n\nIf you did not request this change, ignore this email. Your password will remain unchanged.`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #1F2937; margin-bottom: 16px;">Reset your password</h2>
          <p style="color: #4B5563; font-size: 16px; line-height: 1.5;">We received a request to reset the password for your Beginso account.</p>
          <div style="margin: 28px 0;">
            <a href="${actionUrl}" style="background-color: #2563EB; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset password</a>
          </div>
          <p style="color: #6B7280; font-size: 14px;">Or copy and paste this URL into your browser:<br/><a href="${actionUrl}" style="color: #2563EB; word-break: break-all;">${actionUrl}</a></p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
          <p style="color: #9CA3AF; font-size: 12px;">If you did not request this change, ignore this email. Your password will remain unchanged.</p>
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
