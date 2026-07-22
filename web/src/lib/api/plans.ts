import { API_URL, getAuthToken } from "./members";

export const fetchPlans = async () => {
  const res = await fetch(`${API_URL}/plans`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
  if (!res.ok) throw new Error("Failed to fetch plans");
  return res.json();
};

export const createPlan = async (planData: any) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/plans`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(planData),
  });
  
  if (!res.ok) throw new Error("Failed to create plan");
  return res.json();
};

export const updatePlan = async (id: string, data: any) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/plans/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  
  if (!res.ok) throw new Error("Failed to update plan");
  return res.json();
};

export const deletePlan = async (id: string) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/plans/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  
  if (!res.ok) throw new Error("Failed to delete plan");
  return res.json();
};
