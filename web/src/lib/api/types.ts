/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ApiResponseMeta {
  total?: number;
  count?: number;
  sort?: string;
  cached?: boolean;
  branchId?: string;
  limit?: number;
  nextCursor?: string | null;
  hasMore?: boolean;
  [key: string]: unknown;
}

export interface ApiResponse<T = any, M extends ApiResponseMeta = ApiResponseMeta> {
  success?: boolean;
  status: "success" | "error";
  data: T;
  message?: string;
  meta?: M;
}

export type UserRole =
  | "SUPER_ADMIN"
  | "BRANCH_ADMIN"
  | "ADMIN"
  | "RECEPTIONIST"
  | "TRAINER"
  | "STAFF"
  | "MEMBER";

export interface BranchRecord {
  id: string;
  name: string;
  code: string;
  location: string;
  status: "ACTIVE" | "INACTIVE" | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserSummary {
  id: string;
  email: string;
  role: UserRole;
  branchId?: string | null;
  firstName: string;
  lastName: string;
  phone?: string | null;
  createdAt?: string;
  updatedAt?: string;
  roleAssignedAt?: string | null;
}

export interface PlanRecord {
  id: string;
  branchId?: string | null;
  name: string;
  description?: string | null;
  price: number;
  durationDays: number;
  gstPercentage: number;
  isActive: boolean;
}

export interface MemberSubscriptionSummary {
  status: string;
  startDate?: string;
  endDate?: string;
  plan?: { id: string; name: string; price: number };
}

export interface MemberRecord extends UserSummary {
  memberProfile?: {
    id: string;
    branchId?: string | null;
    memberId: string;
    whatsappNumber?: string | null;
    notificationsEnabled?: boolean;
    photoUrl?: string | null;
    gender?: "MALE" | "FEMALE" | "OTHER" | null;
    bloodGroup?: string | null;
    joiningDate?: string;
    qrCode?: string;
    subscriptions?: MemberSubscriptionSummary[];
  } | null;
}

export interface SubscriptionRecord {
  id: string;
  branchId?: string | null;
  memberId: string;
  planId: string;
  startDate: string;
  endDate: string;
  status: "ACTIVE" | "EXPIRED" | "FROZEN" | "CANCELLED";
  paymentStatus: "PAID" | "PENDING";
  paymentMethod: string;
  balanceAmount: number;
  createdAt: string;
  plan?: PlanRecord;
  member?: {
    id: string;
    branchId?: string | null;
    memberId: string;
    photoUrl?: string;
    user?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
    };
  };
}

export interface PaymentStats {
  todaysCollection: number;
  thisMonth: number;
  totalRecords: number;
  totalPending: number;
}

export interface AttendanceRecord {
  id: string;
  branchId?: string | null;
  memberId: string;
  checkIn: string;
  checkOut: string | null;
  date: string;
  member?: {
    id: string;
    branchId?: string | null;
    memberId: string;
    user?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone?: string | null;
    };
  };
}

export interface ExpenseRecord {
  id: string;
  branchId?: string | null;
  title: string;
  category: string;
  amount: number;
  date: string;
  paymentMethod: string;
  notes?: string;
}

export interface SettingsRecord {
  id: string;
  branchId?: string | null;
  gymName: string;
  logoUrl?: string | null;
  branch?: string | null;
  workingHours?: string | null;
  gstNumber?: string | null;
  address?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  whatsappRemindersEnabled?: boolean;
  emailRemindersEnabled?: boolean;
  reminderMilestones?: string;
}

export interface NotificationLogRecord {
  id: string;
  branchId?: string | null;
  memberId: string;
  channel: "WHATSAPP" | "EMAIL" | string;
  milestone: "7_DAYS" | "3_DAYS" | "1_DAY" | "EXPIRED" | string;
  cycleExpiryDate: string;
  status: "SENT" | "FAILED" | "SKIPPED" | string;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  sentAt: string;
  branch?: { id: string; name: string; code: string } | null;
  member?: {
    id: string;
    memberId: string;
    whatsappNumber?: string | null;
    notificationsEnabled?: boolean;
    user?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone?: string | null;
    } | null;
  } | null;
}

export interface ReminderBatchSummary {
  dryRun: boolean;
  timeZone: string;
  targetDate: string;
  evaluatedMembers: number;
  matchedMilestones: number;
  sent: number;
  failed: number;
  skippedDuplicate: number;
  skippedOptOut: number;
  skippedChannelDisabled: number;
}

export interface AnnouncementRecord {
  id: string;
  branchId?: string | null;
  title: string;
  message: string;
  authorId: string;
  createdAt: string;
  author?: { firstName: string; lastName: string };
}

export interface NotificationItem {
  id: string;
  type: "EXPIRY" | "PAYMENT" | "SYSTEM" | "ANNOUNCEMENT";
  title: string;
  message: string;
  date: string;
  link: string;
  read: boolean;
}

export interface ConsultationInquiryInput {
  name: string;
  phone: string;
  email?: string;
  goal: string;
  message?: string;
}

export interface PaymentTransactionRecord {
  id: string;
  branchId?: string | null;
  invoiceId?: string | null;
  memberId?: string | null;
  planId?: string | null;
  amount: number;
  amountInPaise?: number | null;
  currency: string;
  method: string;
  transactionId?: string | null;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  invoiceNumber?: string | null;
  receiptUrl?: string | null;
  previousExpiryDate?: string | null;
  newExpiryDate?: string | null;
  status: "CREATED" | "CAPTURED" | "FAILED" | "REFUNDED" | "COMPLETED" | string;
  paymentDate: string;
  paidAt?: string | null;
  failureReason?: string | null;
  notes?: string | null;
  branch?: { id: string; name: string; code: string } | null;
  plan?: { id: string; name: string; durationDays: number; price: number } | null;
  member?: {
    id: string;
    memberId: string;
    user?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone?: string | null;
    } | null;
  } | null;
}

export interface CreatePaymentOrderResponse {
  paymentRecordId: string;
  orderId: string;
  amountInPaise: number;
  amount: number;
  currency: string;
  keyId: string;
  mockMode: boolean;
  member: {
    id: string;
    memberId: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    branchId: string;
    branchName: string;
  };
  plan: {
    id: string;
    name: string;
    durationDays: number;
    price: number;
    priceInPaise: number;
  };
}

export interface PublicRenewalContext {
  member: {
    id: string;
    memberId: string;
    name: string;
    branchId: string;
    branchName: string;
  };
  currentSubscription: {
    planId: string;
    planName: string;
    endDate: string;
    isActive: boolean;
  } | null;
  selectedPlanId: string | null;
  plans: Array<{
    id: string;
    name: string;
    description?: string | null;
    price: number;
    priceInPaise: number;
    durationDays: number;
    gstPercentage: number;
  }>;
}

export interface RenewalLinkResponse {
  memberId: string;
  memberCode: string;
  branchId: string;
  token: string;
  renewalUrl: string;
  expiresInHours: number;
}
