"use strict";

const items = document.querySelector("#items");
const template = document.querySelector("#item-template");
const addButton = document.querySelector("#add-item");
const totalOutput = document.querySelector("#grand-total");
const amountWordsOutput = document.querySelector("#amount-words");
const emptyState = document.querySelector("#empty-state");
const discountInput = document.querySelector("#discount");
const vatInput = document.querySelector("#vat");
const currencyInput = document.querySelector("#currency");
const catalogSelect = document.querySelector("#catalog-service");
const formatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const draftKey = "smeta-5-minutes.draft.v1";
const senderKey = "smeta-5-minutes.sender.v1";
const draftFields = ["sender", "recipient", "estimate-number", "estimate-date", "discount", "vat", "currency"];
const itemFields = ["item-name", "item-quantity", "item-unit", "item-price"];
let draftReady = false;

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

function amountInWords(value, currency) {
  if (currency !== "₸" || !Number.isFinite(value) || value <= 0 || value > 999999999) return "";
  // Use the same monetary rounding as the displayed total, without changing calculations.
  const parts = formatter.formatToParts(value);
  const integer = Number(parts.filter((part) => part.type === "integer").map((part) => part.value).join(""));
  const fraction = (parts.find((part) => part.type === "fraction")?.value || "").padEnd(2, "0");
  if (integer === 0 && fraction === "00") return "";
  const units = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
  const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];
  const words = [];
  function group(number, feminine, forms) {
    if (!number) return;
    words.push(hundreds[Math.floor(number / 100)]);
    const remainder = number % 100;
    if (remainder >= 10 && remainder <= 19) words.push(teens[remainder - 10]);
    else {
      const unit = number % 10;
      words.push(tens[Math.floor(remainder / 10)], feminine && unit === 1 ? "одна" : feminine && unit === 2 ? "две" : units[unit]);
    }
    if (forms) {
      const unit = number % 10;
      words.push(forms[remainder >= 11 && remainder <= 14 ? 2 : unit === 1 ? 0 : unit >= 2 && unit <= 4 ? 1 : 2]);
    }
  }
  group(Math.floor(integer / 1000000), false, ["миллион", "миллиона", "миллионов"]);
  group(Math.floor(integer / 1000) % 1000, true, ["тысяча", "тысячи", "тысяч"]);
  group(integer % 1000, false);
  if (!integer) words.push("ноль");
  words.push("тенге");
  if (fraction !== "00") words.push(fraction, "тиын");
  const text = words.filter(Boolean).join(" ");
  return text[0].toUpperCase() + text.slice(1);
}

function recalculate() {
  const currency = currencyInput.value;
  const money = (value) => `${formatter.format(value)} ${currency}`;
  document.querySelectorAll("[data-currency]").forEach((label) => { label.textContent = currency; });
  for (const option of catalogSelect.options) {
    option.textContent = `${option.dataset.name} — ${money(Number(option.dataset.price))}`;
  }
  let total = 0;
  let amountsValid = true;
  for (const row of items.rows) {
    const amount = numericValue(row.querySelector(".item-quantity")) * numericValue(row.querySelector(".item-price"));
    const valid = Number.isFinite(amount) && Number.isFinite(total + amount);
    row.querySelector(".item-price").setCustomValidity(valid ? "" : "Введите меньшее значение цены или количества.");
    row.querySelector(".item-price").setAttribute("aria-label", `Цена, ${currency}`);
    row.querySelector(".item-total").textContent = valid ? money(amount) : "Слишком большое значение";
    if (valid) total += amount;
    else amountsValid = false;
  }
  const discount = total * (Math.min(100, numericValue(discountInput)) / 100);
  const afterDiscount = total - discount;
  const vat = afterDiscount * (Math.min(100, numericValue(vatInput)) / 100);
  document.querySelector("#subtotal").textContent = amountsValid ? money(total) : "Слишком большое значение";
  document.querySelector("#discount-amount").textContent = amountsValid ? `−${money(discount)}` : "—";
  document.querySelector("#after-discount").textContent = amountsValid ? money(afterDiscount) : "—";
  document.querySelector("#vat-amount").textContent = amountsValid ? money(vat) : "—";
  document.querySelector("#discount-row").hidden = discount === 0;
  document.querySelector("#vat-row").hidden = vat === 0;
  totalOutput.textContent = amountsValid && Number.isFinite(afterDiscount + vat) ? money(afterDiscount + vat) : "Слишком большое значение";
  const words = amountsValid ? amountInWords(afterDiscount + vat, currency) : "";
  amountWordsOutput.textContent = words ? `Сумма прописью: ${words}` : "";
  amountWordsOutput.hidden = !words;
  emptyState.hidden = items.rows.length > 0;
  if (draftReady) saveDraft();
}

