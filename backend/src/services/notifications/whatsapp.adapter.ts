import crypto from 'crypto';
import {
  DeliveryAttemptResult,
  PaymentConfirmationContext,
  ReminderTemplateContext,
  WhatsAppProviderAdapter,
} from './messaging.types';
import {
  buildWhatsAppPaymentConfirmationPayload,
  buildWhatsAppTemplatePayload,
} from './templates';
import {
  executeWithRetry,
  isTransientHttpStatus,
  PermanentDeliveryError,
  TransientDeliveryError,
} from './retry';

export interface MetaWhatsAppConfig {
  phoneNumberId?: string;
  accessToken?: string;
  graphVersion?: string;
  templateName?: string;
  languageCode?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Meta WhatsApp Business Cloud API adapter sending approved template messages.
 */
export class MetaWhatsAppCloudAdapter implements WhatsAppProviderAdapter {
  readonly providerName = 'meta-cloud-api';
  private readonly phoneNumberId: string;
  private readonly accessToken: string;
  private readonly graphVersion: string;
  private readonly templateName: string;
  private readonly languageCode: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: MetaWhatsAppConfig = {}) {
    this.phoneNumberId = (config.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID ?? '').trim();
    this.accessToken = (config.accessToken ?? process.env.WHATSAPP_ACCESS_TOKEN ?? '').trim();
    this.graphVersion = (config.graphVersion ?? process.env.WHATSAPP_GRAPH_VERSION ?? 'v21.0').trim();
    this.templateName = (config.templateName ?? process.env.WHATSAPP_TEMPLATE_NAME ?? 'membership_expiry_reminder').trim();
    this.languageCode = (config.languageCode ?? process.env.WHATSAPP_TEMPLATE_LANG ?? 'en').trim();
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  isConfigured(): boolean {
    return Boolean(this.phoneNumberId && this.accessToken);
  }

  async sendTemplateReminder(ctx: ReminderTemplateContext): Promise<DeliveryAttemptResult> {
    if (!this.isConfigured()) {
      throw new PermanentDeliveryError(
        'WhatsApp Cloud API credentials (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN) are not configured.'
      );
    }
    if (!ctx.whatsappNumber) {
      throw new PermanentDeliveryError('Member does not have a valid E.164 WhatsApp number.');
    }

    const templatePayload = buildWhatsAppTemplatePayload(ctx, this.templateName, this.languageCode);
    const { variables: _omitVars, ...graphBody } = templatePayload;
    void _omitVars;

    const endpoint = `https://graph.facebook.com/${this.graphVersion}/${this.phoneNumberId}/messages`;

    const { result } = await executeWithRetry(async () => {
      let response: Response;
      try {
        response = await this.fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(graphBody),
          signal: AbortSignal.timeout(8000),
        });
      } catch (err) {
        throw new TransientDeliveryError(err instanceof Error ? err.message : 'WhatsApp network error');
      }

      const json = (await response.json().catch(() => ({}))) as {
        messages?: Array<{ id?: string }>;
        error?: { message?: string };
      };

      if (!response.ok) {
        const msg = json?.error?.message || `Meta WhatsApp API returned HTTP ${response.status}`;
        if (isTransientHttpStatus(response.status)) {
          throw new TransientDeliveryError(msg, response.status);
        }
        throw new PermanentDeliveryError(msg, response.status);
      }

      return json.messages?.[0]?.id ?? null;
    });

    return {
      status: 'SENT',
      provider: this.providerName,
      providerMessageId: result,
    };
  }

  async sendPaymentConfirmation(ctx: PaymentConfirmationContext): Promise<DeliveryAttemptResult> {
    if (!this.isConfigured()) {
      throw new PermanentDeliveryError(
        'WhatsApp Cloud API credentials (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN) are not configured.'
      );
    }
    if (!ctx.whatsappNumber) {
      throw new PermanentDeliveryError('Member does not have a valid E.164 WhatsApp number.');
    }

    const templatePayload = buildWhatsAppPaymentConfirmationPayload(ctx, undefined, this.languageCode);
    const { variables: _omitVars, ...graphBody } = templatePayload;
    void _omitVars;

    const endpoint = `https://graph.facebook.com/${this.graphVersion}/${this.phoneNumberId}/messages`;
    const { result } = await executeWithRetry(async () => {
      let response: Response;
      try {
        response = await this.fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(graphBody),
          signal: AbortSignal.timeout(8000),
        });
      } catch (err) {
        throw new TransientDeliveryError(err instanceof Error ? err.message : 'WhatsApp network error');
      }

      const json = (await response.json().catch(() => ({}))) as {
        messages?: Array<{ id?: string }>;
        error?: { message?: string };
      };
      if (!response.ok) {
        const msg = json?.error?.message || `Meta WhatsApp API returned HTTP ${response.status}`;
        if (isTransientHttpStatus(response.status)) {
          throw new TransientDeliveryError(msg, response.status);
        }
        throw new PermanentDeliveryError(msg, response.status);
      }
      return json.messages?.[0]?.id ?? null;
    });

    return {
      status: 'SENT',
      provider: this.providerName,
      providerMessageId: result,
    };
  }
}

/**
 * Provider-agnostic HTTP webhook WhatsApp adapter (Twilio / Evolution API / custom gateway).
 */
