/* eslint-disable @typescript-eslint/no-explicit-any */
import { API_URL, apiRequest, getAuthToken } from "./config";
import type { MemberSortOrder } from "../members-sort";

export { API_URL, getAuthToken };
export type { MemberSortOrder };

export const fetchMembers = (sort?: MemberSortOrder | unknown) => {
  const resolvedSort: MemberSortOrder =
    sort === "asc" || sort === "desc" || sort === "latest" ? sort : "asc";
  return apiRequest(`/members?sort=${resolvedSort}`, {}, "Failed to fetch members");
};

export const createMember = (memberData: any) =>
  apiRequest("/members", { method: "POST", body: memberData }, "Failed to create member");

export const deleteMember = (id: string) =>
  apiRequest(`/members/${id}`, { method: "DELETE" }, "Failed to delete member");

export const fetchMemberById = (id: string) =>
  apiRequest(`/members/${id}`, {}, "Failed to fetch member details");

export const updateMember = (id: string, memberData: any) =>
  apiRequest(`/members/${id}`, { method: "PUT", body: memberData }, "Failed to update member");

export const fetchMemberDietPlan = (memberId: string) =>
  apiRequest(`/plans-routines/diet/${memberId}`, {}, "Failed to fetch member diet plan");

export const assignDietPlan = (memberId: string, data: any) =>
  apiRequest(
    `/plans-routines/diet/${memberId}`,
    { method: "POST", body: data },
    "Failed to assign diet plan"
  );

export const fetchMemberWorkoutRoutine = (memberId: string) =>
  apiRequest(`/plans-routines/workout/${memberId}`, {}, "Failed to fetch member workout routine");

export const assignWorkoutRoutine = (memberId: string, data: any) =>
  apiRequest(
    `/plans-routines/workout/${memberId}`,
    { method: "POST", body: data },
    "Failed to assign workout routine"
  );
