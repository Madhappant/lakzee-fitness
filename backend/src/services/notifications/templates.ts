import { PaymentConfirmationContext, ReminderTemplateContext } from './messaging.types';

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface MetaWhatsAppTemplatePayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: { code: string };
    components: Array<{
      type: 'body';
      parameters: Array<{ type: 'text'; text: string }>;
    }>;
  };
  variables: {
    memberName: string;
    branchName: string;
    planName: string;
    expiryDate: string;
    daysLeft: string;
  };
}

/**
 * Builds pre-approved Meta WhatsApp Business Cloud API template payload
 * with dynamic placeholders: {{memberName}}, {{branchName}}, {{planName}}, {{expiryDate}}, {{daysLeft}}.
 */
export function buildWhatsAppTemplatePayload(
  ctx: ReminderTemplateContext,
  templateName = process.env.WHATSAPP_TEMPLATE_NAME?.trim() || 'membership_expiry_reminder',
  languageCode = process.env.WHATSAPP_TEMPLATE_LANG?.trim() || 'en'
): MetaWhatsAppTemplatePayload {
  const daysLeftText = ctx.daysLeft <= 0 ? 'Expired today' : `${ctx.daysLeft} day${ctx.daysLeft === 1 ? '' : 's'}`;
  const toNumber = (ctx.whatsappNumber || '').replace(/^\+/, '');

  const variables = {
    memberName: ctx.memberName,
    branchName: ctx.branchName,
    planName: ctx.planName,
    expiryDate: ctx.expiryDateFormatted,
    daysLeft: daysLeftText,
  };

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toNumber,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: variables.memberName },
            { type: 'text', text: variables.branchName },
            { type: 'text', text: variables.planName },
            { type: 'text', text: variables.expiryDate },
            { type: 'text', text: variables.daysLeft },
          ],
        },
      ],
    },
    variables,
  };
}

/**
 * Renders responsive dark-luxury HTML & plain-text email strictly matching
 * Lakzee Fitness Studio's 3-color palette:
 * - Obsidian Black (#0A0A0C)
 * - Chalk White (#F5F5F7)
 * - Volt Lime (#D4FF00)
 */
