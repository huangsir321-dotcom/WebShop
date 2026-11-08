/** Conservative tax boundary: only explicitly activated merchant-reviewed rules are applied. */
export async function calculateTax(prisma, { countryCode, regionCode, postalCode, taxableAmount }) {
  const code = String(countryCode || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw Object.assign(new Error("A valid destination country is required for tax estimation"), { status: 400 });
  const rules = await prisma.taxRule.findMany({ where: { countryCode: code, active: true, AND: [{ OR: [{ validFrom: null }, { validFrom: { lte: new Date() } }] }, { OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }] }] }, orderBy: { updatedAt: "desc" } });
  const rule = rules.find(r => (!r.regionCode || r.regionCode === regionCode) && (!r.postalPrefix || String(postalCode || "").startsWith(r.postalPrefix)));
  if (!rule) return { amount: 0, rate: 0, configured: false, source: "NO_ACTIVE_REVIEWED_RULE", message: "Tax is not calculated because no reviewed rule is active. Do not use this quote for live checkout." };
  const amount = Math.round(Number(taxableAmount) * Number(rule.rate) * 100) / 100;
  return { amount, rate: Number(rule.rate), configured: true, source: rule.source, ruleId: rule.id, inclusive: rule.inclusive, message: "Estimate based on a merchant-configured rule; verify legal applicability before launch." };
}
