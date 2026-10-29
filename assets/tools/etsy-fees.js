// Etsy fee and profit calculator: pure logic shared by the browser widget, the page's static first state and
// tests/etsy-fees.test.mjs. Every rate is Etsy's own, read with WebFetch on 2026-10-29 from Etsy's help pages
// (etsy.com/legal/fees refused our fetcher with HTTP 403, so the help articles are the source; see ETSY_FEES.sources):
//   - "Etsy Fee Basics": listing fee "a flat rate charge of $0.20 USD per listing"; transaction fee "6.5% of the total
//     order amount in your designated listing currency", which covers the item price plus the shipping and gift wrap
//     you charge.
//   - "What are the fees and taxes for selling on Etsy?": auto-renew sold "$0.20 per each additional quantity"; payment
//     processing is "taken from the item's total sale price, including its shipping fees, and sales tax if you charge
//     tax on the listing"; Offsite Ads "15% fee on the order total" if the shop made less than $10,000 in the past 365
//     days, 12% if it made at least $10,000, and "will never exceed $100 for an order".
//   - "What are payment processing fees for selling on Etsy?": the per-country table below (read twice, en-us and
//     en-gb, identical).
//   - "What is a Regulatory Operating Fee?": the per-country percentages below, charged "on the item price and shipping
//     costs (including gift wrap ...)".
// Not computed, because Etsy's help pages give no base or amount for them: the 2.5% currency conversion fee, shipping
// labels, the one-time shop set-up fee and VAT on fees (the seller types their own VAT rate if it applies).
//
// Money is per order of one item. Amounts are in the shop's currency: the currency of the chosen payment-processing
// region. Etsy states the listing fee and the Offsite Ads cap in US dollars, so a non-USD shop must type today's
// exchange rate to include them; without it the listing fee is left out and flagged, never guessed.

export const ETSY_FEES = {
  checked: "2026-10-29",
  listingUsd: 0.2,
  transactionPct: 6.5,
  offsite: { under: 15, over: 12, thresholdUsd: 10000, capUsd: 100 },
  policy: "https://www.etsy.com/legal/fees/",
  sources: {
    basics: "https://help.etsy.com/hc/en-us/articles/360035902374-Etsy-Fee-Basics",
    fees: "https://help.etsy.com/hc/en-us/articles/115014483627-What-are-the-Fees-and-Taxes-for-Selling-on-Etsy",
    processing: "https://help.etsy.com/hc/en-us/articles/115015628847-What-are-Payment-Processing-Fees-for-Selling-on-Etsy",
    offsite: "https://help.etsy.com/hc/en-us/articles/360000338367-How-Etsy-s-Offsite-Ads-Work",
    regulatory: "https://help.etsy.com/hc/en-us/articles/1500011073202-What-is-a-Regulatory-Operating-Fee",
  },
};

// Regulatory operating fee by country, % of item price plus shipping (Etsy help, 2026-10-29).
const ROF = { CA: 0.5, FR: 1.14, HU: 1.97, IT: 0.8, IN: 0.05, ES: 0.88, TR: 1.67, GB: 0.48, VN: 1.24 };

