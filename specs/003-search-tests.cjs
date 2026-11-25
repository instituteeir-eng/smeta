// node specs/003-search-tests.cjs — includes the history regression suite.
const fs = require('node:fs');
const vm = require('node:vm');
const harness = fs.readFileSync('specs/002-history-tests.cjs', 'utf8');
const tests = `
const search = value => { el('#history-search').value = value; el('#history-search').listeners.input(); };
const visibleClients = () => el('#history-list').children.map(item => item.children[1].textContent);
const fixture = [
  ['СМ-002', 'Алия', '20000'], ['СМ-001', 'ТОО Альфа', '15000'],
  ['СМ-001', 'Алия Иванова', '10000'], ['', '', '0']
].map(([number, client, price], index) => {
  const estimate = structuredClone(base);
  estimate.fields['estimate-number'] = number; estimate.fields.recipient = client;
  estimate.items = [{...estimate.items[0], 'item-quantity': '1', 'item-price': price}];
  return {id: 'search-' + index, savedAt: '2026-11-23T10:00:00.000Z', estimate};
});
const resetFixture = () => data.set(key, JSON.stringify({version:1, entries:fixture}));
resetFixture();
test('Поиск: все примеры, очистка, порядок и дубли номеров', () => {
  for (const [query, indices] of [
    ['см-001',[1,2]], ['001',[1,2]], ['алия',[0,2]], ['  аЛиЯ  ',[0,2]],
    ['альф',[1]], ['СМ-001 Алия',[]], ['несуществующий клиент',[]],
    ['',[0,1,2,3]], ['   ',[0,1,2,3]], ['Без номера',[]]
  ]) {
    search(query);
    assert.deepEqual(visibleClients(), indices.map(i => fixture[i].estimate.fields.recipient || 'Клиент не указан'));
    assert.equal(el('#history-search-status').textContent, indices.length ? '' : 'Ничего не найдено. Измените запрос');
  }
});
test('Поиск: input при вводе, вставке и удалении; поле не заменяется', () => {
  const control = el('#history-search');
  for (const query of ['а','ал','алия','альф','аль','']) search(query);
  assert.equal(el('#history-search'), control); assert.equal(visibleClients().length,4);
});
test('Поиск: пустая история, нет совпадений, ошибка чтения и восстановление', () => {
  data.delete(key); search('алия'); assert.equal(el('#history-empty').hidden,false); assert.equal(el('#history-search-status').textContent,'');
  resetFixture(); search('не найдено'); assert.equal(el('#history-empty').hidden,true); assert.match(el('#history-search-status').textContent,/Ничего не найдено/);
  failRead = true; search('алия'); assert.equal(visibleClients().length,0); assert.equal(el('#history-empty').hidden,true); assert.match(el('#history-search-status').textContent,/Не удалось прочитать/);
  failRead = false; data.set(key,'{'); search(''); assert.match(el('#history-search-status').textContent,/Не удалось прочитать/); assert.equal(data.get(key),'{');
  resetFixture(); search('алия'); assert.equal(visibleClients().length,2); assert.equal(el('#history-search-status').textContent,'');
});
test('Поиск: открытие именно найденной записи и отмена', () => {
  fill(base); context.saveDraft(); search('альф'); const before = snapshot(), draft = data.get('draft');
  confirm = false; el('#history-list').children[0].children[4].listeners.click(); assert.deepEqual(snapshot(),before); assert.equal(data.get('draft'),draft);
  confirm = true; el('#history-list').children[0].children[4].listeners.click(); assert.deepEqual(snapshot(),fixture[1].estimate);
});
test('Поиск: не изменяет форму и всё хранилище; начальная загрузка сбрасывает запрос', () => {
  const before = snapshot(), stored = JSON.stringify([...data]);
  search('алия'); search('['); search(''); assert.deepEqual(snapshot(),before); assert.equal(JSON.stringify([...data]),stored);
  const fresh = vm.createContext({...context});
  el('#history-search').value='старый запрос'; vm.runInContext(source.slice(source.indexOf('const historyKey =')),fresh);
  assert.equal(el('#history-search').value,''); assert.equal(visibleClients().length,4); assert.equal(JSON.stringify([...data]),stored);
  // Restore original listeners after simulating a fresh script load.
  el('#history-search').addEventListener('input',context.refreshHistorySearch);
});
test('Поиск: сохранение совпадающей и несовпадающей сметы при активном фильтре', () => {
  resetFixture(); search('алия'); fill(base); save(); assert.equal(entries().length,5); assert.equal(visibleClients().length,3); assert.equal(el('#history-search').value,'алия'); assert.match(el('#history-status').textContent,/Копия сметы сохранена/);
  el('#recipient').value='Борис'; save(); assert.equal(entries().length,6); assert.equal(visibleClients().length,3); assert.equal(el('#history-search').value,'алия');
  search(''); assert.equal(visibleClients()[0],'Борис'); assert.equal(visibleClients().length,6);
});
test('Поиск: пустые поля, длинный запрос, буквальные символы и различие е/ё', () => {
  const special = structuredClone(fixture[0]); special.id='special'; special.estimate.fields.recipient='Ёлка [*<';
  data.set(key,JSON.stringify({version:1,entries:[special,...fixture]}));
  for (const query of ['[','*','<','ёЛКА']) { search(query); assert.equal(visibleClients().length,1); assert.equal(visibleClients()[0],'Ёлка [*<'); }
  for (const query of ['елка','а'.repeat(10000),'Клиент не указан']) { search(query); assert.equal(visibleClients().length,0); }
  search(''); assert.equal(visibleClients().length,5);
});
test('Поиск: отсутствие фильтра в WhatsApp и изоляция печатной области по коду', () => {
  fill(base); context.recalculate(); const text = context.whatsappText(); search('уникальный запрос'); assert.equal(context.whatsappText(),text);
  assert.doesNotMatch(functionSource('preparePrint'),/history-search|history-list|historySearch/);
  const css = fs.readFileSync('styles.css','utf8'); assert.match(css,/@media print[\\s\\S]*\\.workspace, button, input, select, textarea \\{ display: none !important;/);
  const html = fs.readFileSync('index.html','utf8'); assert.match(html,/<label for="history-search">Поиск по номеру или клиенту<\\/label>/);
});
console.log(JSON.stringify({passed:results.length, tests:results, limitation:'Имитация DOM и localStorage. Реальная вёрстка, фокус, перезагрузка, PDF и буфер обмена требуют браузера.'},null,2));
`;
vm.runInNewContext(harness.slice(0, harness.lastIndexOf('console.log(JSON.stringify')) + tests, {require, console}, {filename:'search-suite.cjs'});
