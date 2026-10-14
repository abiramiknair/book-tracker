/**
 * Book Tracker — app.js
 * ─────────────────────────────────────────────
 * Features:
 *   • localStorage persistence
 *   • Form validation with inline errors
 *   • Sorting: Newest First / Title A-Z
 *   • Live stats bar (Total / To Read / Reading / Finished)
 *   • Search + filter chips + Reset button
 *   • Status in-place update
 *   • Delete with fade-collapse animation + confirmation modal
 *   • Clear All with confirmation popup
 *   • Stacked toast notifications (add / update / delete variants)
 *   • Empty-state SVG illustration with CTA
 */

'use strict';

/* ═══════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════ */

const STORAGE_KEY = 'booktracker_books';

/** CSS classes for the status <select> pill on each book card */
const STATUS_CLASS = {
  'To Read':  's-toread',
  'Reading':  's-reading',
  'Finished': 's-finished',
};

/** Display labels for status options */
const STATUS_LABEL = {
  'To Read':  '📋 To Read',
  'Reading':  '📖 Reading',
  'Finished': '✅ Finished',
};

/* ═══════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════ */

let books        = [];   // master list
let searchQuery  = '';
let activeFilter = 'All';
let sortMode     = 'newest'; // 'newest' | 'az'
let deleteTarget = null;

/* ═══════════════════════════════════════════════
   DOM REFS
═══════════════════════════════════════════════ */

// Form
const bookForm    = document.getElementById('bookForm');
const inputTitle  = document.getElementById('inputTitle');
const inputAuthor = document.getElementById('inputAuthor');
const inputStatus = document.getElementById('inputStatus');
const errTitle    = document.getElementById('errTitle');
const errAuthor   = document.getElementById('errAuthor');

// Search + sort + filters
const searchInput    = document.getElementById('searchInput');
const btnClearSearch = document.getElementById('btnClearSearch');
const filterChips    = document.querySelectorAll('.fchip[data-filter]');
const btnReset       = document.getElementById('btnReset');
const btnClearAll    = document.getElementById('btnClearAll');
const sortSelect     = document.getElementById('sortSelect');

// List + empty state
const bookList    = document.getElementById('bookList');
const emptyState  = document.getElementById('emptyState');
const emptyTitle  = document.getElementById('emptyTitle');
const emptyBody   = document.getElementById('emptyBody');
const btnEmptyCta = document.getElementById('btnEmptyCta');

// Stats
const numTotal   = document.getElementById('numTotal');
const numToRead  = document.getElementById('numToRead');
const numReading = document.getElementById('numReading');
const numDone    = document.getElementById('numDone');

// Toast container
const toastWrap = document.getElementById('toastWrap');

// Delete One modal
const delOneModal      = document.getElementById('delOneModal');
const delOneBody       = document.getElementById('delOneBody');
const btnDelOneConfirm = document.getElementById('btnDelOneConfirm');
const btnDelOneCancel  = document.getElementById('btnDelOneCancel');

// Clear All modal
const clearAllModal      = document.getElementById('clearAllModal');
const clearCount         = document.getElementById('clearCount');
const btnClearAllConfirm = document.getElementById('btnClearAllConfirm');
const btnClearAllCancel  = document.getElementById('btnClearAllCancel');

/* ═══════════════════════════════════════════════
   LOCAL STORAGE
═══════════════════════════════════════════════ */

function loadBooks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBooks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

/* ═══════════════════════════════════════════════
   VALIDATION
═══════════════════════════════════════════════ */

function showErr(input, errEl, msg) {
  input.classList.add('has-error');
  errEl.textContent = msg;
  errEl.classList.add('show');
  input.setAttribute('aria-invalid', 'true');
}

function clearErr(input, errEl) {
  input.classList.remove('has-error');
  errEl.textContent = '';
  errEl.classList.remove('show');
  input.removeAttribute('aria-invalid');
}