// Payment processing by the country of the seller's bank account: [id, name, %, fixed, currency, ROF country].
const ROWS = [
  ["ar", "Argentina", 6.5, 0.3, "USD"], ["au", "Australia (domestic orders)", 3, 0.25, "AUD"], ["au-intl", "Australia (international orders)", 4, 0.25, "AUD"],
  ["at", "Austria", 4, 0.3, "EUR"], ["be", "Belgium", 4, 0.3, "EUR"], ["br", "Brazil", 6.5, 0.3, "USD"], ["bg", "Bulgaria", 4, 0.3, "EUR"],
  ["ca", "Canada (domestic orders or orders from the US)", 3, 0.25, "CAD", "CA"], ["ca-intl", "Canada (international orders)", 4, 0.25, "CAD", "CA"],
  ["cl", "Chile", 6.5, 0.3, "USD"], ["cn", "China", 6.5, 0.3, "USD"], ["hr", "Croatia", 4, 0.3, "EUR"], ["cy", "Cyprus", 4, 0.3, "EUR"],
  ["cz", "Czech Republic", 4, 0.3, "EUR"], ["dk", "Denmark", 4, 2.5, "DKK"], ["eg", "Egypt", 6.5, 0.3, "USD"], ["ee", "Estonia", 4, 0.3, "EUR"],
  ["fi", "Finland", 4, 0.3, "EUR"], ["fr", "France", 4, 0.3, "EUR", "FR"], ["ge", "Georgia", 6.5, 0.3, "USD"], ["de", "Germany", 4, 0.3, "EUR"],
  ["gr", "Greece", 4, 0.3, "EUR"], ["hk", "Hong Kong", 4.4, 2, "HKD"], ["hu", "Hungary", 4, 0.3, "EUR", "HU"], ["in", "India", 5, 25, "INR", "IN"],
  ["id", "Indonesia", 4.5, 7000, "IDR"], ["ie", "Ireland", 4, 0.3, "EUR"], ["il", "Israel", 4.5, 2, "ILS"], ["it", "Italy", 4, 0.3, "EUR", "IT"],
  ["jp", "Japan", 6, 0.3, "USD"], ["kz", "Kazakhstan", 6.5, 0.3, "USD"], ["lv", "Latvia", 4, 0.3, "EUR"], ["lt", "Lithuania", 4, 0.3, "EUR"],
  ["lu", "Luxembourg", 4, 0.3, "EUR"], ["my", "Malaysia", 4.5, 2, "MYR"], ["mt", "Malta", 4, 0.3, "EUR"], ["mx", "Mexico", 4.5, 8, "MXN"],
  ["ma", "Morocco", 4.5, 5, "MAD"], ["nl", "Netherlands", 4, 0.3, "EUR"], ["nz", "New Zealand (domestic orders)", 3, 0.3, "NZD"],
  ["nz-intl", "New Zealand (international orders)", 4, 0.3, "NZD"], ["no", "Norway", 4, 2.5, "NOK"], ["pk", "Pakistan", 6.5, 0.3, "USD"],
  ["pe", "Peru", 6.5, 0.3, "USD"], ["ph", "Philippines", 4.5, 25, "PHP"], ["pl", "Poland", 4, 0.3, "EUR"], ["pt", "Portugal", 4, 0.3, "EUR"],
  ["ro", "Romania", 4, 0.3, "EUR"], ["rs", "Serbia", 6.5, 0.3, "USD"], ["sg", "Singapore", 4.4, 0.35, "SGD"], ["sk", "Slovakia", 4, 0.3, "EUR"],
  ["si", "Slovenia", 4, 0.3, "EUR"], ["za", "South Africa", 4.5, 8, "ZAR"], ["kr", "South Korea", 6.5, 0.3, "USD"], ["es", "Spain", 4, 0.3, "EUR", "ES"],
  ["se", "Sweden", 4, 3, "SEK"], ["ch", "Switzerland", 4, 0.5, "CHF"], ["th", "Thailand", 6, 0.3, "USD"], ["tr", "Türkiye", 6.5, 14, "TRY", "TR"],
  ["ua", "Ukraine", 6, 0.3, "USD"], ["ae", "United Arab Emirates", 6.5, 0.3, "USD"], ["gb", "United Kingdom", 4, 0.2, "GBP", "GB"],
  ["us", "United States", 3, 0.25, "USD"], ["vn", "Vietnam", 4.5, 11500, "VND", "VN"],
];

export const REGIONS = ROWS.map(([id, name, pct, fixed, currency, rofCountry]) => ({ id, name, pct, fixed, currency, rofPct: rofCountry ? ROF[rofCountry] : 0 }));
export const region = (id) => REGIONS.find((r) => r.id === id);

export const OFFSITE = [
  { id: "none", label: "No" },
  { id: "under", label: `Yes: ${ETSY_FEES.offsite.under}% (shop made under USD 10,000 in the past 365 days)` },
  { id: "over", label: `Yes: ${ETSY_FEES.offsite.over}% (shop made USD 10,000 or more in the past 365 days)` },
];

/** Round to cents, half away from zero, without binary drift (2.925 -> 2.93). */
export const cents = (v) => Math.sign(v) * Math.round(Math.abs(v) * 100 + 1e-7) / 100;

const num = (v) => (v === "" || v === null || v === undefined ? NaN : Number(v));

