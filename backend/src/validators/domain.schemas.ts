import { z } from 'zod';
import { isValidE164Phone } from '../services/notifications/e164';

const booleanInputSchema = z.preprocess((v) => {
  if (v === true || v === 'true') return true;
  if (v === false || v === 'false') return false;
  return v;
}, z.boolean());

const e164WhatsappSchema = z.preprocess(
  (v) => (typeof v === 'string' && !v.trim() ? undefined : typeof v === 'string' ? v.trim().replace(/[\s\-().]+/g, '') : v),
  z
    .string()
    .refine((val) => isValidE164Phone(val), {
      message: 'WhatsApp number must be in E.164 format (e.g., +919876543210)',
    })
    .optional()
);

// --- Authentication ---
export const registerBodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
});

export const loginBodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const requestOtpBodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const resetPasswordBodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  otp: z.string().trim().length(6),
  newPassword: z.string().min(6),
});

export const requestPhoneOtpBodySchema = z.object({
  email: z.string().trim().toLowerCase().email().optional(),
  newPhone: z.string().trim().min(5),
});

export const verifyPhoneOtpBodySchema = z.object({
  email: z.string().trim().toLowerCase().email().optional(),
  otp: z.string().trim().length(6),
});

// --- Branches ---
export const createBranchBodySchema = z.object({
  name: z.string().trim().min(2, 'Branch name must be at least 2 characters').max(120),
  code: z
    .string()
    .trim()
    .min(2)
    .max(24)
    .regex(/^[A-Za-z0-9_-]+$/, 'Branch code must be alphanumeric with dashes/underscores')
    .optional(),
  location: z.string().trim().min(2, 'Location is required').max(200),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const updateBranchBodySchema = createBranchBodySchema.partial();

// --- Members ---
export const createMemberBodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  branchId: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional(),
  whatsappNumber: e164WhatsappSchema,
  notificationsEnabled: booleanInputSchema.optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dob: z.string().optional(),
  bloodGroup: z.string().trim().optional(),
  address: z.string().trim().optional(),
  emergencyContact: z.string().trim().optional(),
});

export const updateMemberBodySchema = z.object({
  memberId: z.string().trim().min(1).optional(),
  branchId: z.string().trim().min(1).optional(),
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional(),
  whatsappNumber: z
    .union([
      z.literal('').transform(() => null),
      z.null(),
      z
        .string()
        .trim()
        .transform((val) => val.replace(/[\s\-().]+/g, ''))
        .refine((val) => isValidE164Phone(val), {
          message: 'WhatsApp number must be in E.164 format (e.g., +919876543210)',
        }),
    ])
    .optional(),
  notificationsEnabled: booleanInputSchema.optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  password: z.string().min(6).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dob: z.string().optional(),
  bloodGroup: z.string().trim().optional(),
  address: z.string().trim().optional(),
  emergencyContact: z.string().trim().optional(),
});

export const memberSortQuerySchema = z.object({
  sort: z.enum(['asc', 'desc', 'latest']).optional(),
  branchId: z.string().trim().min(1).optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

// --- Plans & Subscriptions & Expenses ---
export const createPlanBodySchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  price: z.coerce.number().finite().min(0),
  durationDays: z.coerce.number().int().min(1),
  gstPercentage: z.coerce.number().finite().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

export const updatePlanBodySchema = createPlanBodySchema.partial();

export const createSubscriptionBodySchema = z.object({
  memberId: z.string().trim().min(1),
  planId: z.string().trim().min(1),
  startDate: z.string().refine((s) => !isNaN(Date.parse(s)), 'Invalid startDate'),
  status: z.enum(['ACTIVE', 'EXPIRED', 'FROZEN', 'CANCELLED']).optional(),
  paymentStatus: z.enum(['PAID', 'PENDING']).default('PAID'),
  paymentMethod: z.enum(['CASH', 'UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'SPLIT']).default('CASH'),
  balanceAmount: z.preprocess(
    (v) => (v === '' || v === undefined ? 0 : Number(v)),
    z.number().min(0)
  ).default(0),
});

export const updateSubscriptionBodySchema = z.object({
  status: z.enum(['ACTIVE', 'EXPIRED', 'FROZEN', 'CANCELLED']).optional(),
  paymentStatus: z.enum(['PAID', 'PENDING']).optional(),
  paymentMethod: z.enum(['CASH', 'UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'SPLIT']).optional(),
  startDate: z.string().refine((s) => !s || !isNaN(Date.parse(s)), 'Invalid startDate').optional(),
  planId: z.string().trim().min(1).optional(),
  balanceAmount: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : Number(v)),
    z.number().min(0).optional()
  ),
});

export const createExpenseBodySchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(150),
  category: z.enum(['SALARY', 'MAINTENANCE', 'RENT', 'WATER', 'ELECTRICITY', 'CLEANING', 'OTHER']).default('OTHER'),
  amount: z.coerce.number().finite().min(0, 'Amount must be positive'),
  date: z.string().refine((s) => !s || !isNaN(Date.parse(s)), 'Invalid date').optional(),
  paymentMethod: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CREDIT_CARD']).default('CASH'),
  notes: z.string().trim().max(1000).optional(),
});

export const updateExpenseBodySchema = createExpenseBodySchema.partial();

// --- Attendance ---
export const attendanceScanBodySchema = z.object({
  lakzeeId: z.string().trim().min(1, 'Member ID or QR code is required'),
});

// --- Diet & Workout Routines ---
export const dietPlanBodySchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  notes: z.string().trim().max(2000).optional(),
  mealsData: z.union([z.record(z.string(), z.string()), z.string()]),
});

