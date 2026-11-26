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
test('Удаление: подтверждение, отмена, одинаковые номера и названия, сохранность формы', () => {
  resetFixture();
  const named = entries(); named[1].name = named[2].name = '<Кухня> & монтаж';
  data.set(key,JSON.stringify({version:1,entries:named}));
  search('см-001'); open('search-2');
  const form = snapshot(), stored = JSON.stringify([...data]), before = entries();
  let message;
  context.window.confirm = text => { message = text; return false; };
  const button = el('#history-list').children[1].children.at(-1);
  assert.equal(button.textContent,'Удалить'); button.listeners.click();
  assert.match(message, /<Кухня> & монтаж/); assert.match(message,/Алия Иванова/);
  assert.ok(message.includes(new Date(fixture[2].savedAt).toLocaleString('ru-RU')));
  assert.match(message,/Это действие нельзя отменить/);
  assert.equal(JSON.stringify([...data]),stored);
  context.window.confirm = () => true;
  let focused = false; el('#history-search').focus = () => { focused = true; };
  button.listeners.click();
  assert.deepEqual(entries(),before.filter(entry => entry.id !== 'search-2'));
  assert.deepEqual(snapshot(),form);
  assert.equal(JSON.stringify([...data].filter(([k]) => k !== key)),JSON.stringify(JSON.parse(stored).filter(([k]) => k !== key)));
  assert.equal(el('#history-search').value,'см-001'); assert.equal(visibleClients().length,1);
  assert.equal(focused,true); assert.match(el('#history-status').textContent,/Сохранённая смета удалена/);
  const fresh = vm.createContext({...context}); vm.runInContext(source.slice(source.indexOf('const historyKey =')),fresh);
  assert.equal(visibleClients().length,3); assert.equal(entries().some(entry => entry.id === 'search-2'),false);
  el('#history-search').addEventListener('input',context.refreshHistorySearch);
});

test('Удаление: последний результат поиска и последняя запись', () => {
  resetFixture(); search('альф'); context.deleteHistoryEstimate('search-1');
  assert.equal(visibleClients().length,0); assert.equal(el('#history-empty').hidden,true);
  assert.equal(el('#history-search-status').textContent,'Ничего не найдено. Измените запрос');
  assert.equal(el('#history-search').value,'альф');
  for (const entry of entries()) context.deleteHistoryEstimate(entry.id);
  assert.equal(entries().length,0); assert.equal(el('#history-empty').hidden,false);
  assert.equal(el('#history-search-status').textContent,'');
});

