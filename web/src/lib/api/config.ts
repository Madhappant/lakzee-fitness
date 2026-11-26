export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export const getAuthToken = (): string | null => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("lakzee_token");
  }
  return null;
};

export const redirectOnMissingToken = () => {
  const token = getAuthToken();
  if (!token && typeof window !== "undefined") {
    window.location.href = "/login?session_expired=1";
    throw new Error("No authentication token found. Please log in.");
  }
  return token;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleApiResponse<T = any>(res: Response, fallbackMessage: string): Promise<T> {
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("lakzee_token");
      localStorage.removeItem("lakzee_user");
      window.location.href = "/login?session_expired=1";
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || fallbackMessage);
  }
  return res.json();
}
