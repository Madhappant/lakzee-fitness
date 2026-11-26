/* eslint-disable @typescript-eslint/no-explicit-any */
import { API_URL, getAuthToken, handleApiResponse } from "./config";

export const fetchSubscriptions = async (params?: { search?: string; status?: string; paymentStatus?: string }) => {
  const token = getAuthToken();
  if (!token && typeof window !== "undefined") {
    window.location.href = "/login?session_expired=1";
    throw new Error("No authentication token found. Please log in.");
  }

  const queryParams = new URLSearchParams();
  if (params?.search) queryParams.set("search", params.search);
  if (params?.status && params.status !== "All Status" && params.status !== "ALL") queryParams.set("status", params.status);
  if (params?.paymentStatus && params.paymentStatus !== "All Payments" && params.paymentStatus !== "ALL") queryParams.set("paymentStatus", params.paymentStatus);

  const url = `${API_URL}/subscriptions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return handleApiResponse(res, "Failed to fetch subscriptions");
};

export const createSubscription = async (subData: { memberId: string, planId: string, startDate: string }) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/subscriptions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(subData),
  });
  
  return handleApiResponse(res, "Failed to create subscription");
};

export const fetchPaymentStats = async () => {
  const token = getAuthToken();
  if (!token && typeof window !== "undefined") {
    window.location.href = "/login?session_expired=1";
    throw new Error("No authentication token found. Please log in.");
  }

  const res = await fetch(`${API_URL}/subscriptions/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return handleApiResponse(res, "Failed to fetch payment stats");
};

export const updateSubscription = async (id: string, data: any) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/subscriptions/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  
  return handleApiResponse(res, "Failed to update subscription");
};

export const deleteSubscription = async (id: string) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/subscriptions/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  
  return handleApiResponse(res, "Failed to delete subscription");
};
