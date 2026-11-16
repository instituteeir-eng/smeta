"use strict";

const items = document.querySelector("#items");
const template = document.querySelector("#item-template");
const addButton = document.querySelector("#add-item");
const totalOutput = document.querySelector("#grand-total");
const emptyState = document.querySelector("#empty-state");
const discountInput = document.querySelector("#discount");
const vatInput = document.querySelector("#vat");
const currencyInput = document.querySelector("#currency");
const formatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

// Local calendar date avoids a date shift caused by converting to UTC.
const today = new Date();
document.querySelector("#estimate-date").value = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0")
].join("-");

function numericValue(input) {
  const value = Number(input.value);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function recalculate() {
  const currency = currencyInput.value;
  const money = (value) => `${formatter.format(value)} ${currency}`;
  document.querySelectorAll("[data-currency]").forEach((label) => { label.textContent = currency; });
  let total = 0;
  for (const row of items.rows) {
    const amount = numericValue(row.querySelector(".item-quantity")) * numericValue(row.querySelector(".item-price"));
    const valid = Number.isFinite(amount) && Number.isFinite(total + amount);
    row.querySelector(".item-price").setCustomValidity(valid ? "" : "Введите меньшее значение цены или количества.");
    row.querySelector(".item-price").setAttribute("aria-label", `Цена, ${currency}`);
    row.querySelector(".item-total").textContent = valid ? money(amount) : "Слишком большое значение";
    if (valid) total += amount;
  }
  const discount = total * (Math.min(100, numericValue(discountInput)) / 100);
  const afterDiscount = total - discount;
  const vat = afterDiscount * (Math.min(100, numericValue(vatInput)) / 100);
  document.querySelector("#subtotal").textContent = money(total);
  document.querySelector("#discount-amount").textContent = `−${money(discount)}`;
  document.querySelector("#after-discount").textContent = money(afterDiscount);
  document.querySelector("#vat-amount").textContent = money(vat);
  document.querySelector("#discount-row").hidden = discount === 0;
  document.querySelector("#vat-row").hidden = vat === 0;
  totalOutput.textContent = Number.isFinite(afterDiscount + vat) ? money(afterDiscount + vat) : "Слишком большое значение";
  emptyState.hidden = items.rows.length > 0;
}

function addItem(focus = true) {
  const row = template.content.firstElementChild.cloneNode(true);
  items.append(row);
  recalculate();
  if (focus) row.querySelector(".item-name").focus();
}

addButton.addEventListener("click", () => addItem());
discountInput.addEventListener("input", recalculate);
vatInput.addEventListener("input", recalculate);
currencyInput.addEventListener("change", recalculate);
items.addEventListener("input", recalculate);
items.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-button");
  if (!button) return;
  const row = button.closest("tr");
  const nextRow = row.nextElementSibling || row.previousElementSibling;
  row.remove();
  recalculate();
  if (nextRow) nextRow.querySelector(".item-name").focus();
  else addButton.focus();
});
items.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.matches("input") && !event.isComposing) {
    event.preventDefault();
    if (!event.repeat) addItem();
  }
});

addItem(false);

// Build a text-only snapshot so printing includes full values, not input boxes.
function preparePrint() {
  const printView = document.querySelector("#print-estimate");
  printView.replaceChildren();
  const heading = document.createElement("h1");
  const number = document.querySelector("#estimate-number").value.trim() || "—";
  const date = document.querySelector("#estimate-date").value;
  heading.textContent = `Смета № ${number} от ${date ? date.split("-").reverse().join(".") : "—"}`;
  printView.append(heading);
  for (const [label, selector] of [["От кого", "#sender"], ["Для кого", "#recipient"]]) {
    const paragraph = document.createElement("p");
    paragraph.textContent = `${label}: ${document.querySelector(selector).value.trim() || "—"}`;
    printView.append(paragraph);
  }

  const table = document.querySelector(".table-wrap table").cloneNode(true);
  table.querySelectorAll("input").forEach((input) => {
    const text = document.createElement("span");
    text.textContent = input.value || (input.type === "number" ? "0" : "—");
    input.replaceWith(text);
  });
  table.querySelectorAll(".mobile-label, .remove-cell, th:last-child, caption").forEach((element) => element.remove());
  printView.append(table);

  const totals = document.createElement("div");
  totals.className = "print-totals";
  totals.append(document.querySelector(".summary").cloneNode(true), document.querySelector(".total-bar").cloneNode(true));
  printView.append(totals);
  const signature = document.createElement("p");
  signature.className = "print-signature";
  signature.textContent = "Подпись: __________________________";
  printView.append(signature);
  // Avoid duplicate IDs and live announcements from the print-only snapshot.
  printView.querySelectorAll("[id], [aria-live]").forEach((element) => {
    element.removeAttribute("id");
    element.removeAttribute("aria-live");
  });
}

document.querySelector("#save-pdf").addEventListener("click", () => {
  preparePrint();
  window.print();
});
// Also refresh the snapshot when printing with the browser menu or Ctrl+P.
window.addEventListener("beforeprint", preparePrint);
