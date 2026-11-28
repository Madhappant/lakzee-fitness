import crypto from 'crypto';
import nodemailer from 'nodemailer';
import {
  DeliveryAttemptResult,
  EmailProviderAdapter,
  PaymentConfirmationContext,
  ReminderTemplateContext,
} from './messaging.types';
import {
  executeWithRetry,
  isTransientHttpStatus,
  PermanentDeliveryError,
  TransientDeliveryError,
} from './retry';
import { renderExpiryReminderEmail, renderPaymentReceiptEmail } from './templates';

/**
 * Resend REST API email adapter with exponential backoff retries.
 */
export class ResendEmailAdapter implements EmailProviderAdapter {
  readonly providerName = 'resend';
  private readonly apiKey: string;
  private readonly fromAddress: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: { apiKey?: string; from?: string; fetchImpl?: typeof fetch } = {}) {
    this.apiKey = (config.apiKey ?? process.env.RESEND_API_KEY ?? '').trim();
    this.fromAddress = (
      config.from ??
      process.env.EMAIL_FROM ??
      'Lakzee Fitness Studio <notifications@lakzee.fit>'
    ).trim();
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async sendReminderEmail(ctx: ReminderTemplateContext): Promise<DeliveryAttemptResult> {
    if (!this.isConfigured()) {
      throw new PermanentDeliveryError('RESEND_API_KEY is not configured.');
    }
    if (!ctx.email) {
      throw new PermanentDeliveryError('Member does not have an email address.');
    }

    const rendered = renderExpiryReminderEmail(ctx);

    const { result } = await executeWithRetry(async () => {
      let response: Response;
      try {
        response = await this.fetchImpl('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: this.fromAddress,
            to: [ctx.email],
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
          }),
          signal: AbortSignal.timeout(8000),
        });
      } catch (err) {
        throw new TransientDeliveryError(err instanceof Error ? err.message : 'Resend network error');
      }

      const json = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!response.ok) {
        const msg = json?.message || `Resend API returned HTTP ${response.status}`;
        if (isTransientHttpStatus(response.status)) {
          throw new TransientDeliveryError(msg, response.status);
        }
        throw new PermanentDeliveryError(msg, response.status);
      }

      return json.id ?? null;
    });

    return {
      status: 'SENT',
      provider: this.providerName,
      providerMessageId: result,
    };
  }

  async sendPaymentReceiptEmail(ctx: PaymentConfirmationContext): Promise<DeliveryAttemptResult> {
    if (!this.isConfigured()) {
      throw new PermanentDeliveryError('RESEND_API_KEY is not configured.');
    }
    if (!ctx.email) {
      throw new PermanentDeliveryError('Member does not have an email address.');
    }

    const rendered = renderPaymentReceiptEmail(ctx);
    const attachments = ctx.pdfBuffer
      ? [
          {
            filename: ctx.pdfFilename || `Receipt-${ctx.invoiceNumber}.pdf`,
            content: ctx.pdfBuffer.toString('base64'),
          },
        ]
      : undefined;

    const { result } = await executeWithRetry(async () => {
      let response: Response;
      try {
        response = await this.fetchImpl('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: this.fromAddress,
            to: [ctx.email],
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            ...(attachments ? { attachments } : {}),
          }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (err) {
        throw new TransientDeliveryError(err instanceof Error ? err.message : 'Resend network error');
      }

      const json = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!response.ok) {
        const msg = json?.message || `Resend API returned HTTP ${response.status}`;
        if (isTransientHttpStatus(response.status)) {
          throw new TransientDeliveryError(msg, response.status);
        }
        throw new PermanentDeliveryError(msg, response.status);
      }

      return json.id ?? null;
    });

    return {
      status: 'SENT',
      provider: this.providerName,
      providerMessageId: result,
    };
  }
}

/**
 * Nodemailer SMTP email adapter compatible with any standard SMTP relay.
 */
export class NodemailerSmtpAdapter implements EmailProviderAdapter {
  readonly providerName = 'smtp-nodemailer';
  private readonly host: string;
  private readonly port: number;
  private readonly secure: boolean;
  private readonly user: string;
  private readonly pass: string;
  private readonly fromAddress: string;