function addItem(focus = true, service = null) {
  const row = template.content.firstElementChild.cloneNode(true);
  if (service) {
    row.querySelector(".item-name").value = service.name;
    row.querySelector(".item-quantity").value = "1";
    row.querySelector(".item-price").value = service.price;
  }
  items.append(row);
  recalculate();
  if (focus) row.querySelector(".item-name").focus();
}

addButton.addEventListener("click", () => addItem());
document.querySelector("#add-catalog-item").addEventListener("click", () => {
  const selected = catalogSelect.selectedOptions[0];
  if (selected) addItem(true, selected.dataset);
});
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

restoreDraft();
draftReady = true;

document.querySelector(".details-grid").addEventListener("input", saveDraft);
document.querySelector(".details-grid").addEventListener("change", saveDraft);

// Read separately from the draft, including after it has been cleared.
function readSender() {
  const saved = localStorage.getItem(senderKey);
  if (saved === null) return null;
  const details = JSON.parse(saved);
  if (!details || details.version !== 1 || typeof details.sender !== "string" || !details.sender.trim()) {
    throw new Error("Invalid sender details");
  }
  return details.sender;
}

const senderStatus = document.querySelector("#sender-status");
try {
  const saved = readSender();
  senderStatus.textContent = saved === null ? "Реквизиты ещё не сохранены." : `Сохранено: ${saved}`;
} catch {
  senderStatus.textContent = "Не удалось прочитать реквизиты. Сохранённые данные не изменены.";
}

document.querySelector("#save-sender").addEventListener("click", () => {
  const sender = document.querySelector("#sender").value;
  if (!sender.trim()) {
    senderStatus.textContent = "Заполните поле «От кого», затем сохраните реквизиты.";
    document.querySelector("#sender").focus();
    return;
  }
  try {
    const previous = localStorage.getItem(senderKey);
    const next = JSON.stringify({ version: 1, sender });
    if (previous !== null && previous !== next && !window.confirm("Заменить сохранённые реквизиты данными поля «От кого»?")) return;
    localStorage.setItem(senderKey, next);
    senderStatus.textContent = `Реквизиты сохранены: ${sender}`;
  } catch {
    senderStatus.textContent = "Не удалось сохранить реквизиты. Хранилище браузера недоступно или заполнено.";
  }
});

document.querySelector("#apply-sender").addEventListener("click", () => {
  try {
    const saved = readSender();
    if (saved === null) {
      senderStatus.textContent = "Сначала заполните поле «От кого» и сохраните реквизиты.";
      return;
    }
    const input = document.querySelector("#sender");
    if (input.value && input.value !== saved && !window.confirm("Заменить поле «От кого» сохранёнными реквизитами?")) return;
    input.value = saved;
    saveDraft();
    senderStatus.textContent = "Реквизиты применены к этой смете.";
  } catch {
    senderStatus.textContent = "Не удалось прочитать реквизиты. Поле «От кого» не изменено.";
  }
});

function captureEstimate() {
  return {
    version: 1,
    fields: Object.fromEntries(draftFields.map((id) => [id, document.getElementById(id).value])),
    items: Array.from(items.rows, (row) => Object.fromEntries(itemFields.map((name) => [name, row.querySelector(`.${name}`).value])))
  };
}

