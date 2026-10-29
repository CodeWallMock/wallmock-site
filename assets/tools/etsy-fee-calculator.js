// Browser widget for /tools/etsy-fee-calculator/. The page ships a static first state (a USD 45 US sale); this recalculates
// as the seller types. Nothing typed is sent anywhere.
import { etsyFees, feeRows, summaryText, flagText, region } from "./etsy-fees.js?v=1";

const $ = (id) => document.getElementById(id);
const val = (id) => $(id).value.trim();

function rows(r) {
  const all = feeRows(r);
  return all.map(([label, note, amount], i) => {
    const tr = document.createElement("tr");
    if (i >= all.length - 5) tr.className = "total";
    const th = document.createElement("th"); th.scope = "row";
    const small = document.createElement("small"); small.textContent = note;
    th.append(label, small);
    const td = document.createElement("td"); td.textContent = amount;
    tr.append(th, td);
    return tr;
  });
}

function currency() {
  const reg = region($("efc-region").value) ?? region("us");
  for (const el of document.querySelectorAll("#efc [data-cur]")) el.textContent = reg.currency;
  $("efc-usd-row").hidden = reg.currency === "USD";
}

function render() {
  currency();
  const sum = $("efc-sum"), flags = $("efc-flags");
  try {
    const r = etsyFees({
      region: $("efc-region").value, offsite: $("efc-offsite").value,
      price: val("efc-price"), shipping: val("efc-ship") || 0, productCost: val("efc-cost") || 0, providerShipping: val("efc-pship") || 0,
      taxPct: val("efc-tax"), vatPct: val("efc-vat"), usdRate: val("efc-usd"),
    });
    sum.textContent = summaryText(r);
    sum.className = "summary";
    const f = flagText(r);
    flags.textContent = f.join(" ");
    flags.hidden = !f.length;
    $("efc-rows").replaceChildren(...rows(r));
  } catch (e) {
    sum.textContent = e instanceof RangeError ? e.message : "Check the numbers above.";
    sum.className = "summary tool-err";
    flags.hidden = true;
    $("efc-rows").replaceChildren();
  }
}

for (const id of ["efc-price", "efc-ship", "efc-cost", "efc-pship", "efc-usd", "efc-tax", "efc-vat"]) $(id).addEventListener("input", render);
for (const id of ["efc-region", "efc-offsite"]) $(id).addEventListener("change", render);
$("efc").addEventListener("submit", (e) => e.preventDefault());
// After Back, Chrome restores the typed values (and unit) after the load event, without input events, while the page
// still shows its static answer for the defaults. Recalculate from the form now and again on pageshow, which fires after
// that restore (and on a back/forward-cache return).
render();
addEventListener("pageshow", render);
