/* eslint-disable @typescript-eslint/no-explicit-any */
import { API_URL, getAuthToken, handleApiResponse } from "./config";
export { API_URL, getAuthToken };

export const fetchMembers = async () => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/members`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return handleApiResponse(res, "Failed to fetch members");
};

export const createMember = async (memberData: any) => {
  const token = getAuthToken();
  const isFormData = memberData instanceof FormData;
  const headers: any = { Authorization: `Bearer ${token}` };
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}/members`, {
    method: "POST",
    headers,
    body: isFormData ? memberData : JSON.stringify(memberData),
  });
  
  return handleApiResponse(res, "Failed to create member");
};

export const deleteMember = async (id: string) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/members/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  
  return handleApiResponse(res, "Failed to delete member");
};

export const fetchMemberById = async (id: string) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/members/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return handleApiResponse(res, "Failed to fetch member details");
};

export const updateMember = async (id: string, memberData: any) => {
  const token = getAuthToken();
  const isFormData = memberData instanceof FormData;
  const headers: any = { Authorization: `Bearer ${token}` };
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}/members/${id}`, {
    method: "PUT",
    headers,
    body: isFormData ? memberData : JSON.stringify(memberData),
  });
  
  return handleApiResponse(res, "Failed to update member");
};

export const fetchMemberDietPlan = async (memberId: string) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/plans-routines/diet/${memberId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return handleApiResponse(res, "Failed to fetch member diet plan");
};

export const assignDietPlan = async (memberId: string, data: any) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/plans-routines/diet/${memberId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  
  return handleApiResponse(res, "Failed to assign diet plan");
};

export const fetchMemberWorkoutRoutine = async (memberId: string) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/plans-routines/workout/${memberId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return handleApiResponse(res, "Failed to fetch member workout routine");
};

export const assignWorkoutRoutine = async (memberId: string, data: any) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/plans-routines/workout/${memberId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  
  return handleApiResponse(res, "Failed to assign workout routine");
};
