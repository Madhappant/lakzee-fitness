import { apiRequest } from "./config";
import type { ApiResponse, BranchRecord } from "./types";

export const fetchBranches = () =>
  apiRequest<ApiResponse<BranchRecord[]>>(
    "/branches",
    {},
    "Failed to load branches"
  );

export const createBranch = (input: {
  name: string;
  code?: string;
  location: string;
  status?: "ACTIVE" | "INACTIVE";
}) =>
  apiRequest<ApiResponse<BranchRecord>>(
    "/branches",
    { method: "POST", body: input },
    "Failed to create branch"
  );

export const updateBranch = (
  id: string,
  input: Partial<{ name: string; code: string; location: string; status: "ACTIVE" | "INACTIVE" }>
) =>
  apiRequest<ApiResponse<BranchRecord>>(
    `/branches/${id}`,
    { method: "PUT", body: input },
    "Failed to update branch"
  );

export const branchService = {
  list: fetchBranches,
  create: createBranch,
  update: updateBranch,
};
