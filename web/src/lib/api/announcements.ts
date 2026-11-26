import { getAuthToken, API_URL, handleApiResponse } from "./config";

export const fetchAnnouncements = async () => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/announcements`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleApiResponse(res, "Failed to fetch announcements");
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
  return handleApiResponse(res, "Failed to create announcement");
};

export const deleteAnnouncement = async (id: string) => {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/announcements/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleApiResponse(res, "Failed to delete announcement");
};
