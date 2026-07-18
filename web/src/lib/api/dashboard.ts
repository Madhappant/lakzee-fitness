import { API_URL, getAuthToken } from "./members";

export const fetchDashboardStats = async () => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/dashboard/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
};
