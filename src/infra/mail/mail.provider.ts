import type { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export const MAIL_SENDER = Symbol('MAIL_SENDER');

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface MailSender {
  send(message: MailMessage): Promise<void>;
}

export class StubMailSender implements MailSender {
  readonly sent: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.sent.push({ ...message });
    return Promise.resolve();
  }

  lastCode(): string | undefined {
    const last = this.sent.at(-1);
    if (!last) return undefined;
    const match = last.text.match(/\b(\d{6})\b/);
    return match?.[1];
  }

  clear(): void {
    this.sent.length = 0;
  }
}

export class SmtpMailSender implements MailSender {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.getOrThrow<string>('mail.smtp.host');
    const port = config.getOrThrow<number>('mail.smtp.port');
    const user = config.get<string>('mail.smtp.user');
    const pass = config.get<string>('mail.smtp.pass');
    this.from = config.getOrThrow<string>('mail.from');
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text
    });
  }
}

export const createMailSender = (config: ConfigService): MailSender => {
  const provider = config.get<string>('mail.provider', 'stub');
  return provider === 'smtp' ? new SmtpMailSender(config) : new StubMailSender();
};