export const workoutRoutineBodySchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  notes: z.string().trim().max(2000).optional(),
  exercisesData: z.union([z.record(z.string(), z.string()), z.string()]),
});

// --- Studio: Staff, Settings, Announcements, Contact, AI ---
export const assignStaffRoleBodySchema = z.object({
  userId: z.string().trim().min(1),
  role: z.enum(['SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMIN', 'RECEPTIONIST', 'TRAINER', 'STAFF']),
  branchId: z.string().trim().min(1).optional(),
});

export const updateSettingsBodySchema = z.object({
  gymName: z.string().trim().min(1).max(150).optional(),
  logoUrl: z.string().trim().max(500).nullable().optional(),
  branch: z.string().trim().max(150).nullable().optional(),
  workingHours: z.string().trim().max(150).nullable().optional(),
  gstNumber: z.string().trim().max(50).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  contactEmail: z.string().trim().email().or(z.literal('')).nullable().optional(),
  contactPhone: z.string().trim().max(30).nullable().optional(),
  whatsappRemindersEnabled: booleanInputSchema.optional(),
  emailRemindersEnabled: booleanInputSchema.optional(),
  reminderMilestones: z
    .string()
    .trim()
    .regex(/^(0|1|3|7)(,(0|1|3|7))*$/, 'Milestones must be comma-separated values from 7,3,1,0')
    .optional(),
});

// --- Notifications & Expiry Reminder Automation ---
export const notificationLogsQuerySchema = z.object({
  status: z.enum(['SENT', 'FAILED', 'SKIPPED']).optional(),
  channel: z.enum(['WHATSAPP', 'EMAIL']).optional(),
  branchId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

// --- Online Payments & Razorpay ---
export const createPaymentOrderBodySchema = z.object({
  memberId: z.string().trim().min(1).optional(),
  planId: z.string().trim().min(1, 'Plan ID is required'),
});

export const verifyPaymentBodySchema = z.object({
  razorpay_order_id: z.string().trim().min(1, 'razorpay_order_id is required'),
  razorpay_payment_id: z.string().trim().min(1, 'razorpay_payment_id is required'),
  razorpay_signature: z.string().trim().min(1, 'razorpay_signature is required'),
  method: z.string().trim().max(32).optional(),
});

export const paymentListQuerySchema = z.object({
  status: z.enum(['CREATED', 'CAPTURED', 'FAILED', 'REFUNDED', 'COMPLETED', 'ALL']).optional(),
  method: z.string().trim().max(32).optional(),
  branchId: z.string().trim().min(1).optional(),
  memberId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const createRenewalLinkBodySchema = z.object({
  planId: z.string().trim().min(1).optional(),
  ttlHours: z.coerce.number().int().min(1).max(168).optional(),
});

export const publicRenewalOrderBodySchema = z.object({
  planId: z.string().trim().min(1, 'Plan ID is required'),
});

export const sendManualReminderBodySchema = z.object({
  memberId: z.string().trim().min(1, 'Member ID is required'),
  channels: z.array(z.enum(['WHATSAPP', 'EMAIL'])).min(1).max(2).optional(),
  milestone: z.enum(['7_DAYS', '3_DAYS', '1_DAY', 'EXPIRED']).optional(),
  dryRun: booleanInputSchema.optional(),
});

export const runRemindersBodySchema = z.object({
  branchId: z.string().trim().min(1).optional(),
  dryRun: booleanInputSchema.optional(),
});

export const createAnnouncementBodySchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100),
  message: z.string().trim().min(1, 'Message is required').max(1000),
});

export const contactInquiryBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  phone: z.string().trim().min(5, 'Valid phone number is required').max(30),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  goal: z.string().trim().min(1, 'Fitness goal is required').max(50),
  message: z.string().trim().max(1000).optional().or(z.literal('')),
});

export const aiChatBodySchema = z.object({
  messages: z.array(z.any()).min(1, 'Invalid messages array').max(50, 'Invalid messages array'),
  model: z.string().trim().optional(),
});

export const aiVoiceBodySchema = z.object({
  messages: z.array(z.any()).min(1, 'Invalid messages array').max(50, 'Invalid messages array'),
});

// --- Client Observability & Web Vitals Telemetry ---
export const clientTelemetryBodySchema = z.object({
  type: z.enum(['web-vital', 'error']),
  name: z.enum(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']).optional(),
  value: z.number().finite().min(0).max(120000).optional(),
  rating: z.enum(['good', 'needs-improvement', 'poor']).optional(),
  route: z.string().trim().max(200).optional(),
  message: z.string().trim().max(500).optional(),
  stack: z.string().max(4000).optional(),
  componentStack: z.string().max(2000).optional(),
});
