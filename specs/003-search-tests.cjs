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
test('Переименование: отдельное название, тот же ID и дата, поиск и открытие', () => {
  resetFixture(); search('алия'); fill(base); context.saveDraft();
  const form = snapshot(), draft = data.get('draft'), before = entries();
  context.window.prompt = () => '  Ремонт кухни  ';
  context.renameHistoryEstimate('search-2');
  const expected = structuredClone(before); expected[2].name = 'Ремонт кухни';
  assert.deepEqual(entries(),expected); assert.deepEqual(snapshot(),form); assert.equal(data.get('draft'),draft);
  assert.equal(el('#history-search').value,'алия'); assert.equal(visibleClients().length,2);
  assert.equal(el('#history-list').children[1].children[0].textContent,'Ремонт кухни');
  assert.equal(el('#history-list').children[1].children[4].textContent,'Номер сметы: СМ-001');
  search('Ремонт кухни'); assert.equal(visibleClients().length,0);
  search('см-001'); assert.equal(visibleClients().length,2);
  open('search-2'); assert.deepEqual(snapshot(),fixture[2].estimate);
  save(); assert.equal(entries()[0].name,undefined); assert.equal(entries()[3].name,'Ремонт кухни');
});

test('Переименование: отмена, пустой ввод, предел длины, буквальный HTML и дубли', () => {
  resetFixture(); search('');
  for (const answer of [null,'','   ','я'.repeat(101)]) {
    const before = data.get(key); context.window.prompt = () => answer;
    context.renameHistoryEstimate('search-0'); assert.equal(data.get(key),before);
    if (answer !== null) assert.match(el('#history-status').textContent,/от 1 до 100/);
  }
  for (const answer of ['я'.repeat(100),'<Кухня> & монтаж','😀'.repeat(100)]) {
    context.window.prompt = () => answer; context.renameHistoryEstimate('search-0');
    assert.equal(entries()[0].name,answer); assert.equal(el('#history-list').children[0].children[0].textContent,answer);
    assert.equal(el('#history-list').children[0].children[0].children.length,0);
  }
  context.renameHistoryEstimate('search-1'); assert.equal(entries()[0].name,entries()[1].name);
  const fresh = vm.createContext({...context}); vm.runInContext(source.slice(source.indexOf('const historyKey =')),fresh);
  assert.equal(el('#history-list').children[0].children[0].textContent,entries()[0].name);
  el('#history-search').addEventListener('input',context.refreshHistorySearch);
});

test('Переименование: ошибки чтения/записи, повреждения и отсутствующий ID безопасны', () => {
  resetFixture(); search(''); context.window.prompt = () => 'Новое название';
  const original = data.get(key), form = snapshot(), draft = data.get('draft');
  for (const mode of ['read','write','missing','broken','name']) {
    data.set(key,original); failRead = mode === 'read'; failWrite = mode === 'write';
    if (mode === 'broken') data.set(key,'{');
    if (mode === 'name') { const invalid = JSON.parse(original); invalid.entries[0].name=12; data.set(key,JSON.stringify(invalid)); }
    const before = data.get(key);
    context.renameHistoryEstimate(mode === 'missing' ? 'missing-id' : 'search-0');
    assert.equal(data.get(key),before); assert.deepEqual(snapshot(),form); assert.equal(data.get('draft'),draft);
    assert.match(el('#history-status').textContent,/Не удалось переименовать/);
    failRead = failWrite = false;
  }
  data.set(key,original);
  context.window.prompt = () => { data.set(key,JSON.stringify({version:1,entries:fixture.slice(1)})); return 'Новое'; };
  context.renameHistoryEstimate('search-0'); assert.equal(entries().length,3); assert.equal(entries()[0].name,undefined);
  assert.match(el('#history-status').textContent,/Не удалось переименовать/);
  resetFixture(); search('');
});
console.log(JSON.stringify({passed:results.length, tests:results, limitation:'Имитация DOM и localStorage. Реальная вёрстка, фокус, перезагрузка, PDF и буфер обмена требуют браузера.'},null,2));
`;
vm.runInNewContext(harness.slice(0, harness.lastIndexOf('console.log(JSON.stringify')) + tests, {require, console}, {filename:'search-suite.cjs'});
