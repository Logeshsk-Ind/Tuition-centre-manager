(() => {
  'use strict';

  const STORAGE_KEY = 'tuition_centre_data_v1';
  const DEFAULT_CLASSES = [
    'L.K.G.', 'U.K.G.', 'Class 1', 'Class 2', 'Class 3', 'Class 4',
    'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
    'Class 11', 'Class 12',
  ];
  const DEFAULT_BOARDS = ['CBSE', 'ICSE', 'State Board', 'Other'];
  const COLOR_THEMES = [
    { id: 'burgundy', label: 'Burgundy', color: '#82384f' },
    { id: 'soft-pink', label: 'Soft pink', color: '#b95f83' },
    { id: 'glacier', label: 'Glacier', color: '#347c96' },
    { id: 'lavender', label: 'Lavender', color: '#785da0' },
    { id: 'sage', label: 'Sage', color: '#54765b' },
    { id: 'mist-blue', label: 'Mist blue', color: '#4d76a6' },
    { id: 'light-gold', label: 'Light gold', color: '#9b6c20' },
  ];
  const app = document.querySelector('#app');
  const dialog = document.querySelector('#app-dialog');
  const toastElement = document.querySelector('#toast');
  const state = {
    boards: [],
    students: [],
    payments: [],
    customFields: [],
    appearance: { mode: 'light', color: 'sage' },
    page: 'home',
    feeMonth: currentMonth(),
    search: '',
  };
  let toastTimer;

  function currentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  function monthLabel(month) {
    const [year, value] = month.split('-').map(Number);
    return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' })
      .format(new Date(year, value - 1, 1));
  }

  function money(amount, decimals = 2) {
    return `₹${Number(amount || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    })}`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
  }

  function freshData() {
    return {
      boards: DEFAULT_BOARDS.map((name) => ({ name, classes: [...DEFAULT_CLASSES] })),
      students: [],
      payments: [],
      customFields: [],
      appearance: { mode: 'light', color: 'sage' },
    };
  }

  function validData(data) {
    return data && Array.isArray(data.boards) && Array.isArray(data.students)
      && Array.isArray(data.payments) && Array.isArray(data.customFields)
      && (data.appearance === undefined || (
        data.appearance && ['light', 'dark'].includes(data.appearance.mode)
        && COLOR_THEMES.some((theme) => theme.id === data.appearance.color)
      ))
      && data.boards.every((board) => board && typeof board.name === 'string'
        && Array.isArray(board.classes) && board.classes.every((name) => typeof name === 'string'))
      && data.students.every((student) => student && typeof student.id === 'string'
        && typeof student.name === 'string' && typeof student.parentName === 'string'
        && typeof student.mobileNumber === 'string' && typeof student.board === 'string'
        && typeof student.className === 'string' && typeof student.joiningMonth === 'string'
        && /^\d{4}-\d{2}$/.test(student.joiningMonth)
        && Number.isFinite(Number(student.monthlyFee)) && Number(student.monthlyFee) > 0
        && (!student.customFields || (typeof student.customFields === 'object'
          && !Array.isArray(student.customFields)
          && Object.values(student.customFields).every((value) => typeof value === 'string'))))
      && data.payments.every((payment) => payment && typeof payment.id === 'string'
        && typeof payment.studentId === 'string' && Number.isFinite(Number(payment.amount))
        && Number(payment.amount) > 0 && typeof payment.month === 'string'
        && /^\d{4}-\d{2}$/.test(payment.month)
        && ['UPI', 'Cash'].includes(payment.method)
        && typeof payment.paidAt === 'string')
      && data.customFields.every((field) => typeof field === 'string');
  }

  function loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === null) {
        Object.assign(state, freshData());
        persist();
        return;
      }
      const data = JSON.parse(saved);
      if (!validData(data)) throw new Error('The saved data has an unexpected format.');
      Object.assign(state, data);
      if (!data.appearance) state.appearance = { mode: 'light', color: 'sage' };
    } catch (error) {
      app.innerHTML = `<section class="card empty"><strong>Could not open saved data</strong>
        <p>${escapeHtml(error.message || 'This browser could not read local storage.')}</p>
        <p class="help">Your saved records were not replaced. Check browser storage access and reload.</p></section>`;
      throw error;
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        boards: state.boards,
        students: state.students,
        payments: state.payments,
        customFields: state.customFields,
        appearance: state.appearance,
      }));
      return true;
    } catch (error) {
      showToast(`Could not save your changes: ${error.message || 'device storage is unavailable.'}`);
      return false;
    }
  }

  function showToast(message) {
    toastElement.textContent = message;
    toastElement.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastElement.classList.remove('visible'), 3200);
  }

  function id() {
    return globalThis.crypto?.randomUUID?.()
      || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function paidFor(studentId, month) {
    return state.payments
      .filter((payment) => payment.studentId === studentId && payment.month === month)
      .reduce((total, payment) => total + Number(payment.amount), 0);
  }

  function isActiveInMonth(student, month) {
    return student.joiningMonth <= month;
  }

  function monthCollected(month) {
    return state.payments
      .filter((payment) => payment.month === month)
      .reduce((total, payment) => total + Number(payment.amount), 0);
  }

  function pendingFor(month) {
    return state.students.filter((student) => isActiveInMonth(student, month))
      .reduce((total, student) => total + Math.max(0, Number(student.monthlyFee) - paidFor(student.id, month)), 0);
  }

  function render() {
    applyAppearance();
    document.querySelectorAll('.bottom-nav [data-page]').forEach((button) => {
      const active = button.dataset.page === state.page;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    const pages = {
      home: renderHome,
      students: renderStudents,
      fees: renderFees,
      settings: renderSettings,
    };
    app.innerHTML = pages[state.page]();
  }

  function applyAppearance() {
    const root = document.documentElement;
    root.dataset.mode = state.appearance.mode;
    root.dataset.theme = state.appearance.color;
    const theme = COLOR_THEMES.find((item) => item.id === state.appearance.color);
    const themeColor = state.appearance.mode === 'dark' ? '#211e27' : theme.color;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
    document.querySelector('meta[name="color-scheme"]')?.setAttribute(
      'content',
      state.appearance.mode,
    );
  }

  function renderHome() {
    const month = currentMonth();
    const boards = state.boards.length
      ? state.boards.map((board) => {
        const count = state.students.filter((student) => student.board === board.name).length;
        return `<article class="card board-summary"><div><strong>${escapeHtml(board.name)}</strong>
          <p>${board.classes.length} classes</p></div><span class="badge">${count} ${count === 1 ? 'student' : 'students'}</span></article>`;
      }).join('')
      : '<article class="card empty"><strong>No boards yet</strong><p>Add a board in Settings to get started.</p></article>';
    return `<section aria-labelledby="page-title">
      <div class="page-heading"><div><p class="eyebrow">${escapeHtml(monthLabel(month))}</p><h1 id="page-title">Dashboard</h1></div></div>
      <div class="grid metrics">
        ${metric('♙', state.students.length, 'Total students')}
        ${metric('₹', money(monthCollected(month)), 'Fees collected')}
        ${metric('◷', money(pendingFor(month)), 'Pending payments')}
        ${metric('▤', state.boards.length, 'Boards')}
      </div>
      <h2>Quick actions</h2>
      <div class="card actions-card">
        <button class="quick-action" data-action="go-students"><span class="quick-icon">＋</span><span><strong>Add a student</strong><small>Create a student profile</small></span><span class="arrow">›</span></button>
        <button class="quick-action" data-action="go-fees"><span class="quick-icon">₹</span><span><strong>Manage monthly fees</strong><small>Record payments and check balances</small></span><span class="arrow">›</span></button>
      </div>
      <h2>Students by board</h2>${boards}
    </section>`;
  }

  function metric(icon, value, label) {
    return `<article class="card metric"><span class="metric-icon" aria-hidden="true">${icon}</span>
      <strong class="metric-value">${escapeHtml(value)}</strong><span class="metric-label">${escapeHtml(label)}</span></article>`;
  }

  function renderStudents() {
    return `<section aria-labelledby="page-title">
      <div class="page-heading"><div><p class="eyebrow">Manage enrolments</p><h1 id="page-title">Students</h1></div>
        <button class="button" data-action="add-student">＋ Add student</button></div>
      <div class="toolbar"><label class="visually-hidden" for="student-search">Search students</label>
        <input id="student-search" type="search" placeholder="Name, parent, mobile, board or class" value="${escapeHtml(state.search)}"></div>
      <div id="student-list">${renderStudentList()}</div>
    </section>`;
  }

  function renderStudentList() {
    const query = state.search.trim().toLocaleLowerCase();
    const visible = state.students.filter((student) => [
      student.name, student.parentName, student.mobileNumber, student.board, student.className,
      ...Object.values(student.customFields || {}),
    ].some((value) => String(value).toLocaleLowerCase().includes(query)));
    if (!visible.length) {
      return `<article class="card empty"><strong>${query ? 'No matching students' : 'No students yet'}</strong>
        <p>${query ? 'Try another name, parent, mobile number or class.' : 'Add a student to start organizing your classes.'}</p></article>`;
    }
    const groups = state.boards.map((board) => {
      const boardStudents = visible.filter((student) => student.board === board.name);
      if (!boardStudents.length) return '';
      const classes = [...new Set(boardStudents.map((student) => student.className))];
      return `<details class="card student-group" open><summary><span><strong>${escapeHtml(board.name)}</strong>
        <small>${boardStudents.length} ${boardStudents.length === 1 ? 'student' : 'students'}</small></span></summary>
        ${classes.map((className) => {
          const classStudents = boardStudents.filter((student) => student.className === className);
          return `<details class="class-group" open><summary><span><strong>${escapeHtml(className)}</strong>
            <small>${classStudents.length} ${classStudents.length === 1 ? 'student' : 'students'}</small></span></summary>
            ${classStudents.map(studentRow).join('')}</details>`;
        }).join('')}</details>`;
    }).join('');
    const ungrouped = visible.filter((student) => !state.boards.some((board) => board.name === student.board));
    return groups + ungrouped.map(studentRow).join('');
  }

  function studentRow(student) {
    return `<article class="student-row"><span class="avatar">${escapeHtml(student.name[0]?.toLocaleUpperCase() || '?')}</span>
      <div class="student-info"><strong>${escapeHtml(student.name)}</strong>
        <small>${escapeHtml(student.parentName)} · ${escapeHtml(student.mobileNumber)}</small></div>
      <button class="icon-button" data-action="edit-student" data-id="${escapeHtml(student.id)}" aria-label="Edit ${escapeHtml(student.name)}">✎</button>
      <button class="icon-button" data-action="delete-student" data-id="${escapeHtml(student.id)}" aria-label="Delete ${escapeHtml(student.name)}">⋮</button></article>`;
  }

  function renderFees() {
    const monthStudents = state.students.filter((student) => isActiveInMonth(student, state.feeMonth))
      .sort((a, b) => a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase()));
    const rows = monthStudents.length
      ? monthStudents.map((student) => {
        const paid = paidFor(student.id, state.feeMonth);
        const due = Math.max(0, Number(student.monthlyFee) - paid);
        const status = due === 0 ? 'Paid' : paid > 0 ? 'Part-paid' : 'Pending';
        const history = state.payments.filter((payment) => payment.studentId === student.id && payment.month === state.feeMonth);
        return `<details class="card fee-student"><summary><span class="fee-person"><strong>${escapeHtml(student.name)}</strong>
          <small>${escapeHtml(student.board)} · ${escapeHtml(student.className)} · ${status}</small></span>
          <span class="${due === 0 ? 'paid' : 'due'}">${due === 0 ? 'Paid' : `Due ${money(due)}`}</span></summary>
          <div class="fee-details"><p>Monthly fee ${money(student.monthlyFee)} · Paid ${money(paid)}</p>
            ${history.map((payment) => `<div class="payment-row"><span>${money(payment.amount)} · ${escapeHtml(payment.method)}</span>
              <small>${escapeHtml(dateLabel(payment.paidAt))}</small></div>`).join('')}
            ${due > 0 ? `<button class="button secondary full" data-action="record-payment" data-id="${escapeHtml(student.id)}">＋ Record payment</button>` : ''}
          </div></details>`;
      }).join('')
      : '<article class="card empty"><strong>No students for this month</strong><p>No students have joined by this month.</p></article>';
    return `<section aria-labelledby="page-title">
      <div class="page-heading"><div><p class="eyebrow">Payments and balances</p><h1 id="page-title">Fee management</h1></div></div>
      <div class="month-picker"><button class="icon-button" data-action="previous-month" aria-label="Previous month">‹</button>
        <label class="visually-hidden" for="fee-month">Choose fee month</label>
        <input id="fee-month" type="month" value="${escapeHtml(state.feeMonth)}">
        <button class="icon-button" data-action="next-month" aria-label="Next month">›</button></div>
      <div class="grid"><article class="card amount-card"><span class="metric-icon">✓</span><span><small>Collected</small><strong>${money(monthCollected(state.feeMonth))}</strong></span></article>
        <article class="card amount-card"><span class="metric-icon">◷</span><span><small>Still due</small><strong>${money(pendingFor(state.feeMonth))}</strong></span></article></div>
      <h2>${escapeHtml(monthLabel(state.feeMonth))}</h2>${rows}
    </section>`;
  }

  function renderSettings() {
    const appearance = `<section aria-labelledby="appearance-title">
      <h2 id="appearance-title">Appearance</h2>
      <p class="help">Choose a display mode and accent color. Your preference is saved on this device.</p>
      <article class="card settings-card appearance-card">
        <div class="appearance-section">
          <strong class="appearance-label">Display mode</strong>
          <div class="segmented-control" role="group" aria-label="Display mode">
            <button type="button" class="mode-button ${state.appearance.mode === 'light' ? 'selected' : ''}"
              data-action="set-mode" data-mode="light" aria-pressed="${state.appearance.mode === 'light'}">☀ Light</button>
            <button type="button" class="mode-button ${state.appearance.mode === 'dark' ? 'selected' : ''}"
              data-action="set-mode" data-mode="dark" aria-pressed="${state.appearance.mode === 'dark'}">☾ Dark</button>
          </div>
        </div>
        <div class="appearance-section">
          <strong class="appearance-label">Theme color</strong>
          <div class="theme-swatches" role="group" aria-label="Theme color">
            ${COLOR_THEMES.map((theme) => `<button type="button" class="theme-swatch ${state.appearance.color === theme.id ? 'selected' : ''}"
              style="--swatch-color:${theme.color}" data-action="set-color" data-color="${theme.id}"
              aria-label="${theme.label}" aria-pressed="${state.appearance.color === theme.id}">
              <span class="swatch-dot" aria-hidden="true"></span><span>${theme.label}</span>
            </button>`).join('')}
          </div>
        </div>
      </article>
    </section>`;
    const boards = state.boards.length
      ? state.boards.map((board) => `<details class="card settings-card"><summary><span><strong>${escapeHtml(board.name)}</strong>
          <small>${board.classes.length} classes</small></span><span class="arrow">⌄</span></summary>
        <div class="settings-content"><div class="button-row">
          <button class="button secondary small" data-action="rename-board" data-name="${escapeHtml(board.name)}">Rename board</button>
          <button class="button danger small" data-action="delete-board" data-name="${escapeHtml(board.name)}">Delete board</button></div>
          ${board.classes.map((name) => `<div class="class-row"><span>${escapeHtml(name)}</span>
            <button class="icon-button" data-action="rename-class" data-board="${escapeHtml(board.name)}" data-name="${escapeHtml(name)}" aria-label="Rename ${escapeHtml(name)}">✎</button>
            ${DEFAULT_CLASSES.includes(name) ? '<span class="badge">Default</span>' : `<button class="icon-button" data-action="delete-class" data-board="${escapeHtml(board.name)}" data-name="${escapeHtml(name)}" aria-label="Delete ${escapeHtml(name)}">×</button>`}
          </div>`).join('')}
          <button class="button secondary full" data-action="add-class" data-board="${escapeHtml(board.name)}">＋ Add custom class</button>
        </div></details>`).join('')
      : '<article class="card empty"><strong>No boards added yet</strong><p>Create a board before adding students.</p></article>';
    const fields = state.customFields.length
      ? state.customFields.map((name) => `<div class="setting-row"><span>${escapeHtml(name)}</span>
          <button class="icon-button" data-action="delete-field" data-name="${escapeHtml(name)}" aria-label="Remove ${escapeHtml(name)}">×</button></div>`).join('')
      : '<p class="help">No custom fields. Add optional details to student profiles.</p>';
    return `<section aria-labelledby="page-title">
      <div class="page-heading"><div><p class="eyebrow">Centre setup and data</p><h1 id="page-title">Settings</h1></div></div>
      ${appearance}
      <div class="section-actions"><h2>Boards and classes</h2><button class="button small" data-action="add-board">＋ Add board</button></div>
      <p class="help">Manage the boards and classes used for student profiles.</p>${boards}
      <div class="section-actions"><h2>Custom student fields</h2><button class="button secondary small" data-action="add-field">＋ Add field</button></div>
      <p class="help">Optional text fields shown on every student profile.</p>
      <article class="card settings-card">${fields}</article>
      <h2>Backup and install</h2>
      <article class="card settings-card install-note"><strong>Stored on this device</strong>
        <p>Student details and fee payments stay in this browser. Export a backup regularly; records do not automatically sync to another phone.</p>
        <div class="button-row" style="margin-top:12px">
          <button class="button secondary small" data-action="export-data">Export backup</button>
          <button class="button secondary small" data-action="import-data">Import backup</button>
          <input id="import-file" type="file" accept="application/json,.json" hidden>
        </div></article>
      <article class="card settings-card install-note"><strong>Install on your phone</strong>
        <p>Open this app’s secure website in Chrome (Android) or Safari (iPhone), then choose “Add to Home Screen” or “Install app” in the browser menu. Open it once online first; it can then work offline.</p></article>
    </section>`;
  }

  function dateLabel(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Date unavailable'
      : new Intl.DateTimeFormat('en', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(date);
  }

  function showDialog(title, body, submitLabel = 'Save') {
    dialog.innerHTML = `<form class="dialog-content" id="dialog-form"><h2 id="dialog-title">${escapeHtml(title)}</h2>
      ${body}<p class="form-error" id="form-error" role="alert"></p>
      <div class="dialog-actions"><button type="button" class="button secondary" data-action="close-dialog">Cancel</button>
        <button type="submit" class="button">${escapeHtml(submitLabel)}</button></div></form>`;
    dialog.showModal();
  }

  function inputField(label, name, value = '', type = 'text', required = false, extra = '') {
    return `<div class="form-field"><label for="field-${escapeHtml(name)}">${escapeHtml(label)}</label>
      <input id="field-${escapeHtml(name)}" name="${escapeHtml(name)}" type="${type}" value="${escapeHtml(value)}"
        ${required ? 'required' : ''} ${extra}></div>`;
  }

  function openStudentForm(studentId = '') {
    if (!state.boards.length) {
      showToast('Add a board in Settings before adding students.');
      return;
    }
    const student = state.students.find((item) => item.id === studentId);
    const initialBoard = student?.board || state.boards[0]?.name || '';
    const board = state.boards.find((item) => item.name === initialBoard);
    const initialClass = student?.className || board?.classes[0] || '';
    const extraFields = state.customFields.map((field) =>
      inputField(field, `custom:${field}`, student?.customFields?.[field] || ''),
    ).join('');
    const body = state.boards.length ? `
      <div class="form-grid">
        ${inputField('Student name', 'name', student?.name || '', 'text', true, 'autocomplete="name"')}
        ${inputField('Parent name', 'parentName', student?.parentName || '', 'text', true)}
        ${inputField('Mobile number', 'mobileNumber', student?.mobileNumber || '', 'tel', true, 'inputmode="tel"')}
        <div class="form-field"><label for="field-board">Board</label><select id="field-board" name="board" required>
          ${state.boards.map((item) => `<option value="${escapeHtml(item.name)}" ${item.name === initialBoard ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
        </select></div>
        <div class="form-field"><label for="field-className">Class</label><select id="field-className" name="className" required>
          ${(board?.classes || []).map((name) => `<option value="${escapeHtml(name)}" ${name === initialClass ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}
        </select></div>
        ${inputField('Joining month', 'joiningMonth', student?.joiningMonth || currentMonth(), 'month', true)}
        ${inputField('Monthly fee amount (₹)', 'monthlyFee', student?.monthlyFee ?? '', 'number', true, 'min="0.01" step="0.01" inputmode="decimal"')}
        ${extraFields ? `<div><h3>Additional details</h3></div>${extraFields}` : ''}
      </div><input type="hidden" name="studentId" value="${escapeHtml(student?.id || '')}">`
      : '<p>Add a board in Settings before adding students.</p>';
    showDialog(student ? 'Edit student' : 'Add student', body, student ? 'Save changes' : 'Add student');
  }

  function openPaymentForm(student) {
    const due = Math.max(0, Number(student.monthlyFee) - paidFor(student.id, state.feeMonth));
    showDialog(`Record payment · ${student.name}`, `
      <div class="form-grid">${inputField('Amount (₹)', 'amount', due.toFixed(2), 'number', true, 'min="0.01" step="0.01" inputmode="decimal"')}
        <div class="form-field"><label for="field-method">Payment method</label>
          <select id="field-method" name="method"><option>UPI</option><option>Cash</option></select></div></div>
      <input type="hidden" name="studentId" value="${escapeHtml(student.id)}">`, 'Save payment');
  }

  function openNameForm(title, values, fields = []) {
    const body = `<div class="form-grid">${inputField('Name', 'name', values.value || '', 'text', true)}
      ${fields.map((field) => field).join('')}</div>
      ${values.board ? `<input type="hidden" name="board" value="${escapeHtml(values.board)}">` : ''}
      ${values.oldName ? `<input type="hidden" name="oldName" value="${escapeHtml(values.oldName)}">` : ''}
      ${values.kind ? `<input type="hidden" name="kind" value="${escapeHtml(values.kind)}">` : ''}`;
    showDialog(title, body);
  }

  function setFormError(message) {
    const element = document.querySelector('#form-error');
    if (element) element.textContent = message;
  }

  function changeMonth(amount) {
    const [year, month] = state.feeMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + amount, 1);
    state.feeMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    render();
  }

  function saveStudent(form) {
    const values = new FormData(form);
    const mobile = String(values.get('mobileNumber')).trim();
    const digits = mobile.replace(/\D/g, '');
    const fee = Number(values.get('monthlyFee'));
    if (digits.length < 7 || digits.length > 15) {
      setFormError('Enter a valid mobile number (7–15 digits).');
      return;
    }
    if (!Number.isFinite(fee) || fee <= 0) {
      setFormError('Enter a monthly fee greater than zero.');
      return;
    }
    const studentId = String(values.get('studentId') || id());
    const student = {
      id: studentId,
      name: String(values.get('name')).trim(),
      parentName: String(values.get('parentName')).trim(),
      mobileNumber: mobile,
      board: String(values.get('board')),
      className: String(values.get('className')),
      joiningMonth: String(values.get('joiningMonth')),
      monthlyFee: fee,
      customFields: Object.fromEntries(state.customFields.map((field) =>
        [field, String(values.get(`custom:${field}`) || '').trim()])),
    };
    if (!student.name || !student.parentName || !student.joiningMonth || !student.board || !student.className) {
      setFormError('Complete all required fields.');
      return;
    }
    const index = state.students.findIndex((item) => item.id === studentId);
    if (index >= 0) state.students[index] = student;
    else state.students.push(student);
    const saved = persist();
    dialog.close();
    state.search = '';
    state.page = 'students';
    render();
    if (saved) showToast(index >= 0 ? 'Student details updated.' : 'Student added.');
  }

  function savePayment(form) {
    const values = new FormData(form);
    const amount = Number(values.get('amount'));
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Enter an amount greater than zero.');
      return;
    }
    state.payments.push({
      id: id(),
      studentId: String(values.get('studentId')),
      amount,
      month: state.feeMonth,
      method: String(values.get('method')),
      paidAt: new Date().toISOString(),
    });
    const saved = persist();
    dialog.close();
    render();
    if (saved) showToast('Payment recorded.');
  }

  function saveNamedItem(form) {
    const values = new FormData(form);
    const name = String(values.get('name') || '').trim();
    const oldName = String(values.get('oldName') || '');
    const boardName = String(values.get('board') || '');
    const kind = String(values.get('kind') || '');
    if (!name) {
      setFormError('Name cannot be empty.');
      return;
    }
    const duplicate = (items) => items.some((item) => item.toLocaleLowerCase() === name.toLocaleLowerCase());
    try {
      if (kind === 'board-add') {
        if (duplicate(state.boards.map((board) => board.name))) throw new Error('A board with this name already exists.');
        state.boards.push({ name, classes: [...DEFAULT_CLASSES] });
      } else if (kind === 'board-rename') {
        if (duplicate(state.boards.filter((board) => board.name !== oldName).map((board) => board.name))) throw new Error('A board with this name already exists.');
        state.boards.find((board) => board.name === oldName).name = name;
        state.students.forEach((student) => { if (student.board === oldName) student.board = name; });
      } else if (kind === 'class-add') {
        const board = state.boards.find((item) => item.name === boardName);
        if (!board) throw new Error('The selected board no longer exists.');
        if (duplicate(board.classes)) throw new Error('This class already exists on the selected board.');
        board.classes.push(name);
      } else if (kind === 'class-rename') {
        const board = state.boards.find((item) => item.name === boardName);
        if (!board) throw new Error('The selected board no longer exists.');
        if (duplicate(board.classes.filter((item) => item !== oldName))) throw new Error('This class already exists on the selected board.');
        board.classes = board.classes.map((item) => item === oldName ? name : item);
        state.students.forEach((student) => {
          if (student.board === boardName && student.className === oldName) student.className = name;
        });
      } else if (kind === 'field-add') {
        if (duplicate(state.customFields)) throw new Error('A custom field with this name already exists.');
        state.customFields.push(name);
      }
      persist();
      dialog.close();
      render();
    } catch (error) {
      setFormError(error.message);
    }
  }

  function deleteStudent(studentId) {
    const student = state.students.find((item) => item.id === studentId);
    if (!student || !window.confirm(`Delete ${student.name} and their fee payment history?`)) return;
    state.students = state.students.filter((item) => item.id !== studentId);
    state.payments = state.payments.filter((payment) => payment.studentId !== studentId);
    const saved = persist();
    render();
    if (saved) showToast('Student and payment history deleted.');
  }

  function removeBoard(name) {
    if (state.students.some((student) => student.board === name)) {
      showToast('Move or remove this board’s students before deleting it.');
      return;
    }
    if (!window.confirm(`Delete "${name}" and its classes?`)) return;
    state.boards = state.boards.filter((board) => board.name !== name);
    persist();
    render();
  }

  function removeClass(boardName, className) {
    if (DEFAULT_CLASSES.includes(className)) {
      showToast('Default classes cannot be deleted.');
      return;
    }
    if (state.students.some((student) => student.board === boardName && student.className === className)) {
      showToast('Move or remove this class’s students before deleting it.');
      return;
    }
    if (!window.confirm(`Delete "${className}" from ${boardName}?`)) return;
    const board = state.boards.find((item) => item.name === boardName);
    board.classes = board.classes.filter((name) => name !== className);
    persist();
    render();
  }

  function removeCustomField(name) {
    if (!window.confirm(`Remove "${name}" and its saved values from all students?`)) return;
    state.customFields = state.customFields.filter((field) => field !== name);
    state.students.forEach((student) => { delete student.customFields?.[name]; });
    persist();
    render();
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({
      boards: state.boards, students: state.students, payments: state.payments,
      customFields: state.customFields, appearance: state.appearance,
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tuition-centre-backup-${currentMonth()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Backup downloaded.');
  }

  function importData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!validData(data)) throw new Error('This file is not a valid tuition centre backup.');
        if (!window.confirm('Importing replaces the records currently saved on this device. Continue?')) return;
        Object.assign(state, data);
        if (!data.appearance) state.appearance = { mode: 'light', color: 'sage' };
        const saved = persist();
        render();
        if (saved) showToast('Backup imported.');
      } catch (error) {
        showToast(`Could not import backup: ${error.message}`);
      }
    };
    reader.onerror = () => showToast('Could not read the selected backup file.');
    reader.readAsText(file);
  }

  document.querySelector('.bottom-nav').addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (!button) return;
    state.page = button.dataset.page;
    render();
  });

  app.addEventListener('input', (event) => {
    if (event.target.id === 'student-search') {
      state.search = event.target.value;
      const list = document.querySelector('#student-list');
      if (list) list.innerHTML = renderStudentList();
    }
  });

  app.addEventListener('change', (event) => {
    if (event.target.id === 'fee-month' && /^\d{4}-\d{2}$/.test(event.target.value)) {
      state.feeMonth = event.target.value;
      render();
    }
    if (event.target.id === 'import-file') importData(event.target.files?.[0]);
  });

  dialog.addEventListener('change', (event) => {
    if (event.target.name !== 'board') return;
    const board = state.boards.find((item) => item.name === event.target.value);
    const select = dialog.querySelector('[name="className"]');
    select.innerHTML = (board?.classes || []).map((name) =>
      `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  });

  dialog.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.target;
    const fields = new FormData(form);
    if (fields.has('studentId') && fields.has('monthlyFee')) saveStudent(form);
    else if (fields.has('studentId') && fields.has('amount')) savePayment(form);
    else saveNamedItem(form);
  });

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { action, id: itemId, name, board } = button.dataset;
    if (action === 'go-students') { state.page = 'students'; render(); }
    else if (action === 'go-fees') { state.page = 'fees'; render(); }
    else if (action === 'add-student') openStudentForm();
    else if (action === 'edit-student') openStudentForm(itemId);
    else if (action === 'delete-student') deleteStudent(itemId);
    else if (action === 'record-payment') {
      const student = state.students.find((item) => item.id === itemId);
      if (student) openPaymentForm(student);
    } else if (action === 'previous-month') changeMonth(-1);
    else if (action === 'next-month') changeMonth(1);
    else if (action === 'add-board') openNameForm('Add board', { kind: 'board-add' });
    else if (action === 'rename-board') openNameForm('Rename board', { kind: 'board-rename', oldName: name, value: name });
    else if (action === 'delete-board') removeBoard(name);
    else if (action === 'add-class') openNameForm(`Add class to ${board}`, { kind: 'class-add', board });
    else if (action === 'rename-class') openNameForm('Rename class', { kind: 'class-rename', board, oldName: name, value: name });
    else if (action === 'delete-class') removeClass(board, name);
    else if (action === 'add-field') openNameForm('Add student field', { kind: 'field-add' });
    else if (action === 'delete-field') removeCustomField(name);
    else if (action === 'set-mode' && ['light', 'dark'].includes(button.dataset.mode)) {
      state.appearance.mode = button.dataset.mode;
      const saved = persist();
      render();
      if (saved) showToast(`${button.dataset.mode === 'dark' ? 'Dark' : 'Light'} mode enabled.`);
    }
    else if (action === 'set-color' && COLOR_THEMES.some((theme) => theme.id === button.dataset.color)) {
      state.appearance.color = button.dataset.color;
      const selectedTheme = COLOR_THEMES.find((theme) => theme.id === button.dataset.color);
      const saved = persist();
      render();
      if (saved) showToast(`${selectedTheme.label} theme selected.`);
    }
    else if (action === 'close-dialog') dialog.close();
    else if (action === 'export-data') exportData();
    else if (action === 'import-data') document.querySelector('#import-file')?.click();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((error) => {
        console.error('Offline support could not be enabled.', error);
      });
    });
  }

  loadData();
  render();
})();
