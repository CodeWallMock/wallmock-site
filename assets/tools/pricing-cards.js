// Home/pricing cards use WallMock's server region and the app's shared formatter. Price data is public, approved minor units.
import { CURRENCIES, fetchPricingRegion, formatMoney } from "/pricing-currency.js?v=2";

// Each plan's price for new subscribers from 1 January 2027, per region (minor units; owner 18 Nov 2026, the same amounts as the app's
// offers.js OFFERS_2027). Shown as ONE plain dated line under today's price until then, monthly and yearly together (seo-14: never
// crossed out, no second launch paragraph); every [data-price-later] span is painted below, monthly or annual, in the region's currency.
const LATER_MONTHLY = Object.freeze({
  lite: Object.freeze({ usd: 900, eur: 900, gbp: 700, cad: 1200, aud: 1400, inr: 54900, brl: 3590 }),
  pro: Object.freeze({ usd: 1900, eur: 1900, gbp: 1500, cad: 2500, aud: 2900, inr: 119900, brl: 7990 }),
  studio: Object.freeze({ usd: 2900, eur: 2900, gbp: 2300, cad: 3800, aud: 4400, inr: 179900, brl: 11990 })
});
const LATER_ANNUAL = Object.freeze({
  lite: Object.freeze({ usd: 7900, eur: 7900, gbp: 6300, cad: 10300, aud: 11900, inr: 499900, brl: 31500 }),
  pro: Object.freeze({ usd: 17900, eur: 17900, gbp: 14300, cad: 23300, aud: 26900, inr: 1099900, brl: 71900 }),
  studio: Object.freeze({ usd: 27900, eur: 27900, gbp: 22300, cad: 36300, aud: 41900, inr: 1749900, brl: 111900 })
});

const source = document.getElementById("pricing-amounts");
const help = document.getElementById("pricing-currency-help");
const status = document.getElementById("pricing-currency-status");

function mount() {
  if (!source || !help || !status) return;
  let plans, schemas;
  try {
    plans = JSON.parse(source.textContent);
    if (!Array.isArray(plans) || plans.length < 2 || plans.length > 3 || new Set(plans.map((p) => p?.id)).size !== plans.length || plans.some((p) => !["lite", "pro", "studio"].includes(p.id) || typeof p.name !== "string" || !CURRENCIES.every((c) => [p.monthlyAmounts?.[c], p.annualAmounts?.[c]].every((n) => Number.isSafeInteger(n) && n > 0)))) return;
    schemas = [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => ({ node, value: JSON.parse(node.textContent) }));
  } catch { return; } // Static prices remain explicitly USD references if data cannot load.

  const updateSchema = (node, currency) => {
    if (!node || typeof node !== "object") return;
    if (node["@type"] === "SoftwareApplication" && node["@id"] === "https://wallmock.com/#app" && Array.isArray(node.offers)) {
      for (const offer of node.offers) {
        const p = plans.find((p) => p.name === offer.name);
        if (!p && offer.price !== "0") continue;
        offer.priceCurrency = currency.toUpperCase();
        if (!p) continue;
        offer.price = String(p.monthlyAmounts[currency] / 100);
        if (offer.priceSpecification) Object.assign(offer.priceSpecification, { price: offer.price, priceCurrency: offer.priceCurrency });
        offer.description = offer.description.replace(/, billed monthly, or .* a year$/, `, billed monthly, or ${formatMoney(p.annualAmounts[currency], currency)} a year`);
      }
    }
    for (const value of Object.values(node)) if (value && typeof value === "object") {
      for (const child of Array.isArray(value) ? value : [value]) updateSchema(child, currency);
    }
  };

  function paint(currency) {
    if (!CURRENCIES.includes(currency)) currency = "usd";
    for (const node of document.querySelectorAll("[data-price-plan][data-price-kind]")) {
      const p = plans.find((p) => p.id === node.dataset.pricePlan);
      if (!p) continue;
      // seo-14: "per-image" is the monthly price divided by the plan's stated monthly image count (data-per), shown as "about"
      if (node.dataset.priceKind === "per-image") {
        const per = Number(node.dataset.per), value = p.monthlyAmounts[currency] / 100 / per;
        if (Number.isSafeInteger(per) && per > 0) node.textContent = new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase(), currencyDisplay: "code", minimumFractionDigits: 2, maximumFractionDigits: value < 1 ? 3 : 2 }).format(value);
        continue;
      }
      const cents = node.dataset.priceKind === "monthly" ? p.monthlyAmounts[currency] : node.dataset.priceKind === "annual" ? p.annualAmounts[currency] : Math.round(p.annualAmounts[currency] / 12);
      node.textContent = formatMoney(cents, currency);
    }
    for (const node of document.querySelectorAll("[data-free-price]")) node.textContent = formatMoney(0, currency);
    for (const node of document.querySelectorAll("[data-price-later]")) {
      const table = node.dataset.priceLaterKind === "annual" ? LATER_ANNUAL : LATER_MONTHLY;
      const cents = Object.hasOwn(table, node.dataset.priceLater) ? table[node.dataset.priceLater][currency] : undefined;
      if (Number.isSafeInteger(cents) && cents > 0) node.textContent = formatMoney(cents, currency);
    }
    for (const entry of schemas) {
      updateSchema(entry.value, currency);
      entry.node.textContent = JSON.stringify(entry.value).replace(/</g, "\\u003c");
    }
    // Only a currency code is handed to the known app origin; no destination comes from URL input.
    for (const anchor of document.querySelectorAll("a[href]")) {
      let destination;
      try { destination = new URL(anchor.getAttribute("href"), location.href); } catch { continue; }
      if (destination.origin !== "https://app.wallmock.com" || destination.username || destination.password) continue;
      destination.searchParams.delete("currency");
      anchor.href = destination.href;
    }
    document.documentElement.dataset.pricingCurrency = currency;
  }

  let request = 0;
  async function refresh() {
    const current = ++request;
    document.documentElement.dataset.pricingState = "loading";
    help.textContent = "Checking price region… USD reference prices are shown until the check completes.";
    const region = await fetchPricingRegion({ endpoint: "https://app.wallmock.com/api/pricing-region" });
    if (current !== request) return;
    paint(region?.currency ?? "usd");
    document.documentElement.dataset.pricingState = region ? "ready" : "unavailable";
    help.textContent = region ? `Cards show ${region.currency.toUpperCase()}. ${region.source === "fallback" ? "Your connection's country could not be determined, so USD prices apply." : "Price region is set automatically from your connection."} Your existing subscription keeps its billing currency. A VPN or proxy can affect the result. Other price examples are in USD. Taxes may apply at checkout.` : "USD reference prices. Price region could not be checked. The app must load prices before you can subscribe; no different amount is charged silently.";
    status.textContent = region ? `Prices shown in ${region.currency.toUpperCase()}.` : "Price region is unavailable. USD reference prices shown.";
  }
  refresh();
  window.addEventListener("pageshow", (event) => { if (event.persisted) refresh(); });
}
mount();
