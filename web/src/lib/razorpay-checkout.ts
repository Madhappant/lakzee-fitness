/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

export interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, any>) => {
      open: () => void;
      on?: (event: string, cb: (resp: any) => void) => void;
    };
  }
}

export async function loadRazorpayCheckoutScript(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.Razorpay) return true;

  return new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.Razorpay)), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Opens Razorpay Standard Checkout with native UPI (GPay, PhonePe, Paytm, BHIM) prioritized first.
 */
export async function openRazorpayCheckout(params: {
  keyId: string;
  orderId: string;
  amountInPaise: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name?: string; email?: string | null; contact?: string | null };
  notes?: Record<string, string>;
  onSuccess: (response: RazorpaySuccessResponse) => void | Promise<void>;
  onFailure: (message: string) => void;
  onDismiss?: () => void;
}): Promise<void> {
  const loaded = await loadRazorpayCheckoutScript();
  if (!loaded || !window.Razorpay) {
    params.onFailure("Could not load Razorpay Checkout. Check your connection or CSP settings.");
    return;
  }

  const rzp = new window.Razorpay({
    key: params.keyId,
    amount: params.amountInPaise,
    currency: params.currency || "INR",
    name: params.name,
    description: params.description,
    order_id: params.orderId,
    prefill: {
      name: params.prefill.name || "",
      email: params.prefill.email || "",
      contact: params.prefill.contact || "",
    },
    notes: params.notes || {},
    theme: {
      color: "#DBA12C",
      backdrop_color: "#0A0A0C",
    },
    config: {
      display: {
        blocks: {
          upi_block: {
            name: "Pay Instantly via UPI (GPay, PhonePe, Paytm)",
            instruments: [{ method: "upi" }],
          },
        },
        sequence: ["block.upi_block"],
        preferences: { show_default_blocks: true },
      },
    },
    handler: (resp: RazorpaySuccessResponse) => {
      void params.onSuccess(resp);
    },
    modal: {
      ondismiss: () => {
        params.onDismiss?.();
      },
    },
  });

  if (typeof rzp.on === "function") {
    rzp.on("payment.failed", (resp: any) => {
      params.onFailure(resp?.error?.description || "Payment was declined or failed at Razorpay.");
    });
  }

  rzp.open();
}
