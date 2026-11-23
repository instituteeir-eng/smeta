// Run with Node.js: node specs/002-history-tests.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('script.js', 'utf8');
new vm.Script(source);
const results = [];
const structuredClone = value => JSON.parse(JSON.stringify(value));
function test(name, run) { run(); results.push(name); }
class Element {
  constructor() { this.value = ''; this.textContent = ''; this.hidden = false; this.children = []; this.listeners = {}; this.validity = { valid: true }; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes.flatMap(n => n.fragment ? n.children : [n]); }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  setAttribute() {}
  focus() {}
  setCustomValidity(message) { this.validity.valid = !message; }
  querySelector(selector) { return this.controls[selector]; }
}
const elements = new Map();
const el = key => { if (!elements.has(key)) elements.set(key, new Element()); return elements.get(key); };
const fields = ['sender', 'recipient', 'estimate-number', 'estimate-date', 'discount', 'vat', 'currency'];
const itemFields = ['item-name', 'item-quantity', 'item-unit', 'item-price'];
function row() { const result = new Element(); result.controls = Object.fromEntries([...itemFields, 'item-total'].map(key => ['.' + key, new Element()])); return result; }
const items = el('#items');
Object.defineProperty(items, 'rows', { get() { return this.children; } });
const data = new Map();
let failRead = false, failWrite = false, confirm = true;
const storage = {
  getItem(key) { if (failRead) throw Error('unavailable'); return data.get(key) ?? null; },
  setItem(key, value) { if (failWrite) throw Error('quota'); data.set(key, value); },
  removeItem(key) { data.delete(key); }
};
const context = vm.createContext({ console, Intl, Date, Math, Set, localStorage: storage,
  window: { confirm: () => confirm, addEventListener() {} },
  document: {
    querySelector: el, getElementById: id => el('#' + id),
    querySelectorAll: selector => selector.includes('number') ? [el('#discount'), el('#vat'), ...items.rows.flatMap(r => [r.controls['.item-quantity'], r.controls['.item-price']])] : [],
    createElement: () => new Element(), createDocumentFragment: () => Object.assign(new Element(), { fragment: true })
  }
});
context.template = { content: { firstElementChild: { cloneNode: row } } };
context.items = items;
context.draftFields = fields;
context.itemFields = itemFields;
context.catalogSelect = { options: [] };
context.formatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
context.draftKey = 'draft';
context.draftReady = false;
for (const [name, id] of Object.entries({ discountInput: 'discount', vatInput: 'vat', currencyInput: 'currency', totalOutput: 'grand-total', amountWordsOutput: 'amount-words', emptyState: 'empty-state' })) context[name] = el('#' + id);
function functionSource(name) {
  const start = source.indexOf('function ' + name + '(');
  const end = source.indexOf('\n}\n', start) + 3;
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
}
vm.runInContext(['numericValue', 'amountInWords', 'recalculate', 'captureEstimate', 'saveDraft', 'whatsappText'].map(functionSource).join('\n'), context);
vm.runInContext(source.slice(source.indexOf('const historyKey =')), context);
const evaluate = code => vm.runInContext(code, context);
const key = 'smeta-5-minutes.history.v1';
const snapshot = () => JSON.parse(JSON.stringify(context.captureEstimate()));
const entries = () => JSON.parse(data.get(key)).entries;
const save = () => el('#save-history').listeners.click();
const open = id => context.openHistoryEstimate(id);
function fill(estimate) {
  fields.forEach(id => { el('#' + id).value = estimate.fields[id]; });
  items.replaceChildren(...estimate.items.map(saved => { const r = row(); itemFields.forEach(id => { r.controls['.' + id].value = saved[id]; }); return r; }));
  context.recalculate();
}
const base = { version: 1, fields: { sender: 'Исполнитель', recipient: 'Алия', 'estimate-number': 'СМ-001', 'estimate-date': '2026-11-23', discount: '0', vat: '0', currency: '₸' }, items: [
  { 'item-name': 'Дизайн', 'item-quantity': '2', 'item-unit': 'ч', 'item-price': '15000' },
  { 'item-name': 'Монтаж', 'item-quantity': '1', 'item-unit': 'шт.', 'item-price': '8000' }
] };
test('Пустая история', () => assert.equal(el('#history-empty').hidden, false));
test('Пример 1: 38 000 ₸', () => { fill(base); save(); assert.equal(context.validateEstimate(entries()[0].estimate), 38000); });
const firstId = entries()[0].id;
test('Пример 2: 37 620 ₸, одинаковые номера, независимость и порядок', () => {
  el('#discount').value = '10'; el('#vat').value = '10'; context.recalculate(); save();
  assert.equal(entries().length, 2); assert.notEqual(entries()[0].id, firstId);
  assert.equal(context.validateEstimate(entries()[0].estimate), 37620);
  assert.equal(context.validateEstimate(entries()[1].estimate), 38000);
  open(firstId); assert.deepEqual(snapshot(), base);
  open(entries()[0].id); assert.equal(el('#discount').value, '10');
});
test('Пример 3: долларовая смета и восстановление тенге', () => {
  const usd = structuredClone(base); usd.fields.currency = '$'; usd.items = [{ ...usd.items[0], 'item-quantity': '1', 'item-price': '100' }]; fill(usd); save(); const id = entries()[0].id;
  open(firstId); assert.deepEqual(snapshot(), base); open(id); assert.deepEqual(snapshot(), usd); assert.equal(el('#amount-words').hidden, true);
});
test('Отмена открытия не меняет форму и черновик', () => { const before = snapshot(), draft = data.get('draft'); confirm = false; open(firstId); assert.deepEqual(snapshot(), before); assert.equal(data.get('draft'), draft); confirm = true; });
test('Редактирование не меняет историю; реквизиты независимы', () => { const before = data.get(key); data.set('smeta-5-minutes.sender.v1', 'Реквизиты'); el('#sender').value = 'Изменено'; context.saveDraft(); assert.equal(data.get(key), before); open(firstId); assert.equal(data.get('smeta-5-minutes.sender.v1'), 'Реквизиты'); });
test('Пример 4: повторное чтение, очистка черновика, восстановление', () => {
  const before = data.get(key);
  const handler = source.slice(source.indexOf('document.querySelector("#clear-draft").addEventListener'), source.indexOf('\nfunction whatsappText'));
  evaluate(handler); el('#clear-draft').listeners.click(); assert.equal(data.get(key), before); assert.equal(items.rows.length, 0);
  evaluate('renderHistory(readHistory())'); open(firstId); assert.deepEqual(snapshot(), base); assert.deepEqual(JSON.parse(data.get('draft')), base);
});
test('Пример 5: пустая смета, подписи, 0 ₸', () => {
  const empty = structuredClone(base); fields.forEach(id => { empty.fields[id] = ''; }); empty.fields.currency = '₸'; empty.items = []; fill(empty); save();
  const item = el('#history-list').children[0]; assert.equal(item.children[0].textContent, 'Без номера'); assert.equal(item.children[1].textContent, 'Клиент не указан'); assert.equal(item.children[3].textContent, 'Итого: 0 ₸');
});
test('Ошибка чтения и квота: форма и записи остаются', () => {
  const before = data.get(key), form = snapshot();
  for (const mode of ['read', 'write']) { failRead = mode === 'read'; failWrite = mode === 'write'; save(); assert.match(el('#history-status').textContent, /Не удалось/); open(firstId); assert.deepEqual(snapshot(), form); assert.equal(data.get(key), before); }
  failRead = failWrite = false;
});
test('Повреждённый JSON, структура, повторные ID и неверные числа не перезаписываются', () => {
  const before = data.get(key), form = snapshot();
  const broken = JSON.parse(before); broken.entries[0].estimate.fields.vat = '-1';
  for (const raw of ['{', 'null', '{"version":1,"entries":[null]}', JSON.stringify(broken), JSON.stringify({version:1, entries:[entries()[0], entries()[0]]})]) {
    data.set(key, raw); save(); open(firstId); assert.equal(data.get(key), raw); assert.deepEqual(snapshot(), form); assert.match(el('#history-status').textContent, /Не удалось/);
  }
  data.set(key, before);
});
test('Отрицательные, NaN, Infinity, переполнение, ставки > 100 не сохраняются', () => {
  for (const bad of ['-1', 'NaN', 'Infinity', '1e309']) { fill(base); items.rows[0].controls['.item-price'].value = bad; const before = data.get(key); save(); assert.equal(data.get(key), before); }
  for (const target of ['discount', 'vat']) { fill(base); el('#' + target).value = '101'; const before = data.get(key); save(); assert.equal(data.get(key), before); }
  fill(base); items.rows[0].controls['.item-price'].value = '1e308'; const before = data.get(key); context.recalculate(); save(); assert.equal(data.get(key), before); assert.doesNotMatch(el('#grand-total').textContent, /NaN|Infinity/);
  fill(base); el('#vat').value = '100'; items.rows[0].controls['.item-quantity'].value = '1'; items.rows[0].controls['.item-price'].value = '1e308'; save(); assert.equal(data.get(key), before);
});
test('Черновик восстанавливает все поля; каталог добавляет услугу; реквизиты читаются', () => {
  evaluate(['addItem', 'restoreDraft', 'readSender'].map(functionSource).join('\n'));
  context.senderKey = 'smeta-5-minutes.sender.v1';
  fill(base); context.saveDraft(); const draft = data.get('draft');
  items.replaceChildren(); el('#recipient').value = ''; context.draftReady = false; context.restoreDraft(); assert.deepEqual(snapshot(), base);
  context.addItem(false, {name:'Лендинг', price:'50000'}); assert.equal(items.rows.length, 3); assert.equal(items.rows[2].controls['.item-name'].value, 'Лендинг');
  data.set(context.senderKey, JSON.stringify({version:1, sender:'Компания'})); assert.equal(context.readSender(), 'Компания');
  data.set('draft', draft);
});
test('Переполнение позиции не выдаёт частичный итог', () => {
  fill(base); items.rows[0].controls['.item-price'].value = '1e308'; context.recalculate();
  assert.equal(el('#grand-total').textContent, 'Слишком большое значение'); assert.equal(el('#subtotal').textContent, 'Слишком большое значение'); assert.equal(el('#amount-words').hidden, true);
});
test('Четыре валюты, сумма прописью и текст WhatsApp', () => {
  for (const currency of ['₸', '₽', '$', '€']) { fill(base); el('#currency').value = currency; context.recalculate(); assert.ok(el('#grand-total').textContent.endsWith(currency)); assert.equal(el('#amount-words').hidden, currency !== '₸'); const text = context.whatsappText(); assert.ok(text.includes('Алия')); assert.doesNotMatch(text, /История смет|Сохранить в историю|NaN|Infinity/); }
  assert.equal(context.amountInWords(37620, '₸'), 'Тридцать семь тысяч шестьсот двадцать тенге');
});
console.log(JSON.stringify({ passed: results.length, tests: results, limitation: 'Имитация DOM и localStorage; не проверяет реальную вёрстку, HTML-валидацию браузера, печать и буфер обмена.' }, null, 2));
