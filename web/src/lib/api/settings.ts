/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiRequest } from "./config";

export const fetchSettings = () =>
  apiRequest(
    "/settings",
    { requireAuth: false, includeAuth: false },
    "Failed to fetch settings"
  );

export const updateSettings = (settingsData: any) =>
  apiRequest(
    "/settings",
    { method: "PUT", body: settingsData },
    "Failed to update settings"
  );

export const settingsService = {
  get: fetchSettings,
  update: updateSettings,
};