export function renderExpiryReminderEmail(ctx: ReminderTemplateContext): {
  subject: string;
  html: string;
  text: string;
} {
  const safeName = escapeHtml(ctx.memberName);
  const safeBranch = escapeHtml(ctx.branchName);
  const safePlan = escapeHtml(ctx.planName);
  const safeDate = escapeHtml(ctx.expiryDateFormatted);
  const safeCode = escapeHtml(ctx.memberCode);
  const renewalHref = escapeHtml(
    ctx.renewalUrl || `${(process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim()}/member/subscriptions`
  );

  const isExpired = ctx.milestone === 'EXPIRED' || ctx.daysLeft <= 0;
  const urgencyLabel = isExpired
    ? 'MEMBERSHIP EXPIRED TODAY'
    : ctx.daysLeft === 1
      ? 'EXPIRES TOMORROW (1 DAY LEFT)'
      : `EXPIRES IN ${ctx.daysLeft} DAYS`;

  const subject = isExpired
    ? `${ctx.memberName}, your ${ctx.branchName} membership expired today`
    : `${ctx.memberName}, ${ctx.daysLeft} day${ctx.daysLeft === 1 ? '' : 's'} left on your ${ctx.branchName} membership`;

  const headline = isExpired
    ? 'Keep your training streak unbroken.'
    : `Your ${safePlan} plan renews soon.`;

  const summaryLine = isExpired
    ? `Your <strong>${safePlan}</strong> membership at <strong>${safeBranch}</strong> ended on <strong>${safeDate}</strong>. Renew today to maintain uninterrupted studio and QR check-in access.`
    : `Your <strong>${safePlan}</strong> membership at <strong>${safeBranch}</strong> is scheduled to expire on <strong>${safeDate}</strong> (${ctx.daysLeft} day${ctx.daysLeft === 1 ? '' : 's'} left).`;

  const contactLine = [ctx.branchContactPhone, ctx.branchContactEmail].filter(Boolean).join(' · ');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0A0A0C;color:#F5F5F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0A0A0C;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#0A0A0C;border:1px solid rgba(245,245,247,0.16);border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 20px 28px;border-bottom:1px solid rgba(245,245,247,0.12);">
              <span style="display:inline-block;padding:5px 12px;border-radius:999px;background-color:#D4FF00;color:#0A0A0C;font-size:11px;font-weight:800;letter-spacing:0.12em;">
                ${urgencyLabel}
              </span>
              <p style="margin:16px 0 0 0;font-size:12px;letter-spacing:0.18em;color:rgba(245,245,247,0.65);text-transform:uppercase;">
                LAKZEE FITNESS STUDIO · ${safeBranch}
              </p>
              <h1 style="margin:8px 0 0 0;font-size:26px;line-height:1.25;font-weight:800;color:#F5F5F7;">
                ${headline}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#F5F5F7;">
                Hi ${safeName},
              </p>
              <p style="margin:0 0 22px 0;font-size:15px;line-height:1.6;color:rgba(245,245,247,0.86);">
                ${summaryLine}
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0A0A0C;border:1px solid rgba(245,245,247,0.14);border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:14px 18px;font-size:13px;color:rgba(245,245,247,0.65);border-bottom:1px solid rgba(245,245,247,0.1);">Member ID</td>
                  <td align="right" style="padding:14px 18px;font-size:13px;font-weight:700;color:#D4FF00;border-bottom:1px solid rgba(245,245,247,0.1);font-family:monospace;">#${safeCode}</td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;font-size:13px;color:rgba(245,245,247,0.65);border-bottom:1px solid rgba(245,245,247,0.1);">Plan</td>
                  <td align="right" style="padding:14px 18px;font-size:13px;font-weight:600;color:#F5F5F7;border-bottom:1px solid rgba(245,245,247,0.1);">${safePlan}</td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;font-size:13px;color:rgba(245,245,247,0.65);">Expiry Date</td>
                  <td align="right" style="padding:14px 18px;font-size:13px;font-weight:700;color:#F5F5F7;">${safeDate}</td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius:12px;background-color:#D4FF00;">
                    <a href="${renewalHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:800;color:#0A0A0C;text-decoration:none;">
                      Renew Membership Now
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 26px 28px;border-top:1px solid rgba(245,245,247,0.12);font-size:12px;line-height:1.5;color:rgba(245,245,247,0.58);">
              ${contactLine ? `Questions? Reach ${safeBranch}: ${escapeHtml(contactLine)}.<br />` : ''}
              To opt out of automated expiry reminders, ask the front desk at ${safeBranch} to disable reminder notifications on your member profile.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `LAKZEE FITNESS STUDIO - ${ctx.branchName}`,
    urgencyLabel,
    '',
    `Hi ${ctx.memberName},`,
    isExpired
      ? `Your ${ctx.planName} membership (Member #${ctx.memberCode}) at ${ctx.branchName} expired on ${ctx.expiryDateFormatted}.`
      : `Your ${ctx.planName} membership (Member #${ctx.memberCode}) at ${ctx.branchName} expires on ${ctx.expiryDateFormatted} (${ctx.daysLeft} day${ctx.daysLeft === 1 ? '' : 's'} remaining).`,
    '',
    `Renew here or visit the front desk at ${ctx.branchName}: ${ctx.renewalUrl || `${(process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim()}/member/subscriptions`}`,
    contactLine ? `Studio contact: ${contactLine}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}

/**
 * Builds Meta WhatsApp Business Cloud API payload for confirmed payment & receipt link delivery.
 */
export function buildWhatsAppPaymentConfirmationPayload(
  ctx: PaymentConfirmationContext,
  templateName = process.env.WHATSAPP_PAYMENT_TEMPLATE_NAME?.trim() || 'membership_payment_receipt',
  languageCode = process.env.WHATSAPP_TEMPLATE_LANG?.trim() || 'en'
) {
  const toNumber = (ctx.whatsappNumber || '').replace(/^\+/, '');
  const formattedAmount = `INR ${ctx.amountPaidInr.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const variables = {
    memberName: ctx.memberName,
    branchName: ctx.branchName,
    planName: ctx.planName,
    amountPaid: formattedAmount,
    invoiceNumber: ctx.invoiceNumber,
    newExpiryDate: ctx.newExpiryFormatted,
    receiptUrl: ctx.receiptUrl,
  };

  return {
    messaging_product: 'whatsapp' as const,
    recipient_type: 'individual' as const,
    to: toNumber,
    type: 'template' as const,
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: 'body' as const,
          parameters: [
            { type: 'text' as const, text: variables.memberName },
            { type: 'text' as const, text: variables.planName },
            { type: 'text' as const, text: variables.amountPaid },
            { type: 'text' as const, text: variables.invoiceNumber },
            { type: 'text' as const, text: variables.newExpiryDate },
          ],
        },
      ],
    },
    variables,
  };
}

/**
 * Renders luxury 3-color (#0A0A0C / #F5F5F7 / #D4FF00) payment confirmation & receipt email.
 */