function validateForm() {
  let ok = true;
  if (!inputTitle.value.trim()) {
    showErr(inputTitle, errTitle, 'Title is required');
    ok = false;
  } else {
    clearErr(inputTitle, errTitle);
  }
  if (!inputAuthor.value.trim()) {
    showErr(inputAuthor, errAuthor, 'Author is required');
    ok = false;
  } else {
    clearErr(inputAuthor, errAuthor);
  }
  return ok;
}

/* ═══════════════════════════════════════════════
   STATS
═══════════════════════════════════════════════ */

function setStatNum(el, val) {
  const s = String(val);
  if (el.textContent === s) return;
  el.textContent = s;
  el.classList.remove('stat-pop');
  void el.offsetWidth; // force reflow
  el.classList.add('stat-pop');
  el.addEventListener('animationend', () => el.classList.remove('stat-pop'), { once: true });
}

function updateStats() {
  setStatNum(numTotal,   books.length);
  setStatNum(numToRead,  books.filter(b => b.status === 'To Read').length);
  setStatNum(numReading, books.filter(b => b.status === 'Reading').length);
  setStatNum(numDone,    books.filter(b => b.status === 'Finished').length);
}

/* ═══════════════════════════════════════════════
   TOAST NOTIFICATIONS
═══════════════════════════════════════════════ */

const TOAST_DURATION = 3000; // ms

function showToast(message, type = 'add') {
  const emojiMap = { add: '✦', update: '🔄', delete: '🗑️' };

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', 'status');

  const emojiSpan = document.createElement('span');
  emojiSpan.className = 'toast-emoji';
  emojiSpan.setAttribute('aria-hidden', 'true');
  emojiSpan.textContent = emojiMap[type];

  const textSpan = document.createElement('span');
  textSpan.textContent = message;

  el.appendChild(emojiSpan);
  el.appendChild(textSpan);
  toastWrap.appendChild(el);

  const timer = setTimeout(() => dismissToast(el), TOAST_DURATION);
  el.addEventListener('click', () => { clearTimeout(timer); dismissToast(el); });
}

function dismissToast(el) {
  if (!el || el.classList.contains('hiding')) return;
  el.classList.add('hiding');
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

/* ═══════════════════════════════════════════════
   RENDERING
═══════════════════════════════════════════════ */

/** Filter and sort books */
function getFiltered() {
  const q = searchQuery.toLowerCase();
  let result = books.filter(b => {
    const statusOk = activeFilter === 'All' || b.status === activeFilter;
    const searchOk = !q ||
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q);
    return statusOk && searchOk;
  });

  if (sortMode === 'az') {
    result = result.slice().sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
    );
  }
  // 'newest' keeps insertion order (books array is newest-first by default)

  return result;
}

/** Build the status <select> element for a book card */
function buildStatusSel(book) {
  const sel = document.createElement('select');
  sel.className = `status-sel ${STATUS_CLASS[book.status]}`;
  sel.setAttribute('aria-label', `Status for ${book.title}`);

  ['To Read', 'Reading', 'Finished'].forEach(s => {
    const opt = document.createElement('option');
    opt.value       = s;
    opt.textContent = STATUS_LABEL[s];
    if (s === book.status) opt.selected = true;
    sel.appendChild(opt);
  });

  sel.addEventListener('change', () => handleStatusChange(book.id, sel.value, sel));
  return sel;
}

/**
 * Build the delete button with an SVG trash icon
 * so it is always clearly visible.
 */
function buildDelBtn(book) {
  const btn = document.createElement('button');
  btn.className = 'btn-del';
  btn.title     = `Remove "${book.title}"`;
  btn.setAttribute('aria-label', `Remove ${book.title}`);

  // SVG trash icon — always visible red-tinted
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/>
      <path d="M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>`;

  btn.addEventListener('click', () => openDelOneModal(book.id));
  return btn;
}

