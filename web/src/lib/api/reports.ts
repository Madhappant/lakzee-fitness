import { API_URL, getAuthToken } from "./members";

export const fetchReports = async () => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/reports`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch reports");
  return res.json();
};
