import nodemailer from "nodemailer";

export type AuthMailType = "verify_email" | "reset_password";

export interface SendMailOptions {
  to: string;
  template: AuthMailType;
  actionUrl: string;
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

    const { to, template, actionUrl } = options;

    let subject = "";
    let htmlContent = "";
    let textContent = "";

    if (template === "verify_email") {
      subject = "Verify your Beginso email";
      textContent = `Verify your email address\n\nConfirm this email address to finish creating your Beginso workspace.\n\nVerify email: ${actionUrl}\n\nIf you did not create a Beginso account, you can ignore this email.`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #1F2937; margin-bottom: 16px;">Verify your email address</h2>
          <p style="color: #4B5563; font-size: 16px; line-height: 1.5;">Confirm this email address to finish creating your Beginso workspace.</p>
          <div style="margin: 28px 0;">
            <a href="${actionUrl}" style="background-color: #2563EB; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify email</a>
          </div>
          <p style="color: #6B7280; font-size: 14px;">Or copy and paste this URL into your browser:<br/><a href="${actionUrl}" style="color: #2563EB; word-break: break-all;">${actionUrl}</a></p>
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
