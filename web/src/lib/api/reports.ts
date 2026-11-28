/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiRequest } from "./config";
import type { ApiResponse } from "./types";

export const fetchReports = () =>
  apiRequest<ApiResponse<any>>("/reports", {}, "Failed to fetch reports");

export const reportService = {
  getOverview: fetchReports,
};
