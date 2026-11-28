import { addTelemetryBreadcrumb, reportClientError } from "../telemetry";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

export const resolveMediaUrl = (path?: string | null): string => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("blob:")) {
    return path;
  }
  return `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
};

export const getAuthToken = (): string | null => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("lakzee_token");
  }
  return null;
};

export const ACTIVE_BRANCH_STORAGE_KEY = "lakzee_active_branch_id";

export const getStoredActiveBranch = (): string => {
  if (typeof window === "undefined") return "all";
  return localStorage.getItem(ACTIVE_BRANCH_STORAGE_KEY) || "all";
};

export const setStoredActiveBranch = (branchId: string): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem(ACTIVE_BRANCH_STORAGE_KEY, branchId);
  }
};

function getSuperAdminBranchHeader(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const rawUser = localStorage.getItem("lakzee_user");
    if (!rawUser) return null;
    const parsed = JSON.parse(rawUser) as { role?: string };
    if (parsed?.role !== "SUPER_ADMIN") return null;
    return getStoredActiveBranch();
  } catch {
    return null;
  }
}

export const clearClientSessionStorage = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("lakzee_token");
    localStorage.removeItem("lakzee_user");
    localStorage.removeItem("lakzee_swr_cache_v1");
    localStorage.removeItem(ACTIVE_BRANCH_STORAGE_KEY);
  }
};

export const redirectOnMissingToken = () => {
  const token = getAuthToken();
  if (!token && typeof window !== "undefined") {
    window.location.href = "/login?session_expired=1";
    throw new Error("No authentication token found. Please log in.");
  }
  return token;
};

const NO_REFRESH_PATHS = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"];
let activeRefreshPromise: Promise<string | null> | null = null;

/**
 * Single-flight refresh call using the HttpOnly refresh cookie so concurrent
 * expired requests transparently obtain a rotated access token once.
 */
async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (activeRefreshPromise) return activeRefreshPromise;

  activeRefreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return null;

      const json = await res.json().catch(() => null);
      const nextToken = json?.data?.accessToken || json?.data?.token;
      if (!nextToken || typeof nextToken !== "string") return null;

      localStorage.setItem("lakzee_token", nextToken);
      if (json?.data?.user) {
        localStorage.setItem("lakzee_user", JSON.stringify(json.data.user));
      }
      return nextToken;
    } catch {
      return null;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleApiResponse<T = any>(
  res: Response,
  fallbackMessage: string,
  options: { redirectOnUnauthorized?: boolean } = {}
): Promise<T> {
  const { redirectOnUnauthorized = true } = options;
  if (!res.ok) {
    addTelemetryBreadcrumb("api", `${res.status} ${res.url.split("?")[0]}`);
    if (res.status >= 500 && typeof window !== "undefined") {
      reportClientError(new Error(`API ${res.status}: ${fallbackMessage}`), {
        route: window.location.pathname,
      });
    }
    if (redirectOnUnauthorized && res.status === 401 && typeof window !== "undefined") {
      clearClientSessionStorage();
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

  let token = requireAuth
    ? redirectOnMissingToken()
    : includeAuth
      ? getAuthToken()
      : null;

  const buildHeaders = (bearerToken: string | null): Headers => {
    const h = new Headers(headers);
    if (bearerToken) {
      h.set("Authorization", `Bearer ${bearerToken}`);
    }
    const superAdminBranch = getSuperAdminBranchHeader();
    if (superAdminBranch && !h.has("X-Branch-Id") && (requireAuth || includeAuth)) {
      h.set("X-Branch-Id", superAdminBranch);
    }
    return h;
  };

  const resolvedHeaders = buildHeaders(token);

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

  let res = await fetch(url, {
    ...rest,
    credentials: "include",
    headers: resolvedHeaders,
    body: resolvedBody,
  });

  const canAttemptRefresh =
    res.status === 401 &&
    (requireAuth || includeAuth) &&
    !NO_REFRESH_PATHS.some((skip) => path.includes(skip));

  if (canAttemptRefresh) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      token = refreshedToken;
      const retryHeaders = buildHeaders(token);
      if (
        resolvedBody !== undefined &&
        !(typeof FormData !== "undefined" && resolvedBody instanceof FormData) &&
        !retryHeaders.has("Content-Type")
      ) {
        retryHeaders.set("Content-Type", "application/json");
      }
      res = await fetch(url, {
        ...rest,
        credentials: "include",
        headers: retryHeaders,
        body: resolvedBody,
      });
    }
  }

  return handleApiResponse<T>(res, fallbackMessage, { redirectOnUnauthorized });
}
