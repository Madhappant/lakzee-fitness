import { apiRequest } from "./config";
import type { ApiResponse, AttendanceRecord } from "./types";

export const fetchTodayAttendance = () => {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

  return apiRequest<ApiResponse<AttendanceRecord[]>>(
    `/attendance?start=${encodeURIComponent(startOfDay)}&end=${encodeURIComponent(endOfDay)}`,
    {},
    "Failed to fetch attendance logs"
  );
};

export const checkInMember = (lakzeeId: string) =>
  apiRequest<ApiResponse<AttendanceRecord> & { message: string }>(
    "/attendance/checkin",
    { method: "POST", body: { lakzeeId } },
    "Check-in failed"
  );

export const checkOutMember = (lakzeeId: string) =>
  apiRequest<ApiResponse<AttendanceRecord> & { message: string }>(
    "/attendance/checkout",
    { method: "POST", body: { lakzeeId } },
    "Check-out failed"
  );

export const attendanceService = {
  getToday: fetchTodayAttendance,
  checkIn: checkInMember,
  checkOut: checkOutMember,
};
