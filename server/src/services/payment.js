/** Provider-neutral payment boundary. No provider is enabled until merchant credentials and webhook verification are configured. */
export function paymentStatus() {
  return { configured: false, provider: process.env.PAYMENT_PROVIDER || null, mode: "disabled", message: "No payment provider is connected. Do not accept live payments." };
}
export async function createPaymentSession() {
  throw Object.assign(new Error("Payment provider is not configured; order cannot be paid online"), { status: 503, code: "PAYMENT_PROVIDER_DISABLED" });
}
export async function processRefund() {
  throw Object.assign(new Error("Refund provider is not configured; no money has been refunded"), { status: 503, code: "REFUND_PROVIDER_DISABLED" });
}
