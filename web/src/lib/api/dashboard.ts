/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiRequest } from "./config";
import type { ApiResponse } from "./types";

export const fetchDashboardStats = () =>
  apiRequest<ApiResponse<any>>(
    "/dashboard/stats",
    {},
    "Failed to fetch dashboard stats"
  );

export const dashboardService = {
  getStats: fetchDashboardStats,
};
