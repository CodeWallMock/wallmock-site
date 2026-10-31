// Currency presentation follows WallMock's server-side connection region, never browser/URL/storage hints.
// The server enforces checkout eligibility independently; existing subscriptions retain their billing currency.
export const CURRENCIES = Object.freeze(["usd", "eur", "gbp", "cad", "aud", "inr", "brl"]);
export const REGION_ATTRIBUTION = Object.freeze({ name: "DB-IP", url: "https://db-ip.com", license: "CC-BY-4.0" });
let activeRegion = null;
const supported = (value) => typeof value === "string" && CURRENCIES.includes(value.toLowerCase()) ? value.toLowerCase() : null;

export function normalizePricingRegion(value) {
  if (!value || !["network", "fallback"].includes(value.source)) return null;
  const currency = supported(value.currency);
  const country = typeof value.country === "string" && /^[A-Z]{2}$/.test(value.country) ? value.country : null;
  if (!currency || (value.source === "network" && !country) || (value.source === "fallback" && (value.country !== null || currency !== "usd"))) return null;
  return Object.freeze({ country, currency, source: value.source, attribution: REGION_ATTRIBUTION });
}
export function setPricingRegion(value) { activeRegion = normalizePricingRegion(value); return activeRegion; }
export function getPricingRegion() { return activeRegion; }
export function preferredCurrency(fixedCurrency, allowed = CURRENCIES, region = activeRegion) {
  const fixed = typeof fixedCurrency === "string" ? fixedCurrency.toLowerCase() : null;
  if (fixed && /^[a-z]{3}$/.test(fixed) && allowed.includes(fixed)) return fixed;
  const current = normalizePricingRegion(region);
  if (current && allowed.includes(current.currency)) return current.currency;
  return allowed.includes("usd") ? "usd" : allowed[0] ?? "usd";
}
export async function fetchPricingRegion({ endpoint = "/api/pricing-region", fetcher = globalThis.fetch, timeoutMs = 5000 } = {}) {
  if (!["/api/pricing-region", "https://app.wallmock.com/api/pricing-region"].includes(endpoint) || typeof fetcher !== "function") return setPricingRegion(null);
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(endpoint, { credentials: "omit", cache: "no-store", mode: "cors", redirect: "error", signal: controller.signal });
    if (!response.ok) return setPricingRegion(null);
    return setPricingRegion(await response.json());
  } catch { return setPricingRegion(null); }
  finally { clearTimeout(timer); }
}

export function formatMoney(minorUnits, currency) {
  return new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase(), currencyDisplay: "code", minimumFractionDigits: minorUnits % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(minorUnits / 100);
}

export function localizeOffers(offers, currency) {
  const localized = offers.map((offer) => ({ ...offer, amountCents: Number.isSafeInteger(offer.amounts?.[currency]) ? offer.amounts[currency] : offer.amountCents }));
  return localized.map((offer) => {
    const monthly = localized.find((other) => other.plan === offer.plan && !other.founding && other.interval === "monthly");
    return { ...offer, monthlyEquivalentCents: offer.interval === "annual" ? Math.round(offer.amountCents / 12) : offer.amountCents,
      savingPercent: offer.interval === "annual" && !offer.founding && monthly ? (offer.plan === "pro" ? Math.round : Math.floor)((12 * monthly.amountCents - offer.amountCents) / (12 * monthly.amountCents) * 100) : null };
  });
}

// Kept as a read-only notice for existing landing callers; no manual currency control remains.
export function currencyControl(h, currency, _onChange, _allowed = CURRENCIES, fixed = false) {
  return h("div", { class: "pricing-currency-control", "data-key": "pricing-region" },
    h("p", { class: "small muted" }, fixed ? `Prices in ${currency.toUpperCase()}. Your existing subscription keeps its billing currency.` : activeRegion ? `Prices in ${currency.toUpperCase()}. ${activeRegion.source === "fallback" ? "Your connection's country could not be determined, so USD prices apply." : "Price region is set automatically from your connection."} A VPN or proxy can affect the result.` : "USD reference prices. Price region is unavailable; checkout will check it before payment."),
    h("p", { class: "small muted" }, "IP location data by ", h("a", { href: REGION_ATTRIBUTION.url, rel: "noopener" }, REGION_ATTRIBUTION.name), " (CC BY 4.0)."));
}
