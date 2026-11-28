/* eslint-disable @typescript-eslint/no-explicit-any */
import { API_URL, apiRequest, getAuthToken } from "./config";
import type { MemberSortOrder } from "../members-sort";

export { API_URL, getAuthToken };
export type { MemberSortOrder };

export interface FetchMembersOptions {
  sort?: MemberSortOrder | unknown;
  limit?: number;
  cursor?: string | null;
}

export const fetchMembers = (sortOrOptions?: MemberSortOrder | FetchMembersOptions | unknown) => {
  const isOptionsObj =
    typeof sortOrOptions === "object" && sortOrOptions !== null && !Array.isArray(sortOrOptions);
  const opts = isOptionsObj ? (sortOrOptions as FetchMembersOptions) : { sort: sortOrOptions };
  const resolvedSort: MemberSortOrder =
    opts.sort === "asc" || opts.sort === "desc" || opts.sort === "latest" ? opts.sort : "asc";

  const params = new URLSearchParams();
  params.set("sort", resolvedSort);
  if (typeof opts.limit === "number" && opts.limit > 0) {
    params.set("limit", String(opts.limit));
  }
  if (typeof opts.cursor === "string" && opts.cursor.trim()) {
    params.set("cursor", opts.cursor.trim());
  }

  return apiRequest(`/members?${params.toString()}`, {}, "Failed to fetch members");
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

export const memberService = {
  list: fetchMembers,
  create: createMember,
  getById: fetchMemberById,
  update: updateMember,
  delete: deleteMember,
  getDietPlan: fetchMemberDietPlan,
  assignDietPlan,
  getWorkoutRoutine: fetchMemberWorkoutRoutine,
  assignWorkoutRoutine,
};
