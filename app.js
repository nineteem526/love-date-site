const initialRoomSlug = new URLSearchParams(location.search).get('room')?.toLowerCase() || '';
const scopedKey = (slug, key) => slug ? `dateSite:${slug}:${key}` : null;
const stored = (key, fallback) => {
  if (!initialRoomSlug) return fallback;
  try { return JSON.parse(localStorage.getItem(scopedKey(initialRoomSlug, key))) ?? fallback; } catch { return fallback; }
};
const initialValue = (key) => initialRoomSlug ? localStorage.getItem(scopedKey(initialRoomSlug, key)) : null;

const oldSelectedDate = initialValue('dateSelected');
const normalizedSelectedDate = /^\d{4}-\d{2}-\d{2}$/.test(oldSelectedDate || '') ? oldSelectedDate : `2026-09-${String(Number(oldSelectedDate) || 26).padStart(2, '0')}`;

const state = {
  selectedDate: normalizedSelectedDate,
  calendar: stored('calendarMonth', { year: 2026, month: 8 }),
  availability: stored('dateAvailability', {}),
  accepted: initialValue('inviteAccepted') === 'true',
  wishes: stored('dateWishes', [
    { name: '林荫下的意大利小馆', note: '想点松露意面，坐窗边慢慢聊。', icon: '✦', tag: '温柔晚餐' },
    { name: '那家日料小店', note: '上次路过时你说，想试试它的寿司。', icon: '◌', tag: '下次就去' },
    { name: '江边的早午餐', note: '睡到自然醒，然后一起去晒太阳。', icon: '☼', tag: '周末限定' }
  ]),
  tasks: stored('dateTasks', [
    { text: '订好餐厅的靠窗位置', owner: 'Jian', done: true },
    { text: '准备一束小小的花', owner: 'Jian', done: true },
    { text: '选一首想一起听的歌', owner: 'Lu', done: false },
    { text: '想好今天的穿搭', owner: 'Lu', done: false },
    { text: '带上轻松的好心情', owner: '我们', done: false }
  ]),
  profile: { personOne: '我', personTwo: 'TA', startDate: '2024-02-14', theme: 'classic', message: '这不是一份普通的行程表。是我想和你慢一点吃饭、散一点步的邀请。', ...stored('dateProfile', {}) },
  memories: stored('dateMemories', [
    { date: '2026-08-16', title: '那天傍晚的云很好看', note: '我们没有赶时间，只是走啊走，然后在便利店买了两支冰淇淋。', photo: '' },
    { date: '2026-02-14', title: '第一张认真合照', note: '原来只要是和你，普通的一天也会闪闪发光。', photo: '' }
  ]),
  whispers: stored('dateWhispers', [
    { text: '今天也很喜欢你。', from: 'Jian' },
    { text: '那下次见面，也要慢一点分别。', from: 'Lu' }
  ])
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const dateFormat = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
const monthFormat = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' });
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
const showToast = (message) => {
  const toast = $('#toast'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
};
let activeRoom = null;
let cloudSaveTimer = null;
const SUPABASE_URL = 'https://unzcyunpvztmppvrnnzt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_e7yStGsJ7FFcyNXtSUa09A_A6ajhae5';
const persist = () => {
  if (!activeRoom) return;
  const key = (name) => scopedKey(activeRoom.slug, name);
  localStorage.setItem(key('dateSelected'), state.selectedDate);
  localStorage.setItem(key('calendarMonth'), JSON.stringify(state.calendar));
  localStorage.setItem(key('dateAvailability'), JSON.stringify(state.availability));
  localStorage.setItem(key('inviteAccepted'), state.accepted);
  localStorage.setItem(key('dateWishes'), JSON.stringify(state.wishes));
  localStorage.setItem(key('dateTasks'), JSON.stringify(state.tasks));
  localStorage.setItem(key('dateProfile'), JSON.stringify(state.profile));
  localStorage.setItem(key('dateMemories'), JSON.stringify(state.memories));
  localStorage.setItem(key('dateWhispers'), JSON.stringify(state.whispers));
  scheduleCloudSave();
};

const roomSnapshot = () => ({ selectedDate: state.selectedDate, calendar: state.calendar, availability: state.availability, accepted: state.accepted, wishes: state.wishes, tasks: state.tasks, profile: state.profile, memories: state.memories, whispers: state.whispers });
const callRoom = async (name, args) => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  if (!response.ok) { const detail = await response.json().catch(() => ({})); throw new Error(detail.message || '暂时无法连接专属空间。'); }
  return response.json();
};
function roomCode() { return crypto.randomUUID().replace(/-/g, '').slice(0, 12); }
function roomSlug(value) { try { const url = new URL(value); return url.searchParams.get('room') || ''; } catch { return value.trim().toLowerCase(); } }
function renderRoomPanel() { $('#roomPanel').hidden = !activeRoom; if (!activeRoom) return; $('#roomTitle').textContent = '你们的空间正在同步'; $('#roomStatus').textContent = `空间代码：${activeRoom.slug}。把邀请链接和空间密码分享给 TA，就能一起记录每一次约会。`; }
function applyRoom(data) { Object.assign(state, data); renderCalendar(); renderInvite(); renderWishes(); renderTasks(); renderProfile(); renderMemories(); renderWhispers(); }
function scheduleCloudSave() { clearTimeout(cloudSaveTimer); cloudSaveTimer = setTimeout(async () => { try { await callRoom('save_date_room', { p_slug: activeRoom.slug, p_pin: activeRoom.pin, p_data: roomSnapshot() }); } catch { showToast('本次修改暂未同步，网络恢复后会继续保存。'); } }, 650); }
async function openRoom(slug, pin) { const normalizedSlug = roomSlug(slug); const result = await callRoom('open_date_room', { p_slug: normalizedSlug, p_pin: pin }); activeRoom = { slug: normalizedSlug, pin }; history.replaceState({}, '', `${location.pathname}?room=${normalizedSlug}`); applyRoom(result.data); renderRoomPanel(); }
async function createRoom(personOne, personTwo, pin) {
  const slug = roomCode();
  state.profile.personOne = personOne.trim() || '我';
  state.profile.personTwo = personTwo.trim() || 'TA';
  await callRoom('create_date_room', { p_slug: slug, p_pin: pin, p_data: roomSnapshot() });
  activeRoom = { slug, pin };
  history.replaceState({}, '', `${location.pathname}?room=${slug}`);
  persist();
  renderProfile();
  renderRoomPanel();
}

function changeView(id) {
  $$('.view').forEach(view => view.classList.toggle('active', view.id === id));
  $$('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.view === id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function isoDate(year, month, day) { return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }
function selectedDateObject() { return new Date(`${state.selectedDate}T12:00:00`); }
function updateSelectedDateText() { $('#selectedDateText').textContent = `已选：${dateFormat.format(selectedDateObject()).replace('周', '周')}`; }

function renderCalendar() {
  const { year, month } = state.calendar;
  const firstDay = new Date(year, month, 1).getDay();
  const offset = (firstDay + 6) % 7;
  const totalDays = new Date(year, month + 1, 0).getDate();
  $('#calendarMonthText').textContent = monthFormat.format(new Date(year, month, 1));
  const cells = Array.from({ length: offset }, () => '<span class="date-cell empty"></span>');
  for (let day = 1; day <= totalDays; day += 1) {
    const iso = isoDate(year, month, day);
    const status = state.availability[iso] || '';
    const isSelected = iso === state.selectedDate ? 'selected' : '';
    cells.push(`<button class="date-cell ${isSelected} ${status}" data-date="${iso}" aria-label="选择 ${year} 年 ${month + 1} 月 ${day} 日">${day}</button>`);
  }
  $('#calendarGrid').innerHTML = cells.join('');
  updateSelectedDateText();
  renderAvailability();
}

function renderAvailability() {
  const status = state.availability[state.selectedDate];
  $$('[data-availability]').forEach(button => button.classList.toggle('active', button.dataset.availability === status));
  const message = status === 'available' ? '已标记：这天可以见面，等对方确认。' : status === 'busy' ? '已标记：这天不方便，可以继续挑其他日子。' : '还没有标记，等你决定。';
  $('#availabilityText').textContent = message;
}

function shiftCalendar(direction) {
  const next = new Date(state.calendar.year, state.calendar.month + direction, 1);
  state.calendar = { year: next.getFullYear(), month: next.getMonth() }; persist(); renderCalendar();
}

function renderInvite() {
  const area = $('#inviteResponse');
  area.innerHTML = state.accepted
    ? '<div class="accepted-message">♥ 约会已确认，我会准时出现。</div>'
    : '<button class="response-yes" id="acceptInvite">好呀，我愿意</button><button class="response-later" id="maybeLater">换个时间？</button>';
  const accept = $('#acceptInvite');
  if (accept) accept.addEventListener('click', () => { state.accepted = true; persist(); renderInvite(); showToast('太好了，这个傍晚属于我们。'); });
  const later = $('#maybeLater');
  if (later) later.addEventListener('click', () => { changeView('date'); showToast('没关系，我们一起挑一个更合适的日子。'); });
}

function renderWishes() {
  $('#wishCards').innerHTML = state.wishes.map((wish, index) => `<article class="wish-card" data-index="${index}"><div><span class="wish-icon">${wish.icon || '✦'}</span><h4>${escapeHtml(wish.name)}</h4><p>${escapeHtml(wish.note || '和你一起去就很好。')}</p></div><footer><span>${escapeHtml(wish.tag || '新的心愿')}</span><button class="choose-wish">选这家 ↗</button></footer></article>`).join('');
  $('#wishCount').textContent = `${state.wishes.length} places`;
  $$('.choose-wish').forEach(button => button.addEventListener('click', (event) => {
    const card = event.target.closest('.wish-card'); $$('.wish-card').forEach(item => item.classList.remove('selected-wish'));
    card.classList.add('selected-wish'); showToast('好，这次的晚餐就选它。');
  }));
}

function renderTasks() {
  const list = $('#taskList'); const completed = state.tasks.filter(task => task.done).length; const total = state.tasks.length;
  list.innerHTML = state.tasks.map((task, index) => `<div class="task ${task.done ? 'done' : ''}"><button class="task-check" data-check="${index}" aria-label="切换完成状态">${task.done ? '✓' : ''}</button><p>${escapeHtml(task.text)}</p><small>${escapeHtml(task.owner)}</small>${index > 4 ? `<button class="task-remove" data-remove="${index}" aria-label="删除">×</button>` : ''}</div>`).join('');
  $('#progressNumber').textContent = completed; $('#progressTotal').textContent = total;
  $('#progressCopy').textContent = `已经完成 ${completed} 件小事，共 ${total} 件，期待值正在上升。`;
  $('.progress-ring').style.setProperty('--progress', `${total ? Math.round(completed / total * 100) : 0}%`);
  $$('[data-check]').forEach(button => button.addEventListener('click', () => { state.tasks[button.dataset.check].done = !state.tasks[button.dataset.check].done; persist(); renderTasks(); }));
  $$('[data-remove]').forEach(button => button.addEventListener('click', () => { state.tasks.splice(button.dataset.remove, 1); persist(); renderTasks(); showToast('这件小事先从清单里拿走了。'); }));
}

function renderProfile() {
  const p = state.profile;
  $('.brand > span:last-child').textContent = `${p.personOne} & ${p.personTwo}`;
  $('.brand-mark').innerHTML = `${escapeHtml(p.personOne.charAt(0) || 'J')}<span>♥</span>${escapeHtml(p.personTwo.charAt(0) || 'L')}`;
  $('.avatar').textContent = p.personTwo.charAt(0) || '鹿';
  $('.hero-text').innerHTML = escapeHtml(p.message).replace(/。/g, '。<br />');
  $('#personOne').value = p.personOne; $('#personTwo').value = p.personTwo; $('#startDate').value = p.startDate; $('#homeMessage').value = p.message;
  const start = new Date(`${p.startDate}T12:00:00`); const today = new Date();
  $('#daysTogether').textContent = Math.max(0, Math.floor((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - start) / 86400000));
  document.body.dataset.theme = p.theme === 'classic' ? '' : p.theme;
  $$('[data-theme-choice]').forEach(button => button.classList.toggle('active', button.dataset.themeChoice === p.theme));
  renderAnniversary(start, today);
}

function renderAnniversary(start, today) {
  let next = new Date(today.getFullYear(), start.getMonth(), start.getDate());
  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) next = new Date(today.getFullYear() + 1, start.getMonth(), start.getDate());
  const days = Math.max(0, Math.ceil((next - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000));
  const years = next.getFullYear() - start.getFullYear();
  $('#anniversaryNote').textContent = `· 距 ${years} 周年还有 ${days} 天`;
  $('#anniversaryTitle').textContent = `${years} 周年纪念日`;
  $('#anniversaryDetail').textContent = `${next.getFullYear()} 年 ${next.getMonth() + 1} 月 ${next.getDate()} 日 · 还有 ${days} 天`;
}

function renderMemories() {
  const sorted = [...state.memories].sort((a, b) => b.date.localeCompare(a.date));
  $('#memoryCount').textContent = `${sorted.length} moments`;
  $('#timeline').innerHTML = sorted.map(memory => {
    const photo = memory.photo ? `<img src="${memory.photo}" alt="${escapeHtml(memory.title)}" />` : '♥';
    return `<article class="timeline-item"><div class="memory-image">${photo}</div><div class="timeline-content"><button class="memory-delete" data-memory-delete="${state.memories.indexOf(memory)}" aria-label="删除这条回忆">×</button><time>${dateFormat.format(new Date(`${memory.date}T12:00:00`))}</time><h4>${escapeHtml(memory.title)}</h4><p>${escapeHtml(memory.note || '这一天，很想好好记住。')}</p></div></article>`;
  }).join('');
  $$('[data-memory-delete]').forEach(button => button.addEventListener('click', () => { state.memories.splice(Number(button.dataset.memoryDelete), 1); persist(); renderMemories(); showToast('这条回忆已从时间线中拿走。'); }));
}

function renderWhispers() {
  $('#whisperList').innerHTML = state.whispers.slice().reverse().map(whisper => `<article class="whisper"><p>“${escapeHtml(whisper.text)}”</p><small>— ${escapeHtml(whisper.from)}</small></article>`).join('');
}

function imageDataFromFile(file) {
  if (!file) return Promise.resolve('');
  if (!file.type.startsWith('image/')) return Promise.reject(new Error('请选择照片文件。'));
  if (file.size > 6 * 1024 * 1024) return Promise.reject(new Error('照片请控制在 6MB 以内。'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('这张照片暂时无法读取。'));
    reader.onload = () => { const image = new Image(); image.onerror = () => reject(new Error('这张照片暂时无法处理。')); image.onload = () => { const ratio = Math.min(1, 900 / Math.max(image.width, image.height)); const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * ratio); canvas.height = Math.round(image.height * ratio); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', .78)); }; image.src = reader.result; };
    reader.readAsDataURL(file);
  });
}

$$('[data-view]').forEach(button => button.addEventListener('click', () => changeView(button.dataset.view)));
$('#calendarGrid').addEventListener('click', (event) => {
  const iso = event.target.dataset.date; if (!iso) return;
  state.selectedDate = iso; const date = new Date(`${iso}T12:00:00`); state.calendar = { year: date.getFullYear(), month: date.getMonth() };
  persist(); renderCalendar(); showToast(`${dateFormat.format(date)} 已选中 ✦`);
});
$$('[data-calendar-nav]').forEach(button => button.addEventListener('click', () => shiftCalendar(button.dataset.calendarNav === 'next' ? 1 : -1)));
$$('[data-availability]').forEach(button => button.addEventListener('click', () => { state.availability[state.selectedDate] = button.dataset.availability; persist(); renderCalendar(); showToast(button.dataset.availability === 'available' ? '已标记为可以见面。' : '已标记为这天不方便。'); }));
$('#wishForm').addEventListener('submit', (event) => { event.preventDefault(); const name = $('#wishName').value.trim(), note = $('#wishNote').value.trim(); if (!name) return; state.wishes.unshift({ name, note, icon: '♥', tag: '你刚刚添加' }); persist(); renderWishes(); event.target.reset(); showToast('已经放进我们的心愿单。'); });
$('#addTaskButton').addEventListener('click', () => { $('.inline-task-form').classList.toggle('visible'); $('#taskInput').focus(); });
$('#taskForm').addEventListener('submit', (event) => { event.preventDefault(); const text = $('#taskInput').value.trim(); if (!text) return; state.tasks.push({ text, owner: '我们', done: false }); persist(); renderTasks(); event.target.reset(); $('.inline-task-form').classList.remove('visible'); showToast('新的小事已经记下啦。'); });
$('#settingsForm').addEventListener('submit', (event) => { event.preventDefault(); state.profile = { personOne: $('#personOne').value.trim() || '我', personTwo: $('#personTwo').value.trim() || 'TA', startDate: $('#startDate').value || '2024-02-14', theme: state.profile.theme, message: $('#homeMessage').value.trim() || '这不是一份普通的行程表。' }; persist(); renderProfile(); showToast('我们的小设定已经保存。'); });
$$('[data-theme-choice]').forEach(button => button.addEventListener('click', () => { state.profile.theme = button.dataset.themeChoice; persist(); renderProfile(); showToast('今天的氛围已换好。'); }));
$('#memoryForm').addEventListener('submit', async (event) => { event.preventDefault(); const title = $('#memoryTitle').value.trim(); const date = $('#memoryDate').value; if (!title || !date) return; try { const photo = await imageDataFromFile($('#memoryPhoto').files[0]); state.memories.push({ date, title, note: $('#memoryNote').value.trim(), photo }); persist(); renderMemories(); event.target.reset(); $('#memoryDate').value = new Date().toISOString().slice(0, 10); showToast('这一页已经被好好收藏。'); } catch (error) { showToast(error.message); } });
$('#whisperForm').addEventListener('submit', (event) => { event.preventDefault(); const text = $('#whisperInput').value.trim(); if (!text) return; state.whispers.push({ text, from: state.profile.personOne }); persist(); renderWhispers(); event.target.reset(); showToast('悄悄话已经放进小信箱。'); });
function revealApp() { $('#lockScreen').classList.add('unlocked'); }
function showEntry(mode) { $('#createSpaceEntry').hidden = mode !== 'create'; $('#joinSpaceEntry').hidden = mode !== 'join'; }
function showInviteEntry() { $('#createSpaceEntry').hidden = true; $('#joinSpaceEntry').hidden = true; $('#unlockForm').hidden = false; }
function roomError(input, error) { input.setCustomValidity(error.message || '暂时无法打开这个空间。'); input.reportValidity(); input.addEventListener('input', () => input.setCustomValidity(''), { once: true }); }

$('#showJoinEntry').addEventListener('click', () => showEntry('join'));
$('#showCreateEntry').addEventListener('click', () => showEntry('create'));
$('#createSpaceForm').addEventListener('submit', async (event) => { event.preventDefault(); const pin = $('#entryCreatePin').value.trim(); if (pin.length < 4) return; try { await createRoom($('#entryPersonOne').value, $('#entryPersonTwo').value, pin); $('#entryCreatePin').value = ''; revealApp(); showToast('专属空间创建完成，快把邀请链接分享给 TA 吧。'); } catch (error) { roomError($('#entryCreatePin'), error); } });
$('#joinSpaceForm').addEventListener('submit', async (event) => { event.preventDefault(); const slug = roomSlug($('#entryJoinLink').value); const pin = $('#entryJoinPin').value.trim(); if (!/^[a-z0-9]{8,20}$/.test(slug)) return showToast('请粘贴正确的邀请链接或空间代码。'); try { await openRoom(slug, pin); $('#entryJoinPin').value = ''; revealApp(); showToast('已经进入 TA 的专属空间。'); } catch (error) { roomError($('#entryJoinPin'), error); } });
$('#unlockForm').addEventListener('submit', async (event) => { event.preventDefault(); const input = $('#unlockPassword'); try { await openRoom(initialRoomSlug, input.value); input.value = ''; revealApp(); } catch (error) { roomError(input, error); } });
$('#copyRoomLink').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); showToast('专属链接已复制。'); } catch { showToast('请复制浏览器地址栏中的链接。'); } });

$('#memoryDate').value = new Date().toISOString().slice(0, 10);
renderCalendar(); renderInvite(); renderWishes(); renderTasks(); renderProfile(); renderMemories(); renderWhispers();
renderRoomPanel();
if (initialRoomSlug) showInviteEntry();
