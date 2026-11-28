import { apiRequest } from "./config";

export const fetchAnnouncements = () =>
  apiRequest("/announcements", {}, "Failed to fetch announcements");

export const createAnnouncement = (data: { title: string; message: string }) =>
  apiRequest(
    "/announcements",
    { method: "POST", body: data },
    "Failed to create announcement"
  );

export const deleteAnnouncement = (id: string) =>
  apiRequest(
    `/announcements/${id}`,
    { method: "DELETE" },
    "Failed to delete announcement"
  );

export const announcementService = {
  list: fetchAnnouncements,
  create: createAnnouncement,
  delete: deleteAnnouncement,
};
