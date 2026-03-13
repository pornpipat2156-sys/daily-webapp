import nodemailer from "nodemailer";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
) {
  const port = Number(process.env.SMTP_PORT || "465");
  const secure =
    process.env.SMTP_SECURE != null
      ? process.env.SMTP_SECURE === "true"
      : port === 465;

  const transporter = nodemailer.createTransport({
    host: requireEnv("SMTP_HOST"),
    port,
    secure,
    auth: {
      user: requireEnv("SMTP_USER"),
      pass: requireEnv("SMTP_PASS"),
    },
  });

  await transporter.sendMail({
    from: requireEnv("MAIL_FROM"),
    to,
    subject,
    html,
    text:
      text ||
      html
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
  });
}