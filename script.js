"use strict";

const items = document.querySelector("#items");
const template = document.querySelector("#item-template");
const addButton = document.querySelector("#add-item");
const totalOutput = document.querySelector("#grand-total");
const emptyState = document.querySelector("#empty-state");
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
  let total = 0;
  for (const row of items.rows) {
    const amount = numericValue(row.querySelector(".item-quantity")) * numericValue(row.querySelector(".item-price"));
    const valid = Number.isFinite(amount) && Number.isFinite(total + amount);
    row.querySelector(".item-price").setCustomValidity(valid ? "" : "Введите меньшее значение цены или количества.");
    row.querySelector(".item-total").textContent = valid ? formatter.format(amount) : "Слишком большое значение";
    if (valid) total += amount;
  }
  totalOutput.textContent = `${formatter.format(total)} ₸`;
  emptyState.hidden = items.rows.length > 0;
}

function addItem(focus = true) {
  const row = template.content.firstElementChild.cloneNode(true);
  items.append(row);
  recalculate();
  if (focus) row.querySelector(".item-name").focus();
}

addButton.addEventListener("click", () => addItem());
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
