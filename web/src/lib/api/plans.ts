/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiRequest } from "./config";

export const fetchPlans = () =>
  apiRequest(
    "/plans",
    { requireAuth: false, includeAuth: false },
    "Failed to fetch plans"
  );

export const createPlan = (planData: any) =>
  apiRequest(
    "/plans",
    { method: "POST", body: planData },
    "Failed to create plan"
  );

export const updatePlan = (id: string, data: any) =>
  apiRequest(
    `/plans/${id}`,
    { method: "PUT", body: data },
    "Failed to update plan"
  );

export const deletePlan = (id: string) =>
  apiRequest(
    `/plans/${id}`,
    { method: "DELETE" },
    "Failed to delete plan"
  );

export const planService = {
  list: fetchPlans,
  create: createPlan,
  update: updatePlan,
  delete: deletePlan,
};
