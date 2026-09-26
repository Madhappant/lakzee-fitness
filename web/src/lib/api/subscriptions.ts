/* eslint-disable @typescript-eslint/no-explicit-any */
import { API_URL, getAuthToken } from "./members";

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

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("lakzee_token");
      localStorage.removeItem("lakzee_user");
      window.location.href = "/login?session_expired=1";
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to fetch subscriptions");
  }
  return res.json();
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
  
  if (!res.ok) throw new Error("Failed to create subscription");
  return res.json();
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

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("lakzee_token");
      localStorage.removeItem("lakzee_user");
      window.location.href = "/login?session_expired=1";
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to fetch payment stats");
  }
  return res.json();
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
  
  if (!res.ok) throw new Error("Failed to update subscription");
  return res.json();
};

export const deleteSubscription = async (id: string) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/subscriptions/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  
  if (!res.ok) throw new Error("Failed to delete subscription");
  return res.json();
};
