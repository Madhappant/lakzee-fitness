/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiRequest } from "./config";
import type { ApiResponse, PaymentStats, SubscriptionRecord } from "./types";

export const fetchSubscriptions = (params?: {
  search?: string;
  status?: string;
  paymentStatus?: string;
}) => {
  const queryParams = new URLSearchParams();
  if (params?.search) queryParams.set("search", params.search);
  if (params?.status && params.status !== "All Status" && params.status !== "ALL") {
    queryParams.set("status", params.status);
  }
  if (params?.paymentStatus && params.paymentStatus !== "All Payments" && params.paymentStatus !== "ALL") {
    queryParams.set("paymentStatus", params.paymentStatus);
  }

  const query = queryParams.toString();
  return apiRequest<ApiResponse<SubscriptionRecord[]>>(
    `/subscriptions${query ? `?${query}` : ""}`,
    {},
    "Failed to fetch subscriptions"
  );
};

export const createSubscription = (subData: {
  memberId: string;
  planId: string;
  startDate: string;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  balanceAmount?: number | string;
}) =>
  apiRequest<ApiResponse<SubscriptionRecord>>(
    "/subscriptions",
    { method: "POST", body: subData },
    "Failed to create subscription"
  );

export const fetchPaymentStats = () =>
  apiRequest<ApiResponse<PaymentStats>>(
    "/subscriptions/stats",
    {},
    "Failed to fetch payment stats"
  );

export const updateSubscription = (id: string, data: any) =>
  apiRequest<ApiResponse<SubscriptionRecord>>(
    `/subscriptions/${id}`,
    { method: "PUT", body: data },
    "Failed to update subscription"
  );

export const deleteSubscription = (id: string) =>
  apiRequest<ApiResponse<null>>(
    `/subscriptions/${id}`,
    { method: "DELETE" },
    "Failed to delete subscription"
  );

export const subscriptionService = {
  list: fetchSubscriptions,
  create: createSubscription,
  getPaymentStats: fetchPaymentStats,
  update: updateSubscription,
  delete: deleteSubscription,
};
