import { apiRequest } from "./config";
import type { ApiResponse, ConsultationInquiryInput } from "./types";

export const submitConsultationInquiry = (data: ConsultationInquiryInput) =>
  apiRequest<ApiResponse<{ id: string }>>(
    "/contact",
    { method: "POST", body: data, requireAuth: false, includeAuth: false },
    "Could not send request. Please verify your details and try again."
  );

export const contactService = {
  submitInquiry: submitConsultationInquiry,
};
