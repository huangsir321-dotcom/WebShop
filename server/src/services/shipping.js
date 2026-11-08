/** Provider-neutral shipping adapter. Manual rates are estimates only; labels and tracking need a real provider integration. */
export function shippingStatus() {
  return { configured: false, provider: process.env.SHIPPING_PROVIDER || null, mode: "manual-estimate-only", message: "No shipping API connected; no label can be purchased." };
}
export async function quoteShipping({ countryCode, currency = "USD", subtotal = 0 }) {
  const code = String(countryCode || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw Object.assign(new Error("A valid two-letter destination country is required"), { status: 400 });
  // Never present these as carrier quotes: this is an explicit, configurable estimate only.
  const configured = Number(process.env[`SHIPPING_ESTIMATE_${code}`]);
  if (!Number.isFinite(configured) || configured < 0) return { available: false, configured: false, countryCode: code, currency, amount: null, source: "UNCONFIGURED", message: "Shipping estimate is not configured for this destination." };
  return { available: true, configured: false, countryCode: code, currency, amount: configured, source: "MERCHANT_ESTIMATE_NOT_CARRIER_QUOTE", message: "Merchant-configured estimate only. No carrier rate or delivery promise is confirmed." };
}
