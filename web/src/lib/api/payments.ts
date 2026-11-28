/* eslint-disable @typescript-eslint/no-explicit-any */
import { API_URL, apiRequest, getAuthToken, getStoredActiveBranch } from "./config";
import type {
  ApiResponse,
  CreatePaymentOrderResponse,
  PaymentTransactionRecord,
  PublicRenewalContext,
  RenewalLinkResponse,
} from "./types";

export const fetchOnlinePayments = (filters?: {
  status?: string;
  method?: string;
  limit?: number;
}) => {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== "ALL") params.set("status", filters.status);
  if (filters?.method && filters.method !== "ALL") params.set("method", filters.method);
  if (filters?.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();
  return apiRequest<ApiResponse<PaymentTransactionRecord[]>>(
    `/payments${qs ? `?${qs}` : ""}`,
    {},
    "Failed to fetch payment transactions"
  );
};

export const createRazorpayOrder = (payload: { memberId?: string; planId: string }) =>
  apiRequest<ApiResponse<CreatePaymentOrderResponse>>(
    "/payments/create-order",
    { method: "POST", body: payload },
    "Failed to initialize Razorpay order"
  );

export const verifyRazorpayPayment = (payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  method?: string;
}) =>
  apiRequest<
    ApiResponse<{
      alreadyCaptured: boolean;
      payment: PaymentTransactionRecord;
      subscription: any;
      invoice: any;
    }>
  >(
    "/payments/verify",
    { method: "POST", body: payload },
    "Payment verification failed"
  );

export const createMemberRenewalLink = (
  memberId: string,
  payload?: { planId?: string; ttlHours?: number }
) =>
  apiRequest<ApiResponse<RenewalLinkResponse>>(
    `/payments/renewal-link/${encodeURIComponent(memberId)}`,
    { method: "POST", body: payload ?? {} },
    "Failed to generate renewal link"
  );

export const fetchPublicRenewalContext = (token: string) =>
  apiRequest<ApiResponse<PublicRenewalContext>>(
    `/payments/renewal/${encodeURIComponent(token)}`,
    { requireAuth: false, includeAuth: false },
    "Renewal link is invalid or has expired"
  );

export const createPublicRenewalOrder = (token: string, planId: string) =>
  apiRequest<ApiResponse<CreatePaymentOrderResponse>>(
    `/payments/renewal/${encodeURIComponent(token)}/create-order`,
    { method: "POST", body: { planId }, requireAuth: false, includeAuth: false },
    "Failed to create renewal payment order"
  );

export const verifyPublicRenewalPayment = (
  token: string,
  payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    method?: string;
  }
) =>
  apiRequest<
    ApiResponse<{
      alreadyCaptured: boolean;
      payment: PaymentTransactionRecord;
      subscription: any;
      invoice: any;
    }>
  >(
    `/payments/renewal/${encodeURIComponent(token)}/verify`,
    { method: "POST", body: payload, requireAuth: false, includeAuth: false },
    "Failed to verify online payment"
  );

export async function downloadPaymentReceipt(paymentId: string, filename?: string): Promise<void> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  if (typeof window !== "undefined") {
    try {
      const rawUser = localStorage.getItem("lakzee_user");
      if (rawUser) {
        const parsed = JSON.parse(rawUser) as { role?: string };
        if (parsed?.role === "SUPER_ADMIN") {
          const branchId = getStoredActiveBranch();
          if (branchId) headers["X-Branch-Id"] = branchId;
        }
      }
    } catch {
      // Ignore header fallback failures
    }
  }

  const res = await fetch(`${API_URL}/payments/${encodeURIComponent(paymentId)}/receipt`, {
    method: "GET",
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    const errPayload = await res.json().catch(() => ({}));
    throw new Error((errPayload as { message?: string })?.message || "Failed to download receipt PDF");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || `Receipt-${paymentId.slice(0, 8)}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadPublicRenewalReceipt(
  token: string,
  paymentId: string,
  filename?: string
): Promise<void> {
  const res = await fetch(
    `${API_URL}/payments/renewal/${encodeURIComponent(token)}/receipt/${encodeURIComponent(paymentId)}`,
    { method: "GET" }
  );

  if (!res.ok) {
    const errPayload = await res.json().catch(() => ({}));
    throw new Error((errPayload as { message?: string })?.message || "Failed to download receipt PDF");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || `Receipt-${paymentId.slice(0, 8)}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
