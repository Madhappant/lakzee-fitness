import PDFDocument from 'pdfkit';
import { computeInvoiceBreakdown } from '../subscription-ledger.service';

export interface ReceiptGenerationInput {
  paymentId: string;
  invoiceNumber: string;
  gymName: string;
  branchName: string;
  branchLocation?: string | null;
  branchGstNumber?: string | null;
  branchContactPhone?: string | null;
  branchContactEmail?: string | null;
  memberName: string;
  memberCode: string;
  memberEmail?: string | null;
  memberPhone?: string | null;
  planName: string;
  durationDays: number;
  totalAmountInr: number;
  gstPercentage: number;
  paymentMethod: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  paidAt: Date;
  previousExpiryDate?: Date | null;
  newExpiryDate?: Date | null;
}

function formatInr(amount: number): string {
  return `INR ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateIst(date: Date | null | undefined, includeTime = false): string {
  if (!date) return 'N/A';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', hour12: true } : {}),
  }).format(new Date(date));
}

/**
 * Generates an executive luxury 3-color (#0A0A0C / #F5F5F7 / #D4FF00)
 * GST Tax Invoice & Payment Receipt PDF completely in-memory.
 */
export class ReceiptService {
  async generateReceiptPdf(input: ReceiptGenerationInput): Promise<Buffer> {
    const breakdown = computeInvoiceBreakdown(input.totalAmountInr, input.gstPercentage || 18.0, 'PAID', 0);

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 44,
        info: {
          Title: `Payment Receipt ${input.invoiceNumber}`,
          Author: input.gymName || 'Lakzee Fitness Studio',
          Subject: `Membership Renewal Receipt - #${input.memberCode}`,
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const pageWidth = doc.page.width;
      const contentWidth = pageWidth - 88;
      const obsidian = '#0A0A0C';
      const chalk = '#F5F5F7';
      const volt = '#D4FF00';
      const muted = '#52525B';
      const border = '#E4E4E7';

      // --- Header Band (Obsidian Black + Volt Lime Accent) ---
      doc.rect(0, 0, pageWidth, 128).fill(obsidian);
      doc.rect(0, 128, pageWidth, 4).fill(volt);

      doc
        .fillColor(volt)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('TAX INVOICE & PAYMENT RECEIPT', 44, 32, { characterSpacing: 1.8 });

      doc
        .fillColor(chalk)
        .font('Helvetica-Bold')
        .fontSize(22)
        .text(input.gymName || 'LAKZEE FITNESS STUDIO', 44, 50);

      const branchSubtitle = [
        input.branchName,
        input.branchLocation,
        input.branchGstNumber ? `GSTIN: ${input.branchGstNumber}` : null,
      ]
        .filter(Boolean)
        .join('  |  ');

      doc
        .fillColor('#A1A1AA')
        .font('Helvetica')
        .fontSize(9)
        .text(branchSubtitle, 44, 80, { width: contentWidth - 130 });

      const contactLine = [input.branchContactPhone, input.branchContactEmail].filter(Boolean).join('  |  ');
      if (contactLine) {
        doc.fillColor('#A1A1AA').font('Helvetica').fontSize(8.5).text(contactLine, 44, 96);
      }

      // Paid Stamp Badge on top right
      doc.roundedRect(pageWidth - 146, 36, 102, 26, 6).fill(volt);
      doc
        .fillColor(obsidian)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('PAID · VERIFIED', pageWidth - 146, 45, { width: 102, align: 'center' });

      // --- Meta Grid: Invoice & Billed To ---
      let cursorY = 154;
      const colWidth = (contentWidth - 16) / 2;

      doc.roundedRect(44, cursorY, colWidth, 104, 8).strokeColor(border).lineWidth(1).stroke();
      doc.roundedRect(44 + colWidth + 16, cursorY, colWidth, 104, 8).strokeColor(border).lineWidth(1).stroke();

      // Left Box: Member Info
      const leftX = 58;
      doc.fillColor(muted).font('Helvetica-Bold').fontSize(8).text('BILLED TO MEMBER', leftX, cursorY + 14);
      doc.fillColor(obsidian).font('Helvetica-Bold').fontSize(12).text(input.memberName, leftX, cursorY + 28);
      doc
        .fillColor(obsidian)
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .text(`Member ID: #${input.memberCode}`, leftX, cursorY + 46);
      if (input.memberEmail) {
        doc.fillColor(muted).font('Helvetica').fontSize(9).text(input.memberEmail, leftX, cursorY + 62);
      }
      if (input.memberPhone) {
        doc.fillColor(muted).font('Helvetica').fontSize(9).text(input.memberPhone, leftX, cursorY + 76);
      }

      // Right Box: Payment & Invoice Metadata
      const rightX = 44 + colWidth + 30;
      doc.fillColor(muted).font('Helvetica-Bold').fontSize(8).text('RECEIPT DETAILS', rightX, cursorY + 14);
      const metaRows: Array<[string, string]> = [
        ['Invoice No:', input.invoiceNumber],
        ['Paid On:', formatDateIst(input.paidAt, true)],
        ['Method:', input.paymentMethod.toUpperCase()],
        ['Transaction ID:', input.razorpayPaymentId || input.paymentId],
      ];
      let metaY = cursorY + 28;
      for (const [label, value] of metaRows) {
        doc.fillColor(muted).font('Helvetica').fontSize(8.5).text(label, rightX, metaY, { width: 78 });
        doc
          .fillColor(obsidian)
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .text(value, rightX + 78, metaY, { width: colWidth - 104, align: 'right' });
        metaY += 16;
      }

      // --- Validity Highlight Banner ---
      cursorY += 122;
      doc.roundedRect(44, cursorY, contentWidth, 54, 8).fill('#F4F4F5');
      doc
        .fillColor(muted)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('MEMBERSHIP PLAN & EXTENDED VALIDITY', 58, cursorY + 12);

      const validityText = input.previousExpiryDate
        ? `Previous Expiry: ${formatDateIst(input.previousExpiryDate)}   ->   New Valid Until: ${formatDateIst(input.newExpiryDate)}`
        : `Active From: ${formatDateIst(input.paidAt)}   ->   Valid Until: ${formatDateIst(input.newExpiryDate)}`;

      doc
        .fillColor(obsidian)
        .font('Helvetica-Bold')
        .fontSize(10.5)
        .text(`${input.planName} (${input.durationDays} Days)   |   ${validityText}`, 58, cursorY + 28, {
          width: contentWidth - 28,
        });

      // --- Financial Breakdown Table ---
      cursorY += 74;
      doc.rect(44, cursorY, contentWidth, 28).fill(obsidian);
      doc.fillColor(chalk).font('Helvetica-Bold').fontSize(8.5).text('DESCRIPTION', 58, cursorY + 10);
      doc.text('TAXABLE / RATE', 310, cursorY + 10, { width: 95, align: 'right' });
      doc.text('AMOUNT', 420, cursorY + 10, { width: contentWidth - 390, align: 'right' });

      cursorY += 34;
      const lineItems: Array<{ label: string; rate: string; amount: string }> = [
        {
          label: `${input.planName} Membership (${input.durationDays} Days)`,
          rate: 'Taxable Value',
          amount: formatInr(breakdown.subtotal),
        },
        {
          label: `Goods & Services Tax (GST @ ${input.gstPercentage || 18}%)`,
          rate: `${input.gstPercentage || 18}%`,
          amount: formatInr(breakdown.gstAmount),
        },
      ];

      for (const item of lineItems) {
        doc.fillColor(obsidian).font('Helvetica').fontSize(9.5).text(item.label, 58, cursorY, { width: 245 });
        doc.fillColor(muted).font('Helvetica').fontSize(9).text(item.rate, 310, cursorY, { width: 95, align: 'right' });
        doc
          .fillColor(obsidian)
          .font('Helvetica-Bold')
          .fontSize(9.5)
          .text(item.amount, 420, cursorY, { width: contentWidth - 390, align: 'right' });
        cursorY += 24;
        doc
          .moveTo(44, cursorY - 6)
          .lineTo(44 + contentWidth, cursorY - 6)
          .strokeColor(border)
          .lineWidth(0.75)
          .stroke();
      }

      // Total Row
      cursorY += 8;
      doc.roundedRect(44, cursorY, contentWidth, 38, 6).fill(obsidian);
      doc
        .fillColor(chalk)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('TOTAL PAID (INCL. GST)', 58, cursorY + 13);
      doc
        .fillColor(volt)
        .font('Helvetica-Bold')
        .fontSize(13)
        .text(formatInr(breakdown.totalAmount), 300, cursorY + 12, {
          width: contentWidth - 270,
          align: 'right',
        });

      // Order reference & Footer
      cursorY += 56;
      if (input.razorpayOrderId) {
        doc
          .fillColor(muted)
          .font('Helvetica')
          .fontSize(8.5)
          .text(`Gateway Reference: Order ${input.razorpayOrderId}`, 44, cursorY);
      }

      doc
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(8)
        .text(
          `Thank you for training with ${input.gymName || 'Lakzee Fitness Studio'}. This is a digitally generated tax receipt and does not require a physical signature.`,
          44,
          755,
          { width: contentWidth, align: 'center' }
        );

      doc.end();
    });
  }
}

export const receiptService = new ReceiptService();
