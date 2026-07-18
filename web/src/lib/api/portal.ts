export const API_URL = "http://localhost:5000/api";

export const getAuthToken = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("lakzee_token");
  }
  return null;
};

export const fetchMyProfile = async () => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/portal/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
};

export const fetchMyAttendance = async () => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/portal/attendance`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error("Failed to fetch attendance");
  return res.json();
};

export const fetchMySubscriptions = async () => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/portal/subscriptions`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error("Failed to fetch subscriptions");
  return res.json();
};

export const uploadMyPhoto = async (file: File) => {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append('photo', file);

  const res = await fetch(`${API_URL}/portal/photo`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) throw new Error("Failed to upload photo");
  return res.json();
};

export const fetchMyDietPlan = async () => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/portal/diet`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error("Failed to fetch diet plan");
  return res.json();
};

export const fetchMyWorkoutRoutine = async () => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/portal/workout`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error("Failed to fetch workout routine");
  return res.json();
};
