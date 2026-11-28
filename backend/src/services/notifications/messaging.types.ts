export type NotificationChannel = 'WHATSAPP' | 'EMAIL';

export type ReminderMilestone = '7_DAYS' | '3_DAYS' | '1_DAY' | 'EXPIRED';

export type NotificationStatus = 'SENT' | 'FAILED' | 'SKIPPED';

export const MILESTONE_DAYS_MAP: Record<number, ReminderMilestone> = {
  7: '7_DAYS',
  3: '3_DAYS',
  1: '1_DAY',
  0: 'EXPIRED',
};

export const MILESTONE_TO_DAYS_LABEL: Record<ReminderMilestone, string> = {
  '7_DAYS': '7 days remaining',
  '3_DAYS': '3 days remaining',
  '1_DAY': '1 day remaining',
  EXPIRED: 'Expired today',
};

export interface ReminderTemplateContext {
  memberProfileId: string;
  userId: string;
  memberCode: string;
  memberName: string;
  email: string | null;
  whatsappNumber: string | null;
  branchId: string;
  branchName: string;
  branchContactPhone?: string | null;
  branchContactEmail?: string | null;
  planName: string;
  expiryDateIso: string;
  expiryDateFormatted: string;
  daysLeft: number;
  milestone: ReminderMilestone;
  renewalUrl?: string;
}

export interface DeliveryAttemptResult {
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  provider: string;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  dryRun?: boolean;
}

export interface WhatsAppProviderAdapter {
  readonly providerName: string;
  isConfigured(): boolean;
  sendTemplateReminder(ctx: ReminderTemplateContext): Promise<DeliveryAttemptResult>;
  sendPaymentConfirmation?(ctx: PaymentConfirmationContext): Promise<DeliveryAttemptResult>;
}

export interface EmailProviderAdapter {
  readonly providerName: string;
  isConfigured(): boolean;
  sendReminderEmail(ctx: ReminderTemplateContext): Promise<DeliveryAttemptResult>;
  sendPaymentReceiptEmail?(ctx: PaymentConfirmationContext): Promise<DeliveryAttemptResult>;
}

export interface PaymentConfirmationContext {
  paymentId: string;
  invoiceNumber: string;
  memberProfileId: string;
  memberCode: string;
  memberName: string;
  email: string | null;
  whatsappNumber: string | null;
  branchId: string;
  branchName: string;
  branchContactPhone?: string | null;
  branchContactEmail?: string | null;
  planName: string;
  durationDays: number;
  amountPaidInr: number;
  method: string;
  razorpayPaymentId?: string | null;
  paidAtFormatted: string;
  newExpiryFormatted: string;
  receiptUrl: string;
  pdfBuffer?: Buffer;
  pdfFilename?: string;
}
