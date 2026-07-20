import { getAuthToken, API_URL } from "./members";

export const fetchAnnouncements = async () => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/announcements`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to fetch announcements");
  return res.json();
};

export const createAnnouncement = async (data: { title: string; message: string }) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/announcements`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to create announcement");
  return json;
};

export const deleteAnnouncement = async (id: string) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/announcements/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to delete announcement");
  return json;
};
