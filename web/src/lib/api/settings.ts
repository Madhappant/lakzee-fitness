import { API_URL, getAuthToken } from "./members";

export const fetchSettings = async () => {
  const res = await fetch(`${API_URL}/settings`);
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json();
};

export const updateSettings = async (settingsData: any) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(settingsData),
  });
  
  if (!res.ok) throw new Error("Failed to update settings");
  return res.json();
};