export class WebhookWhatsAppAdapter implements WhatsAppProviderAdapter {
  readonly providerName = 'webhook-whatsapp';
  private readonly webhookUrl: string;
  private readonly authToken: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: { webhookUrl?: string; authToken?: string; fetchImpl?: typeof fetch } = {}) {
    this.webhookUrl = (config.webhookUrl ?? process.env.WHATSAPP_WEBHOOK_URL ?? '').trim();
    this.authToken = (config.authToken ?? process.env.WHATSAPP_WEBHOOK_TOKEN ?? '').trim();
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  isConfigured(): boolean {
    return Boolean(this.webhookUrl);
  }

  async sendTemplateReminder(ctx: ReminderTemplateContext): Promise<DeliveryAttemptResult> {
    if (!this.isConfigured()) {
      throw new PermanentDeliveryError('WHATSAPP_WEBHOOK_URL is not configured.');
    }
    if (!ctx.whatsappNumber) {
      throw new PermanentDeliveryError('Member does not have a valid E.164 WhatsApp number.');
    }

    const payload = buildWhatsAppTemplatePayload(ctx);
    const { result } = await executeWithRetry(async () => {
      let response: Response;
      try {
        response = await this.fetchImpl(this.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
          },
          body: JSON.stringify({
            to: ctx.whatsappNumber,
            templateName: payload.template.name,
            variables: payload.variables,
            milestone: ctx.milestone,
            branchId: ctx.branchId,
          }),
          signal: AbortSignal.timeout(8000),
        });
      } catch (err) {
        throw new TransientDeliveryError(err instanceof Error ? err.message : 'WhatsApp webhook network error');
      }

      const json = (await response.json().catch(() => ({}))) as { messageId?: string; id?: string; error?: string };
      if (!response.ok) {
        const msg = json?.error || `WhatsApp webhook failed with HTTP ${response.status}`;
        if (isTransientHttpStatus(response.status)) {
          throw new TransientDeliveryError(msg, response.status);
        }
        throw new PermanentDeliveryError(msg, response.status);
      }
      return json.messageId ?? json.id ?? null;
    });

      return {
        status: 'SENT',
        provider: this.providerName,
        providerMessageId: result,
      };
  }

  async sendPaymentConfirmation(ctx: PaymentConfirmationContext): Promise<DeliveryAttemptResult> {
    if (!this.isConfigured()) {
      throw new PermanentDeliveryError('WHATSAPP_WEBHOOK_URL is not configured.');
    }
    if (!ctx.whatsappNumber) {
      throw new PermanentDeliveryError('Member does not have a valid E.164 WhatsApp number.');
    }

    const payload = buildWhatsAppPaymentConfirmationPayload(ctx);
    const { result } = await executeWithRetry(async () => {
      let response: Response;
      try {
        response = await this.fetchImpl(this.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
          },
          body: JSON.stringify({
            to: ctx.whatsappNumber,
            templateName: payload.template.name,
            variables: payload.variables,
            event: 'payment_confirmed',
            branchId: ctx.branchId,
          }),
          signal: AbortSignal.timeout(8000),
        });
      } catch (err) {
        throw new TransientDeliveryError(err instanceof Error ? err.message : 'WhatsApp webhook network error');
      }

      const json = (await response.json().catch(() => ({}))) as { messageId?: string; id?: string; error?: string };
      if (!response.ok) {
        const msg = json?.error || `WhatsApp webhook failed with HTTP ${response.status}`;
        if (isTransientHttpStatus(response.status)) {
          throw new TransientDeliveryError(msg, response.status);
        }
        throw new PermanentDeliveryError(msg, response.status);
      }
      return json.messageId ?? json.id ?? null;
    });

    return {
      status: 'SENT',
      provider: this.providerName,
      providerMessageId: result,
    };
  }
}

export class DryRunWhatsAppAdapter implements WhatsAppProviderAdapter {
  readonly providerName = 'dry-run-whatsapp';

  isConfigured(): boolean {
    return true;
  }

  async sendTemplateReminder(ctx: ReminderTemplateContext): Promise<DeliveryAttemptResult> {
    buildWhatsAppTemplatePayload(ctx);
    return {
      status: 'SENT',
      provider: this.providerName,
      providerMessageId: `dry-wa-${crypto.randomUUID().slice(0, 12)}`,
      dryRun: true,
    };
  }

  async sendPaymentConfirmation(ctx: PaymentConfirmationContext): Promise<DeliveryAttemptResult> {
    buildWhatsAppPaymentConfirmationPayload(ctx);
    return {
      status: 'SENT',
      provider: this.providerName,
      providerMessageId: `dry-wa-pay-${crypto.randomUUID().slice(0, 12)}`,
      dryRun: true,
    };
  }
}

export function createWhatsAppAdapter(options: { dryRun?: boolean } = {}): WhatsAppProviderAdapter {
  if (options.dryRun) {
    return new DryRunWhatsAppAdapter();
  }
  const provider = (process.env.WHATSAPP_PROVIDER || '').trim().toLowerCase();
  if (provider === 'webhook' || (!process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_WEBHOOK_URL)) {
    return new WebhookWhatsAppAdapter();
  }
  return new MetaWhatsAppCloudAdapter();
}
