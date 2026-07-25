import { API_URL, getAuthToken } from "./members";

export const fetchTodayAttendance = async () => {
  const token = getAuthToken();
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();
  
  const res = await fetch(`${API_URL}/attendance?start=${startOfDay}&end=${endOfDay}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch attendance logs");
  return res.json();
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
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Check-in failed");
  }
  return res.json();
};
