/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiRequest } from "./config";

export const loginUser = (credentials: any) =>
  apiRequest(
    "/auth/login",
    { method: "POST", body: credentials, requireAuth: false },
    "Failed to login"
  );

export const requestPasswordOtp = (email: string) =>
  apiRequest(
    "/auth/request-otp",
    { method: "POST", body: { email }, requireAuth: false },
    "Failed to request OTP"
  );

export const resetPassword = (data: any) =>
  apiRequest(
    "/auth/reset-password",
    { method: "POST", body: data, requireAuth: false },
    "Failed to reset password"
  );
