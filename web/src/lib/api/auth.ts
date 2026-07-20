import { API_URL } from "./members";

export const loginUser = async (credentials: any) => {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to login");
  }
  return res.json();
};

export const requestPasswordOtp = async (email: string) => {
  const res = await fetch(`${API_URL}/auth/request-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to request OTP");
  }
  return res.json();
};

export const resetPassword = async (data: any) => {
  const res = await fetch(`${API_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to reset password");
  }
  return res.json();
};
