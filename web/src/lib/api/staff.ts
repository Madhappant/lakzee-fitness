import { API_URL, getAuthToken, handleApiResponse } from "./config";

export const fetchStaff = async () => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/staff`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleApiResponse(res, "Failed to fetch staff");
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
  return handleApiResponse(res, "Failed to assign role");
};

export const revokeRole = async (userId: string) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/staff/${userId}/revoke`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleApiResponse(res, "Failed to revoke role");
};
