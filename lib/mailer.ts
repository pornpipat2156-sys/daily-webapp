// lib/mailer.ts (หรือ mailer.ts)
import nodemailer from "nodemailer";

export async function sendEmail(to: string, subject: string, html: string) {
  const port = Number(process.env.SMTP_PORT || "587"); // 587=STARTTLS, 465=SSL

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port,
    secure: port === 465, // ✅ 465 = true, 587 = false
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
