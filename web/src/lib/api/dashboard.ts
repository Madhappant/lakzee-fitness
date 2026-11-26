import { API_URL, redirectOnMissingToken, handleApiResponse } from "./config";

export const fetchDashboardStats = async () => {
  const token = redirectOnMissingToken();
  const res = await fetch(`${API_URL}/dashboard/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleApiResponse(res, `Failed to fetch dashboard stats (${res.status})`);
};
