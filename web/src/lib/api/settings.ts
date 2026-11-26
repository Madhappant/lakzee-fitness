/* eslint-disable @typescript-eslint/no-explicit-any */
import { API_URL, getAuthToken, handleApiResponse } from "./config";

export const fetchSettings = async () => {
  const res = await fetch(`${API_URL}/settings`);
  return handleApiResponse(res, "Failed to fetch settings");
};

export const updateSettings = async (settingsData: any) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(settingsData),
  });
  return handleApiResponse(res, "Failed to update settings");
};
