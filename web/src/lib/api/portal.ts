/* eslint-disable @typescript-eslint/no-explicit-any */
import { API_URL, apiRequest, getAuthToken } from "./config";
import type { ApiResponse } from "./types";
export { API_URL, getAuthToken };

export const fetchMyProfile = () =>
  apiRequest<ApiResponse<any>>("/portal/me", {}, "Failed to fetch profile");

export const fetchMyAttendance = () =>
  apiRequest<ApiResponse<any[]>>("/portal/attendance", {}, "Failed to fetch attendance");

export const fetchMySubscriptions = () =>
  apiRequest<ApiResponse<any[]>>("/portal/subscriptions", {}, "Failed to fetch subscriptions");

export const uploadMyPhoto = (file: File) => {
  const formData = new FormData();
  formData.append("photo", file);
  return apiRequest<ApiResponse<{ photoUrl: string }>>(
    "/portal/photo",
    { method: "POST", body: formData },
    "Failed to upload photo"
  );
};

export const fetchMyDietPlan = () =>
  apiRequest<ApiResponse<any>>("/portal/diet", {}, "Failed to fetch diet plan");

export const fetchMyWorkoutRoutine = () =>
  apiRequest<ApiResponse<any>>("/portal/workout", {}, "Failed to fetch workout routine");

export const portalService = {
  getProfile: fetchMyProfile,
  getAttendance: fetchMyAttendance,
  getSubscriptions: fetchMySubscriptions,
  uploadPhoto: uploadMyPhoto,
  getDietPlan: fetchMyDietPlan,
  getWorkoutRoutine: fetchMyWorkoutRoutine,
};
