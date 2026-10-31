// Home/pricing cards use WallMock's server region and the app's shared formatter. Price data is public, approved minor units.
import { CURRENCIES, fetchPricingRegion, formatMoney } from "/pricing-currency.js?v=2";

const source = document.getElementById("pricing-amounts");
const help = document.getElementById("pricing-currency-help");
const status = document.getElementById("pricing-currency-status");

function mount() {
  if (!source || !help || !status) return;
  let plans, schemas;
  try {
    plans = JSON.parse(source.textContent);
    if (!Array.isArray(plans) || plans.length !== 2 || plans.some((p) => !["lite", "pro"].includes(p.id) || typeof p.name !== "string" || !CURRENCIES.every((c) => [p.monthlyAmounts?.[c], p.annualAmounts?.[c]].every((n) => Number.isSafeInteger(n) && n > 0)))) return;
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
      const cents = node.dataset.priceKind === "monthly" ? p.monthlyAmounts[currency] : node.dataset.priceKind === "annual" ? p.annualAmounts[currency] : Math.round(p.annualAmounts[currency] / 12);
      node.textContent = formatMoney(cents, currency);
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