function saveDraft() {
  const draft = captureEstimate();
  try {
    localStorage.setItem(draftKey, JSON.stringify(draft));
    document.querySelector("#draft-status").textContent = "Черновик сохранён в этом браузере.";
  } catch {
    document.querySelector("#draft-status").textContent = "Не удалось сохранить черновик. Хранилище браузера недоступно или заполнено; после обновления изменения могут потеряться.";
  }
  // Do not leave an outdated manual-copy text visible after edits.
  document.querySelector("#manual-copy").hidden = true;
  document.querySelector("#copy-status").textContent = "";
}

function restoreDraft() {
  try {
    const saved = localStorage.getItem(draftKey);
    if (!saved) { addItem(false); return; }
    const draft = JSON.parse(saved);
    if (draft.version !== 1 || !draft.fields || !Array.isArray(draft.items)
      || !draftFields.every((id) => typeof draft.fields[id] === "string")
      || !["₸", "₽", "$", "€"].includes(draft.fields.currency)
      || !draft.items.every((row) => row && itemFields.every((name) => typeof row[name] === "string"))) {
      throw new Error("Invalid draft");
    }
    draftFields.forEach((id) => { document.getElementById(id).value = draft.fields[id]; });
    items.replaceChildren();
    for (const savedRow of draft.items) {
      const row = template.content.firstElementChild.cloneNode(true);
      itemFields.forEach((name) => { row.querySelector(`.${name}`).value = savedRow[name]; });
      items.append(row);
    }
    recalculate();
    document.querySelector("#draft-status").textContent = "Черновик восстановлен.";
  } catch {
    addItem(false);
    document.querySelector("#draft-status").textContent = "Не удалось прочитать черновик. Открыта новая смета; сохранение может быть недоступно.";
  }
}

document.querySelector("#clear-draft").addEventListener("click", () => {
  if (!window.confirm("Удалить сохранённый черновик и очистить смету?")) return;
  try {
    localStorage.removeItem(draftKey);
  } catch {
    document.querySelector("#draft-status").textContent = "Не удалось удалить черновик из хранилища. Смета не очищена.";
    return;
  }
  draftReady = false;
  draftFields.forEach((id) => { document.getElementById(id).value = ""; });
  discountInput.value = "0";
  vatInput.value = "0";
  currencyInput.value = "₸";
  items.replaceChildren();
  recalculate();
  draftReady = true;
  document.querySelector("#print-estimate").replaceChildren();
  document.querySelector("#manual-copy").hidden = true;
  document.querySelector("#whatsapp-text").value = "";
  document.querySelector("#copy-status").textContent = "";
  document.querySelector("#draft-status").textContent = "Черновик удалён. Новые изменения будут сохраняться автоматически.";
  document.querySelector("#sender").focus();
});

function whatsappText() {
  const value = (id) => document.getElementById(id).value.trim() || "—";
  const date = document.querySelector("#estimate-date").value;
  const lines = [
    `Смета № ${value("estimate-number")} от ${date ? date.split("-").reverse().join(".") : "—"}`,
    `От кого: ${value("sender")}`,
    `Для кого: ${value("recipient")}`, "", "Позиции:"
  ];
  Array.from(items.rows).forEach((row, index) => {
    const name = row.querySelector(".item-name").value.trim() || "Без названия";
    const unit = row.querySelector(".item-unit").value.trim();
    const quantity = formatter.format(numericValue(row.querySelector(".item-quantity")));
    const price = formatter.format(numericValue(row.querySelector(".item-price")));
    lines.push(`${index + 1}. ${name}`, `   ${quantity}${unit ? ` ${unit}` : ""} × ${price} ${currencyInput.value} = ${row.querySelector(".item-total").textContent}`);
  });
  if (!items.rows.length) lines.push("Нет позиций");
  lines.push("", `Сумма позиций: ${document.querySelector("#subtotal").textContent}`);
  if (!document.querySelector("#discount-row").hidden) lines.push(`Скидка (${formatter.format(Math.min(100, numericValue(discountInput)))}%): ${document.querySelector("#discount-amount").textContent}`);
  lines.push(`Сумма после скидки: ${document.querySelector("#after-discount").textContent}`);
  if (!document.querySelector("#vat-row").hidden) lines.push(`НДС (${formatter.format(Math.min(100, numericValue(vatInput)))}%): ${document.querySelector("#vat-amount").textContent}`);
  lines.push(`Итого к оплате: ${totalOutput.textContent}`);
  if (!amountWordsOutput.hidden) lines.push(amountWordsOutput.textContent);
  return lines.join("\n");
}

