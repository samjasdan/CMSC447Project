// =============================================================================
// UTILITY HELPERS
// =============================================================================

const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);
const on = (el, event, handler) => el?.addEventListener(event, handler);

const onEnter = (el, handler) => {
  on(el, 'keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handler(e); }
  });
};

const setVal     = (id, value) => { const el = $(id); if (el) el.value = value; };
const setHidden  = (id, hidden) => { const el = $(id); if (el) el.hidden = hidden; };
const clearVal   = (id) => setVal(id, '');
const clearFields = (ids) => ids.forEach(id => { const el = $(id); if (el) el.value = ''; });

const toggleDisplay = (el, show) => { if (el) el.style.display = show ? '' : 'none'; };
const pluralSuffix  = (count) => (count !== 1 ? 's' : '');

function throttle(callback, limit) {
  let waiting = false;
  return function (...args) {
    if (waiting) return;
    callback.apply(this, args);
    waiting = true;
    setTimeout(() => { waiting = false; }, limit);
  };
}


// =============================================================================
// DISPLAY FORMATTERS
// =============================================================================

function formatDisplayDate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${m}-${d}-${y}`;
}

function formatDisplayTime(timeValue) {
  if (!timeValue) return '';
  const match = String(timeValue).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*((?:a|p)\.m\.))?$/i);
  if (!match) return timeValue;
  let hour   = parseInt(match[1], 10);
  const min  = match[2];
  let ampm   = match[3];
  if (!ampm) {
    ampm = hour >= 12 ? 'p.m.' : 'a.m.';
    hour = hour % 12 || 12;
  }
  return `${hour}:${min} ${ampm}`;
}

function formatDisplayRole(role) {
  return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}


// =============================================================================
// DOM / TABLE HELPERS
// =============================================================================

function findTableRow(tableId, attr, id) {
  return document.querySelector(`#${tableId} tbody tr[data-${attr}="${id}"]`);
}

function removeTableRow(entityLabel, id) {
  const attr = entityLabel !== 'account' ? entityLabel : 'user';
  const tableId = `${entityLabel}-table`;
  findTableRow(tableId, `${attr}-id`, id)?.remove();
  reapplyTableFilter(tableId);
}

function upsertTableRow(tableId, attr, id, rowHTML) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  if (!tbody) return;

  const temp = document.createElement('tbody');
  temp.innerHTML = rowHTML.trim();
  const newRow = temp.firstElementChild;

  const existing = findTableRow(tableId, attr, id);
  existing ? existing.replaceWith(newRow) : tbody.prepend(newRow);

  reapplyTableFilter(tableId);
}

function removeTutorRelatedRows(userId) {
  $$(`#event-table    tbody tr[data-user-id="${userId}"]`).forEach(r => r.remove());
  $$(`#schedule-table tbody tr[data-user-id="${userId}"]`).forEach(r => r.remove());
}


// =============================================================================
// ROW BUILDERS
// =============================================================================

const EVENT_TYPE_KEYS = {
  '1': 'called_out',
  '2': 'late',
  '3': 'leaving_early',
  '4': 'at_capacity',
};

function buildEventRow(e) {
  const typeKey      = EVENT_TYPE_KEYS[e.event_type];
  const finalDay     = typeKey === 'called_out'    ? formatDisplayDate(e.final_day) : '—';
  const duration     = typeKey === 'leaving_early' ? e.duration                     : '—';

  const userRow  = document.querySelector(`#account-table tr[data-user-id="${e.user_id}"]`);
  const nameCell = userRow?.children[1]?.textContent?.trim();
  const idCell   = userRow?.children[0]?.textContent?.trim();
  const userLabel = nameCell ? `${nameCell}${idCell ? ` (${idCell})` : ''}` : String(e.user_id);

  const typeOption   = document.querySelector(`#event_type option[value="${e.event_type}"]`);
  const eventTypeLabel = typeOption ? typeOption.textContent.trim() : String(e.event_type);

  return `
    <tr
      data-event-id="${e.event_id}"
      data-user-id="${e.user_id}"
      data-event-type="${e.event_type}"
      data-start-day="${e.start_day}"
      data-final-day="${e.final_day || ''}"
      data-duration="${e.duration || ''}"
    >
      <td>${userLabel}</td>
      <td>${eventTypeLabel}</td>
      <td>${formatDisplayDate(e.start_day)}</td>
      <td>${finalDay}</td>
      <td>${duration}</td>
      <td>
        <button type="button" class="button button-primary admin-edit-event">Edit</button>
        <button type="button" class="button button-secondary admin-delete-event">Delete</button>
      </td>
    </tr>`;
}

const DAY_ABBR = { Monday: 'MON', Tuesday: 'TUE', Wednesday: 'WED', Thursday: 'THU', Friday: 'FRI' };

function resolveCourseLabel(courseId, schedule) {
  if (schedule.course_label) return schedule.course_label;

  const existingRow = document.querySelector(`#schedule-table tbody tr[data-course-id="${courseId}"]`);
  if (existingRow) return existingRow.children[1]?.textContent?.trim() || String(courseId);

  try {
    const raw = document.getElementById('course_lookup_results')?.value;
    if (raw) {
      const c = JSON.parse(raw);
      if (String(c.course_id) === String(courseId)) {
        return `${c.course_subject} ${c.course_code} \u2014 ${c.course_name}`;
      }
    }
  } catch (_) {}

  return String(courseId);
}

function resolveUserLabel(userId, fallback) {
  if (fallback) return fallback;
  const userRow  = document.querySelector(`#account-table tr[data-user-id="${userId}"]`);
  const nameCell = userRow?.children[1]?.textContent?.trim();
  const idCell   = userRow?.children[0]?.textContent?.trim();
  return nameCell ? `${nameCell}${idCell ? ` (${idCell})` : ''}` : String(userId);
}

function buildScheduleRow(s) {
  const userLabel   = resolveUserLabel(s.user_id, s.user_label);
  const courseLabel = resolveCourseLabel(s.course_id, s);

  return `
    <tr
      data-schedule-id="${s.schedule_id}"
      data-user-id="${s.user_id}"
      data-course-id="${s.course_id}"
      data-day-of-week="${DAY_ABBR[s.day_of_week] ?? s.day_of_week}"
      data-start-time="${s.start_time}"
      data-end-time="${s.end_time}"
    >
      <td>${userLabel}</td>
      <td>${courseLabel}</td>
      <td>${s.day_of_week}</td>
      <td>${formatDisplayTime(s.start_time)}</td>
      <td>${formatDisplayTime(s.end_time)}</td>
      <td>
        <button type="button" class="button button-primary admin-edit-schedule">Edit</button>
        <button type="button" class="button button-secondary admin-delete-schedule">Delete</button>
      </td>
    </tr>`;
}

function buildAccountRow(a) {
  return `
    <tr
      data-user-id="${a.user_id}"
      data-user-login="${a.user_login || ''}"
      data-user-email="${a.user_email || ''}"
      data-first-name="${a.first_name || ''}"
      data-last-name="${a.last_name || ''}"
      data-roles="${(a.roles || []).join(',')}"
    >
      <td>${a.user_login}</td>
      <td>${a.first_name} ${a.last_name}</td>
      <td>${a.user_email}</td>
      <td>${(a.roles || []).map(formatDisplayRole).join(', ')}</td>
      <td>
        <button type="button" class="button button-primary admin-edit-account">Edit</button>
        <button type="button" class="button button-secondary admin-delete-account">Delete</button>
      </td>
    </tr>`;
}


