import { API_URL, getAuthToken, handleApiResponse } from "./config";

export const fetchExpenses = async (month?: number, year?: number) => {
  const token = getAuthToken();
  let url = `${API_URL}/expenses`;
  if (month && year) {
    url += `?month=${month}&year=${year}`;
  }
  
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleApiResponse(res, "Failed to fetch expenses");
};

export interface ExpenseData {
  title: string;
  category: string;
  amount: number;
  date?: string;
  paymentMethod?: string;
  notes?: string;
}

export const createExpense = async (data: ExpenseData) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/expenses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return handleApiResponse(res, "Failed to create expense");
};

export const updateExpense = async (id: string, data: Partial<ExpenseData>) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/expenses/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return handleApiResponse(res, "Failed to update expense");
};

export const deleteExpense = async (id: string) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/expenses/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleApiResponse(res, "Failed to delete expense");
};