export function renderPaymentReceiptEmail(ctx: PaymentConfirmationContext): {
  subject: string;
  html: string;
  text: string;
} {
  const safeName = escapeHtml(ctx.memberName);
  const safeBranch = escapeHtml(ctx.branchName);
  const safePlan = escapeHtml(ctx.planName);
  const safeInvoice = escapeHtml(ctx.invoiceNumber);
  const safeExpiry = escapeHtml(ctx.newExpiryFormatted);
  const safeCode = escapeHtml(ctx.memberCode);
  const safeMethod = escapeHtml(ctx.method.toUpperCase());
  const safeTxn = escapeHtml(ctx.razorpayPaymentId || ctx.paymentId);
  const safeReceiptHref = escapeHtml(ctx.receiptUrl);
  const formattedAmount = `INR ${ctx.amountPaidInr.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const subject = `Payment Confirmed · ${ctx.invoiceNumber} — ${ctx.branchName}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0A0A0C;color:#F5F5F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0A0A0C;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#0A0A0C;border:1px solid rgba(245,245,247,0.16);border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 20px 28px;border-bottom:1px solid rgba(245,245,247,0.12);">
              <span style="display:inline-block;padding:5px 12px;border-radius:999px;background-color:#D4FF00;color:#0A0A0C;font-size:11px;font-weight:800;letter-spacing:0.12em;">
                PAYMENT CONFIRMED · ${safeInvoice}
              </span>
              <p style="margin:16px 0 0 0;font-size:12px;letter-spacing:0.18em;color:rgba(245,245,247,0.65);text-transform:uppercase;">
                LAKZEE FITNESS STUDIO · ${safeBranch}
              </p>
              <h1 style="margin:8px 0 0 0;font-size:24px;line-height:1.25;font-weight:800;color:#F5F5F7;">
                Your membership is extended.
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#F5F5F7;">Hi ${safeName},</p>
              <p style="margin:0 0 22px 0;font-size:15px;line-height:1.6;color:rgba(245,245,247,0.86);">
                Thank you for renewing your <strong>${safePlan}</strong> membership (${ctx.durationDays} days). Your GST tax receipt PDF is attached to this email.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0A0A0C;border:1px solid rgba(245,245,247,0.14);border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:12px 18px;font-size:13px;color:rgba(245,245,247,0.65);border-bottom:1px solid rgba(245,245,247,0.1);">Member ID</td>
                  <td align="right" style="padding:12px 18px;font-size:13px;font-weight:700;color:#D4FF00;border-bottom:1px solid rgba(245,245,247,0.1);font-family:monospace;">#${safeCode}</td>
                </tr>
                <tr>
                  <td style="padding:12px 18px;font-size:13px;color:rgba(245,245,247,0.65);border-bottom:1px solid rgba(245,245,247,0.1);">Amount Paid</td>
                  <td align="right" style="padding:12px 18px;font-size:13px;font-weight:800;color:#D4FF00;border-bottom:1px solid rgba(245,245,247,0.1);font-family:monospace;">${escapeHtml(formattedAmount)}</td>
                </tr>
                <tr>
                  <td style="padding:12px 18px;font-size:13px;color:rgba(245,245,247,0.65);border-bottom:1px solid rgba(245,245,247,0.1);">Payment Method</td>
                  <td align="right" style="padding:12px 18px;font-size:13px;font-weight:600;color:#F5F5F7;border-bottom:1px solid rgba(245,245,247,0.1);">${safeMethod}</td>
                </tr>
                <tr>
                  <td style="padding:12px 18px;font-size:13px;color:rgba(245,245,247,0.65);border-bottom:1px solid rgba(245,245,247,0.1);">Transaction Ref</td>
                  <td align="right" style="padding:12px 18px;font-size:12px;font-weight:600;color:#F5F5F7;border-bottom:1px solid rgba(245,245,247,0.1);font-family:monospace;">${safeTxn}</td>
                </tr>
                <tr>
                  <td style="padding:12px 18px;font-size:13px;color:rgba(245,245,247,0.65);">New Valid Until</td>
                  <td align="right" style="padding:12px 18px;font-size:13px;font-weight:700;color:#D4FF00;">${safeExpiry}</td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius:12px;background-color:#D4FF00;">
                    <a href="${safeReceiptHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:800;color:#0A0A0C;text-decoration:none;">
                      View Member Portal & Receipts
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `LAKZEE FITNESS STUDIO - ${ctx.branchName}`,
    `PAYMENT CONFIRMED (${ctx.invoiceNumber})`,
    '',
    `Hi ${ctx.memberName},`,
    `Your payment of ${formattedAmount} (${ctx.method.toUpperCase()}) for ${ctx.planName} (${ctx.durationDays} days) has been received.`,
    `Member ID: #${ctx.memberCode}`,
    `New Expiry Date: ${ctx.newExpiryFormatted}`,
    `Transaction Reference: ${ctx.razorpayPaymentId || ctx.paymentId}`,
    `Download receipt or manage your membership: ${ctx.receiptUrl}`,
  ].join('\n');

  return { subject, html, text };
}
