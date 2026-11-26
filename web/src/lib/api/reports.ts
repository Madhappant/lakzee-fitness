import { API_URL, redirectOnMissingToken, handleApiResponse } from "./config";

export const fetchReports = async () => {
  const token = redirectOnMissingToken();
  const res = await fetch(`${API_URL}/reports`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleApiResponse(res, "Failed to fetch reports");
};