// =============================================================================
// API CLIENT
// =============================================================================

const api = {
  root: (window.wpApiSettings?.root || '/wp-json').replace(/\/$/, ''),

  headers() {
    return {
      'Content-Type': 'application/json',
      'X-WP-Nonce': window.wpApiSettings?.nonce || '',
    };
  },

  async request(endpoint, method = 'GET', body = null) {
    const options = { method, headers: this.headers() };
    if (body)            options.body = JSON.stringify(body);
    if (method === 'GET') delete options.headers['Content-Type'];

    const res  = await fetch(`${this.root}/asc-tutoring/v1${endpoint}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  },
};


// =============================================================================
// SLIDE ANIMATIONS
// =============================================================================

const applyStyles  = (el, styles) => Object.assign(el.style, styles);
const removeStyles = (el, props) => props.forEach(p => el.style.removeProperty(p));

const SLIDE_CLEANUP_PROPS = [
  'height', 'padding-top', 'padding-bottom',
  'margin-top', 'margin-bottom', 'overflow',
  'transition-duration', 'transition-property',
];

const DOMAnimations = {
  slideUp(element, duration = 500) {
    return new Promise(resolve => {
      applyStyles(element, {
        height:             `${element.offsetHeight}px`,
        transitionProperty: 'height, margin, padding',
        transitionDuration: `${duration}ms`,
      });
      element.offsetHeight; // force reflow
      applyStyles(element, { overflow: 'hidden', height: '0', paddingTop: '0', paddingBottom: '0', marginTop: '0', marginBottom: '0' });
      setTimeout(() => {
        element.style.display = 'none';
        removeStyles(element, SLIDE_CLEANUP_PROPS);
        resolve(false);
      }, duration);
    });
  },

  slideDown(element, duration = 500) {
    return new Promise(resolve => {
      element.style.removeProperty('display');
      let display = window.getComputedStyle(element).display;
      if (display === 'none') display = 'block';
      applyStyles(element, { display, overflow: 'hidden', height: '0', paddingTop: '0', paddingBottom: '0', marginTop: '0', marginBottom: '0' });
      const height = element.offsetHeight; // force reflow
      applyStyles(element, { transitionProperty: 'height, margin, padding', transitionDuration: `${duration}ms`, height: `${height}px` });
      removeStyles(element, ['padding-top', 'padding-bottom', 'margin-top', 'margin-bottom']);
      setTimeout(() => {
        removeStyles(element, ['height', 'overflow', 'transition-duration', 'transition-property']);
        resolve(true);
      }, duration);
    });
  },

  slideToggle(element, duration = 500) {
    return window.getComputedStyle(element).display === 'none'
      ? this.slideDown(element, duration)
      : this.slideUp(element, duration);
  },
};


// =============================================================================
// EXPANDERS
// =============================================================================

function initExpanders() {
  $$('.sights-expander-trigger').forEach(trigger => {
    const toggle = () => {
      const content  = $(trigger.getAttribute('aria-controls'));
      if (!content) return;
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!expanded));
      content.classList.toggle('sights-expander-hidden', expanded);
    };

    on(trigger, 'click', toggle);
    on(trigger, 'keydown', (e) => {
      if (['Enter', ' '].includes(e.key)) { e.preventDefault(); toggle(); }
    });
  });
}


// =============================================================================
// SUBJECT FILTERS
// =============================================================================

function initSubjectFilters() {
  const buttons  = $$('.subject-filter-button');
  const sections = $$('.subject-section');

  buttons.forEach(btn => {
    on(btn, 'click', () => {
      const subject = btn.dataset.subject;
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sections.forEach(sec => toggleDisplay(sec, subject === 'all' || sec.dataset.subject === subject));
    });
  });
}


// =============================================================================
// NAVIGATION
// =============================================================================

const MENU_DURATION = 300;

const menuItemsWithChildren = $$('.top-level > .sub-menu li.menu-item-has-children:not(.sub-menu .sub-menu li.menu-item-has-children), li.top-level.menu-item-has-children');
const topLevelMenuItems     = $$('.top-level');
const menuToggle            = document.querySelector('.menu-toggle');
const wholeMenu             = document.querySelector('#primary-menu');
const menuToggleContent     = document.querySelector('.menu-toggle .menu-toggle-content');
const navigationWrapper     = document.querySelector('.navigation-wrapper');

let windowWidth;
let touchmoved;

function chevronButton(text) {
  return `
    <button>
      <span class="icon-chevron" aria-hidden="true">
        <svg viewBox="0 0 1024 661" xmlns="http://www.w3.org/2000/svg">
          <path d="m459.2 639.05c28.8 28.79 76.8 28.79 105.6 0l435.2-435.05c32-32 32-80 0-108.77l-70.4-73.64c-32-28.79-80-28.79-108.8 0l-310.4 310.33-307.2-310.33c-28.8-28.79-76.8-28.79-108.8 0l-70.4 73.59c-32 28.82-32 76.82 0 108.82z"/>
        </svg>
      </span>
      <span class="sr-only">Toggle submenu for ${text}</span>
    </button>`;
}

function closeAllSubMenus() {
  menuItemsWithChildren.forEach(item => {
    item.classList.remove('menu-hover', 'open');
    item.querySelectorAll('.sub-menu').forEach(sm => sm.classList.remove('open'));
  });
}

function setMenuToggleExpanded(expanded) {
  menuToggle.setAttribute('aria-expanded', expanded);
  menuToggleContent.innerHTML = expanded ? 'Close' : 'Menu';
}

menuToggle.addEventListener('click', (e) => {
  e.preventDefault();
  DOMAnimations.slideToggle(navigationWrapper, MENU_DURATION);

  const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
  setMenuToggleExpanded(!isExpanded);
  navigationWrapper.classList.toggle('open');
  document.body.classList.toggle('mobile-menu-open');

  const mobileLink  = document.querySelector('.mobile-header-title a');
  const logoWrapper = document.querySelector('.umbc-logo-wrapper');

  if (isExpanded) {
    mobileLink?.setAttribute('tabindex', -1);
    logoWrapper?.setAttribute('tabindex', 0);
    closeAllSubMenus();
  } else {
    mobileLink?.setAttribute('tabindex', 0);
    logoWrapper?.setAttribute('tabindex', -1);
  }
});

menuItemsWithChildren.forEach(el => {
  const link = el.querySelector('a');
  link.insertAdjacentHTML('afterend', chevronButton(link.textContent));
});

// Resize handler
const handleResize = throttle(() => {
  if (window.innerWidth === windowWidth) return;
  windowWidth = window.innerWidth;
  windowWidth > 768 ? enableDesktopNavigation() : enableMobileNavigation();
}, 50);

window.addEventListener('resize', handleResize);

function withMenuInstant(fn) {
  wholeMenu.classList.add('menu-instant');
  fn();
}

function clearMenuDisable() {
  $$('.menu-disable').forEach(el => el.classList.remove('menu-disable'));
}

function enableDesktopNavigation() {
  navigationWrapper.style.display = 'block';
  document.body.classList.remove('mobile-menu-open');
  navigationWrapper.classList.remove('open');
  menuToggleContent.innerHTML = 'Menu';
  closeAllSubMenus();

  const docWidth = window.innerWidth;

  menuItemsWithChildren.forEach(menu => {
    const rect             = menu.getBoundingClientRect();
    const hasSubMenus      = menu.querySelectorAll('.sub-menu').length > 1;
    const subMenuWidth     = menu.querySelector('.sub-menu').getBoundingClientRect().width + 16;
    const totalWidth       = hasSubMenus ? subMenuWidth * 2 : subMenuWidth;
    menu.classList.toggle('too-wide', rect.x + totalWidth > docWidth);
  });

  topLevelMenuItems.forEach(tlmi => {
    tlmi.addEventListener('mouseover', () => {
      topLevelMenuItems.forEach(item => {
        if (item === tlmi) return;
        item.classList.add('menu-disable');
        item.querySelectorAll('.menu-item').forEach(mi => mi.classList.remove('menu-hover'));
      });
    });
  });

  $$('.top-level > a').forEach(link => {
    link.addEventListener('focus', (e) => {
      withMenuInstant(() => {
        topLevelMenuItems.forEach(tlmi => {
          tlmi.classList.add('menu-disable');
          tlmi.classList.remove('menu-hover');
          tlmi.querySelectorAll('li').forEach(li => li.classList.remove('menu-hover'));
          tlmi.querySelectorAll('.sub-menu').forEach(sm => sm.classList.remove('open'));
        });
        e.target.closest('.top-level').classList.remove('menu-disable');
      });
    }, true);
  });

  $$('.top-level > button').forEach(button => {
    button.addEventListener('click', (e) => {
      withMenuInstant(() => {
        e.preventDefault();
        const topLevel = e.target.closest('.top-level');
        topLevel.classList.toggle('menu-hover');
        topLevel.querySelectorAll('.menu-item').forEach(item => item.classList.remove('menu-hover'));
      });
    });
  });

  $$('.sub-menu button').forEach(button => {
    button.addEventListener('click', (e) => {
      withMenuInstant(() => {
        e.preventDefault();
        const menuItem = e.target.closest('.menu-item');
        if (menuItem.classList.contains('menu-hover')) {
          menuItem.classList.remove('menu-hover');
          return;
        }
        Promise.resolve().then(() => {
          e.target.closest('.top-level').querySelectorAll('.menu-hover').forEach(el => el.classList.remove('menu-hover'));
          menuItem.classList.add('menu-hover');
        });
      });
    });
  });

  menuItemsWithChildren.forEach(item => {
    item.addEventListener('mouseover', () => {
      wholeMenu.classList.remove('menu-instant');
      item.classList.add('menu-hover');
      item.classList.remove('menu-disable', 'menu-item-instant');
    });

    item.addEventListener('mouseleave', (e) => {
      item.classList.remove('menu-hover', 'open');
      if (e.relatedTarget?.closest('li')?.classList.contains('menu-item')) {
        item.classList.add('menu-item-instant');
      }
      clearMenuDisable();
      item.querySelectorAll('.sub-menu').forEach(sm => sm.classList.remove('open'));
    });

    item.querySelector('button').addEventListener('focus', (e) => {
      e.target.closest('.top-level').classList.remove('menu-disable');
    });
  });
}

function enableMobileNavigation() {
  navigationWrapper.style.removeProperty('display');

  if ('ontouchstart' in window) {
    menuItemsWithChildren.forEach(item => {
      item.addEventListener('touchstart', () => { touchmoved = false; });
      item.addEventListener('touchmove',  () => { touchmoved = true; });
      item.addEventListener('touchend', (e) => {
        if (e.target.getAttribute('data-clickable') !== 'false' || touchmoved) return;
        withMenuInstant(() => {
          e.currentTarget.parentNode.classList.add('menu-hover');
          item.classList.add('menu-hover');
        });
        e.preventDefault();
        e.stopPropagation();
        e.target.setAttribute('data-clickable', 'true');
      });
    });
    $$('.menu-item-has-children > a').forEach(link => link.setAttribute('data-clickable', 'false'));
    return;
  }

  menuItemsWithChildren.forEach(item => {
    item.querySelector('button').addEventListener('click', (e) => {
      withMenuInstant(() => {
        e.preventDefault();
        const parent  = e.currentTarget.parentNode;
        const subMenu = parent.querySelector('.sub-menu');
        subMenu.classList.toggle('open');
        parent.classList.toggle('menu-hover');
        subMenu.querySelectorAll('.sub-menu').forEach(sm => {
          sm.classList.remove('open');
          sm.parentNode.classList.remove('menu-hover');
        });
      });
    });

    item.addEventListener('mouseover', () => {
      wholeMenu.classList.remove('menu-instant');
      item.classList.add('menu-hover');
      item.classList.remove('menu-disable');
    });
  });
}


// =============================================================================
// ADMIN PANEL
// =============================================================================

// --- Time Dropdown Helpers ---------------------------------------------------

function setTimeDropdowns(prefix, timeValue) {
  const hourField   = $(`${prefix}_hour`);
  const minuteField = $(`${prefix}_minute`);
  const ampmField   = $(`${prefix}_ampm`);
  const hiddenField = $(prefix);
  if (!hourField || !minuteField || !ampmField || !hiddenField) return;

  if (!timeValue) {
    [hourField, minuteField, ampmField, hiddenField].forEach(f => { f.value = ''; });
    return;
  }

  const match = String(timeValue).trim().toLowerCase()
    .match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*((?:a|p)\.m\.))?$/);
  if (!match) return;

  let hour   = parseInt(match[1], 10);
  const min  = match[2];
  let ampm   = match[3];

  if (!ampm) {
    ampm = hour >= 12 ? 'p.m.' : 'a.m.';
    hour = hour % 12 || 12;
  }

  const paddedHour  = String(hour).padStart(2, '0');
  hourField.value   = paddedHour;
  minuteField.value = min;
  ampmField.value   = ampm;
  hiddenField.value = `${paddedHour}:${min} ${ampm}`;
}

function updateHiddenTimeField(prefix) {
  const hour        = $(`${prefix}_hour`)?.value   || '';
  const minute      = $(`${prefix}_minute`)?.value || '';
  const ampm        = $(`${prefix}_ampm`)?.value   || '';
  const hiddenField = $(prefix);
  if (!hiddenField) return;

  if (!hour || !minute || !ampm) { hiddenField.value = ''; return; }

  let hour24 = parseInt(hour, 10);
  if (ampm === 'a.m.' && hour24 === 12) hour24 = 0;
  if (ampm === 'p.m.' && hour24 !== 12) hour24 += 12;

  hiddenField.value = `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

function bindTimeDropdowns(prefix) {
  ['hour', 'minute', 'ampm'].forEach(part => {
    $(`${prefix}_${part}`)?.addEventListener('change', () => updateHiddenTimeField(prefix));
  });
}

// --- Form Load Helpers -------------------------------------------------------

function loadEventIntoForm(row, setEventFormMode) {
  setVal('event_type',    row.dataset.eventType);
  toggleEventFields();
  setVal('event_id',      row.dataset.eventId);
  setVal('event_user_id', row.dataset.userId);
  setVal('start_day',     row.dataset.startDay);
  setVal('final_day',     row.dataset.finalDay);
  setVal('duration',      row.dataset.duration ? row.dataset.duration.padStart(2, '0') : '');
  setEventFormMode('edit');
}

function loadScheduleIntoForm(row, setScheduleFormMode, scheduleCourseLookup) {
  const DAY_UNABBR = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday' };

  setVal('schedule_id',          row.dataset.scheduleId);
  setVal('schedule_user_id',     row.dataset.userId);
  setVal('schedule_course_id',   row.dataset.courseId);
  setVal('schedule_day_of_week', DAY_UNABBR[row.dataset.dayOfWeek] || '');
  setTimeDropdowns('schedule_start_time', row.dataset.startTime);
  setTimeDropdowns('schedule_end_time',   row.dataset.endTime);

  if (scheduleCourseLookup) {
    const courseId = String(row.dataset.courseId);
    const matched  = Array.from(scheduleCourseLookup.options).find(opt => {
      try { return String(JSON.parse(opt.value).course_id) === courseId; } catch (_) { return false; }
    });
    scheduleCourseLookup.value = matched ? matched.value : '';
  }

  setScheduleFormMode('edit');
}

function loadAccountIntoForm(row, accountForm, accountLookupResults, setAccountFormMode) {
  const roles = (row.dataset.roles || '').split(',').map(r => r.trim().toLowerCase()).filter(Boolean);

  setVal('account_user_id', row.dataset.userId);
  setVal('user_login',      row.dataset.userLogin || '');
  setVal('user_email',      row.dataset.userEmail || '');
  setVal('first_name',      row.dataset.firstName || '');
  setVal('last_name',       row.dataset.lastName  || '');

  accountForm.querySelectorAll('input[name="roles[]"]').forEach(cb => {
    cb.checked = roles.includes(cb.value.toLowerCase());
  });

  if (accountLookupResults) accountLookupResults.value = '';
  clearVal('account_search_query');
  setHidden('account_search_results', true);
  setAccountFormMode('edit');
}

// --- UMBC Search UI ----------------------------------------------------------

async function searchUmbc({ endpoint, resultsBoxId, statusElId, listElId, collectionKey, renderItem, onSelect, getLabel, showMessage }) {
  const resultsBox = $(resultsBoxId);
  const statusEl   = $(statusElId);
  const listEl     = $(listElId);
  if (!resultsBox) return;

  resultsBox.hidden    = false;
  statusEl.textContent = 'Searching\u2026';
  listEl.innerHTML     = '';

  try {
    const data  = await api.request(endpoint);
    const items = data[collectionKey] || [];

    if (!items.length) { statusEl.textContent = 'No results found.'; return; }

    statusEl.textContent = `${items.length} result${pluralSuffix(items.length)} found \u2014 click a result to select it.`;

    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'account-search-item';
      li.innerHTML = `
        <div class="account-search-item-info">${renderItem(item)}</div>
        <button type="button" class="button button-primary" style="flex-shrink:0;">Select</button>
      `;

      const selectFn = () => {
        listEl.querySelectorAll('.account-search-item').forEach(el => el.classList.remove('selected'));
        li.classList.add('selected');
        onSelect(item);
        showMessage(`Selected: ${getLabel(item)}`, 'success');
      };

      on(li, 'click', selectFn);
      on(li.querySelector('button'), 'click', (e) => { e.stopPropagation(); selectFn(); });
      listEl.appendChild(li);
    });
  } catch (err) {
    statusEl.textContent = 'Search failed.';
    showMessage(err.message, 'error');
  }
}

// --- Lookup Table Binding ----------------------------------------------------

function bindLookupForm({ formId, queryId, resultsId, endpoint, collectionKey, headers, buildRow, showMessage }) {
  $(formId)?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = $(queryId).value.trim();
    const box   = $(resultsId);
    try {
      const data  = await api.request(`${endpoint}?search_str=${encodeURIComponent(query)}`);
      const items = data[collectionKey] || [];
      if (!items.length) { box.innerHTML = '<p>No results found.</p>'; return; }
      const headerCells = headers.map(h => `<th>${h}</th>`).join('');
      const rows        = items.map(buildRow).join('');
      box.innerHTML = `
        <div class="umbc-table-wrapper">
          <table class="umbc-table">
            <thead><tr>${headerCells}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    } catch (err) {
      showMessage(err.message, 'error');
    }
  });
}

// --- Main Admin Init ---------------------------------------------------------

function initAdminUI() {
  const messageBoxes = $$('.tutoring-admin-message');
  if (!messageBoxes.length) return;

  const showMessage = (text, type = 'success') => {
    messageBoxes.forEach(box => {
      box.textContent = text;
      box.className   = `tutoring-admin-message ${type}`;
      box.hidden      = false;
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearMessages = () => {
    messageBoxes.forEach(box => {
      box.textContent = '';
      box.classList.remove('success', 'error'); // or whatever types you use
      box.hidden = true;
    });
  };

  // Tabs
  $$('.admin-tab').forEach(tab => {
    on(tab, 'click', () => {

      clearMessages();

      $$('.admin-tab').forEach(t => t.classList.remove('active'));
      $$('.admin-section').forEach(s => s.classList.remove('active'));

      tab.classList.add('active');
      $(`admin-tab-${tab.dataset.tab}`)?.classList.add('active');
    });
  });

  // Form references
  const scheduleForm         = $('schedule-form');
  const eventForm            = $('event-form');
  const accountForm          = $('account-form');
  const scheduleCourseLookup = $('schedule_course_lookup');
  const accountLookupResults = $('account_lookup_results');

  const SCHEDULE_FIELD_IDS      = ['schedule_user_id', 'schedule_course_id', 'schedule_day_of_week', 'schedule_start_time', 'schedule_end_time'];
  const SCHEDULE_TIME_FIELD_IDS = ['schedule_start_time_hour', 'schedule_start_time_minute', 'schedule_start_time_ampm', 'schedule_end_time_hour', 'schedule_end_time_minute', 'schedule_end_time_ampm'];
  const ACCOUNT_FIELD_IDS       = ['user_login', 'user_email', 'first_name', 'last_name'];

  // --- Form mode helpers ---

  const applyFormModeLabels = (labelId, resetId, isEdit, editLabel, addLabel) => {
    const label = $(labelId);
    if (label) label.textContent = isEdit ? editLabel : addLabel;
    const resetBtn = $(resetId);
    if (resetBtn) resetBtn.textContent = isEdit ? 'Cancel' : 'Clear';
  };

  const unlockFields = (ids) => ids.forEach(id => {
    const field = $(id);
    if (!field) return;
    field.readOnly = false;
    field.disabled = false;
    field.classList.remove('account-field-locked');
  });

  const setRolesEditable = (editable) => {
    accountForm.querySelectorAll('input[name="roles[]"]').forEach(cb => {
      cb.disabled   = !editable;
      cb.style.cursor = editable ? '' : 'not-allowed';
    });
  };

  const setAccountSearchEditable = (editable) => {
    const input = $('account_search_query');
    const btn   = $('account-search-submit');
    if (input) input.disabled = !editable;
    if (btn)   btn.disabled   = !editable;
  };

  const setAccountFormMode = (mode) => {
    const isEdit = mode === 'edit';
    applyFormModeLabels('account-form-mode-label', 'reset-account-form', isEdit, 'Editing Account Permissions', 'Add New Account');
    setAccountSearchEditable(!isEdit);
    if (isEdit) { setRolesEditable(true); return; }
    const hasSelected = !!accountLookupResults?.value;
    setRolesEditable(hasSelected);
    if (!hasSelected) clearFields(ACCOUNT_FIELD_IDS);
  };

  const setScheduleFormMode = (mode) => {
    const isEdit = mode === 'edit';
    applyFormModeLabels('schedule-form-mode-label', 'reset-schedule-form', isEdit, 'Editing Schedule Entry', 'Create New Schedule Entry');
    if (isEdit) { unlockFields(SCHEDULE_FIELD_IDS); unlockFields(SCHEDULE_TIME_FIELD_IDS); return; }
    const hasSelected = !!scheduleCourseLookup?.value;
    if (hasSelected) { unlockFields(SCHEDULE_FIELD_IDS); unlockFields(SCHEDULE_TIME_FIELD_IDS); return; }
    clearFields(SCHEDULE_FIELD_IDS);
    setTimeDropdowns('schedule_start_time', '');
    setTimeDropdowns('schedule_end_time', '');
  };

  const setEventFormMode = (mode) => {
    applyFormModeLabels('event-form-mode-label', 'reset-event-form', mode === 'edit', 'Editing Event', 'Create New Event');
  };

  // --- Time dropdowns ---

  bindTimeDropdowns('schedule_start_time');
  bindTimeDropdowns('schedule_end_time');

  // --- Edit buttons (delegated) ---

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[class*="admin-edit-"]');
    if (!btn) return;
    const row = btn.closest('tr');
    if (!row) return;

    if (btn.classList.contains('admin-edit-event')) {
      loadEventIntoForm(row, setEventFormMode);
      showMessage(`Loaded event ${row.dataset.eventId} into the form.`, 'success');
    } else if (btn.classList.contains('admin-edit-schedule')) {
      loadScheduleIntoForm(row, setScheduleFormMode, scheduleCourseLookup);
      showMessage(`Loaded schedule ${row.dataset.scheduleId} into the form.`, 'success');
    } else if (btn.classList.contains('admin-edit-account')) {
      loadAccountIntoForm(row, accountForm, accountLookupResults, setAccountFormMode);
      showMessage(`Loaded account ${row.dataset.userId}.`, 'success');
    }
  });

  // --- Delete buttons ---

  const bindDeleteButtons = (selector, getIdFromRow, buildEndpoint, entityLabel) => {
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest(selector);
      if (!btn) return;
      const row = btn.closest('tr');
      if (!row) return;
      const id = getIdFromRow(row);
      if (!confirm(`Delete ${entityLabel} ${id}?`)) return;

      try {
        await api.request(buildEndpoint(id), 'DELETE');
        removeTableRow(entityLabel, id);
        if (entityLabel === 'account') removeTutorRelatedRows(id);
        showMessage(`Deleted ${entityLabel} ${id}.`);
      } catch (err) {
        showMessage(err.message, 'error');
      }
    });
  };

  bindDeleteButtons('.admin-delete-event',    row => row.dataset.eventId,    id => `/events/${id}`,   'event');
  bindDeleteButtons('.admin-delete-schedule', row => row.dataset.scheduleId, id => `/schedule/${id}`, 'schedule');
  bindDeleteButtons('.admin-delete-account',  row => row.dataset.userId,     id => `/accounts/${id}`, 'account');

  // --- UMBC search buttons ---

  const searchUmbcAccounts = (query) => searchUmbc({
    endpoint:      `/umbc_db/accounts?search_str=${encodeURIComponent(query)}`,
    resultsBoxId:  'account_search_results',
    statusElId:    'account-search-status',
    listElId:      'account-search-list',
    collectionKey: 'umbc_accounts',
    renderItem:    (a) => `
      <span class="account-search-item-name">${a.first_name} ${a.last_name}</span>
      <span class="account-search-item-meta">${a.umbc_id} &bull; ${a.umbc_email}</span>`,
    onSelect: (account) => {
      if (accountLookupResults) accountLookupResults.value = JSON.stringify(account);
      setVal('user_login', account.umbc_id    || '');
      setVal('user_email', account.umbc_email || '');
      setVal('first_name', account.first_name || '');
      setVal('last_name',  account.last_name  || '');
      setAccountFormMode('add');
    },
    getLabel:    (a) => `${a.first_name} ${a.last_name} (${a.umbc_id})`,
    showMessage,
  });

  const searchUmbcCourses = (query) => searchUmbc({
    endpoint:      `/umbc_db/courses?search_str=${encodeURIComponent(query)}`,
    resultsBoxId:  'course_search_results',
    statusElId:    'course-search-status',
    listElId:      'course-search-list',
    collectionKey: 'umbc_courses',
    renderItem:    (c) => `
      <span class="account-search-item-name">${c.course_subject} ${c.course_code} \u2014 ${c.course_name}</span>
      <span class="account-search-item-meta">${c.subject_name}</span>`,
    onSelect: (course) => {
      const courseLookupResults = $('course_lookup_results');
      if (courseLookupResults) courseLookupResults.value = JSON.stringify(course);
      if (scheduleCourseLookup) {
        scheduleCourseLookup.querySelector('option[data-new-course]')?.remove();
        const opt      = document.createElement('option');
        opt.value      = 'new';
        opt.textContent = 'New Course Selected';
        opt.dataset.newCourse = 'true';
        opt.selected   = true;
        scheduleCourseLookup.prepend(opt);
      }
      setVal('schedule_course_id', course.course_id || '');
    },
    getLabel:    (c) => `${c.course_subject} ${c.course_code} \u2014 ${c.course_name}`,
    showMessage,
  });

  on($('account-search-submit'), 'click', async () => {
    const query = $('account_search_query').value.trim();
    if (!query) { showMessage('Please enter a search term.', 'error'); return; }
    if (accountLookupResults) accountLookupResults.value = '';
    clearFields(ACCOUNT_FIELD_IDS);
    setAccountFormMode('add');
    await searchUmbcAccounts(query);
  });

  onEnter($('account_search_query'), () => $('account-search-submit')?.click());

  on($('course-search-submit'), 'click', async () => {
    const query = $('course_search_query').value.trim();
    if (!query) { showMessage('Please enter a search term.', 'error'); return; }
    await searchUmbcCourses(query);
  });

  onEnter($('course_search_query'), () => $('course-search-submit')?.click());

  // --- Schedule form submit ---

  scheduleForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    updateHiddenTimeField('schedule_start_time');
    updateHiddenTimeField('schedule_end_time');

    const startTime = $('schedule_start_time').value;
    const endTime   = $('schedule_end_time').value;

    if (endTime <= startTime) { showMessage('Error: End Time must be after Start Time.', 'error'); return; }
    const id      = $('schedule_id').value.trim();
    const payload = {
      user_id:     Number($('schedule_user_id').value),
      course_id:   Number($('schedule_course_id').value),
      day_of_week: $('schedule_day_of_week').value,
      start_time:  startTime,
      end_time:    endTime,
    };

    try {
      const courseLookupResults = $('course_lookup_results');
      if (courseLookupResults?.value) {
        const newCourse = JSON.parse(courseLookupResults.value);
        if (newCourse.course_subject && newCourse.course_code && newCourse.course_name) {
          Object.assign(payload, {
            course_subject: newCourse.course_subject,
            course_code:    newCourse.course_code,
            course_name:    newCourse.course_name,
            course_id:      newCourse.course_id,
          });
        }
      }
    } catch (_) {}

    try {
      if (id) {
        await api.request(`/schedule/${id}`, 'PATCH', payload);
        upsertTableRow('schedule-table', 'schedule-id', id, buildScheduleRow({ ...payload, schedule_id: id }));
        showMessage(`Updated schedule entry ${id}.`);
      } else {
        const data = await api.request('/schedule', 'POST', payload);
        upsertTableRow('schedule-table', 'schedule-id', data.schedule_id, buildScheduleRow({ ...payload, schedule_id: data.schedule_id }));
        showMessage(`Created schedule entry ${data.schedule_id}.`);
      }
      scheduleForm.reset();
      setTimeDropdowns('schedule_start_time', '');
      setTimeDropdowns('schedule_end_time', '');
      setScheduleFormMode('add');
    } catch (err) {
      showMessage(err.message, 'error');
    }
  });

  // --- Event form submit ---

  eventForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id      = $('event_id').value.trim();
    const payload = {
      user_id:    Number($('event_user_id').value),
      event_type: Number($('event_type').value),
      start_day:  $('start_day').value,
      final_day:  $('final_day').value   || null,
      duration:   $('duration').value    ? Number($('duration').value) : null,
    };

    try {
      if (id) {
        await api.request(`/events/${id}`, 'PATCH', payload);
        upsertTableRow('event-table', 'event-id', id, buildEventRow({ ...payload, event_id: id }));
        showMessage(`Updated event ${id}.`);
      } else {
        const data = await api.request('/events', 'POST', payload);
        upsertTableRow('event-table', 'event-id', data.event_id, buildEventRow({ ...payload, event_id: data.event_id }));
        showMessage(`Created event ${data.event_id}.`);
      }
      eventForm.reset();
      $('event_type').selectedIndex = 0;
      toggleEventFields();
      setEventFormMode('add');
    } catch (err) {
      showMessage(err.message, 'error');
    }
  });

  // --- Account form submit ---

  accountForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id         = $('account_user_id').value.trim();
    const user_login = $('user_login').value.trim();
    const user_email = $('user_email').value.trim();
    const first_name = $('first_name').value.trim();
    const last_name  = $('last_name').value.trim();
    const roles      = Array.from(accountForm.querySelectorAll('input[name="roles[]"]:checked')).map(el => el.value);

    if (!roles.length) { showMessage('Select at least one role.', 'error'); return; }

    const payload = { user_login, user_email, first_name, last_name, roles };

    try {
      if (id) {
        await api.request(`/accounts/${id}`, 'PATCH', payload);
        upsertTableRow('account-table', 'user-id', id, buildAccountRow({ ...payload, user_id: id }));
        showMessage(`Updated account ${id}.`);
      } else {
        const data = await api.request('/accounts', 'POST', payload);
        upsertTableRow('account-table', 'user-id', data.user_id, buildAccountRow({ ...payload, user_id: data.user_id }));
        showMessage(`Created account ${data.user_id}.`);
      }
      accountForm.reset();
      clearVal('account_user_id');
      if (accountLookupResults) accountLookupResults.value = '';
      clearVal('account_search_query');
      setHidden('account_search_results', true);
      setAccountFormMode('add');
    } catch (err) {
      showMessage(err.message, 'error');
    }
  });

  // --- Course lookup dropdown ---

  scheduleCourseLookup?.addEventListener('change', () => {
    if (!scheduleCourseLookup.value) { clearVal('schedule_course_id'); return; }
    const selected = scheduleCourseLookup.options[scheduleCourseLookup.selectedIndex];
    if (!selected.dataset.newCourse) {
      scheduleCourseLookup.querySelector('option[data-new-course]')?.remove();
      $$('#course-search-list .account-search-item').forEach(el => el.classList.remove('selected'));
      clearVal('course_lookup_results');
    }
    try { setVal('schedule_course_id', JSON.parse(scheduleCourseLookup.value).course_id || ''); } catch (_) {}
  });

  // --- Lookup forms ---

  bindLookupForm({
    formId:        'lookup-accounts-form',
    queryId:       'lookup-accounts-query',
    resultsId:     'lookup-accounts-results',
    endpoint:      '/umbc_db/accounts',
    collectionKey: 'umbc_accounts',
    headers:       ['UMBC ID', 'Name', 'Email'],
    buildRow:      (a) => `<tr><td>${a.umbc_id}</td><td>${a.first_name} ${a.last_name}</td><td>${a.umbc_email}</td></tr>`,
    showMessage,
  });

  bindLookupForm({
    formId:        'lookup-courses-form',
    queryId:       'lookup-courses-query',
    resultsId:     'lookup-courses-results',
    endpoint:      '/umbc_db/courses',
    collectionKey: 'umbc_courses',
    headers:       ['Course ID', 'Course', 'Name', 'Subject'],
    buildRow:      (c) => `<tr><td>${c.course_id}</td><td>${c.course_subject} ${c.course_code}</td><td>${c.course_name}</td><td>${c.subject_name}</td></tr>`,
    showMessage,
  });

  // --- Reset buttons ---

  on($('reset-schedule-form'), 'click', () => {
    scheduleForm.reset();
    clearVal('schedule_id');
    if (scheduleCourseLookup) scheduleCourseLookup.value = '';
    scheduleCourseLookup?.querySelector('option[data-new-course]')?.remove();
    clearVal('course_search_query');
    setHidden('course_search_results', true);
    const courseList = $('course-search-list');
    if (courseList) courseList.innerHTML = '';
    clearVal('course_lookup_results');
    clearFields(SCHEDULE_FIELD_IDS);
    setScheduleFormMode('add');
  });

  on($('reset-event-form'), 'click', () => {
    eventForm.reset();
    clearVal('event_id');
    $('event_type').selectedIndex = 0;
    toggleEventFields();
    setEventFormMode('add');
  });

  on($('reset-account-form'), 'click', () => {
    accountForm.reset();
    clearVal('account_user_id');
    if (accountLookupResults) accountLookupResults.value = '';
    clearVal('account_search_query');
    setHidden('account_search_results', true);
    $('account-search-list') && ($('account-search-list').innerHTML = '');
    clearFields(ACCOUNT_FIELD_IDS);
    setAccountFormMode('add');
  });

  // Initial modes
  if (accountForm)  setAccountFormMode('add');
  if (scheduleForm) setScheduleFormMode('add');
}


// =============================================================================
// EVENT TYPE FIELD TOGGLE
// =============================================================================

// Declared at module scope so initAdminUI reset handlers can call it.
var toggleEventFields = () => {};

function initEventFields() {
  const eventType       = $('event_type');
  if (!eventType) return;

  const dateRangeFields = $('date-range-fields');
  const durationField   = $('duration-field');
  const today           = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  const hideFieldGroup = (group, defaultDate = '') => {
    group.style.display = 'none';
    group.querySelectorAll('input').forEach(i => { i.removeAttribute('required'); i.value = defaultDate; });
  };

  const showFieldGroup = (group) => {
    group.style.display = 'block';
    group.querySelectorAll('input').forEach(i => i.setAttribute('required', ''));
  };

  toggleEventFields = function () {
    const selectedText = eventType.options[eventType.selectedIndex].text.toLowerCase();
    const calledOut    = selectedText.includes('called out');
    const leavingEarly = selectedText.includes('leaving early');

    if (!calledOut)    hideFieldGroup(dateRangeFields, today);
    if (!leavingEarly) hideFieldGroup(durationField);
    if (calledOut) {
      showFieldGroup(dateRangeFields);
      dateRangeFields.querySelectorAll('input').forEach(i => { i.value = ''; });
    } else if (leavingEarly) {
      showFieldGroup(durationField);
    }
  };

  on(eventType, 'change', toggleEventFields);
  toggleEventFields();
}

// =============================================================================
// TABLE FILTERING
// =============================================================================

const TABLE_FILTER_STATE = {};

function normalizeFilterText(value) {
  return String(value || '').trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getFilterableHeaders(table) {
  const headers = Array.from(table.querySelectorAll('thead th'));
  return headers
    .map((th, index) => ({
      index,
      label: th.textContent.trim(),
    }))
    .filter(col => normalizeFilterText(col.label) !== 'actions');
}

function getUniqueColumnValues(table, columnIndex, typedValue = '') {
  const typed = normalizeFilterText(typedValue);
  const values = new Map();

  table.querySelectorAll('tbody tr').forEach(row => {
    const raw = row.children[columnIndex]?.textContent?.trim() || '';
    const normalized = normalizeFilterText(raw);
    if (!raw) return;
    if (typed && !normalized.includes(typed)) return;
    if (!values.has(normalized)) values.set(normalized, raw);
  });

  return Array.from(values.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );
}

function applyTableFilter(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const state = TABLE_FILTER_STATE[tableId];
  if (!state) return;

  const { appliedColumnIndex, appliedQuery } = state;
  const normalizedQuery = normalizeFilterText(appliedQuery);

  table.querySelectorAll('tbody tr').forEach(row => {
    if (appliedColumnIndex === '' || !normalizedQuery) {
      row.hidden = false;
      return;
    }

    const cellValue = row.children[appliedColumnIndex]?.textContent?.trim() || '';
    row.hidden = normalizeFilterText(cellValue) !== normalizedQuery;
  });
}

function refreshAutocompleteList(tableId) {
  const table = document.getElementById(tableId);
  const wrapper = document.querySelector(`.admin-table-filter[data-table-id="${tableId}"]`);
  if (!table || !wrapper) return;

  const select = wrapper.querySelector('.admin-table-filter-select');
  const input = wrapper.querySelector('.admin-table-filter-input');
  const box = wrapper.querySelector('.admin-table-filter-suggestions');

  const columnIndex = select.value;
  const query = input.value.trim();

  if (columnIndex === '' || query === '') {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }

  const matches = getUniqueColumnValues(table, Number(columnIndex), query).slice(0, 8);

  if (!matches.length) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }

  box.innerHTML = matches.map(value => `
    <button type="button" class="admin-table-filter-suggestion" data-value="${escapeHtml(value)}">
      ${escapeHtml(value)}
    </button>
  `).join('');

  box.hidden = false;
}

function initTableFilterState(tableId) {
  TABLE_FILTER_STATE[tableId] = {
    selectedColumnIndex: '',
    draftQuery: '',
    appliedColumnIndex: '',
    appliedQuery: '',
  };
}

function reapplyTableFilter(tableId) {
  if (!TABLE_FILTER_STATE[tableId]) return;
  applyTableFilter(tableId);
}

function buildTableFilterUI(table) {
  const tableId = table.id;
  const columns = getFilterableHeaders(table);

  initTableFilterState(tableId);

  const filter = document.createElement('div');
  filter.className = 'admin-table-filter';
  filter.dataset.tableId = tableId;

  filter.innerHTML = `
    <div class="admin-table-filter-row">
      <label class="admin-table-filter-label">
        <strong>Filter by</strong>
      </label>

      <select class="admin-table-filter-select" aria-label="Select filter column for ${tableId}">
        <option value="">Select column</option>
        ${columns.map(col => `<option value="${col.index}">${escapeHtml(col.label)}</option>`).join('')}
      </select>

      <div class="admin-table-filter-search-wrap">
        <input
          type="text"
          class="admin-table-filter-input"
          placeholder="Start typing to search..."
          autocomplete="off"
          disabled
          aria-label="Filter search for ${tableId}"
        />
        <div class="admin-table-filter-suggestions" hidden></div>
      </div>

      <button type="button" class="button button-primary admin-table-filter-search">
        Search
      </button>

      <button type="button" class="button button-secondary admin-table-filter-clear">
        Clear
      </button>
    </div>
  `;

  table.parentNode.insertBefore(filter, table);

  const select = filter.querySelector('.admin-table-filter-select');
  const input = filter.querySelector('.admin-table-filter-input');
  const searchBtn = filter.querySelector('.admin-table-filter-search');
  const clearBtn = filter.querySelector('.admin-table-filter-clear');
  const suggestions = filter.querySelector('.admin-table-filter-suggestions');

  select.addEventListener('change', () => {
    const hasColumn = select.value !== '';
    input.disabled = !hasColumn;
    input.value = '';
    suggestions.hidden = true;
    suggestions.innerHTML = '';

    TABLE_FILTER_STATE[tableId].selectedColumnIndex = select.value;
    TABLE_FILTER_STATE[tableId].draftQuery = '';

    if (hasColumn) input.focus();
  });

  input.addEventListener('input', () => {
    TABLE_FILTER_STATE[tableId].selectedColumnIndex = select.value;
    TABLE_FILTER_STATE[tableId].draftQuery = input.value;
    refreshAutocompleteList(tableId);
  });

  input.addEventListener('focus', () => {
    refreshAutocompleteList(tableId);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      suggestions.hidden = true;
      suggestions.innerHTML = '';
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      searchBtn.click();
    }
  });

  suggestions.addEventListener('click', (e) => {
    const btn = e.target.closest('.admin-table-filter-suggestion');
    if (!btn) return;

    input.value = btn.dataset.value;
    TABLE_FILTER_STATE[tableId].draftQuery = input.value;

    suggestions.hidden = true;
    suggestions.innerHTML = '';
    input.focus();
  });

  searchBtn.addEventListener('click', () => {
    TABLE_FILTER_STATE[tableId].appliedColumnIndex = select.value;
    TABLE_FILTER_STATE[tableId].appliedQuery = input.value.trim();

    suggestions.hidden = true;
    suggestions.innerHTML = '';

    applyTableFilter(tableId);
  });

  clearBtn.addEventListener('click', () => {
    select.value = '';
    input.value = '';
    input.disabled = true;
    suggestions.hidden = true;
    suggestions.innerHTML = '';

    initTableFilterState(tableId);
    applyTableFilter(tableId);
  });
}

function initAdminTableFilters() {
  ['event-table', 'schedule-table', 'account-table'].forEach(tableId => {
    const table = document.getElementById(tableId);
    if (!table) return;
    buildTableFilterUI(table);
  });
}

// =============================================================================
// AUDIT LOGS
// =============================================================================

function initLogsUI() {
  const fetchBtn  = $('logs-fetch-btn');
  const viewer    = $('logs-viewer');
  const box       = $('logs-box');
  const emptyMsg  = $('logs-empty');
  const dateLabel = $('logs-date-label');
  const prevBtn   = $('logs-prev-btn');
  const nextBtn   = $('logs-next-btn');
  const jumpBtn   = $('logs-jump-btn');
  const jumpInput = $('logs-jump-date');
  const msgEl     = $('logs-message');

  if (!fetchBtn) return;

  // ---- Dummy data ----
  const DUMMY_LOGS = (() => {
    const logs = {};
    const sep = "\n" + " ".repeat(22);
    const entries = [
      [0,  '09:14:02', 'admin (LO89179, Samuel Sudhakar) EDITED schedule entry:' + sep + 
        'Joseph Williams, STAT 121, Wednesday, 12:45 p.m., 2:30 p.m.' + sep + 
        'Changed: Tuesday-> Wednesday'],
      [0,  '14:22:10', 'staff (DA46048, Abe Green) CREATED event:' + sep +
        'Kaila Garcia, At Capacity, 2026-04-19'],
      [0,  '11:03:55', 'admin (WB55131, Justin Collier) DELETED event:' + sep +
        'Kaila Garcia, At Capacity, 2026-04-19'],
      [1,  '08:45:00', 'admin (WB55131, Justin Collier) CREATED account:' + sep +
        'NK46421, Chiara Hall, chall@umbc.edu, Tutor'],
      [1,  '13:10:33', 'staff (DA46048, Abe Green) CREATED event:' + sep +
        'Dani Martinez, Late, 2026-04-18'],
      [3,  '10:00:01', 'admin (OI33374, Sam Dolle) DELETED schedule entry:' + sep + 
        'Aren Garcia, PHYS 121, Friday, 2:00 p.m., 5:00 p.m.'],
      [4,  '09:30:15', 'admin (OI33374, Sam Dolle) EDITED account:' + sep +
        'DA46048, Abe Green, agreen@umbc.edu, Tutor;ASC Staff' + sep +
        'Changed: Tutor -> Tutor;ASC Staff'],
      [4,  '15:55:42', 'admin (LO89179, Samuel Sudhakar) CREATED event #52'],
      [4,  '16:01:09', 'admin (LO89179, Samuel Sudhakar) EDITED event #52'],
      [6,  '11:22:48', 'admin (WB55131, Justin Collier) CREATED schedule entry #43'],
      [8,  '10:14:00', 'staff (DA46048, Abe Green) DELETED event #10'],
      [9,  '09:05:31', 'admin (OI33374, Sam Dolle) EDITED account for cjohnson'],
      [12, '14:00:00', 'admin (OI33374, Sam Dolle) CREATED event #48'],
      [13, '08:30:22', 'staff (DA46048, Abe Green) EDITED schedule entry #3'],
      [15, '11:45:09', 'admin (WB55131, Justin Collier) DELETED account for dgreen'],
      [18, '13:22:55', 'staff (DA46048, Abe Green) CREATED schedule entry #44'],
      [20, '09:10:00', 'admin (OI33374, Sam Dolle) EDITED event #44'],
      [21, '16:30:00', 'staff (DA46048, Abe Green) CREATED account for ewhite'],
      [25, '10:55:12', 'admin (LO89179, Samuel Sudhakar) DELETED event #9'],
      [27, '12:00:00', 'staff (DA46048, Abe Green) EDITED account for fblack'],
      [30, '08:00:00', 'admin (OI33374, Sam Dolle) CREATED schedule entry #45'],
    ];
    entries.forEach(([daysAgo, time, msg]) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      const key = d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      if (!logs[key]) logs[key] = [];
      logs[key].push(`[${key} ${time}] ${msg}`);
    });
    return logs;
  })();
  // ---- End dummy data ----

  const allDates   = Object.keys(DUMMY_LOGS).sort();
  const oldestDate = allDates[0] || toDateKey(new Date());

  let windowStart = null; // set on fetch

  // ---- Date key helpers ----

  function toDateKey(date) {
    return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  }

  function dateFromKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(key, n) {
    const d = dateFromKey(key);
    d.setDate(d.getDate() + n);
    return toDateKey(d);
  }

  function formatLabel(key) {
    return dateFromKey(key).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  // ---- Rendering ----

  function showMessage(text, type = 'success') {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.className   = `tutoring-admin-message ${type}`;
    msgEl.hidden      = false;
    setTimeout(() => { msgEl.hidden = true; }, 4000);
  }

  function renderWindow(startKey) {
    const todayKey = toDateKey(new Date());
    if (startKey > todayKey) startKey = todayKey;

    if (startKey < oldestDate) startKey = oldestDate;

    windowStart = startKey;
    const endKey = addDays(startKey, -6);

    const windowEntries = [];
    for (let i = 0; i < 7; i++) {
      const dayKey = addDays(startKey, -i);
      (DUMMY_LOGS[dayKey] || []).forEach(line => windowEntries.push(line));
    }

    dateLabel.textContent = `${formatLabel(endKey)} – ${formatLabel(startKey)}`;

    Array.from(box.childNodes).forEach(n => { if (n !== emptyMsg) n.remove(); });

    if (!windowEntries.length) {
      emptyMsg.hidden = false;
    } else {
      emptyMsg.hidden = true;
      windowEntries.forEach(line => {
        const span = document.createElement('span');
        span.className   = 'logs-entry';
        span.textContent = line;
        box.appendChild(span);
      });
    }

    prevBtn.disabled = endKey <= oldestDate;

    nextBtn.disabled = startKey >= todayKey;
  }

  on(fetchBtn, 'click', () => {
  viewer.hidden = false;
  renderWindow(toDateKey(new Date()));
  showMessage('Logs loaded.');

  fetchBtn.id        = 'logs-export-btn';
  fetchBtn.textContent = 'Export Logs';
  fetchBtn.classList.replace('button-primary', 'button-secondary');

  fetchBtn.addEventListener('click', () => {
    const allEntries = allDates.flatMap(date => DUMMY_LOGS[date] || []);
    const blob = new Blob([allEntries.join('\n')], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `audit-logs-full-${toDateKey(new Date())}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, { once: false });
});

  on(prevBtn, 'click', () => {
    renderWindow(addDays(windowStart, -7));
  });

  on(nextBtn, 'click', () => {
    renderWindow(addDays(windowStart, 7));
  });

  on(jumpBtn, 'click', () => {
    const val = jumpInput?.value;
    if (!val) { showMessage('Select a date first.', 'error'); return; }
    renderWindow(val);
    showMessage(`Jumped to week of ${formatLabel(val)}.`);
  });

}

// =============================================================================
// BOOT
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  handleResize();
  initExpanders();
  initSubjectFilters();
  initAdminTableFilters();
  initAdminUI();
  initEventFields();
  initLogsUI();
});