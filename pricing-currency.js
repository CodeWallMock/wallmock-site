// Suggested billing currency from browser hints only: no IP lookup, GPS or exchange-rate conversion.
// A currency suggestion is not a verified location; the selector and checkout show the actual currency.
export const CURRENCIES = Object.freeze(["usd", "eur", "gbp", "cad", "aud", "inr", "brl"]);
const STORAGE_KEY = "wallmock-pricing-currency";
const euroCountries = ["AT", "BE", "BG", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES",
  "AD", "MC", "SM", "VA", "ME", "XK", "AX", "RE", "YT", "GF", "GP", "MQ", "BL", "MF", "PM", "TF"];
const countryCurrencies = Object.freeze(Object.fromEntries([
  ...euroCountries.map((code) => [code, "eur"]),
  ...["US", "PR", "GU", "VI", "AS", "MP", "UM"].map((code) => [code, "usd"]),
  ...["GB", "GG", "JE", "IM"].map((code) => [code, "gbp"]),
  ...["AU", "CC", "CX", "NF"].map((code) => [code, "aud"]),
  ["CA", "cad"], ["IN", "inr"], ["BR", "brl"]
]));
const zones = Object.freeze({
  eur: ["Europe/Vienna", "Europe/Brussels", "Europe/Sofia", "Europe/Zagreb", "Asia/Nicosia", "Europe/Nicosia", "Asia/Famagusta", "Europe/Tallinn", "Europe/Helsinki", "Europe/Mariehamn", "Europe/Paris", "Europe/Berlin", "Europe/Busingen", "Europe/Athens", "Europe/Dublin", "Europe/Rome", "Europe/Riga", "Europe/Vilnius", "Europe/Luxembourg", "Europe/Malta", "Europe/Amsterdam", "Europe/Lisbon", "Atlantic/Madeira", "Atlantic/Azores", "Europe/Bratislava", "Europe/Ljubljana", "Europe/Madrid", "Atlantic/Canary", "Africa/Ceuta", "Europe/Andorra", "Europe/Monaco", "Europe/San_Marino", "Europe/Vatican", "Europe/Podgorica", "Indian/Reunion", "Indian/Mayotte", "America/Cayenne", "America/Guadeloupe", "America/Martinique", "America/St_Barthelemy", "America/Marigot", "America/Miquelon"],
  gbp: ["Europe/London", "Europe/Guernsey", "Europe/Jersey", "Europe/Isle_of_Man", "GB", "GB-Eire"],
  cad: ["America/Toronto", "America/Vancouver", "America/Edmonton", "America/Winnipeg", "America/Halifax", "America/St_Johns", "America/Regina", "America/Whitehorse", "America/Dawson", "America/Dawson_Creek", "America/Fort_Nelson", "America/Creston", "America/Blanc-Sablon", "America/Atikokan", "America/Iqaluit", "America/Rankin_Inlet", "America/Resolute", "America/Cambridge_Bay", "America/Inuvik", "America/Yellowknife", "America/Moncton", "America/Thunder_Bay", "America/Rainy_River", "America/Swift_Current", "America/Pangnirtung", "America/Nipigon", "America/Montreal", "America/Glace_Bay", "America/Goose_Bay"],
  inr: ["Asia/Kolkata", "Asia/Calcutta"],
  brl: ["America/Sao_Paulo", "America/Manaus", "America/Fortaleza", "America/Recife", "America/Belem", "America/Bahia", "America/Araguaina", "America/Maceio", "America/Campo_Grande", "America/Cuiaba", "America/Porto_Velho", "America/Rio_Branco", "America/Boa_Vista", "America/Eirunepe", "America/Santarem", "America/Noronha", "America/Porto_Acre"],
  aud: ["Indian/Christmas", "Indian/Cocos", "Pacific/Norfolk"]
});
const zoneCurrencies = new Map(Object.entries(zones).flatMap(([currency, names]) => names.map((name) => [name, currency])));
const normalized = (value) => typeof value === "string" ? value.toLowerCase() : null;
const supported = (value) => CURRENCIES.includes(normalized(value)) ? normalized(value) : null;

export function regionalCurrency({ country, timeZone, languages = [] } = {}) {
  // An explicit region, when available, is stronger than a language preference. Unknown regions use USD.
  if (typeof country === "string" && /^[A-Za-z]{2}$/.test(country)) return countryCurrencies[country.toUpperCase()] ?? "usd";
  if (typeof timeZone === "string") {
    if (zoneCurrencies.has(timeZone)) return zoneCurrencies.get(timeZone);
    if (/^Australia\//.test(timeZone)) return "aud";
    if (/^Brazil\//.test(timeZone)) return "brl";
    if (/^Canada\//.test(timeZone)) return "cad";
    // A region-bearing unsupported zone (e.g. Zurich) must not become EUR because the language is German.
    if (/^[A-Za-z_]+\/[A-Za-z_+-]+(?:\/[A-Za-z_+-]+)?$/.test(timeZone) && !timeZone.startsWith("Etc/")) return "usd";
  }
  for (const language of Array.isArray(languages) ? languages : []) {
    try {
      const region = new Intl.Locale(language).region;
      if (region) return countryCurrencies[region] ?? "usd";
    } catch {}
  }
  return "usd";
}

export function currencyFromUrl() {
  try {
    const values = new URLSearchParams(location.search).getAll("currency");
    return values.length === 1 ? supported(values[0]) : null;
  } catch { return null; }
}

// Capture a valid website handoff when this module first loads, before internal navigation or authentication removes it.
let incomingCurrency = currencyFromUrl();
if (incomingCurrency) {
  try { localStorage.setItem(STORAGE_KEY, incomingCurrency); } catch {}
}

export function saveCurrency(currency) {
  const code = supported(currency);
  if (!code) return;
  incomingCurrency = code;
  try { localStorage.setItem(STORAGE_KEY, code); } catch {}
  // A later manual choice must also replace an older query choice; preserve path, attribution and router state.
  try {
    const url = new URL(location.href);
    url.searchParams.set("currency", code);
    history.replaceState(history.state, "", url.href);
  } catch {}
}

export function preferredCurrency(fixedCurrency, allowed = CURRENCIES, hints) {
  const fixed = normalized(fixedCurrency);
  if (fixed && /^[a-z]{3}$/.test(fixed) && allowed.includes(fixed)) return fixed;
  const available = CURRENCIES.filter((currency) => allowed.includes(currency));
  const handoff = currencyFromUrl() ?? incomingCurrency;
  if (handoff && available.includes(handoff)) return handoff;
  let saved;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch {}
  if (available.includes(saved)) return saved;
  let timeZone;
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {}
  const suggested = regionalCurrency(hints ?? { timeZone, languages: typeof navigator === "undefined" ? [] : navigator.languages });
  return available.includes(suggested) ? suggested : available.includes("usd") ? "usd" : available[0] ?? "usd";
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

export function currencyControl(h, currency, onChange, allowed = CURRENCIES, fixed = false) {
  const select = h("select", { "aria-label": "Pricing currency", "data-key": "pricing-currency", disabled: fixed }, ...allowed.map((code) => h("option", { value: code, selected: code === currency }, code.toUpperCase())));
  select.addEventListener("change", () => { if (allowed.includes(select.value)) { saveCurrency(select.value); onChange(select.value); } });
  return h("label", { class: "pricing-currency-control" }, "Currency ", select);
}