/** Build a complete book card element */
function buildCard(book, idx) {
  const card = document.createElement('div');
  card.className  = 'book-card';
  card.dataset.id = book.id;

  // Index badge
  const badge = document.createElement('div');
  badge.className   = 'card-idx';
  badge.textContent = idx;
  badge.setAttribute('aria-hidden', 'true');

  // Text body
  const body = document.createElement('div');
  body.className = 'card-body';

  const titleEl = document.createElement('div');
  titleEl.className   = 'card-title-text';
  titleEl.textContent = book.title;

  const authorEl = document.createElement('div');
  authorEl.className = 'card-author';

  const bySpan = document.createElement('span');
  bySpan.className   = 'card-author-by';
  bySpan.textContent = 'by ';
  bySpan.setAttribute('aria-hidden', 'true');

  authorEl.appendChild(bySpan);
  authorEl.appendChild(document.createTextNode(book.author));

  body.appendChild(titleEl);
  body.appendChild(authorEl);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'card-actions';

  actions.appendChild(buildStatusSel(book));
  actions.appendChild(buildDelBtn(book));

  card.appendChild(badge);
  card.appendChild(body);
  card.appendChild(actions);

  return card;
}

/** Update the empty-state copy based on current context */
function updateEmptyState(hasBooks, filtered) {
  if (!hasBooks) {
    emptyTitle.textContent = 'Your shelf is empty';
    emptyBody.textContent  = 'Add your first book above to start tracking your reading journey.';
    btnEmptyCta.hidden = false;
  } else if (filtered.length === 0 && searchQuery) {
    emptyTitle.textContent = 'No results found';
    emptyBody.textContent  = `No books match "${searchQuery}". Try a different search.`;
    btnEmptyCta.hidden = true;
  } else {
    emptyTitle.textContent = 'No books in this category';
    emptyBody.textContent  = 'Try a different filter or add a new book.';
    btnEmptyCta.hidden = true;
  }
}

/** Full re-render of the list area */
function render() {
  const filtered = getFiltered();
  bookList.innerHTML = '';

  if (filtered.length === 0) {
    bookList.hidden   = true;
    emptyState.hidden = false;
    updateEmptyState(books.length > 0, filtered);
  } else {
    bookList.hidden   = false;
    emptyState.hidden = true;
    filtered.forEach((book, i) => {
      bookList.appendChild(buildCard(book, i + 1));
    });
  }

  updateStats();
}

/* ═══════════════════════════════════════════════
   EVENT HANDLERS
═══════════════════════════════════════════════ */

/** Form submit — add a book */
function handleAdd(e) {
  e.preventDefault();
  if (!validateForm()) {
    if (inputTitle.classList.contains('has-error')) inputTitle.focus();
    else inputAuthor.focus();
    return;
  }

  const book = {
    id:      Date.now(),
    title:   inputTitle.value.trim(),
    author:  inputAuthor.value.trim(),
    status:  inputStatus.value,
    addedAt: Date.now(),
  };

  books.unshift(book); // prepend → newest first
  saveBooks();
  render();

  showToast(`"${book.title}" added to your shelf!`, 'add');

  bookForm.reset();
  clearErr(inputTitle, errTitle);
  clearErr(inputAuthor, errAuthor);
  inputTitle.focus();
}

/** Status pill change on a book card */
function handleStatusChange(id, newStatus, selEl) {
  const book = books.find(b => b.id === id);
  if (!book) return;
  book.status = newStatus;
  saveBooks();
  // Re-colour the pill in-place (avoids full re-render flicker)
  selEl.className = `status-sel ${STATUS_CLASS[newStatus]}`;
  updateStats();
  showToast(`"${book.title}" → ${newStatus}`, 'update');
}

/** Search input */
function handleSearch() {
  searchQuery = searchInput.value;
  btnClearSearch.hidden = !searchQuery;
  render();
}

/** Clear search field */
function handleClearSearch() {
  searchInput.value = '';
  searchQuery = '';
  btnClearSearch.hidden = true;
  searchInput.focus();
  render();
}

/** Filter chip click */
function handleFilterClick(e) {
  const chip = e.currentTarget;
  activeFilter = chip.dataset.filter;
  filterChips.forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  render();
}

/** Sort select change */
function handleSortChange() {
  sortMode = sortSelect.value;
  render();
}

