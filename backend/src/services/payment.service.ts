/* eslint-disable @typescript-eslint/no-explicit-any */
import { paymentRepository, PaymentRepository } from '../repositories/payment.repository';
import { auditService } from './audit.service';
import { notificationService } from './notification.service';
import { normalizeE164Phone } from './notifications/e164';
import {
  defaultRazorpayAdapter,
  type RazorpayGatewayAdapter,
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from './payments/razorpay.adapter';
import { receiptService, ReceiptService } from './payments/receipt.service';
import {
  buildRenewalUrl,
  createRenewalLinkToken,
  verifyRenewalLinkToken,
} from './payments/renewal-token';
import { invalidateTenantCacheScopes } from '../utils/cache';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import {
  assertBranchOwnership,
  PRIMARY_BRANCH_ID,
  PRIMARY_BRANCH_NAME,
  type TenantScope,
} from '../utils/tenant';

function formatReceiptDateIst(date: Date | null | undefined): string {
  if (!date) return 'N/A';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

function resolveMemberReceiptPortalUrl(): string {
  const raw = (process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0]?.trim() || 'http://localhost:3000';
  return `${raw.replace(/\/+$/, '')}/member/subscriptions`;
}

export class PaymentService {
  constructor(
    private readonly repo: PaymentRepository = paymentRepository,
    private readonly gateway: RazorpayGatewayAdapter = defaultRazorpayAdapter,
    private readonly pdfReceipts: ReceiptService = receiptService
  ) {}

  private resolveGateway(override?: RazorpayGatewayAdapter): RazorpayGatewayAdapter {
    return override ?? this.gateway;
  }

  /**
   * Resolves a MemberProfile while enforcing caller ownership (MEMBER -> self only; Admin -> branch-checked).
   */
  private async resolveTargetMember(params: {
    actorUserId?: string;
    actorRole?: string;
    tenant?: TenantScope;
    memberId?: string;
  }) {
    if (params.actorRole === 'MEMBER') {
      if (!params.actorUserId) throw new ForbiddenError('Authentication required');
      const selfMember = await this.repo.findMemberByUserId(params.actorUserId);
      if (!selfMember) throw new NotFoundError('Member profile not found');
      if (params.memberId && params.memberId !== selfMember.id && params.memberId !== selfMember.memberId) {
        throw new ForbiddenError('Members can only initiate renewals for their own membership');
      }
      return selfMember;
    }

    if (!params.memberId) {
      throw new BadRequestError('memberId is required when creating an order as staff', 'MISSING_MEMBER_ID');
    }

    const scopeBranchId = params.tenant?.branchId ?? null;
    const member = await this.repo.findMemberByIdentifier(params.memberId, scopeBranchId);
    if (!member) throw new NotFoundError('Member not found');

    const memberBranchId = member.branchId ?? member.user?.branchId ?? PRIMARY_BRANCH_ID;
    assertBranchOwnership(memberBranchId, params.tenant);
    return member;
  }

  /**
   * Computes exact authoritative paise pricing from DB — NEVER trusting client-sent amounts.
   */
  private resolveAuthoritativePlanPaise(plan: { price: number; priceInPaise?: number | null }): number {
    if (typeof plan.priceInPaise === 'number' && Number.isInteger(plan.priceInPaise) && plan.priceInPaise > 0) {
      return plan.priceInPaise;
    }
    return Math.round(Number(plan.price) * 100);
  }

  async createOrder(params: {
    actorUserId?: string;
    actorRole?: string;
    tenant?: TenantScope;
    memberId?: string;
    planId: string;
    gatewayOverride?: RazorpayGatewayAdapter;
  }) {
    const member = await this.resolveTargetMember(params);
    const plan = await this.repo.findPlanById(params.planId);
    if (!plan || !plan.isActive) {
      throw new NotFoundError('Active membership plan not found');
    }

    const branchId = member.branchId ?? member.user?.branchId ?? PRIMARY_BRANCH_ID;
    const planBranchId = plan.branchId ?? PRIMARY_BRANCH_ID;
    if (planBranchId !== branchId && planBranchId !== PRIMARY_BRANCH_ID) {
      throw new ForbiddenError('Selected plan does not belong to the member branch');
    }

    const amountInPaise = this.resolveAuthoritativePlanPaise(plan);
    if (amountInPaise < 100) {
      throw new BadRequestError('Plan price must be at least INR 1.00 for online checkout', 'INVALID_PLAN_PRICE');
    }

    const gw = this.resolveGateway(params.gatewayOverride);
    const receiptTag = `RCPT-${member.memberId}-${Date.now().toString(36).toUpperCase()}`;
    const order = await gw.createOrder({
      amountInPaise,
      currency: 'INR',
      receipt: receiptTag,
      notes: {
        memberProfileId: member.id,
        memberCode: member.memberId,
        planId: plan.id,
        planName: plan.name,
        branchId,
      },
    });

    const record = await this.repo.createOrderRecord({
      branchId,
      memberId: member.id,
      planId: plan.id,
      amount: amountInPaise / 100,
      amountInPaise,
      currency: order.currency,
      razorpayOrderId: order.orderId,
      notes: `Online renewal order for ${plan.name}`,
    });

    auditService.record({
      branchId,
      actorId: params.actorUserId ?? null,
      actorRole: params.actorRole ?? null,
      action: 'PAYMENT_ORDER_CREATED',
      targetId: record.id,
      description: `Created Razorpay order ${order.orderId} for #${member.memberId} (${plan.name})`,
      metadata: {
        razorpayOrderId: order.orderId,
        amountInPaise,
        planId: plan.id,
        mockMode: order.mockMode,
      },
    });

    return {
      paymentRecordId: record.id,
      orderId: order.orderId,
      amountInPaise,
      amount: amountInPaise / 100,
      currency: order.currency,
      keyId: gw.getPublicKeyId() || (order.mockMode ? 'rzp_test_mock_key' : ''),
      mockMode: order.mockMode,
      member: {
        id: member.id,
        memberId: member.memberId,
        name: `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim(),
        email: member.user?.email || null,
        phone: member.user?.phone || null,
        branchId,
        branchName: member.branch?.name || PRIMARY_BRANCH_NAME,
      },
      plan: {
        id: plan.id,
        name: plan.name,
        durationDays: plan.durationDays,
        price: amountInPaise / 100,
        priceInPaise: amountInPaise,
      },
    };
  }

  /**
   * Builds and dispatches PDF tax receipt over Email & WhatsApp after confirmed capture.
   */
  private async sendConfirmationAndReceipt(captured: {
    payment: any;
    dryRun?: boolean;
  }) {
    const { payment } = captured;
    const branchId = payment.branchId ?? payment.member?.branchId ?? PRIMARY_BRANCH_ID;
    const settings = await this.repo.findBranchSettings(branchId);

    const gymName = settings?.gymName || 'Lakzee Fitness Studio';
    const branchName = payment.branch?.name || settings?.branch || PRIMARY_BRANCH_NAME;
    const memberName =
      `${payment.member?.user?.firstName || ''} ${payment.member?.user?.lastName || ''}`.trim() || 'Member';
    const memberCode = payment.member?.memberId || '000';
    const memberEmail = payment.member?.user?.email || null;
    const memberPhone = payment.member?.user?.phone || null;
    const whatsappNumber = normalizeE164Phone(
      payment.member?.whatsappNumber ?? payment.member?.whatsapp ?? memberPhone
    );

    const totalInr = (payment.amountInPaise ?? Math.round(payment.amount * 100)) / 100;
    const taxPercent = payment.plan?.taxPercent ?? payment.plan?.gstPercentage ?? 18.0;
    const paidAt = payment.paidAt ? new Date(payment.paidAt) : new Date();

    const pdfBuffer = await this.pdfReceipts.generateReceiptPdf({
      paymentId: payment.id,
      invoiceNumber: payment.invoiceNumber || `INV-${payment.id.slice(0, 8).toUpperCase()}`,
      gymName,
      branchName,
      branchLocation: payment.branch?.location || settings?.address || null,
      branchGstNumber: settings?.gstNumber || null,
      branchContactPhone: settings?.contactPhone || null,
      branchContactEmail: settings?.contactEmail || null,
      memberName,
      memberCode,
      memberEmail,
      memberPhone,
      planName: payment.plan?.name || 'Membership Plan',
      durationDays: payment.plan?.durationDays || 30,
      totalAmountInr: totalInr,
      gstPercentage: taxPercent,
      paymentMethod: payment.method || 'upi',
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: payment.razorpayPaymentId,
      paidAt,
      previousExpiryDate: payment.previousExpiryDate,
      newExpiryDate: payment.newExpiryDate,
    });

    const filename = `Receipt-${payment.invoiceNumber || payment.id}.pdf`;
    await notificationService.sendPaymentReceiptNotification(
      {
        paymentId: payment.id,
        invoiceNumber: payment.invoiceNumber || payment.id,
        memberProfileId: payment.memberId,
        memberCode,
        memberName,
        email: memberEmail,
        whatsappNumber,
        branchId,
        branchName,
        branchContactPhone: settings?.contactPhone || null,
        branchContactEmail: settings?.contactEmail || null,
        planName: payment.plan?.name || 'Membership Plan',
        durationDays: payment.plan?.durationDays || 30,
        amountPaidInr: totalInr,
        method: payment.method || 'upi',
        razorpayPaymentId: payment.razorpayPaymentId,
        paidAtFormatted: formatReceiptDateIst(paidAt),
        newExpiryFormatted: formatReceiptDateIst(payment.newExpiryDate),
        receiptUrl: resolveMemberReceiptPortalUrl(),
        pdfBuffer,
        pdfFilename: filename,
      },
      { dryRun: captured.dryRun }
    );
  }

  private async finalizeCapture(params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature?: string | null;
    method: string;
    actorId?: string | null;
    actorRole?: string | null;
    ipAddress?: string | null;
  }) {
    const result = await this.repo.capturePaymentAndExtendAtomic({
      razorpayOrderId: params.razorpayOrderId,
      razorpayPaymentId: params.razorpayPaymentId,
      razorpaySignature: params.razorpaySignature,
      method: params.method,
    });

    const branchId = result.payment.branchId ?? PRIMARY_BRANCH_ID;

    if (!result.alreadyCaptured) {
      invalidateTenantCacheScopes(branchId, 'dashboard', 'reports', 'members', 'plans');

      auditService.record({
        branchId,
        actorId: params.actorId ?? result.payment.member?.user?.id ?? null,
        actorRole: params.actorRole ?? 'SYSTEM',
        action: 'PAYMENT_CAPTURED',
        targetId: result.payment.id,
        ipAddress: params.ipAddress ?? null,
        description: `Captured INR ${result.payment.amount} (${result.payment.method}) for #${result.payment.member?.memberId || 'member'} -> ${result.payment.invoiceNumber}`,
        metadata: {
          razorpayOrderId: result.payment.razorpayOrderId,
          razorpayPaymentId: result.payment.razorpayPaymentId,
          invoiceNumber: result.payment.invoiceNumber,
          newExpiryDate: result.payment.newExpiryDate,
        },
      });

      try {
        await this.sendConfirmationAndReceipt({ payment: result.payment });
      } catch (err) {
        logger.warn('Post-capture receipt notification failed softly', {
          paymentId: result.payment.id,
          reason: err instanceof Error ? err.message : 'unknown',
        });
      }
    }

    return result;
  }

  async verifyAndCapture(params: {
    actorUserId?: string;
    actorRole?: string;
    tenant?: TenantScope;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    method?: string;
    ipAddress?: string | null;
    keySecretOverride?: string;
  }) {
    const existing = await this.repo.findPaymentByOrderId(params.razorpayOrderId);
    if (!existing) {
      throw new NotFoundError('Payment order not found');
    }

    if (params.actorRole === 'MEMBER') {
      if (!params.actorUserId || existing.member?.user?.id !== params.actorUserId) {
        throw new ForbiddenError('Cannot verify another member payment');
      }
    } else if (params.tenant) {
      assertBranchOwnership(existing.branchId ?? PRIMARY_BRANCH_ID, params.tenant);
    }

    const secret = (params.keySecretOverride ?? this.gateway.getKeySecret()).trim();
    const valid = verifyRazorpayCheckoutSignature({
      orderId: params.razorpayOrderId,
      paymentId: params.razorpayPaymentId,
      signature: params.razorpaySignature,
      keySecret: secret,
    });
    if (!valid) {
      throw new BadRequestError('Invalid Razorpay payment signature', 'INVALID_PAYMENT_SIGNATURE');
    }

    return this.finalizeCapture({
      razorpayOrderId: params.razorpayOrderId,
      razorpayPaymentId: params.razorpayPaymentId,
      razorpaySignature: params.razorpaySignature,
      method: params.method || existing.method || 'upi',
      actorId: params.actorUserId,
      actorRole: params.actorRole,
      ipAddress: params.ipAddress,
    });
  }

  async handleWebhook(params: {
    rawBody?: Buffer | string;
    signature?: string;
    eventPayload: any;
    webhookSecretOverride?: string;
    ipAddress?: string | null;
  }) {
    const secret = (params.webhookSecretOverride ?? this.gateway.getWebhookSecret()).trim();
    const rawBody = params.rawBody ?? '';
    const signature = params.signature ?? '';

    const valid = verifyRazorpayWebhookSignature({
      rawBody,
      signature,
      webhookSecret: secret,
    });
    if (!valid) {
      throw new BadRequestError('Invalid Razorpay webhook signature', 'INVALID_WEBHOOK_SIGNATURE');
    }

    const eventName = String(params.eventPayload?.event || '');
    const paymentEntity = params.eventPayload?.payload?.payment?.entity;

    if (!paymentEntity?.order_id) {
      return { processed: false, event: eventName, reason: 'no_order_id' };
    }

    const orderId = String(paymentEntity.order_id);
    const paymentId = String(paymentEntity.id || '');
    const method = String(paymentEntity.method || 'upi').toLowerCase();

    if (eventName === 'payment.captured' || eventName === 'order.paid') {
      const existing = await this.repo.findPaymentByOrderId(orderId);
      if (!existing) {
        return { processed: false, event: eventName, reason: 'order_not_found' };
      }

      if (
        typeof paymentEntity.amount === 'number' &&
        existing.amountInPaise &&
        paymentEntity.amount !== existing.amountInPaise
      ) {
        logger.error('Razorpay webhook amount mismatch rejected', {
          orderId,
          expectedPaise: existing.amountInPaise,
          receivedPaise: paymentEntity.amount,
        });
        throw new BadRequestError('Webhook payment amount mismatch', 'WEBHOOK_AMOUNT_MISMATCH');
      }

      const captured = await this.finalizeCapture({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
        method,
        actorRole: 'RAZORPAY_WEBHOOK',
        ipAddress: params.ipAddress,
      });

      return {
        processed: true,
        event: eventName,
        alreadyCaptured: captured.alreadyCaptured,
        paymentId: captured.payment.id,
        invoiceNumber: captured.payment.invoiceNumber,
      };
    }

    if (eventName === 'payment.failed') {
      const reason =
        paymentEntity.error_description || paymentEntity.error_reason || 'Payment failed at Razorpay';
      const failed = await this.repo.markPaymentFailed({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId || null,
        method,
        failureReason: String(reason),
      });

      if (failed && failed.status === 'FAILED') {
        auditService.record({
          branchId: failed.branchId ?? PRIMARY_BRANCH_ID,
          actorRole: 'RAZORPAY_WEBHOOK',
          action: 'PAYMENT_FAILED',
          targetId: failed.id,
          ipAddress: params.ipAddress ?? null,
          description: `Razorpay payment failed for order ${orderId}: ${reason}`,
        });
      }

      return {
        processed: Boolean(failed),
        event: eventName,
        status: failed?.status ?? 'UNKNOWN',
      };
    }

    return { processed: false, event: eventName, reason: 'event_ignored' };
  }

  async generateRenewalLinkForMember(params: {
    memberId: string;
    planId?: string;
    ttlHours?: number;
    tenant?: TenantScope;
  }) {
    const scopeBranchId = params.tenant?.branchId ?? null;
    const member = await this.repo.findMemberByIdentifier(params.memberId, scopeBranchId);
    if (!member) throw new NotFoundError('Member not found');

    const branchId = member.branchId ?? member.user?.branchId ?? PRIMARY_BRANCH_ID;
    assertBranchOwnership(branchId, params.tenant);

    const ttlSeconds = params.ttlHours ? params.ttlHours * 3600 : 72 * 3600;
    const token = createRenewalLinkToken({
      memberProfileId: member.id,
      branchId,
      planId: params.planId,
      ttlSeconds,
    });
    const renewalUrl = buildRenewalUrl(token);

    return {
      memberId: member.id,
      memberCode: member.memberId,
      branchId,
      token,
      renewalUrl,
      expiresInHours: Math.round(ttlSeconds / 3600),
    };
  }

  async getPublicRenewalCheckoutContext(token: string) {
    const payload = verifyRenewalLinkToken(token);
    const member = await this.repo.findMemberByIdentifier(payload.memberProfileId, payload.branchId);
    if (!member) throw new NotFoundError('Member not found');

    const branchId = member.branchId ?? payload.branchId ?? PRIMARY_BRANCH_ID;
    const [latestSub, activePlans, branch, settings] = await Promise.all([
      this.repo.findLatestMemberSubscription(member.id),
      this.repo.listActivePlans(branchId),
      this.repo.findBranchById(branchId),
      this.repo.findBranchSettings(branchId),
    ]);

    const now = new Date();
    const isActive = Boolean(latestSub && new Date(latestSub.endDate).getTime() > now.getTime());

    return {
      member: {
        id: member.id,
        memberId: member.memberId,
        name: `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim() || 'Member',
        branchId,
        branchName: branch?.name || settings?.gymName || PRIMARY_BRANCH_NAME,
      },
      currentSubscription: latestSub
        ? {
            planId: latestSub.planId,
            planName: latestSub.plan?.name || 'Membership Plan',
            endDate: latestSub.endDate,
            isActive,
          }
        : null,
      selectedPlanId: payload.planId || latestSub?.planId || activePlans[0]?.id || null,
      plans: activePlans.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: Number(p.price),
        priceInPaise: this.resolveAuthoritativePlanPaise(p),
        durationDays: p.durationDays,
        gstPercentage: Number(p.taxPercent ?? p.gstPercentage ?? 18),
      })),
    };
  }

  async createOrderFromRenewalToken(token: string, planId: string) {
    const payload = verifyRenewalLinkToken(token);
    const member = await this.repo.findMemberByIdentifier(payload.memberProfileId, payload.branchId);
    if (!member) throw new NotFoundError('Member not found');

    return this.createOrder({
      actorUserId: member.user?.id,
      actorRole: 'MEMBER',
      memberId: member.id,
      planId,
    });
  }

  async verifyFromRenewalToken(params: {
    token: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    method?: string;
    ipAddress?: string | null;
  }) {
    const payload = verifyRenewalLinkToken(params.token);
    const existing = await this.repo.findPaymentByOrderId(params.razorpayOrderId);
    if (!existing) throw new NotFoundError('Payment order not found');
    if (existing.memberId !== payload.memberProfileId) {
      throw new ForbiddenError('Renewal token does not match payment order');
    }

    return this.verifyAndCapture({
      actorUserId: existing.member?.user?.id,
      actorRole: 'MEMBER',
      razorpayOrderId: params.razorpayOrderId,
      razorpayPaymentId: params.razorpayPaymentId,
      razorpaySignature: params.razorpaySignature,
      method: params.method,
      ipAddress: params.ipAddress,
    });
  }

  async generateReceiptDownloadFromRenewalToken(params: {
    token: string;
    paymentId: string;
  }): Promise<{ buffer: Buffer; filename: string }> {
    const payload = verifyRenewalLinkToken(params.token);
    const payment = await this.repo.findPaymentById(params.paymentId);
    if (!payment) {
      throw new NotFoundError('Payment receipt not found');
    }
    if (payment.memberId !== payload.memberProfileId) {
      throw new ForbiddenError('Renewal token does not authorize access to this receipt');
    }

    return this.generateReceiptDownload({
      paymentId: params.paymentId,
      actorUserId: payment.member?.user?.id,
      actorRole: 'MEMBER',
    });
  }

  async listPayments(params: {
    actorUserId?: string;
    actorRole?: string;
    tenant?: TenantScope;
    status?: string;
    method?: string;
    memberId?: string;
    limit?: number;
  }) {
    const branchId = params.tenant?.branchId ?? null;
    let memberFilter = params.memberId;

    if (params.actorRole === 'MEMBER') {
      if (!params.actorUserId) throw new ForbiddenError('Authentication required');
      const self = await this.repo.findMemberByUserId(params.actorUserId);
      if (!self) return [];
      memberFilter = self.id;
    }

    return this.repo.listPayments({
      branchId: params.actorRole === 'MEMBER' ? null : branchId,
      memberId: memberFilter,
      status: params.status,
      method: params.method,
      limit: params.limit,
    });
  }

  async generateReceiptDownload(params: {
    paymentId: string;
    actorUserId?: string;
    actorRole?: string;
    tenant?: TenantScope;
  }): Promise<{ buffer: Buffer; filename: string }> {
    const payment = await this.repo.findPaymentById(params.paymentId);
    if (!payment) {
      throw new NotFoundError('Payment receipt not found');
    }

    if (params.actorRole === 'MEMBER') {
      if (!params.actorUserId || payment.member?.user?.id !== params.actorUserId) {
        throw new ForbiddenError('Members can only download their own payment receipts');
      }
    } else if (params.tenant) {
      assertBranchOwnership(payment.branchId ?? PRIMARY_BRANCH_ID, params.tenant);
    }

    if (payment.status !== 'CAPTURED' && payment.status !== 'COMPLETED') {
      throw new BadRequestError('Receipt is only available for completed/captured payments', 'PAYMENT_NOT_CAPTURED');
    }

    const branchId = payment.branchId ?? payment.member?.branchId ?? PRIMARY_BRANCH_ID;
    const settings = await this.repo.findBranchSettings(branchId);

    const invoiceNumber =
      payment.invoiceNumber ||
      payment.invoice?.invoiceNumber ||
      `INV-${payment.id.slice(0, 8).toUpperCase()}`;

    const totalInr = (payment.amountInPaise ?? Math.round(Number(payment.amount) * 100)) / 100;
    const taxPercent = payment.plan?.taxPercent ?? payment.plan?.gstPercentage ?? 18.0;
    const paidAt = payment.paidAt ? new Date(payment.paidAt) : new Date(payment.paymentDate);

    const buffer = await this.pdfReceipts.generateReceiptPdf({
      paymentId: payment.id,
      invoiceNumber,
      gymName: settings?.gymName || 'Lakzee Fitness Studio',
      branchName: payment.branch?.name || settings?.branch || PRIMARY_BRANCH_NAME,
      branchLocation: payment.branch?.location || settings?.address || null,
      branchGstNumber: settings?.gstNumber || null,
      branchContactPhone: settings?.contactPhone || null,
      branchContactEmail: settings?.contactEmail || null,
      memberName: `${payment.member?.user?.firstName || ''} ${payment.member?.user?.lastName || ''}`.trim() || 'Member',
      memberCode: payment.member?.memberId || '000',
      memberEmail: payment.member?.user?.email || null,
      memberPhone: payment.member?.user?.phone || null,
      planName: payment.plan?.name || 'Membership Plan',
      durationDays: payment.plan?.durationDays || 30,
      totalAmountInr: totalInr,
      gstPercentage: taxPercent,
      paymentMethod: payment.method || 'upi',
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: payment.razorpayPaymentId || payment.transactionId,
      paidAt,
      previousExpiryDate: payment.previousExpiryDate,
      newExpiryDate: payment.newExpiryDate,
    });

    const sanitizedFile = `Receipt-${invoiceNumber.replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`;
    return { buffer, filename: sanitizedFile };
  }
}

export const paymentService = new PaymentService();
