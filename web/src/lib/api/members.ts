export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export const getAuthToken = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("lakzee_token");
  }
  return null;
};

export const fetchMembers = async () => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/members`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error("Failed to fetch members");
  return res.json();
};

export const createMember = async (memberData: any) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/members`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(memberData),
  });
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to create member");
  }
  return res.json();
};

export const deleteMember = async (id: string) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/members/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  
  if (!res.ok) throw new Error("Failed to delete member");
  return res.json();
};

export const fetchMemberById = async (id: string) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/members/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error("Failed to fetch member details");
  return res.json();
};

export const updateMember = async (id: string, memberData: any) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/members/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(memberData),
  });
  
  if (!res.ok) throw new Error("Failed to update member");
  return res.json();
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
  
  if (!res.ok) throw new Error("Failed to assign diet plan");
  return res.json();
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
  
  if (!res.ok) throw new Error("Failed to assign workout routine");
  return res.json();
};
