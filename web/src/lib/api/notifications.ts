import { apiRequest, getAuthToken } from "./config";
import type {
  ApiResponse,
  NotificationItem,
  NotificationLogRecord,
  ReminderBatchSummary,
} from "./types";

export const fetchNotifications = async (): Promise<NotificationItem[]> => {
  const token = getAuthToken();
  if (!token) return [];

  const tzOffset = new Date().getTimezoneOffset();
  const res = await apiRequest<ApiResponse<NotificationItem[]>>(
    `/notifications?tzOffset=${tzOffset}`,
    { requireAuth: false, includeAuth: true, redirectOnUnauthorized: true },
    "Failed to fetch notifications"
  );
  return res.data;
};

export const fetchNotificationLogs = (options: {
  status?: string;
  channel?: string;
  limit?: number;
} = {}) => {
  const params = new URLSearchParams();
  if (options.status && options.status !== "ALL") params.set("status", options.status);
  if (options.channel && options.channel !== "ALL") params.set("channel", options.channel);
  if (options.limit) params.set("limit", String(options.limit));
  const qs = params.toString();
  return apiRequest<ApiResponse<NotificationLogRecord[]>>(
    `/notifications/logs${qs ? `?${qs}` : ""}`,
    {},
    "Failed to fetch notification logs"
  );
};

export const sendManualReminder = (payload: {
  memberId: string;
  channels?: Array<"WHATSAPP" | "EMAIL">;
  milestone?: "7_DAYS" | "3_DAYS" | "1_DAY" | "EXPIRED";
  dryRun?: boolean;
}) =>
  apiRequest<
    ApiResponse<{
      memberId: string;
      memberCode: string;
      memberName: string;
      branchId: string;
      dryRun: boolean;
      results: Array<{
        channel: string;
        milestone: string;
        status: string;
        reason?: string;
      }>;
    }>
  >(
    "/notifications/send",
    { method: "POST", body: payload },
    "Failed to send expiry reminder"
  );

export const retryNotificationLog = (id: string, dryRun?: boolean) =>
  apiRequest<
    ApiResponse<{
      logId: string;
      channel: string;
      milestone: string;
      status: string;
      reason?: string;
    }>
  >(
    `/notifications/logs/${id}/retry`,
    { method: "POST", body: dryRun !== undefined ? { dryRun } : {} },
    "Failed to retry reminder"
  );

export const runRemindersBatch = (payload: { dryRun?: boolean } = {}) =>
  apiRequest<ApiResponse<ReminderBatchSummary>>(
    "/notifications/run",
    { method: "POST", body: payload },
    "Failed to execute reminder batch"
  );

export const notificationService = {
  list: fetchNotifications,
  listLogs: fetchNotificationLogs,
  sendManual: sendManualReminder,
  retryLog: retryNotificationLog,
  runBatch: runRemindersBatch,
};