function selectCopyText() {
  const text = document.querySelector("#whatsapp-text");
  text.focus();
  text.select();
  text.setSelectionRange(0, text.value.length);
}

document.querySelector("#copy-whatsapp").addEventListener("click", async () => {
  const text = whatsappText();
  try {
    await navigator.clipboard.writeText(text);
    document.querySelector("#manual-copy").hidden = true;
    document.querySelector("#copy-status").textContent = "Смета скопирована. Вставьте её в нужный чат WhatsApp.";
  } catch {
    document.querySelector("#whatsapp-text").value = text;
    document.querySelector("#manual-copy").hidden = false;
    document.querySelector("#copy-status").textContent = "Автоматическое копирование недоступно. Скопируйте текст ниже вручную.";
    selectCopyText();
  }
});
document.querySelector("#select-copy-text").addEventListener("click", selectCopyText);
document.querySelector("#close-copy").addEventListener("click", () => {
  document.querySelector("#manual-copy").hidden = true;
  document.querySelector("#copy-whatsapp").focus();
});

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
  totals.append(amountWordsOutput.cloneNode(true));
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

const historyKey = "smeta-5-minutes.history.v1";
const historyStatus = document.querySelector("#history-status");
const historyList = document.querySelector("#history-list");

// Validate on detached controls before touching the form or stored draft.
function validateEstimate(estimate) {
  if (!estimate || estimate.version !== 1 || !estimate.fields || !Array.isArray(estimate.items)
    || !draftFields.every((id) => typeof estimate.fields[id] === "string")
    || !["₸", "₽", "$", "€"].includes(estimate.fields.currency)
    || !estimate.items.every((row) => row && itemFields.every((name) => typeof row[name] === "string"))) {
    throw new Error("Invalid estimate");
  }
  function number(value, maximum = Infinity) {
    const input = document.createElement("input");
    input.type = "number";
    input.value = value;
    const result = Number(value);
    if ((value !== "" && input.value === "") || !Number.isFinite(result) || result < 0 || result > maximum) {
      throw new Error("Invalid number");
    }
    return result;
  }
  const date = document.createElement("input");
  date.type = "date";
  date.value = estimate.fields["estimate-date"];
  if (date.value !== estimate.fields["estimate-date"]) throw new Error("Invalid date");
  let subtotal = 0;
  for (const row of estimate.items) {
    subtotal += number(row["item-quantity"]) * number(row["item-price"]);
    if (!Number.isFinite(subtotal)) throw new Error("Overflow");
  }
  const afterDiscount = subtotal - subtotal * (number(estimate.fields.discount, 100) / 100);
  const total = afterDiscount + afterDiscount * (number(estimate.fields.vat, 100) / 100);
  if (!Number.isFinite(total)) throw new Error("Overflow");
  return total;
}

function readHistory() {
  const raw = localStorage.getItem(historyKey);
  if (raw === null) return [];
  const history = JSON.parse(raw);
  if (!history || history.version !== 1 || !Array.isArray(history.entries)) throw new Error("Invalid history");
  const ids = new Set();
  for (const entry of history.entries) {
    if (!entry || typeof entry.id !== "string" || !entry.id || ids.has(entry.id)
      || typeof entry.savedAt !== "string" || !Number.isFinite(Date.parse(entry.savedAt))) throw new Error("Invalid entry");
    ids.add(entry.id);
    validateEstimate(entry.estimate);
  }
  return history.entries;
}

