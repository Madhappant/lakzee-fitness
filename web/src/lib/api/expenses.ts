import { apiRequest } from "./config";
import type { ApiResponse, ExpenseRecord } from "./types";

export interface ExpenseData {
  title: string;
  category: string;
  amount: number;
  date?: string;
  paymentMethod?: string;
  notes?: string;
}

export const fetchExpenses = (month?: number, year?: number) => {
  const query = month && year ? `?month=${month}&year=${year}` : "";
  return apiRequest<ApiResponse<ExpenseRecord[]>>(
    `/expenses${query}`,
    {},
    "Failed to fetch expenses"
  );
};

export const createExpense = (data: ExpenseData) =>
  apiRequest<ApiResponse<ExpenseRecord>>(
    "/expenses",
    { method: "POST", body: data },
    "Failed to create expense"
  );

export const updateExpense = (id: string, data: Partial<ExpenseData>) =>
  apiRequest<ApiResponse<ExpenseRecord>>(
    `/expenses/${id}`,
    { method: "PUT", body: data },
    "Failed to update expense"
  );

export const deleteExpense = (id: string) =>
  apiRequest<ApiResponse<null>>(
    `/expenses/${id}`,
    { method: "DELETE" },
    "Failed to delete expense"
  );

export const expenseService = {
  list: fetchExpenses,
  create: createExpense,
  update: updateExpense,
  delete: deleteExpense,
};
