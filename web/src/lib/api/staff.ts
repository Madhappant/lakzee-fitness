import { API_URL, getAuthToken } from "./members";

export const fetchStaff = async () => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/staff`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch staff");
  return res.json();
};

export const assignRole = async (userId: string, role: string) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/staff/assign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userId, role }),
  });
  if (!res.ok) throw new Error("Failed to assign role");
  return res.json();
};

export const revokeRole = async (userId: string) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/staff/${userId}/revoke`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to revoke role");
  }
  return res.json();
};