test('Удаление: ошибки хранилища, повреждения и исчезнувшая запись без ложного успеха', () => {
  resetFixture(); search('');
  const original = data.get(key), form = snapshot(), draft = data.get('draft');
  for (const mode of ['read','write','missing','broken','duplicate']) {
    data.set(key,original); failRead = mode === 'read'; failWrite = mode === 'write';
    if (mode === 'broken') data.set(key,'{');
    if (mode === 'duplicate') { const invalid = JSON.parse(original); invalid.entries[1].id = invalid.entries[0].id; data.set(key,JSON.stringify(invalid)); }
    const before = data.get(key);
    context.deleteHistoryEstimate(mode === 'missing' ? 'missing-id' : 'search-0');
    assert.equal(data.get(key),before); assert.deepEqual(snapshot(),form); assert.equal(data.get('draft'),draft);
    assert.match(el('#history-status').textContent,/Не удалось удалить/);
    failRead = failWrite = false;
  }
  data.set(key,original);
  context.window.confirm = () => { data.set(key,JSON.stringify({version:1,entries:fixture.slice(1)})); return true; };
  context.deleteHistoryEstimate('search-0'); assert.deepEqual(entries(),fixture.slice(1));
  assert.match(el('#history-status').textContent,/Не удалось удалить/);
  context.window.confirm = () => confirm; resetFixture(); search('');
});
const sort = value => { el('#history-sort').value = value; el('#history-sort').listeners.change(); };
const titles = () => el('#history-list').children.map(item => item.children[0].textContent);
const sortFixture = [10000,30000,20000].map((price,index) => {
  const estimate = structuredClone(base);
  estimate.fields.recipient = index === 2 ? 'Борис' : 'Алия';
  estimate.fields['estimate-number'] = index === 2 ? 'СМ-002' : 'СМ-001';
  estimate.fields['estimate-date'] = '2026-11-' + (23-index);
  estimate.items = [{...estimate.items[0], 'item-quantity':'1', 'item-price':String(price)}];
  return {id:'sort-'+index,name:['А','Б','В'][index],savedAt:'2026-11-20T'+(10+index)+':00:00.000Z',estimate};
});
const resetSort = () => { data.set(key,JSON.stringify({version:1,entries:sortFixture})); search(''); };
test('Сортировка: пример 3, поиск, неизменность хранилища и сброс при загрузке', () => {
  resetSort(); const stored = JSON.stringify([...data]), form = snapshot();
  for (const [mode,all,filtered] of [
    ['newest',['В','Б','А'],['Б','А']], ['oldest',['А','Б','В'],['А','Б']],
    ['total-asc',['А','В','Б'],['А','Б']], ['total-desc',['Б','В','А'],['Б','А']]
  ]) {
    search(''); sort(mode); assert.deepEqual(titles(),all);
    search('алия'); assert.deepEqual(titles(),filtered);
    assert.equal(el('#history-sort').value,mode);
  }
  assert.equal(JSON.stringify([...data]),stored); assert.deepEqual(snapshot(),form);
  const fresh = vm.createContext({...context}); vm.runInContext(source.slice(source.indexOf('const historyKey =')),fresh);
  assert.equal(el('#history-search').value,''); assert.equal(el('#history-sort').value,'newest');
  assert.deepEqual(titles(),['В','Б','А']); assert.equal(JSON.stringify([...data]),stored);
  el('#history-search').addEventListener('input',context.refreshHistorySearch);
  el('#history-sort').addEventListener('change',context.refreshHistorySearch);
});
test('Сортировка: пример 6, равные суммы и даты, скидка и НДС', () => {
  const mixed = [100,1000,0,100,100].map((price,i) => {
    const entry = structuredClone(sortFixture[0]); entry.id='mixed-'+i; entry.name=String(i);
    entry.estimate.items[0]['item-price']=String(price);
    entry.estimate.fields.currency=i===0?'$':'₸';
    entry.savedAt=i>=3?'2026-11-21T10:00:00.000Z':entry.savedAt; return entry;
  });
  data.set(key,JSON.stringify({version:1,entries:mixed})); search(''); sort('total-asc');
  assert.deepEqual(titles(),['2','3','4','0','1']); sort('total-desc');
  assert.deepEqual(titles(),['1','3','4','0','2']);
  sort('newest'); assert.deepEqual(titles(),['3','4','0','1','2']);
  sort('oldest'); assert.deepEqual(titles(),['0','1','2','3','4']);
  mixed[1].estimate.fields.discount='95'; mixed[1].estimate.fields.vat='10';
  data.set(key,JSON.stringify({version:1,entries:mixed})); sort('total-asc');
  assert.deepEqual(titles(),['2','1','3','4','0']);
  assert.equal(context.validateEstimate(mixed[1].estimate),55);
});
test('Сортировка: сохранение, переименование, открытие и удаление по ID во всех режимах', () => {
  for (const mode of ['newest','oldest','total-asc','total-desc']) {
    resetSort(); sort(mode); search('алия');
    const target = el('#history-list').children.find(item=>item.children[0].textContent==='Б');
    context.window.prompt=()=> 'Ремонт кухни';
    target.children.find(child=>child.textContent==='Переименовать').listeners.click();
    assert.equal(entries()[1].name,'Ремонт кухни'); assert.equal(entries()[0].name,'А');
    const renamed = el('#history-list').children.find(item=>item.children[0].textContent==='Ремонт кухни');
    renamed.children.find(child=>child.textContent==='Открыть').listeners.click();
    assert.deepEqual(snapshot(),sortFixture[1].estimate);
    renamed.children.find(child=>child.textContent==='Удалить').listeners.click();
    assert.deepEqual(entries().map(entry=>entry.id),['sort-0','sort-2']);
    assert.deepEqual(titles(),['А']);
    fill(sortFixture[0].estimate); el('#items').children[0].controls['.item-price'].value='5000'; save();
    assert.equal(entries().length,3); assert.equal(entries()[0].name,undefined);
    assert.deepEqual(titles(),mode==='newest'||mode==='total-asc'?['СМ-001','А']:['А','СМ-001']);
    assert.equal(el('#history-search').value,'алия'); assert.equal(el('#history-sort').value,mode);
  }
});
test('Сортировка: пустая история, ошибки чтения и неизменность WhatsApp', () => {
  fill(base); const text=context.whatsappText();
  for (const mode of ['newest','oldest','total-asc','total-desc']) {
    data.set(key,JSON.stringify({version:1,entries:[]})); sort(mode);
    assert.equal(el('#history-empty').hidden,false); assert.deepEqual(titles(),[]);
    assert.equal(el('#history-search-status').textContent,'');
    failRead=true; sort(mode); assert.match(el('#history-search-status').textContent,/Не удалось прочитать/); failRead=false;
    data.set(key,'{'); sort(mode); assert.equal(data.get(key),'{'); assert.match(el('#history-search-status').textContent,/Не удалось прочитать/);
    assert.equal(context.whatsappText(),text);
  }
  const html=fs.readFileSync('index.html','utf8');
  assert.ok(html.includes('Вы ещё не сохранили ни одной сметы'));
  assert.ok(html.includes('Суммы сравниваются численно, без конвертации по курсу'));
  assert.doesNotMatch(functionSource('preparePrint'),/historySort|history-sort/);
  resetFixture(); search(''); sort('newest');
});
console.log(JSON.stringify({passed:results.length, tests:results, limitation:'Имитация DOM и localStorage. Реальная вёрстка, фокус, перезагрузка, PDF и буфер обмена требуют браузера.'},null,2));
`;
vm.runInNewContext(harness.slice(0, harness.lastIndexOf('console.log(JSON.stringify')) + tests, {require, console}, {filename:'search-suite.cjs'});
