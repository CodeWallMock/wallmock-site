// Home/pricing cards share the app's exact regional resolver. Price data is public, approved minor units.
import { CURRENCIES, preferredCurrency, formatMoney, saveCurrency } from "/pricing-currency.js?v=1";

const select = document.getElementById("pricing-currency");
const source = document.getElementById("pricing-amounts");
const help = document.getElementById("pricing-currency-help");
const status = document.getElementById("pricing-currency-status");

function mount() {
  if (!select || !source || !help || !status) return;
  let plans, schemas;
  try {
    plans = JSON.parse(source.textContent);
    if (!Array.isArray(plans) || plans.length !== 2 || plans.some((p) => !["lite", "pro"].includes(p.id) || typeof p.name !== "string" || !CURRENCIES.every((c) => [p.monthlyAmounts?.[c], p.annualAmounts?.[c]].every((n) => Number.isSafeInteger(n) && n > 0)))) return;
    schemas = [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => ({ node, value: JSON.parse(node.textContent) }));
  } catch { return; } // The static USD cards remain usable if local-price data cannot load.

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

  function paint(currency, announce = false) {
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
      destination.searchParams.set("currency", currency);
      anchor.href = destination.href;
    }
    select.value = currency;
    select.disabled = false;
    help.textContent = `Cards show ${currency.toUpperCase()}. Your device region suggests a currency; you can change it here. Unsupported regions use USD. Other price examples are in USD. Taxes may apply at checkout.`;
    document.documentElement.dataset.pricingCurrency = currency;
    if (announce) status.textContent = `Prices now shown in ${currency.toUpperCase()}.`;
  }

  select.addEventListener("change", () => {
    if (!CURRENCIES.includes(select.value)) return;
    saveCurrency(select.value);
    paint(select.value, true);
  });
  const restore = () => paint(preferredCurrency(null, CURRENCIES));
  restore();
  window.addEventListener("pageshow", restore);
}
mount();