function renderHistory(entries) {
  const fragment = document.createDocumentFragment();
  for (const entry of entries) {
    const fields = entry.estimate.fields;
    const item = document.createElement("li");
    item.className = "history-entry";
    const heading = document.createElement("h3");
    heading.textContent = fields["estimate-number"].trim() || "Без номера";
    const client = document.createElement("p");
    client.textContent = fields.recipient.trim() || "Клиент не указан";
    const dates = document.createElement("p");
    dates.textContent = `Дата сметы: ${fields["estimate-date"] ? fields["estimate-date"].split("-").reverse().join(".") : "—"}. Сохранено: ${new Date(entry.savedAt).toLocaleString("ru-RU")}`;
    const total = document.createElement("p");
    total.textContent = `Итого: ${formatter.format(validateEstimate(entry.estimate))} ${fields.currency}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "add-button";
    button.textContent = "Открыть";
    button.setAttribute("aria-label", `Открыть смету ${heading.textContent}, ${client.textContent}`);
    button.addEventListener("click", () => openHistoryEstimate(entry.id));
    item.append(heading, client, dates, total, button);
    fragment.append(item);
  }
  historyList.replaceChildren(fragment);
  document.querySelector("#history-empty").hidden = entries.length > 0;
}

function openHistoryEstimate(id) {
  try {
    const entry = readHistory().find((candidate) => candidate.id === id);
    if (!entry) throw new Error("Missing entry");
    const estimate = entry.estimate;
    if (JSON.stringify(captureEstimate()) !== JSON.stringify(estimate)
      && !window.confirm("Открыть выбранную смету вместо текущей? Чтобы сохранить текущую смету, сначала добавьте её в историю")) return;
    const rows = estimate.items.map((savedRow) => {
      const row = template.content.firstElementChild.cloneNode(true);
      itemFields.forEach((name) => { row.querySelector(`.${name}`).value = savedRow[name]; });
      return row;
    });
    // Commit the draft before replacing the form. A failed write leaves it intact.
    localStorage.setItem(draftKey, JSON.stringify(estimate));
    draftFields.forEach((id) => { document.getElementById(id).value = estimate.fields[id]; });
    items.replaceChildren(...rows);
    draftReady = false;
    try { recalculate(); } finally { draftReady = true; }
    document.querySelector("#manual-copy").hidden = true;
    document.querySelector("#whatsapp-text").value = "";
    document.querySelector("#copy-status").textContent = "";
    document.querySelector("#print-estimate").replaceChildren();
    document.querySelector("#draft-status").textContent = "Открытая смета сохранена как текущий черновик.";
    historyStatus.textContent = "Смета открыта. Изменения не затрагивают её копию в истории.";
    document.querySelector("#sender").focus();
  } catch {
    historyStatus.textContent = "Не удалось открыть смету. Проверьте доступность и свободное место хранилища; данные истории могут быть повреждены. Текущая смета не изменена.";
  }
}

document.querySelector("#save-history").addEventListener("click", () => {
  const estimate = captureEstimate();
  try {
    validateEstimate(estimate);
    if (Array.from(document.querySelectorAll('.workspace input[type="number"]')).some((input) => !input.validity.valid)) {
      throw new Error("Invalid input");
    }
  } catch {
    historyStatus.textContent = "Не удалось сохранить смету. Исправьте дату, цены, количество, скидку или НДС: значения должны быть допустимыми, а суммы — конечными.";
    return;
  }
  try {
    const entries = readHistory();
    let id;
    do { id = `${Date.now()}-${Math.random().toString(36).slice(2)}`; } while (entries.some((entry) => entry.id === id));
    const next = [{ id, savedAt: new Date().toISOString(), estimate }, ...entries];
    localStorage.setItem(historyKey, JSON.stringify({ version: 1, entries: next }));
    renderHistory(next);
    historyStatus.textContent = "Копия сметы сохранена в истории.";
  } catch {
    historyStatus.textContent = "Не удалось сохранить историю. Хранилище недоступно, заполнено или содержит повреждённые данные. Ранее сохранённые записи не изменены.";
  }
});

try { renderHistory(readHistory()); } catch {
  document.querySelector("#history-empty").hidden = true;
  historyStatus.textContent = "Не удалось прочитать историю. Хранилище недоступно или данные повреждены. Сохранённые данные не изменены.";
}
