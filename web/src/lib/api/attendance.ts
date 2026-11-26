import { API_URL, getAuthToken, handleApiResponse } from "./config";

export const fetchTodayAttendance = async () => {
  const token = getAuthToken();
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();
  
  const res = await fetch(`${API_URL}/attendance?start=${startOfDay}&end=${endOfDay}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleApiResponse(res, "Failed to fetch attendance logs");
};

export const checkInMember = async (lakzeeId: string) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/attendance/checkin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ lakzeeId }),
  });
  return handleApiResponse(res, "Check-in failed");
};

export const checkOutMember = async (lakzeeId: string) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/attendance/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ lakzeeId }),
  });
  return handleApiResponse(res, "Check-out failed");
};
