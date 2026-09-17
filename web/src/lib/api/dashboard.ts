import { API_URL, getAuthToken } from "./members";

export const fetchDashboardStats = async () => {
  const token = getAuthToken();
  if (!token && typeof window !== "undefined") {
    window.location.href = "/login?session_expired=1";
    throw new Error("No authentication token found. Please log in.");
  }

  const res = await fetch(`${API_URL}/dashboard/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("lakzee_token");
      localStorage.removeItem("lakzee_user");
      window.location.href = "/login?session_expired=1";
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to fetch dashboard stats (${res.status})`);
  }

  return res.json();
};

