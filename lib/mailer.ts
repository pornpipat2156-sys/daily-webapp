// lib/mailer.ts
import nodemailer from "nodemailer";

export async function sendEmail(to: string, subject: string, html: string) {
  const port = Number(process.env.SMTP_PORT || "465");
  const secure =
    process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === "true"
      : port === 465;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port,
    secure, // ✅ 465 = true, 587 = false
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM!,
    to,
    subject,
    html,
  });
}