/** Reset filters + search */
function handleReset() {
  btnReset.classList.remove('spinning');
  void btnReset.offsetWidth;
  btnReset.classList.add('spinning');
  btnReset.addEventListener('animationend', () => btnReset.classList.remove('spinning'), { once: true });

  searchInput.value = '';
  searchQuery = '';
  btnClearSearch.hidden = true;
  activeFilter = 'All';
  filterChips.forEach(c => c.classList.remove('active'));
  document.getElementById('filterAll').classList.add('active');
  sortMode = 'newest';
  sortSelect.value = 'newest';
  render();
}

/* ── Delete One modal ─────────────────────────── */

function openDelOneModal(id) {
  const book = books.find(b => b.id === id);
  if (!book) return;
  deleteTarget = id;
  delOneBody.textContent = `"${book.title}" by ${book.author} will be permanently removed.`;
  delOneModal.hidden = false;
  btnDelOneConfirm.focus();
}

function closeDelOneModal() {
  delOneModal.hidden = true;
  deleteTarget = null;
}

function handleDelOneConfirm() {
  if (deleteTarget === null) return;

  const book  = books.find(b => b.id === deleteTarget);
  const title = book ? book.title : 'Book';
  const targetId = deleteTarget;

  // Animate card out, then remove from data
  const card = bookList.querySelector(`[data-id="${targetId}"]`);
  const doRemove = () => {
    books = books.filter(b => b.id !== targetId);
    deleteTarget = null;
    saveBooks();
    render();
  };

  if (card) {
    card.classList.add('removing');
    card.addEventListener('animationend', doRemove, { once: true });
  } else {
    doRemove();
  }

  closeDelOneModal();
  showToast(`"${title}" removed`, 'delete');
}

/* ── Clear All modal ──────────────────────────── */

function openClearAllModal() {
  if (books.length === 0) return;
  clearCount.textContent = books.length === 1 ? '1 book' : `all ${books.length} books`;
  clearAllModal.hidden = false;
  btnClearAllConfirm.focus();
}

function closeClearAllModal() {
  clearAllModal.hidden = true;
}

function handleClearAllConfirm() {
  const count = books.length;
  books = [];
  saveBooks();
  render();
  closeClearAllModal();
  showToast(`${count} book${count !== 1 ? 's' : ''} cleared`, 'delete');
}

/* ── Empty state CTA ─────────────────────────── */

function handleEmptyCta() {
  inputTitle.focus();
  inputTitle.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ── Keyboard ────────────────────────────────── */

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!delOneModal.hidden)    closeDelOneModal();
    if (!clearAllModal.hidden)  closeClearAllModal();
  }
});

/* ── Live clear errors on typing ─────────────── */

inputTitle.addEventListener('input',  () => clearErr(inputTitle,  errTitle));
inputAuthor.addEventListener('input', () => clearErr(inputAuthor, errAuthor));

/* ═══════════════════════════════════════════════
   WIRE UP EVENTS
═══════════════════════════════════════════════ */

bookForm.addEventListener('submit',  handleAdd);
searchInput.addEventListener('input', handleSearch);
btnClearSearch.addEventListener('click', handleClearSearch);
filterChips.forEach(chip => chip.addEventListener('click', handleFilterClick));
sortSelect.addEventListener('change', handleSortChange);
btnReset.addEventListener('click',    handleReset);
btnClearAll.addEventListener('click', openClearAllModal);

// Delete One modal
btnDelOneConfirm.addEventListener('click', handleDelOneConfirm);
btnDelOneCancel.addEventListener('click',  closeDelOneModal);
delOneModal.addEventListener('click', e => { if (e.target === delOneModal) closeDelOneModal(); });

// Clear All modal
btnClearAllConfirm.addEventListener('click', handleClearAllConfirm);
btnClearAllCancel.addEventListener('click',  closeClearAllModal);
clearAllModal.addEventListener('click', e => { if (e.target === clearAllModal) closeClearAllModal(); });

// Empty state CTA
btnEmptyCta.addEventListener('click', handleEmptyCta);

/* ═══════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════ */

books = loadBooks();
render();
