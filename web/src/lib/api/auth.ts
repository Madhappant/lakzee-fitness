import { apiRequest, clearClientSessionStorage } from "./config";
import type { ApiResponse, UserSummary } from "./types";

export const loginUser = (credentials: { email: string; password: string }) =>
  apiRequest<ApiResponse<{ user: UserSummary; token: string; accessToken?: string }>>(
    "/auth/login",
    { method: "POST", body: credentials, requireAuth: false },
    "Failed to login"
  );

export const refreshSession = () =>
  apiRequest<ApiResponse<{ user: UserSummary; token: string; accessToken: string }>>(
    "/auth/refresh",
    { method: "POST", requireAuth: false, includeAuth: false },
    "Session expired"
  );

export const logoutUser = async () => {
  try {
    await apiRequest<ApiResponse<null>>(
      "/auth/logout",
      {
        method: "POST",
        requireAuth: false,
        includeAuth: true,
        redirectOnUnauthorized: false,
      },
      "Failed to logout"
    );
  } catch {
    // Always clear client session state even if network is offline
  } finally {
    clearClientSessionStorage();
  }
};

export const requestPasswordOtp = (email: string) =>
  apiRequest<
    ApiResponse<{ phoneMasked?: string | null }> & {
      simulatedOtp?: string;
      phoneMasked?: string;
      previewUrl?: string;
    }
  >(
    "/auth/request-otp",
    { method: "POST", body: { email }, requireAuth: false },
    "Failed to request OTP"
  );

export const resetPassword = (data: { email: string; otp: string; newPassword: string }) =>
  apiRequest<ApiResponse<null>>(
    "/auth/reset-password",
    { method: "POST", body: data, requireAuth: false },
    "Failed to reset password"
  );

export const requestPhoneOtp = (data: { email?: string; newPhone: string }) =>
  apiRequest<
    ApiResponse<{ phoneMasked?: string }> & {
      simulatedOtp?: string;
      phoneMasked?: string;
      previewUrl?: string;
    }
  >(
    "/auth/request-phone-otp",
    { method: "POST", body: data },
    "Failed to request OTP."
  );

export const verifyPhoneOtp = (data: { email?: string; otp: string }) =>
  apiRequest<ApiResponse<{ user: UserSummary }>>(
    "/auth/verify-phone",
    { method: "POST", body: data },
    "Failed to verify OTP."
  );

export const authService = {
  login: loginUser,
  refresh: refreshSession,
  logout: logoutUser,
  requestPasswordOtp,
  resetPassword,
  requestPhoneOtp,
  verifyPhoneOtp,
};
