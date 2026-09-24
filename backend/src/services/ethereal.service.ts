import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '../config/env.js';

let defaultTransporter: Transporter | null = null;

const initializeDefaultTransporter = async (): Promise<Transporter> => {
  if (defaultTransporter) {
    return defaultTransporter;
  }

  let user = env.ETHEREAL_USER;
  let pass = env.ETHEREAL_PASSWORD;
  let host = env.ETHEREAL_HOST;
  let port = env.ETHEREAL_PORT;

  if (!user || !pass || !host || !port) {
    const testAccount = await nodemailer.createTestAccount();
    user = testAccount.user;
    pass = testAccount.pass;
    host = (testAccount as any).smtp?.host || 'smtp.ethereal.email';
    port = (testAccount as any).smtp?.port || 587;
  }

  defaultTransporter = nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: {
      user,
      pass,
    },
  });

  return defaultTransporter;
};

export interface SendMailOptions {
  fromName: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
  senderHost?: string | null;
  senderPort?: number | null;
  senderUser?: string | null;
  senderPass?: string | null;
}

export interface SendMailResult {
  messageId: string;
  previewUrl: string | null;
}

export const sendEmailViaSmtp = async (options: SendMailOptions): Promise<SendMailResult> => {
  let transporter: Transporter;

  if (options.senderUser && options.senderPass && options.senderHost) {
    transporter = nodemailer.createTransport({
      host: options.senderHost,
      port: options.senderPort || 587,
      secure: false,
      auth: {
        user: options.senderUser,
        pass: options.senderPass,
      },
    });
  } else {
    transporter = await initializeDefaultTransporter();
  }

  const info = await transporter.sendMail({
    from: `"${options.fromName}" <${options.fromEmail}>`,
    to: options.toEmail,
    subject: options.subject,
    text: options.body.replace(/<[^>]*>?/gm, ''),
    html: options.body,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || null;

  return {
    messageId: info.messageId,
    previewUrl: typeof previewUrl === 'string' ? previewUrl : null,
  };
};
