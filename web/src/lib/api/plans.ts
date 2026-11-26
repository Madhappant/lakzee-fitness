/* eslint-disable @typescript-eslint/no-explicit-any */
import { API_URL, getAuthToken, handleApiResponse } from "./config";

export const fetchPlans = async () => {
  const res = await fetch(`${API_URL}/plans`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
  return handleApiResponse(res, "Failed to fetch plans");
};

export const createPlan = async (planData: any) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/plans`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(planData),
  });
  return handleApiResponse(res, "Failed to create plan");
};

export const updatePlan = async (id: string, data: any) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/plans/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return handleApiResponse(res, "Failed to update plan");
};

export const deletePlan = async (id: string) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/plans/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return handleApiResponse(res, "Failed to delete plan");
};