/** Check and normalise an input. Throws RangeError with a plain message on bad input. */
export function normalise(input) {
  const r = region(input.region ?? "us");
  if (!r) throw new RangeError("Choose the country of your bank account.");
  const price = num(input.price), shipping = num(input.shipping ?? 0);
  if (!(Number.isFinite(price) && price > 0 && price <= 1e9)) throw new RangeError("Enter an item price above 0.");
  const productCost = num(input.productCost ?? 0), providerShipping = num(input.providerShipping ?? 0);
  for (const [v, what] of [[shipping, "shipping you charge"], [productCost, "provider's product cost"], [providerShipping, "provider's shipping cost"]]) {
    if (!(Number.isFinite(v) && v >= 0 && v <= 1e9)) throw new RangeError(`Enter the ${what} as a number of 0 or more.`);
  }
  const offsite = input.offsite ?? "none";
  if (!OFFSITE.some((o) => o.id === offsite)) throw new RangeError("Choose whether the sale came from an Offsite Ad.");
  const taxPct = Number.isFinite(num(input.taxPct)) ? num(input.taxPct) : 0;
  const vatPct = Number.isFinite(num(input.vatPct)) ? num(input.vatPct) : 0;
  if (taxPct < 0 || taxPct > 100) throw new RangeError("Enter a tax rate from 0 to 100%.");
  if (vatPct < 0 || vatPct > 100) throw new RangeError("Enter a VAT rate from 0 to 100%.");
  // Units of the shop currency per 1 USD. USD shops need none; others give it or the USD-based amounts are flagged.
  let usdRate = r.currency === "USD" ? 1 : num(input.usdRate);
  if (!(Number.isFinite(usdRate) && usdRate > 0)) usdRate = null;
  return { region: r, price, shipping, productCost, providerShipping, offsite, taxPct, vatPct, usdRate };
}

// Fee rates as fractions of (item price + shipping), and the fixed part, for a normalised input.
function rates(n) {
  const offsitePct = n.offsite === "none" ? 0 : ETSY_FEES.offsite[n.offsite];
  return {
    transaction: ETSY_FEES.transactionPct / 100,
    processing: (n.region.pct / 100) * (1 + n.taxPct / 100), // taken from the total sale price including any sales tax
    regulatory: n.region.rofPct / 100,
    offsite: offsitePct / 100,
    offsiteCap: n.usdRate ? ETSY_FEES.offsite.capUsd * n.usdRate : Infinity, // in the shop currency; unknown -> no cap applied
    listing: n.usdRate ? ETSY_FEES.listingUsd * n.usdRate : 0,
    fixed: n.region.fixed,
    vat: n.vatPct / 100,
  };
}

/**
 * etsyFees({ price, shipping, productCost, providerShipping, region, offsite, taxPct?, vatPct?, usdRate? })
 * -> { currency, lines: [{ id, label, amount, note }], fees, revenue, costs, profit, margin, breakEven, flags }
 * Each fee line is rounded to the cent; totals add the rounded lines, so the table always adds up.
 */
export function etsyFees(input) {
  const n = normalise(input);
  const k = rates(n), base = n.price + n.shipping, r = n.region;
  const lines = [];
  lines.push({ id: "listing", label: "Listing fee", amount: n.usdRate ? cents(k.listing) : null, note: n.usdRate ? (r.currency === "USD" ? "USD 0.20: each item sold renews the listing" : `USD 0.20 at ${n.usdRate} ${r.currency} per USD; each item sold renews the listing`) : `USD 0.20: enter today's ${r.currency} per USD rate to include it` });
  lines.push({ id: "transaction", label: "Transaction fee", amount: cents(k.transaction * base), note: `${ETSY_FEES.transactionPct}% of the item price plus shipping` });
  lines.push({ id: "processing", label: "Payment processing", amount: cents(k.processing * base + k.fixed), note: `${r.pct}% + ${money(r.fixed, r.currency)} of the total sale${n.taxPct ? `, including ${n.taxPct}% tax` : ""} (${r.name})` });
  if (k.regulatory) lines.push({ id: "regulatory", label: "Regulatory operating fee", amount: cents(k.regulatory * base), note: `${r.rofPct}% of the item price plus shipping (${r.name.replace(/ \(.*\)$/, "")})` });
  let capped = false;
  if (k.offsite) {
    const raw = k.offsite * base;
    capped = raw > k.offsiteCap;
    lines.push({ id: "offsite", label: "Offsite Ads fee", amount: cents(capped ? k.offsiteCap : raw), note: `${k.offsite * 100}% of the order total${capped ? ", capped at USD 100" : n.usdRate ? ", never more than USD 100" : ""}` });
  }
  const etsy = lines.reduce((s, l) => s + (l.amount ?? 0), 0);
  if (k.vat) lines.push({ id: "vat", label: "VAT on Etsy's fees", amount: cents(k.vat * etsy), note: `${n.vatPct}% of the fees above` });
  const fees = cents(lines.reduce((s, l) => s + (l.amount ?? 0), 0));
  const revenue = cents(base), costs = cents(n.productCost + n.providerShipping);
  const profit = cents(revenue - fees - costs);
  return {
    currency: r.currency, region: r, lines, fees, revenue, costs, profit,
    margin: Math.round((profit / revenue) * 1000) / 10,
    breakEven: priceForMargin(input, 0),
    flags: { listingMissing: !n.usdRate, capUnknown: !n.usdRate && !!k.offsite, capped },
  };
}

