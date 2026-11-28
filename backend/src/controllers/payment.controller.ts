import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { paymentService } from '../services/payment.service';
import { sendSuccess } from '../utils/response';

export const createPaymentOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = req.validated?.body ?? req.body;
  const result = await paymentService.createOrder({
    actorUserId: req.user?.id,
    actorRole: req.user?.role,
    tenant: req.tenant,
    memberId: body.memberId,
    planId: body.planId,
  });
  return sendSuccess(res, { statusCode: 201, data: result });
});

export const verifyPayment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = req.validated?.body ?? req.body;
  const result = await paymentService.verifyAndCapture({
    actorUserId: req.user?.id,
    actorRole: req.user?.role,
    tenant: req.tenant,
    razorpayOrderId: body.razorpay_order_id,
    razorpayPaymentId: body.razorpay_payment_id,
    razorpaySignature: body.razorpay_signature,
    method: body.method,
    ipAddress: req.ip,
  });

  return sendSuccess(res, {
    data: {
      alreadyCaptured: result.alreadyCaptured,
      payment: result.payment,
      subscription: result.subscription,
      invoice: result.invoice,
    },
  });
});

export const handleRazorpayWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.get('x-razorpay-signature') || '';
  const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}), 'utf8');

  const outcome = await paymentService.handleWebhook({
    rawBody,
    signature,
    eventPayload: req.body,
    ipAddress: req.ip,
  });

  return sendSuccess(res, { data: outcome });
});

export const listPayments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const query = req.validated?.query ?? req.query;
  const payments = await paymentService.listPayments({
    actorUserId: req.user?.id,
    actorRole: req.user?.role,
    tenant: req.tenant,
    status: query.status,
    method: query.method,
    memberId: query.memberId,
    limit: query.limit ? Number(query.limit) : undefined,
  });

  return sendSuccess(res, { data: payments, meta: { total: payments.length } });
});

export const downloadPaymentReceipt = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { buffer, filename } = await paymentService.generateReceiptDownload({
    paymentId: String(req.params.id),
    actorUserId: req.user?.id,
    actorRole: req.user?.role,
    tenant: req.tenant,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', String(buffer.length));
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(buffer);
});

export const createMemberRenewalLink = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = req.validated?.body ?? req.body;
  const result = await paymentService.generateRenewalLinkForMember({
    memberId: String(req.params.memberId),
    planId: body?.planId,
    ttlHours: body?.ttlHours,
    tenant: req.tenant,
  });
  return sendSuccess(res, { statusCode: 201, data: result });
});

export const getPublicRenewalContext = asyncHandler(async (req: Request, res: Response) => {
  const data = await paymentService.getPublicRenewalCheckoutContext(String(req.params.token));
  return sendSuccess(res, { data });
});

export const createPublicRenewalOrder = asyncHandler(async (req: Request, res: Response) => {
  const body = req.validated?.body ?? req.body;
  const data = await paymentService.createOrderFromRenewalToken(String(req.params.token), body.planId);
  return sendSuccess(res, { statusCode: 201, data });
});

export const verifyPublicRenewalPayment = asyncHandler(async (req: Request, res: Response) => {
  const body = req.validated?.body ?? req.body;
  const result = await paymentService.verifyFromRenewalToken({
    token: String(req.params.token),
    razorpayOrderId: body.razorpay_order_id,
    razorpayPaymentId: body.razorpay_payment_id,
    razorpaySignature: body.razorpay_signature,
    method: body.method,
    ipAddress: req.ip,
  });

  return sendSuccess(res, {
    data: {
      alreadyCaptured: result.alreadyCaptured,
      payment: result.payment,
      subscription: result.subscription,
      invoice: result.invoice,
    },
  });
});

export const downloadPublicRenewalReceipt = asyncHandler(async (req: Request, res: Response) => {
  const { buffer, filename } = await paymentService.generateReceiptDownloadFromRenewalToken({
    token: String(req.params.token),
    paymentId: String(req.params.id),
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', String(buffer.length));
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(buffer);
});
