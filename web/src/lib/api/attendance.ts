import { API_URL, getAuthToken } from "./members";

export const fetchTodayAttendance = async () => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/attendance`, {
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
