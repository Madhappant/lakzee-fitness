import { apiRequest } from "./config";

export const fetchStaff = () =>
  apiRequest("/staff", {}, "Failed to fetch staff");

export const assignRole = (userId: string, role: string) =>
  apiRequest(
    "/staff/assign",
    { method: "POST", body: { userId, role } },
    "Failed to assign role"
  );

export const revokeRole = (userId: string) =>
  apiRequest(
    `/staff/${userId}/revoke`,
    { method: "POST" },
    "Failed to revoke role"
  );

export const staffService = {
  list: fetchStaff,
  assignRole,
  revokeRole,
};
