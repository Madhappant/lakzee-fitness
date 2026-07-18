import { API_URL, getAuthToken } from "./members";

export const fetchSubscriptions = async () => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/subscriptions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch subscriptions");
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
  const res = await fetch(`${API_URL}/subscriptions/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch payment stats");
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
