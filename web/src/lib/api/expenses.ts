import { API_URL } from "./config";

const getAuthToken = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("token") || "";
  }
  return "";
};

export const fetchExpenses = async (month?: number, year?: number) => {
  const token = getAuthToken();
  let url = `${API_URL}/expenses`;
  if (month && year) {
    url += `?month=${month}&year=${year}`;
  }
  
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch expenses");
  return res.json();
};

export const createExpense = async (data: any) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/expenses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to create expense");
  }
  return res.json();
};

export const updateExpense = async (id: string, data: any) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/expenses/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to update expense");
  }
  return res.json();
};

export const deleteExpense = async (id: string) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/expenses/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to delete expense");
  return res.json();
};
