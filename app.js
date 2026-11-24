(() => {
  "use strict";

  const storageKey = "vayro-workspace-v2";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function todayISO() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function emptyState() {
    return { profileName: "Arnav", assignments: [], events: [], tasks: [], grades: [], materials: [], sessions: [] };
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey));
      return parsed && typeof parsed === "object" ? { ...emptyState(), ...parsed } : emptyState();
    } catch {
      return emptyState();
    }
  }

  let state = loadState();
  let calendarDate = new Date();
  let selectedDate = todayISO();
  let remainingSeconds = 25 * 60;
  let timerId = null;
  let timerRunning = false;
  let selectedMinutes = 25;

  function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function makeId() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function fromISO(value) {
    return value ? new Date(`${value}T00:00:00`) : new Date();
  }

  function shortDate(value) {
    return fromISO(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function formatTime(value) {
    if (!value) return "Any time";
    return fromISO(`2000-01-01T${value}`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function gradeAverage() {
    const values = state.grades.map((grade) => {
      const score = Number(grade.score);
      const max = Number(grade.max);
      return max > 0 ? Math.max(0, Math.min(100, score / max * 100)) : null;
    }).filter((value) => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }

  function renderProfile() {
    $$(".profile-name").forEach((node) => node.textContent = state.profileName);
    $$(".avatar").forEach((node) => node.textContent = state.profileName.charAt(0).toUpperCase());
  }

  function updateTime() {
    const now = new Date();
    if ($("#live-date")) $("#live-date").textContent = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    if ($("#live-clock")) $("#live-clock").textContent = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function renderOverview() {
    const open = state.assignments.filter((item) => !item.done);
    const average = gradeAverage();
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const due = open.filter((item) => {
      const date = fromISO(item.date);
      return date >= fromISO(todayISO()) && date <= weekEnd;
    }).length;
    const focusMinutes = state.sessions.filter((session) => session.done).reduce((sum, session) => sum + Number(session.minutes), 0);
    $("#open-count").textContent = open.length;
    $("#due-count").textContent = due;
    $("#average-score").textContent = average === null ? "No data" : `${Math.round(average)}%`;
    $("#focus-count").textContent = `${Math.floor(focusMinutes / 60)}h ${focusMinutes % 60}m`;

    const agenda = state.events.filter((event) => event.date === todayISO()).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    $("#today-list").innerHTML = agenda.length ? agenda.map((event) => `<div class="agenda-row"><time>${formatTime(event.time)}</time><span><strong>${escapeHTML(event.title)}</strong><small>${escapeHTML(event.type)}</small></span></div>`).join("") : `<div class="empty">No events scheduled today.</div>`;

    const upcoming = open.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
    $("#next-assignment-list").innerHTML = upcoming.length ? upcoming.map((item) => `<div class="agenda-row"><time>${shortDate(item.date)}</time><span><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.subject)}</small></span></div>`).join("") : `<div class="empty">No open assignments.</div>`;
  }

  function renderAssignments() {
    const list = $("#assignment-list");
    if (!list) return;
    const filter = $(".filter-row button.active")?.dataset.filter || "all";
    const query = ($("#assignment-search")?.value || "").toLowerCase();
    const rows = state.assignments.filter((item) => {
      const filterMatch = filter === "all" || (filter === "done" ? item.done : !item.done);
      return filterMatch && `${item.title} ${item.subject} ${item.notes || ""}`.toLowerCase().includes(query);
    }).sort((a, b) => a.date.localeCompare(b.date));
    list.innerHTML = rows.length ? rows.map((item) => `<tr><td><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.notes || "No notes")}</small></td><td>${escapeHTML(item.subject)}</td><td>${shortDate(item.date)}</td><td><span class="tag ${item.done ? "done" : item.date < todayISO() ? "urgent" : ""}">${item.done ? "Completed" : item.date < todayISO() ? "Overdue" : "Open"}</span></td><td><div class="row-actions"><button type="button" data-action="toggle-assignment" data-id="${item.id}">${item.done ? "Reopen" : "Complete"}</button><button type="button" data-action="delete-assignment" data-id="${item.id}">Delete</button></div></td></tr>`).join("") : `<tr><td colspan="5"><div class="empty">No assignments match this view.</div></td></tr>`;
  }

  function renderCalendar() {
    const grid = $("#calendar-grid");
    if (!grid) return;
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    $("#calendar-title").textContent = calendarDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    const cells = [];
    for (let index = 0; index < 42; index++) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const events = state.events.filter((event) => event.date === iso).slice(0, 2);
      cells.push(`<button type="button" class="calendar-cell ${date.getMonth() !== month ? "muted" : ""} ${iso === selectedDate ? "selected" : ""}" data-date="${iso}"><strong>${date.getDate()}</strong>${events.map((event) => `<span class="calendar-dot">${escapeHTML(event.title)}</span>`).join("")}</button>`);
    }
    grid.innerHTML = cells.join("");
    renderSelectedDay();
  }

  function renderSelectedDay() {
    if ($("#selected-date")) $("#selected-date").textContent = fromISO(selectedDate).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    const events = state.events.filter((event) => event.date === selectedDate).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    if ($("#day-events")) $("#day-events").innerHTML = events.length ? events.map((event) => `<div class="agenda-row"><time>${formatTime(event.time)}</time><span><strong>${escapeHTML(event.title)}</strong><small>${escapeHTML(event.type)}${event.notes ? `, ${escapeHTML(event.notes)}` : ""}</small></span></div>`).join("") : `<div class="empty">No events for this day.</div>`;
  }

  function renderTasks() {
    const list = $("#task-list");
    if (!list) return;
    const tasks = state.tasks.slice().sort((a, b) => (Number(a.done) - Number(b.done)) || (a.date || "9999").localeCompare(b.date || "9999"));
    list.innerHTML = tasks.length ? `<table class="data-table"><tbody>${tasks.map((task) => `<tr><td><strong>${escapeHTML(task.title)}</strong><small>${escapeHTML(task.subject || "No subject")}</small></td><td>${task.date ? shortDate(task.date) : "No date"}</td><td><span class="tag ${task.done ? "done" : ""}">${task.done ? "Completed" : "Open"}</span></td><td><div class="row-actions"><button type="button" data-action="toggle-task" data-id="${task.id}">${task.done ? "Reopen" : "Complete"}</button><button type="button" data-action="delete-task" data-id="${task.id}">Delete</button></div></td></tr>`).join("")}</tbody></table>` : `<div class="empty">No study tasks yet.</div>`;
  }

  function renderGrades() {
    const list = $("#grade-list");
    if (!list) return;
    const average = gradeAverage();
    if ($("#grade-average")) $("#grade-average").textContent = average === null ? "No data" : `${Math.round(average)}%`;
    if ($("#grade-count")) $("#grade-count").textContent = state.grades.length;
    if ($("#grade-subject-count")) $("#grade-subject-count").textContent = new Set(state.grades.map((grade) => grade.subject)).size;
    list.innerHTML = state.grades.length ? state.grades.slice().sort((a, b) => b.date.localeCompare(a.date)).map((grade) => {
      const percent = Math.round(Number(grade.score) / Number(grade.max) * 100);
      return `<tr><td><strong>${escapeHTML(grade.title)}</strong></td><td>${escapeHTML(grade.subject)}</td><td>${shortDate(grade.date)}</td><td>${escapeHTML(String(grade.score))}/${escapeHTML(String(grade.max))} <span class="tag">${percent}%</span></td><td><div class="row-actions"><button type="button" data-action="delete-grade" data-id="${grade.id}">Delete</button></div></td></tr>`;
    }).join("") : `<tr><td colspan="5"><div class="empty">No grades recorded.</div></td></tr>`;
  }

  function renderMaterials() {
    const list = $("#material-list");
    if (!list) return;
    const query = ($("#material-search")?.value || "").toLowerCase();
    const items = state.materials.filter((item) => `${item.title} ${item.subject} ${item.type} ${item.notes || ""}`.toLowerCase().includes(query));
    if ($("#material-count")) $("#material-count").textContent = `${items.length} resource${items.length === 1 ? "" : "s"}`;
    list.innerHTML = items.length ? items.map((item) => `<article class="resource-card"><p class="eyebrow">${escapeHTML(item.type)}</p><h2>${escapeHTML(item.title)}</h2><p>${escapeHTML(item.subject || "General")}</p><p>${escapeHTML(item.notes || "No notes")}</p><div class="card-actions">${item.url ? `<a class="button secondary" href="${escapeHTML(item.url)}" target="_blank" rel="noreferrer">Open link</a>` : ""}<button type="button" class="button secondary" data-action="delete-material" data-id="${item.id}">Delete</button></div></article>`).join("") : `<div class="empty">No resources match this view.</div>`;
  }

  function renderAnalytics() {
    const total = state.assignments.length;
    const done = state.assignments.filter((item) => item.done).length;
    const rate = total ? Math.round(done / total * 100) : 0;
    const average = gradeAverage();
    const focus = state.sessions.reduce((sum, session) => sum + Number(session.minutes), 0);
    if ($("#completion-rate")) $("#completion-rate").textContent = `${rate}%`;
    if ($("#completion-bar")) $("#completion-bar").style.width = `${rate}%`;
    if ($("#completion-detail")) $("#completion-detail").textContent = `${done} of ${total} assignments`;
    if ($("#focus-total")) $("#focus-total").textContent = `${Math.floor(focus / 60)}h ${focus % 60}m`;
    if ($("#analytics-average")) $("#analytics-average").textContent = average === null ? "No data" : `${Math.round(average)}%`;
    const subjects = {};
    state.grades.forEach((grade) => {
      const subject = grade.subject || "Other";
      const score = Number(grade.score) / Number(grade.max) * 100;
      subjects[subject] = subjects[subject] || [];
      subjects[subject].push(score);
    });
    const bars = $("#subject-bars");
    if (!bars) return;
    bars.innerHTML = Object.keys(subjects).length ? Object.entries(subjects).map(([subject, values]) => {
      const value = Math.round(values.reduce((sum, item) => sum + item, 0) / values.length);
      return `<div class="bar-row"><strong>${escapeHTML(subject)}</strong><div class="progress"><span style="width:${value}%"></span></div><span>${value}%</span></div>`;
    }).join("") : `<div class="empty">No subject grades recorded.</div>`;
  }

  function renderTimer() {
    const display = $("#timer-display");
    if (!display) return;
    display.textContent = `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`;
    if ($("#timer-toggle")) $("#timer-toggle").textContent = timerRunning ? "Pause" : "Start";
  }

  function bindTimer() {
    const toggle = $("#timer-toggle");
    if (!toggle) return;
    toggle.addEventListener("click", () => {
      if (timerRunning) {
        clearInterval(timerId);
        timerId = null;
        timerRunning = false;
        renderTimer();
        return;
      }
      timerRunning = true;
      timerId = setInterval(() => {
        remainingSeconds -= 1;
        if (remainingSeconds <= 0) {
          clearInterval(timerId);
          timerId = null;
          timerRunning = false;
          state.sessions.push({ id: makeId(), date: todayISO(), minutes: selectedMinutes, done: true });
          saveState();
          remainingSeconds = selectedMinutes * 60;
          showToast("Focus session recorded.");
        }
        renderTimer();
      }, 1000);
      renderTimer();
    });
    $$(".preset").forEach((button) => button.addEventListener("click", () => {
      clearInterval(timerId);
      timerId = null;
      timerRunning = false;
      selectedMinutes = Number(button.dataset.minutes);
      remainingSeconds = selectedMinutes * 60;
      $$(".preset").forEach((item) => item.classList.toggle("active", item === button));
      renderTimer();
    }));
  }

  function openDialog(type) {
    const dialog = $("#item-dialog");
    if (!dialog) return;
    const form = $("form", dialog);
    if (form) form.reset();
    dialog.showModal();
  }

  function bindForms() {
    const eventForm = $("#event-form");
    if (eventForm) eventForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(eventForm));
      state.events.push({ id: makeId(), title: data.title, date: data.date, time: data.time, type: data.type, duration: Number(data.duration), notes: data.notes });
      saveState();
      $("#item-dialog").close();
      renderAll();
      showToast("Event saved.");
    });
    const taskForm = $("#task-form");
    if (taskForm) taskForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(taskForm));
      state.tasks.push({ id: makeId(), title: data.title, subject: data.subject, date: data.date, done: false });
      saveState();
      $("#item-dialog").close();
      renderAll();
      showToast("Task saved.");
    });
    const gradeForm = $("#grade-form");
    if (gradeForm) gradeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(gradeForm));
      state.grades.push({ id: makeId(), title: data.title, subject: data.subject, date: data.date, score: Number(data.score), max: Number(data.max) });
      saveState();
      $("#item-dialog").close();
      renderAll();
      showToast("Grade saved.");
    });
    const materialForm = $("#material-form");
    if (materialForm) materialForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(materialForm));
      state.materials.push({ id: makeId(), title: data.title, subject: data.subject, type: data.type, url: data.url, notes: data.notes });
      saveState();
      $("#item-dialog").close();
      renderAll();
      showToast("Resource saved.");
    });
  }

  function bindDataActions() {
    $$("[data-open]").forEach((button) => button.addEventListener("click", () => openDialog(button.dataset.open)));
    $$("[data-close]").forEach((button) => button.addEventListener("click", () => $("#item-dialog").close()));
    $$(".filter-row button").forEach((button) => button.addEventListener("click", () => {
      $$(".filter-row button").forEach((item) => item.classList.toggle("active", item === button));
      renderAssignments();
    }));
    $("#assignment-search")?.addEventListener("input", renderAssignments);
    $("#material-search")?.addEventListener("input", renderMaterials);
    $("#month-prev")?.addEventListener("click", () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); });
    $("#month-next")?.addEventListener("click", () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); });
    $("#calendar-grid")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-date]");
      if (!button) return;
      selectedDate = button.dataset.date;
      renderCalendar();
    });
  }

  function bindRows() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const itemId = button.dataset.id;
      const action = button.dataset.action;
      if (action === "toggle-assignment") {
        const item = state.assignments.find((assignment) => assignment.id === itemId);
        if (item) item.done = !item.done;
      }
      if (action === "delete-assignment") state.assignments = state.assignments.filter((item) => item.id !== itemId);
      if (action === "toggle-task") {
        const item = state.tasks.find((task) => task.id === itemId);
        if (item) item.done = !item.done;
      }
      if (action === "delete-task") state.tasks = state.tasks.filter((item) => item.id !== itemId);
      if (action === "delete-grade") state.grades = state.grades.filter((item) => item.id !== itemId);
      if (action === "delete-material") state.materials = state.materials.filter((item) => item.id !== itemId);
      saveState();
      renderAll();
    });
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vayro-backup-${todayISO()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function bindSettings() {
    if ($("#profile-form")) $("#profile-form").addEventListener("submit", (event) => {
      event.preventDefault();
      state.profileName = ($("#profile-name").value || "").trim() || "Arnav";
      saveState();
      renderProfile();
      showToast("Profile saved.");
    });
    $("#export-data")?.addEventListener("click", exportBackup);
    $("#import-data")?.addEventListener("click", () => $("#import-file").click());
    $("#import-file")?.addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        if (!Array.isArray(parsed.assignments) || !Array.isArray(parsed.events)) throw new Error("This is not a VAYRO backup.");
        state = parsed;
        saveState();
        renderAll();
        showToast("Backup restored.");
      } catch (error) {
        showToast(error.message);
      } finally {
        event.target.value = "";
      }
    });
    $("#clear-data")?.addEventListener("click", () => {
      if (!confirm("Clear all VAYRO data saved in this browser?")) return;
      state = emptyState();
      saveState();
      renderAll();
      showToast("Workspace cleared.");
    });
  }

  function bindCalendarExport() {
    $$("[data-export-calendar]").forEach((button) => button.addEventListener("click", () => {
      const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//VAYRO//Academic Calendar//EN"];
      state.events.forEach((event) => {
        const date = event.date.replace(/-/g, "");
        lines.push("BEGIN:VEVENT", `UID:${event.id}@vayro.local`, `DTSTART:${date}T${(event.time || "0900").replace(":", "")}00`, `SUMMARY:${event.title}`, "END:VEVENT");
      });
      lines.push("END:VCALENDAR");
      const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vayro-calendar-${todayISO()}.ics`;
      link.click();
      URL.revokeObjectURL(url);
      showToast("Calendar exported.");
    }));
  }

  function bindForms() {
    const eventForm = $("#event-form");
    if (eventForm) eventForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(eventForm));
      state.events.push({ id: makeId(), title: data.title, date: data.date, time: data.time, type: data.type, duration: Number(data.duration), notes: data.notes });
      saveState();
      $("#item-dialog").close();
      renderAll();
      showToast("Event saved.");
    });
    const taskForm = $("#task-form");
    if (taskForm) taskForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(taskForm));
      state.tasks.push({ id: makeId(), title: data.title, subject: data.subject, date: data.date, done: false });
      saveState();
      $("#item-dialog").close();
      renderAll();
      showToast("Task saved.");
    });
    const gradeForm = $("#grade-form");
    if (gradeForm) gradeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(gradeForm));
      state.grades.push({ id: makeId(), title: data.title, subject: data.subject, date: data.date, score: Number(data.score), max: Number(data.max) });
      saveState();
      $("#item-dialog").close();
      renderAll();
      showToast("Grade saved.");
    });
    const materialForm = $("#material-form");
    if (materialForm) materialForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(materialForm));
      state.materials.push({ id: makeId(), title: data.title, subject: data.subject, type: data.type, url: data.url, notes: data.notes });
      saveState();
      $("#item-dialog").close();
      renderAll();
      showToast("Resource saved.");
    });
  }

  function renderAll() {
    renderProfile();
    const page = document.body.dataset.page;
    if (page === "overview") { renderOverview(); bindTimer(); }
    if (page === "assignments") renderAssignments();
    if (page === "calendar") renderCalendar();
    if (page === "planner") renderTasks();
    if (page === "grades") renderGrades();
    if (page === "materials") renderMaterials();
    if (page === "analytics") renderAnalytics();
    if (page === "settings") {
      $("#profile-name").value = state.profileName;
      bindSettings();
    }
  }

  const assignmentForm = $("#assignment-form");
  if (assignmentForm) assignmentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(assignmentForm));
    state.assignments.push({ id: makeId(), title: data.title, subject: data.subject, date: data.date, notes: data.notes, done: false });
    saveState();
    $("#item-dialog").close();
    renderAll();
    showToast("Assignment saved.");
  });
  bindForms();
  bindDataActions();
  bindRows();
  bindCalendarExport();
  updateTime();
  setInterval(updateTime, 1000);
  renderAll();
})();