/**
 * The lowest item price (rounded up to the cent) that leaves `marginPct` of the item price plus shipping as profit,
 * with shipping, costs and fee settings unchanged. 0 for break-even. null when fees and margin take 100% or more.
 * Solved exactly: fees are linear in the price except for the Offsite Ads cap, so try uncapped first, then capped.
 */
export function priceForMargin(input, marginPct = 0) {
  const n = normalise({ ...input, price: 1 });
  const k = rates(n), m = marginPct / 100, v = 1 + k.vat, s = n.shipping, C = n.productCost + n.providerShipping;
  // profit(P) = (P + s)(1 - m) - v * (listing + fixed + a (P + s) [+ cap]) - C = 0
  const solve = (a, extra) => { const d = 1 - m - v * a; return d > 0 ? (C + v * (k.listing + k.fixed + extra)) / d - s : null; };
  const all = k.transaction + k.processing + k.regulatory;
  let p = solve(all + k.offsite, 0);
  if (p !== null && k.offsite && k.offsite * (p + s) > k.offsiteCap) p = solve(all, k.offsiteCap);
  if (p === null) return null;
  return Math.max(0, Math.ceil(p * 100 - 1e-6) / 100);
}

/** "USD 1,234.50": the currency code, never a symbol, so every currency reads the same way. */
export function money(v, currency = "USD") {
  if (v === null || v === undefined || !Number.isFinite(v)) return "not included";
  const digits = ["IDR", "VND"].includes(currency) ? 0 : 2;
  const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${v < 0 ? "−" : ""}${currency} ${s}`;
}

/** Table rows for a result, shared by the page's first state and the widget: [label, note, amount text]. */
export function feeRows(r) {
  const c = r.currency;
  return [
    ...r.lines.map((l) => [l.label, l.note, money(l.amount, c)]),
    ["Total Etsy fees", r.flags.listingMissing ? "without the listing fee" : `${Math.round((r.fees / r.revenue) * 1000) / 10}% of the sale`, money(r.fees, c)],
    ["Your provider's cost", "product plus shipping to the buyer", money(r.costs, c)],
    [r.profit < 0 ? "Loss" : "Profit", "what you keep from the sale", money(r.profit, c)],
    ["Margin", "profit ÷ item price plus shipping", `${r.margin.toFixed(1)}%`],
    ["Break-even item price", "the lowest price that loses nothing, same shipping and costs", r.breakEven === null ? "none: fees take the whole price" : money(r.breakEven, c)],
  ];
}

/** One-line answer above the table. */
export function summaryText(r) {
  const c = r.currency;
  const head = r.profit < 0 ? `A loss of ${money(-r.profit, c)} on this sale` : `${money(r.profit, c)} profit on this sale (${r.margin.toFixed(1)}% margin)`;
  const be = r.breakEven === null ? "" : ` Break-even price: ${money(r.breakEven, c)}.`;
  return `${head}, after ${money(r.fees, c)} in Etsy fees.${be}`;
}

/** Plain warnings for missing or capped amounts. */
export function flagText(r) {
  const out = [];
  if (r.flags.listingMissing) out.push(`Etsy charges the listing fee in US dollars. Enter how many ${r.currency} one US dollar costs today to include it.`);
  if (r.flags.capUnknown) out.push(`The Offsite Ads fee is capped at USD 100 an order; with no exchange rate the cap isn't applied.`);
  if (r.flags.capped) out.push("This order hits the Offsite Ads cap of USD 100.");
  return out;
}
