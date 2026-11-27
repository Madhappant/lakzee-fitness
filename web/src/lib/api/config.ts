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
export async function handleApiResponse<T = any>(
  res: Response,
  fallbackMessage: string,
  options: { redirectOnUnauthorized?: boolean } = {}
): Promise<T> {
  const { redirectOnUnauthorized = true } = options;
  if (!res.ok) {
    if (redirectOnUnauthorized && res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("lakzee_token");
      localStorage.removeItem("lakzee_user");
      localStorage.removeItem("lakzee_swr_cache_v1");
      window.location.href = "/login?session_expired=1";
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || fallbackMessage);
  }
  return res.json();
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  requireAuth?: boolean;
  includeAuth?: boolean;
  redirectOnUnauthorized?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiRequest<T = any>(
  path: string,
  options: ApiRequestOptions = {},
  fallbackMessage = "Request failed"
): Promise<T> {
  const {
    body,
    headers,
    requireAuth = true,
    includeAuth = requireAuth,
    redirectOnUnauthorized = requireAuth,
    ...rest
  } = options;

  const token = requireAuth
    ? redirectOnMissingToken()
    : includeAuth
      ? getAuthToken()
      : null;

  const resolvedHeaders = new Headers(headers);
  if (token && !resolvedHeaders.has("Authorization")) {
    resolvedHeaders.set("Authorization", `Bearer ${token}`);
  }

  let resolvedBody: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    if (typeof FormData !== "undefined" && body instanceof FormData) {
      resolvedBody = body;
    } else if (typeof body === "string") {
      if (!resolvedHeaders.has("Content-Type")) {
        resolvedHeaders.set("Content-Type", "application/json");
      }
      resolvedBody = body;
    } else {
      if (!resolvedHeaders.has("Content-Type")) {
        resolvedHeaders.set("Content-Type", "application/json");
      }
      resolvedBody = JSON.stringify(body);
    }
  }

  const url = path.startsWith("http")
    ? path
    : `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...rest,
    headers: resolvedHeaders,
    body: resolvedBody,
  });

  return handleApiResponse<T>(res, fallbackMessage, { redirectOnUnauthorized });
}
