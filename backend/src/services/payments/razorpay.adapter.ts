import crypto from 'crypto';
import { AppError, BadRequestError } from '../../utils/errors';

export interface RazorpayOrderCreateInput {
  amountInPaise: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
}

export interface RazorpayOrderResult {
  orderId: string;
  amountInPaise: number;
  currency: string;
  receipt: string;
  status: string;
  mockMode: boolean;
}

export interface RazorpayGatewayAdapter {
  isConfigured(): boolean;
  isMockMode(): boolean;
  getPublicKeyId(): string;
  getKeySecret(): string;
  getWebhookSecret(): string;
  createOrder(input: RazorpayOrderCreateInput): Promise<RazorpayOrderResult>;
}

/**
 * Timing-safe hex digest comparison helper preventing timing side-channel leaks.
 */
function timingSafeEqualHex(expectedHex: string, actualHex: string): boolean {
  const normalizedExpected = expectedHex.trim().toLowerCase();
  const normalizedActual = actualHex.trim().toLowerCase();
  if (!normalizedExpected || !normalizedActual || normalizedExpected.length !== normalizedActual.length) {
    return false;
  }
  const a = Buffer.from(normalizedExpected, 'utf8');
  const b = Buffer.from(normalizedActual, 'utf8');
  return crypto.timingSafeEqual(a, b);
}

/**
 * Verifies Razorpay Standard Checkout client callback signature:
 * HMAC-SHA256(`${razorpay_order_id}|${razorpay_payment_id}`, RAZORPAY_KEY_SECRET)
 */
export function verifyRazorpayCheckoutSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret?: string;
}): boolean {
  const secret = (params.keySecret ?? process.env.RAZORPAY_KEY_SECRET ?? '').trim();
  if (!secret || !params.orderId || !params.paymentId || !params.signature) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest('hex');

  return timingSafeEqualHex(expected, params.signature);
}

/**
 * Verifies Razorpay Webhook signature against the unaltered raw HTTP request body:
 * HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)
 */
export function verifyRazorpayWebhookSignature(params: {
  rawBody: Buffer | string;
  signature: string;
  webhookSecret?: string;
}): boolean {
  const secret = (params.webhookSecret ?? process.env.RAZORPAY_WEBHOOK_SECRET ?? '').trim();
  if (!secret || !params.signature || !params.rawBody) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(params.rawBody)
    .digest('hex');

  return timingSafeEqualHex(expected, params.signature);
}

/**
 * Production & Test-mode Razorpay REST gateway adapter using Node native fetch and Basic Auth.
 * Never relies on client amounts or hardcoded secrets.
 */
export class HttpRazorpayAdapter implements RazorpayGatewayAdapter {
  private readonly keyIdOverride?: string;
  private readonly keySecretOverride?: string;
  private readonly webhookSecretOverride?: string;
  private readonly mockModeOverride?: boolean;
  private readonly fetchImpl: typeof fetch;

  constructor(
    config: {
      keyId?: string;
      keySecret?: string;
      webhookSecret?: string;
      mockMode?: boolean;
      fetchImpl?: typeof fetch;
    } = {}
  ) {
    this.keyIdOverride = config.keyId;
    this.keySecretOverride = config.keySecret;
    this.webhookSecretOverride = config.webhookSecret;
    this.mockModeOverride = config.mockMode;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  getPublicKeyId(): string {
    return (this.keyIdOverride ?? process.env.RAZORPAY_KEY_ID ?? '').trim();
  }

  getKeySecret(): string {
    return (this.keySecretOverride ?? process.env.RAZORPAY_KEY_SECRET ?? '').trim();
  }

  getWebhookSecret(): string {
    return (this.webhookSecretOverride ?? process.env.RAZORPAY_WEBHOOK_SECRET ?? '').trim();
  }

  isMockMode(): boolean {
    if (typeof this.mockModeOverride === 'boolean') return this.mockModeOverride;
    return String(process.env.RAZORPAY_MOCK_MODE || '').trim().toLowerCase() === 'true';
  }

  isConfigured(): boolean {
    return Boolean(this.getPublicKeyId() && this.getKeySecret());
  }

  async createOrder(input: RazorpayOrderCreateInput): Promise<RazorpayOrderResult> {
    if (!Number.isInteger(input.amountInPaise) || input.amountInPaise < 100) {
      throw new BadRequestError('Minimum payable amount is INR 1.00 (100 paise)', 'INVALID_PAYMENT_AMOUNT');
    }

    if (this.isMockMode()) {
      return {
        orderId: `order_mock_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`,
        amountInPaise: input.amountInPaise,
        currency: input.currency || 'INR',
        receipt: input.receipt,
        status: 'created',
        mockMode: true,
      };
    }

    const keyId = this.getPublicKeyId();
    const keySecret = this.getKeySecret();
    if (!keyId || !keySecret) {
      throw new AppError(
        'Razorpay payment gateway is not configured (missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).',
        503,
        'PAYMENT_GATEWAY_NOT_CONFIGURED'
      );
    }

    const basicToken = Buffer.from(`${keyId}:${keySecret}`, 'utf8').toString('base64');

    let response: Response;
    try {
      response = await this.fetchImpl('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: input.amountInPaise,
          currency: input.currency || 'INR',
          receipt: input.receipt.slice(0, 40),
          payment_capture: 1,
          notes: input.notes,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      throw new AppError(
        err instanceof Error ? `Razorpay API unreachable: ${err.message}` : 'Razorpay API unreachable',
        502,
        'RAZORPAY_GATEWAY_ERROR'
      );
    }

    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      amount?: number;
      currency?: string;
      receipt?: string;
      status?: string;
      error?: { description?: string; reason?: string };
    };

    if (!response.ok || !payload.id) {
      const description =
        payload.error?.description || payload.error?.reason || `Razorpay returned HTTP ${response.status}`;
      throw new AppError(description, 502, 'RAZORPAY_ORDER_FAILED');
    }

    return {
      orderId: payload.id,
      amountInPaise: Number(payload.amount ?? input.amountInPaise),
      currency: payload.currency || input.currency || 'INR',
      receipt: payload.receipt || input.receipt,
      status: payload.status || 'created',
      mockMode: false,
    };
  }
}

export const defaultRazorpayAdapter = new HttpRazorpayAdapter();
