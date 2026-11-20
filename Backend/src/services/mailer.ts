import nodemailer from 'nodemailer';
import { ENV } from '../config/env';

export function isMailConfigured(): boolean {
  return Boolean(ENV.SMTP_HOST);
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  if (!isMailConfigured()) throw new Error('SMTP is not configured');
  const transporter = nodemailer.createTransport({
    host: ENV.SMTP_HOST,
    port: ENV.SMTP_PORT,
    secure: ENV.SMTP_SECURE,
    auth: ENV.SMTP_USER ? { user: ENV.SMTP_USER, pass: ENV.SMTP_PASS } : undefined,
  });
  await transporter.sendMail({
    from: ENV.MAIL_FROM,
    to: email,
    subject: 'Reset your CollabKanban password',
    text: `Use this link to reset your password. It expires in 30 minutes:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
  });
}