  constructor(
    config: {
      host?: string;
      port?: number;
      secure?: boolean;
      user?: string;
      pass?: string;
      from?: string;
    } = {}
  ) {
    this.host = (config.host ?? process.env.SMTP_HOST ?? '').trim();
    this.port = config.port ?? Number(process.env.SMTP_PORT || 587);
    this.secure = config.secure ?? (String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || this.port === 465);
    this.user = (config.user ?? process.env.SMTP_USER ?? '').trim();
    this.pass = (config.pass ?? process.env.SMTP_PASS ?? '').trim();
    this.fromAddress = (
      config.from ??
      process.env.EMAIL_FROM ??
      'Lakzee Fitness Studio <notifications@lakzee.fit>'
    ).trim();
  }

  isConfigured(): boolean {
    return Boolean(this.host);
  }

  async sendReminderEmail(ctx: ReminderTemplateContext): Promise<DeliveryAttemptResult> {
    if (!this.isConfigured()) {
      throw new PermanentDeliveryError('SMTP_HOST is not configured.');
    }
    if (!ctx.email) {
      throw new PermanentDeliveryError('Member does not have an email address.');
    }

    const transporter = nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: this.secure,
      ...(this.user && this.pass ? { auth: { user: this.user, pass: this.pass } } : {}),
    });

    const rendered = renderExpiryReminderEmail(ctx);
    const { result } = await executeWithRetry(async () => {
      try {
        const info = await transporter.sendMail({
          from: this.fromAddress,
          to: ctx.email!,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        });
        return info?.messageId ?? null;
      } catch (err: any) {
        const code = typeof err?.responseCode === 'number' ? err.responseCode : undefined;
        if (code && code >= 500 && code < 550) {
          throw new PermanentDeliveryError(err.message || 'SMTP permanent rejection', code);
        }
        throw new TransientDeliveryError(err?.message || 'SMTP transient error', code);
      }
    });

      return {
        status: 'SENT',
        provider: this.providerName,
        providerMessageId: result,
      };
  }

  async sendPaymentReceiptEmail(ctx: PaymentConfirmationContext): Promise<DeliveryAttemptResult> {
    if (!this.isConfigured()) {
      throw new PermanentDeliveryError('SMTP_HOST is not configured.');
    }
    if (!ctx.email) {
      throw new PermanentDeliveryError('Member does not have an email address.');
    }

    const transporter = nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: this.secure,
      ...(this.user && this.pass ? { auth: { user: this.user, pass: this.pass } } : {}),
    });

    const rendered = renderPaymentReceiptEmail(ctx);
    const { result } = await executeWithRetry(async () => {
      try {
        const info = await transporter.sendMail({
          from: this.fromAddress,
          to: ctx.email!,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          ...(ctx.pdfBuffer
            ? {
                attachments: [
                  {
                    filename: ctx.pdfFilename || `Receipt-${ctx.invoiceNumber}.pdf`,
                    content: ctx.pdfBuffer,
                    contentType: 'application/pdf',
                  },
                ],
              }
            : {}),
        });
        return info?.messageId ?? null;
      } catch (err: any) {
        const code = typeof err?.responseCode === 'number' ? err.responseCode : undefined;
        if (code && code >= 500 && code < 550) {
          throw new PermanentDeliveryError(err.message || 'SMTP permanent rejection', code);
        }
        throw new TransientDeliveryError(err?.message || 'SMTP transient error', code);
      }
    });

    return {
      status: 'SENT',
      provider: this.providerName,
      providerMessageId: result,
    };
  }
}

export class DryRunEmailAdapter implements EmailProviderAdapter {
  readonly providerName = 'dry-run-email';

  isConfigured(): boolean {
    return true;
  }

  async sendReminderEmail(ctx: ReminderTemplateContext): Promise<DeliveryAttemptResult> {
    renderExpiryReminderEmail(ctx);
    return {
      status: 'SENT',
      provider: this.providerName,
      providerMessageId: `dry-mail-${crypto.randomUUID().slice(0, 12)}`,
      dryRun: true,
    };
  }

  async sendPaymentReceiptEmail(ctx: PaymentConfirmationContext): Promise<DeliveryAttemptResult> {
    renderPaymentReceiptEmail(ctx);
    return {
      status: 'SENT',
      provider: this.providerName,
      providerMessageId: `dry-rcpt-${crypto.randomUUID().slice(0, 12)}`,
      dryRun: true,
    };
  }
}

export function createEmailAdapter(options: { dryRun?: boolean } = {}): EmailProviderAdapter {
  if (options.dryRun) {
    return new DryRunEmailAdapter();
  }
  const provider = (process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
  if (provider === 'resend' || (!provider && process.env.RESEND_API_KEY?.trim())) {
    return new ResendEmailAdapter();
  }
  return new NodemailerSmtpAdapter();
}
