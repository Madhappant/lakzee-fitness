import { API_URL, getAuthToken, handleApiResponse } from "./config";
export { API_URL, getAuthToken };

export const fetchMyProfile = async () => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/portal/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleApiResponse(res, "Failed to fetch profile");
};

export const fetchMyAttendance = async () => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/portal/attendance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleApiResponse(res, "Failed to fetch attendance");
};

export const fetchMySubscriptions = async () => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/portal/subscriptions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleApiResponse(res, "Failed to fetch subscriptions");
};

export const uploadMyPhoto = async (file: File) => {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append('photo', file);

  const res = await fetch(`${API_URL}/portal/photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  return handleApiResponse(res, "Failed to upload photo");
};

export const fetchMyDietPlan = async () => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/portal/diet`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleApiResponse(res, "Failed to fetch diet plan");
};

export const fetchMyWorkoutRoutine = async () => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/portal/workout`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleApiResponse(res, "Failed to fetch workout routine");
};
