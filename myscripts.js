
(() => {
  "use strict";

  const STORAGE_KEY = "vayro-workspace-v1";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const elements = {
    date: $("#date-display"),
    clock: $("#clock-display"),
    breadcrumb: $("#page-breadcrumb"),
    welcomeName: $("#welcome-name"),
    sidebarName: $("#sidebar-name"),
    sidebarAvatar: $("#sidebar-avatar"),
    avatar: $("#profile-shortcut"),
    navAssignmentCount: $("#nav-assignment-count"),
    homeGreeting: $("#home-greeting"),

    statOpen: $("#stat-open"),
    statAverage: $("#stat-average"),
    statFocus: $("#stat-focus"),
    statCompleted: $("#stat-completed"),

    agenda: $("#today-agenda"),
    homeAssignments: $("#home-assignments-list"),
    nextTest: $("#next-test-content"),
    homeMaterials: $("#home-materials-list"),
    homeGradeSummary: $("#home-grade-summary"),
    homeGradeBar: $("#home-grade-bar"),

    timer: $("#timer-value"),
    timerButton: $("#focus-start-button"),
    timerReset: $("#focus-reset-button"),
    timerCaption: $("#timer-caption"),
    timerNote: $("#focus-session-note"),

    assignments: $("#assignments-list"),
    assignmentSearch: $("#assignment-search"),

    calendarMonth: $("#calendar-month-label"),
    calendarDays: $("#calendar-days"),
    selectedDate: $("#selected-date-label"),
    selectedEvents: $("#selected-day-events"),

    planner: $("#planner-list"),
    plannerCount: $("#planner-count"),

    grades: $("#grades-list"),

    materials: $("#materials-list"),
    materialsSearch: $("#materials-search"),
    materialsCount: $("#materials-count"),

    toastRegion: $("#toast-region"),
  };


  // =========================================
  // DATA AND STORAGE
  // =========================================

  const todayISO = () => toISODate(new Date());

  const emptyState = () => ({
    version: 1,
    profileName: "Arnav",
    assignments: [],
    events: [],
    tasks: [],
    grades: [],
    materials: [],
    sessions: [],
  });


  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return emptyState();
      }

      const parsed = JSON.parse(raw);

      if (!parsed || typeof parsed !== "object") {
        return emptyState();
      }

      const fresh = emptyState();

      return {
        ...fresh,
        ...parsed,

        profileName:
          typeof parsed.profileName === "string"
            ? parsed.profileName
            : fresh.profileName,

        assignments: Array.isArray(parsed.assignments)
          ? parsed.assignments
          : [],

        events: Array.isArray(parsed.events)
          ? parsed.events
          : [],

        tasks: Array.isArray(parsed.tasks)
          ? parsed.tasks
          : [],

        grades: Array.isArray(parsed.grades)
          ? parsed.grades
          : [],

        materials: Array.isArray(parsed.materials)
          ? parsed.materials
          : [],

        sessions: Array.isArray(parsed.sessions)
          ? parsed.sessions
          : [],
      };

    } catch (error) {
      console.warn("VAYRO could not read saved workspace data.", error);
      return emptyState();
    }
  }


  let state = loadState();

  let assignmentFilter = "all";
  let calendarCursor = new Date();
  let selectedDateISO = todayISO();

  let selectedMinutes = 25;
  let remainingSeconds = selectedMinutes * 60;

  let timerEndsAt = null;
  let timerInterval = null;
  let timerRunning = false;


  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );

    } catch (error) {
      console.error("VAYRO could not save workspace data.", error);

      showToast(
        "Could not save data. Check your browser storage settings.",
        true
      );
    }
  }


  function makeId() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return window.crypto.randomUUID();
    }

    return `vayro-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }


  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }


  // =========================================
  // DATE AND TIME HELPERS
  // =========================================

  function toISODate(date) {
    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }


  function fromISODate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      return new Date(NaN);
    }

    const [year, month, day] = value.split("-").map(Number);

    return new Date(year, month - 1, day);
  }


  function formatDate(
    value,
    options = {
      month: "short",
      day: "numeric",
      year: "numeric"
    }
  ) {
    const date = fromISODate(value);

    if (Number.isNaN(date.getTime())) {
      return "No date";
    }

    return date.toLocaleDateString(undefined, options);
  }


  function formatTime(value) {
    if (!value) {
      return "Any time";
    }

    const [hours, minutes] = value.split(":").map(Number);

    if (
      !Number.isFinite(hours) ||
      !Number.isFinite(minutes)
    ) {
      return value;
    }

    const date = new Date();

    date.setHours(hours, minutes, 0, 0);

    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }


  function shortDate(value) {
    return formatDate(value, {
      month: "short",
      day: "numeric",
    });
  }


  function daysFromToday(value) {
    const target = fromISODate(value);

    if (Number.isNaN(target.getTime())) {
      return null;
    }

    const today = fromISODate(todayISO());

    return Math.round(
      (target - today) / 86400000
    );
  }


  function dueText(value) {
    const difference = daysFromToday(value);

    if (difference === null) {
      return "No date";
    }

    if (difference < 0) {
      return `${Math.abs(difference)} day${Math.abs(difference) === 1 ? "" : "s"} overdue`;
    }

    if (difference === 0) {
      return "Due today";
    }

    if (difference === 1) {
      return "Due tomorrow";
    }

    if (difference < 7) {
      return `Due in ${difference} days`;
    }

    return `Due ${shortDate(value)}`;
  }


  // =========================================
  // GRADE CALCULATIONS
  // =========================================

  function percentForGrade(grade) {
    const score = Number(grade.score);
    const max = Number(grade.maxScore);

    if (
      !Number.isFinite(score) ||
      !Number.isFinite(max) ||
      max <= 0
    ) {
      return null;
    }

    return Math.max(
      0,
      Math.min(100, (score / max) * 100)
    );
  }


  function getAverage(grades = state.grades) {
    const values = grades
      .map(percentForGrade)
      .filter((value) => value !== null);

    if (!values.length) {
      return null;
    }

    return values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length;
  }


  // =========================================
  // NOTIFICATIONS
  // =========================================

  function showToast(message, isError = false) {
    if (!elements.toastRegion) {
      return;
    }

    const toast = document.createElement("div");

    toast.className = `toast${isError ? " is-error" : ""}`;
    toast.textContent = message;

    elements.toastRegion.append(toast);

    window.setTimeout(() => toast.remove(), 3600);
  }


  // =========================================
  // DIALOG MANAGEMENT
  // =========================================

  function openDialog(id) {
    const dialog = document.getElementById(id);

    if (!dialog) {
      return;
    }

    if (
      id === "event-dialog" &&
      !$("#event-id").value
    ) {
      $("#event-date").value = selectedDateISO || todayISO();
    }

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      showToast(
        "Your browser does not support dialog windows. Try a recent browser.",
        true
      );
    }
  }


  function closeDialog(button) {
    const dialog = button.closest("dialog");

    if (dialog) {
      dialog.close();
    }
  }


  function resetDialogForm(dialogId) {
    const dialog = document.getElementById(dialogId);

    if (!dialog) {
      return;
    }

    const form = $("form", dialog);

    if (form) {
      form.reset();
    }

    const idField = $("input[type='hidden']", dialog);

    if (idField) {
      idField.value = "";
    }

    if (dialogId === "assignment-dialog") {
      $("#assignment-dialog-title").textContent = "New assignment";
    }

    if (dialogId === "event-dialog") {
      $("#event-dialog-title").textContent = "New calendar event";
    }

    if (dialogId === "task-dialog") {
      $("#task-dialog-title").textContent = "New study task";
    }

    if (dialogId === "grade-dialog") {
      $("#grade-dialog-title").textContent = "Add grade";
    }

    if (dialogId === "material-dialog") {
      $("#material-dialog-title").textContent = "Save resource";
    }
  }


  // =========================================
  // PAGE NAVIGATION
  // =========================================

  function switchView(viewName) {
    const panel = $(`[data-view-panel="${viewName}"]`);

    if (!panel) {
      return;
    }

    $$("[data-view-panel]").forEach((item) => {
      const visible = item.dataset.viewPanel === viewName;

      item.hidden = !visible;

      item.classList.toggle(
        "is-visible",
        visible
      );
    });

    $$(".nav-link[data-view]").forEach((link) => {
      const active = link.dataset.view === viewName;

      link.classList.toggle("is-active", active);

      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    const activeLink = $(
      `.nav-link[data-view="${viewName}"]`
    );

    elements.breadcrumb.textContent = activeLink
      ? activeLink.textContent.trim().replace(/\s+\d+$/, "")
      : "Overview";

    if (viewName === "calendar") renderCalendar();
    if (viewName === "assignments") renderAssignments();
    if (viewName === "grades") renderGrades();
    if (viewName === "materials") renderMaterials();
    if (viewName === "analytics") renderAnalytics();

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }


  // =========================================
  // LIVE DATE AND CLOCK
  // =========================================

  function renderDateAndClock() {
    const now = new Date();

    elements.date.textContent = now.toLocaleDateString(
      undefined,
      {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }
    );

    elements.clock.textContent = now.toLocaleTimeString(
      undefined,
      {
        hour: "numeric",
        minute: "2-digit",
      }
    );

    elements.clock.dateTime = now.toISOString();

    const hour = now.getHours();

    elements.homeGreeting.textContent =
      hour < 12
        ? "Morning"
        : hour < 18
          ? "Today"
          : "Evening";
  }


  // =========================================
  // PROFILE
  // =========================================

  function renderProfile() {
    const name = (state.profileName || "Student").trim() || "Student";

    const firstName = name.split(/\s+/)[0];

    elements.welcomeName.textContent = firstName;
    elements.sidebarName.textContent = name;

    elements.sidebarAvatar.textContent =
      firstName.charAt(0).toUpperCase();

    elements.avatar.textContent =
      firstName.charAt(0).toUpperCase();

    $("#profile-name-input").value = name;
  }


  // =========================================
  // FOCUS STATISTICS
  // =========================================

  function currentWeekStart() {
    const date = new Date();

    const day = date.getDay();

    date.setDate(date.getDate() - day);
    date.setHours(0, 0, 0, 0);

    return date;
  }


  function getFocusMinutesThisWeek() {
    const start = currentWeekStart();

    return state.sessions
      .filter((session) => {
        const date = fromISODate(session.date);

        return (
          session.completed &&
          !Number.isNaN(date.getTime()) &&
          date >= start
        );
      })
      .reduce(
        (sum, session) => sum + (Number(session.minutes) || 0),
        0
      );
  }


  // =========================================
  // HOME DASHBOARD
  // =========================================

  function renderHome() {
    const openAssignments = state.assignments.filter(
      (item) => !item.completed
    );

    const completedAssignments = state.assignments.filter(
      (item) => item.completed
    );

    const average = getAverage();

    const focusMinutes = getFocusMinutesThisWeek();

    elements.statOpen.textContent = String(openAssignments.length);

    elements.statAverage.textContent =
      average === null ? "No data" : `${Math.round(average)}%`;

    elements.statFocus.innerHTML =
      `${focusMinutes} <small>min</small>`;

    elements.statCompleted.textContent =
      String(completedAssignments.length);

    elements.navAssignmentCount.textContent =
      String(openAssignments.length);


    // Today's agenda

    const agendaItems = [];

    state.events
      .filter((event) => event.date === todayISO())
      .forEach((event) => agendaItems.push({
        kind: "event",
        time: event.time || "",
        title: event.title,
        detail: `${event.type || "Event"}${event.notes ? ` · ${event.notes}` : ""}`,
      }));

    state.assignments
      .filter((item) => !item.completed && item.dueDate === todayISO())
      .forEach((item) => agendaItems.push({
        kind: "assignment",
        time: "",
        title: item.title,
        detail: `Assignment · ${item.subject}`,
      }));

    agendaItems.sort((a, b) =>
      (a.time || "99:99").localeCompare(b.time || "99:99")
    );

    if (!agendaItems.length) {
      elements.agenda.innerHTML = `
        <div class="empty-state compact">
          <span aria-hidden="true">+</span>
          <p>Your day is open.</p>
          <small>Add a calendar event to plan your day.</small>
        </div>
      `;
    } else {
      elements.agenda.innerHTML = agendaItems.map((item) => `
        <div class="agenda-row">
          <span class="agenda-time">
            ${item.time ? escapeHTML(formatTime(item.time)) : "DUE"}
          </span>

          <span class="agenda-item-copy">
            <strong>${escapeHTML(item.title)}</strong>
            <small>${escapeHTML(item.detail)}</small>
          </span>

          <span class="agenda-tag">
            ${item.kind === "event" ? "EVENT" : "DUE"}
          </span>
        </div>
      `).join("");
    }


    // Upcoming assignments

    const upcoming = openAssignments
      .slice()
      .sort((a, b) =>
        (a.dueDate || "9999").localeCompare(b.dueDate || "9999")
      )
      .slice(0, 4);

    if (!upcoming.length) {
      elements.homeAssignments.innerHTML = `
        <div class="empty-state compact">
          <span>✓</span>
          <p>No assignments yet.</p>
          <small>Add your first assignment to see it here.</small>
        </div>
      `;
    } else {
      elements.homeAssignments.innerHTML = upcoming.map((item) => {
        const difference = daysFromToday(item.dueDate);

        const urgent = difference !== null && difference <= 1;

        return `
          <div class="mini-assignment">
            <span class="subject-stripe${urgent ? " is-urgent" : ""}"></span>

            <span>
              <strong>${escapeHTML(item.title)}</strong>
              <small>${escapeHTML(item.subject)}</small>
            </span>

            <span class="mini-due${urgent ? " is-urgent" : ""}">
              ${escapeHTML(dueText(item.dueDate))}
            </span>
          </div>
        `;
      }).join("");
    }


    // Next test

    const nextTest = state.events
      .filter((event) =>
        event.type === "Test" &&
        event.date >= todayISO()
      )
      .sort((a, b) =>
        `${a.date} ${a.time || ""}`.localeCompare(
          `${b.date} ${b.time || ""}`
        )
      )[0];

    if (!nextTest) {
      elements.nextTest.innerHTML = `
        <p class="muted-copy">
          Add a test event to your calendar and it will appear here.
        </p>
      `;
    } else {
      const difference = daysFromToday(nextTest.date);

      elements.nextTest.innerHTML = `
        <div class="test-subject">
          ${escapeHTML(nextTest.title)}
        </div>

        <div class="test-meta">
          ${escapeHTML(formatDate(nextTest.date))}
          ${nextTest.time ? ` · ${escapeHTML(formatTime(nextTest.time))}` : ""}
        </div>

        <div class="test-days-line">
          <strong>${difference}</strong>
          <span>${difference === 1 ? "day to prepare" : "days to prepare"}</span>
        </div>
      `;
    }


    // Study materials

    const recentMaterials = state.materials
      .slice()
      .sort((a, b) =>
        (b.createdAt || "").localeCompare(a.createdAt || "")
      )
      .slice(0, 3);

    if (!recentMaterials.length) {
      elements.homeMaterials.innerHTML = `
        <div class="empty-state compact">
          <span aria-hidden="true">R</span>
          <p>Your library is waiting.</p>
          <small>Save notes, links, and useful resources.</small>
        </div>
      `;
    } else {
      elements.homeMaterials.innerHTML = recentMaterials.map((item) => `
        <div class="material-preview-item">
          <span class="resource-icon" aria-hidden="true">R</span>

          <span>
            <strong>${escapeHTML(item.title)}</strong>
            <small>${escapeHTML(item.subject || item.type || "Resource")}</small>
          </span>
        </div>
      `).join("");
    }


    // Grade summary

    if (average === null) {
      elements.homeGradeSummary.innerHTML = `
        <span class="grade-empty">No data</span>
        <p class="muted-copy">
          Add a few grades to see your current average.
        </p>
      `;

      elements.homeGradeBar.style.width = "0%";

    } else {
      elements.homeGradeSummary.innerHTML = `
        <span class="grade-empty">${Math.round(average)}%</span>
        <p>
          Across ${state.grades.length} recorded assessment${state.grades.length === 1 ? "" : "s"}.
        </p>
      `;

      elements.homeGradeBar.style.width =
        `${Math.max(0, Math.min(100, average))}%`;
    }
  }


  // =========================================
  // ASSIGNMENT MANAGER
  // =========================================

  function renderAssignments() {
    const query = (
      elements.assignmentSearch.value || ""
    ).trim().toLowerCase();

    const items = state.assignments
      .filter((item) => {
        const matchesFilter =
          assignmentFilter === "all" ||
          (
            assignmentFilter === "completed"
              ? item.completed
              : !item.completed
          );

        const matchesQuery =
          !query ||
          `${item.title} ${item.subject} ${item.notes || ""}`
            .toLowerCase()
            .includes(query);

        return matchesFilter && matchesQuery;
      })
      .sort((a, b) =>
        (
          a.completed === b.completed
            ? (a.dueDate || "9999").localeCompare(b.dueDate || "9999")
            : Number(a.completed) - Number(b.completed)
        )
      );


    if (!items.length) {
      elements.assignments.innerHTML = `
        <div class="empty-state">
          <span aria-hidden="true">+</span>
          <h3>Nothing in this view.</h3>
          <p>Add an assignment or change your filter.</p>
        </div>
      `;

      return;
    }


    elements.assignments.innerHTML = items.map((item) => {
      const difference = daysFromToday(item.dueDate);

      const dueClass =
        !item.completed && difference !== null && difference < 0
          ? " overdue"
          : "";

      return `
        <article class="data-row" data-id="${escapeHTML(item.id)}">

          <div class="data-primary">
            <strong>${escapeHTML(item.title)}</strong>

            <small>
              ${escapeHTML(item.notes || "No notes added")}
              ${
                item.priority === "high"
                  ? " · High priority"
                  : item.priority === "low"
                    ? " · Low priority"
                    : ""
              }
            </small>
          </div>

          <span class="data-subject">
            ${escapeHTML(item.subject)}
          </span>

          <span class="data-date${dueClass}">
            ${escapeHTML(dueText(item.dueDate))}
          </span>

          <span class="data-status${item.completed ? " completed" : ""}">
            ${item.completed ? "Completed" : "To do"}
          </span>

          <div class="row-actions">

            <button
              class="icon-action"
              type="button"
              data-assignment-action="toggle"
              data-id="${escapeHTML(item.id)}">
              ${item.completed ? "Reopen" : "Done"}
            </button>

            <button
              class="icon-action"
              type="button"
              data-assignment-action="edit"
              data-id="${escapeHTML(item.id)}">
              Edit
            </button>

            <button
              class="icon-action danger"
              type="button"
              data-assignment-action="delete"
              data-id="${escapeHTML(item.id)}"
              aria-label="Delete ${escapeHTML(item.title)}">
              ×
            </button>

          </div>

        </article>
      `;
    }).join("");
  }


  // =========================================
  // CALENDAR
  // =========================================

  function renderCalendar() {
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();

    elements.calendarMonth.textContent =
      calendarCursor.toLocaleDateString(
        undefined,
        {
          month: "long",
          year: "numeric",
        }
      );

    const firstDay = new Date(year, month, 1);

    const daysInMonth =
      new Date(year, month + 1, 0).getDate();

    const offset = firstDay.getDay();

    const totalCells =
      Math.ceil((offset + daysInMonth) / 7) * 7;

    const cells = [];


    for (let index = 0; index < totalCells; index += 1) {
      const date = new Date(year, month, 1 - offset + index);

      const iso = toISODate(date);

      const isCurrentMonth = date.getMonth() === month;

      const dayEvents = state.events.filter(
        (event) => event.date === iso
      );

      const dueAssignments = state.assignments.filter(
        (item) => !item.completed && item.dueDate === iso
      );

      const isToday = iso === todayISO();
      const isSelected = iso === selectedDateISO;


      const dots = [
        ...dayEvents
          .slice(0, 3)
          .map((event) =>
            `<i class="day-dot${event.type === "Test" ? " test" : ""}" aria-hidden="true"></i>`
          ),

        ...dueAssignments
          .slice(
            0,
            Math.max(
              0,
              3 - Math.min(3, dayEvents.length)
            )
          )
          .map(() =>
            '<i class="day-dot assignment" aria-hidden="true"></i>'
          ),

      ].join("");


      const count = dayEvents.length + dueAssignments.length;


      cells.push(`
        <button
          class="calendar-day${isCurrentMonth ? "" : " is-outside"}${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}"
          type="button"
          data-calendar-date="${iso}"
          aria-label="${escapeHTML(formatDate(iso, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
          }))}${count ? `, ${count} item${count === 1 ? "" : "s"}` : ""}"
          aria-pressed="${isSelected}">

          <span class="day-number">${date.getDate()}</span>

          <span class="day-dots">${dots}</span>

        </button>
      `);
    }


    elements.calendarDays.innerHTML = cells.join("");

    renderSelectedDay();
  }


  function renderSelectedDay() {
    const selectedDate = selectedDateISO;

    elements.selectedDate.textContent =
      formatDate(
        selectedDate,
        {
          weekday: "long",
          month: "long",
          day: "numeric",
        }
      );

    const events = state.events
      .filter((event) => event.date === selectedDate)
      .sort((a, b) =>
        (a.time || "99:99").localeCompare(b.time || "99:99")
      );

    const assignments = state.assignments.filter(
      (item) =>
        !item.completed &&
        item.dueDate === selectedDate
    );


    if (!events.length && !assignments.length) {
      elements.selectedEvents.innerHTML = `
        <div class="empty-state compact">
          <span>☼</span>
          <p>Nothing scheduled.</p>
          <small>Choose a day or add an event.</small>
        </div>
      `;

      return;
    }


    const eventRows = events.map((event) => `
      <div class="day-event">

        <span class="day-event-bar${event.type === "Test" ? " test" : ""}"></span>

        <span>
          <strong>${escapeHTML(event.title)}</strong>

          <small>
            ${escapeHTML(event.type)}
            ·
            ${escapeHTML(event.time ? formatTime(event.time) : "Any time")}
            ${event.notes ? ` · ${escapeHTML(event.notes)}` : ""}
          </small>
        </span>

        <span class="day-event-actions">

          <button
            class="icon-action"
            type="button"
            data-event-action="edit"
            data-id="${escapeHTML(event.id)}">
            Edit
          </button>

          <button
            class="icon-action danger"
            type="button"
            data-event-action="delete"
            data-id="${escapeHTML(event.id)}">
            Delete
          </button>

        </span>
      </div>
    `);


    const assignmentRows = assignments.map((item) => `
      <div class="day-event">

        <span class="day-event-bar"></span>

        <span>
          <strong>${escapeHTML(item.title)}</strong>
          <small>Assignment due · ${escapeHTML(item.subject)}</small>
        </span>

      </div>
    `);


    elements.selectedEvents.innerHTML =
      [...eventRows, ...assignmentRows].join("");
  }


  // =========================================
  // STUDY PLANNER
  // =========================================

  function renderPlanner() {
    const pending = state.tasks.filter(
      (task) => !task.completed
    );

    const completed = state.tasks.filter(
      (task) => task.completed
    );

    elements.plannerCount.textContent =
      `${pending.length} open · ${completed.length} done`;

    const tasks = [...pending, ...completed];


    if (!tasks.length) {
      elements.planner.innerHTML = `
        <div class="empty-state">
          <span aria-hidden="true">T</span>
          <h3>Make a plan that feels doable.</h3>
          <p>Add a task to turn your study intentions into a next step.</p>
        </div>
      `;

      return;
    }


    elements.planner.innerHTML = tasks.map((task) => `
      <div
        class="planner-task${task.completed ? " is-done" : ""}"
        data-id="${escapeHTML(task.id)}">

        <input
          class="task-check"
          type="checkbox"
          data-task-action="toggle"
          data-id="${escapeHTML(task.id)}"
          aria-label="Mark ${escapeHTML(task.title)} complete"
          ${task.completed ? "checked" : ""}>

        <span class="planner-task-copy">

          <strong>${escapeHTML(task.title)}</strong>

          <small>
            ${escapeHTML(task.subject || "Study task")}
            ${
              task.date
                ? ` · ${escapeHTML(formatDate(task.date, {
                    month: "short",
                    day: "numeric"
                  }))}`
                : ""
            }
          </small>

        </span>

        <span class="planner-task-actions">

          <button
            class="icon-action"
            type="button"
            data-task-action="edit"
            data-id="${escapeHTML(task.id)}">
            Edit
          </button>

          <button
            class="icon-action danger"
            type="button"
            data-task-action="delete"
            data-id="${escapeHTML(task.id)}">
            ×
          </button>

        </span>

      </div>
    `).join("");
  }


  // =========================================
  // GRADEBOOK
  // =========================================

  function renderGrades() {
    const average = getAverage();

    const subjects = new Set(
      state.grades
        .map((grade) => (grade.subject || "").trim().toLowerCase())
        .filter(Boolean)
    );

    $("#grades-average").textContent =
      average === null ? "No data" : `${average.toFixed(1)}%`;

    $("#grades-count").textContent =
      String(state.grades.length);

    $("#grades-subject-count").textContent =
      String(subjects.size);


    if (!state.grades.length) {
      elements.grades.innerHTML = `
        <div class="empty-state">
          <span aria-hidden="true">G</span>
          <h3>Your gradebook starts here.</h3>
          <p>Add an assessment and its score to calculate your recorded average.</p>
        </div>
      `;

      return;
    }


    const ordered = state.grades
      .slice()
      .sort((a, b) =>
        (b.date || "").localeCompare(a.date || "")
      );


    elements.grades.innerHTML = ordered.map((grade) => {
      const percent = percentForGrade(grade);

      return `
        <div class="grade-row" data-id="${escapeHTML(grade.id)}">

          <strong>${escapeHTML(grade.title)}</strong>

          <small>${escapeHTML(grade.subject)}</small>

          <small>
            ${escapeHTML(formatDate(grade.date, {
              month: "short",
              day: "numeric",
              year: "numeric"
            }))}
          </small>

          <span class="grade-score">
            ${percent === null ? "No data" : `${percent.toFixed(1)}%`}
          </span>

          <div class="row-actions">

            <button
              class="icon-action"
              type="button"
              data-grade-action="edit"
              data-id="${escapeHTML(grade.id)}">
              Edit
            </button>

            <button
              class="icon-action danger"
              type="button"
              data-grade-action="delete"
              data-id="${escapeHTML(grade.id)}">
              ×
            </button>

          </div>
        </div>
      `;
    }).join("");
  }


  // =========================================
  // STUDY MATERIALS
  // =========================================

  function normalizeResourceUrl(value) {
    if (!value) {
      return "";
    }

    try {
      const url = new URL(value);

      if (
        url.protocol !== "http:" &&
        url.protocol !== "https:"
      ) {
        return "";
      }

      return url.href;

    } catch {
      return "";
    }
  }


  function renderMaterials() {
    const query = (
      elements.materialsSearch.value || ""
    ).trim().toLowerCase();

    const materials = state.materials
      .filter((item) =>
        !query ||
        `${item.title} ${item.subject || ""} ${item.notes || ""} ${item.type || ""}`
          .toLowerCase()
          .includes(query)
      )
      .sort((a, b) =>
        (b.createdAt || "").localeCompare(a.createdAt || "")
      );


    elements.materialsCount.textContent =
      `${state.materials.length} resource${state.materials.length === 1 ? "" : "s"}`;


    if (!materials.length) {
      elements.materials.innerHTML = `
        <div class="panel empty-state">
          <span aria-hidden="true">R</span>
          <h3>No resources in this view.</h3>
          <p>Save a link, set of notes, or study guide.</p>
        </div>
      `;

      return;
    }


    elements.materials.innerHTML = materials.map((item) => {
      const url = normalizeResourceUrl(item.url);

      const action = url
        ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">Open resource</a>`
        : `<span class="muted-copy">Saved in VAYRO</span>`;

      return `
        <article class="resource-card" data-id="${escapeHTML(item.id)}">

          <div class="resource-card-top">

            <span class="resource-type">
              ${escapeHTML(item.type || "Resource")}
            </span>

            <span class="subtle-count">
              ${escapeHTML(item.subject || "General")}
            </span>

          </div>

          <h3>${escapeHTML(item.title)}</h3>

          <p>${escapeHTML(item.notes || "No description added.")}</p>

          <div class="resource-card-footer">

            <small>
              ${escapeHTML(item.createdAt
                ? formatDate(item.createdAt.slice(0, 10), {
                    month: "short",
                    day: "numeric"
                  })
                : "Saved")}
            </small>

            ${action}

            <span class="row-actions">

              <button
                class="icon-action"
                type="button"
                data-material-action="edit"
                data-id="${escapeHTML(item.id)}">
                Edit
              </button>

              <button
                class="icon-action danger"
                type="button"
                data-material-action="delete"
                data-id="${escapeHTML(item.id)}">
                ×
              </button>

            </span>

          </div>
        </article>
      `;
    }).join("");
  }


  // =========================================
  // ANALYTICS
  // =========================================

  function renderAnalytics() {
    const total = state.assignments.length;

    const complete = state.assignments.filter(
      (item) => item.completed
    ).length;

    const completion = total
      ? Math.round((complete / total) * 100)
      : 0;

    const average = getAverage();

    const focusMinutes = state.sessions
      .filter((session) => session.completed)
      .reduce(
        (sum, session) => sum + (Number(session.minutes) || 0),
        0
      );


    $("#analytics-completion").textContent =
      `${completion}%`;

    $("#analytics-completion-bar").style.width =
      `${completion}%`;

    $("#analytics-assignment-detail").textContent =
      `${complete} of ${total} assignments`;

    $("#analytics-focus").textContent =
      focusMinutes >= 60
        ? `${(focusMinutes / 60).toFixed(1)} hr`
        : `${focusMinutes} min`;

    $("#analytics-average").textContent =
      average === null
        ? "No data"
        : `${average.toFixed(1)}%`;


    const grouped = new Map();

    state.grades.forEach((grade) => {
      const subject = (grade.subject || "Other").trim() || "Other";

      const value = percentForGrade(grade);

      if (value === null) {
        return;
      }

      if (!grouped.has(subject)) {
        grouped.set(subject, []);
      }

      grouped.get(subject).push(value);
    });


    if (!grouped.size) {
      $("#subject-bars").innerHTML =
        '<p class="muted-copy">Add grades to see a subject breakdown.</p>';

      return;
    }


    $("#subject-bars").innerHTML =
      Array.from(grouped.entries()).map(([subject, values]) => {
        const averageForSubject =
          values.reduce((sum, value) => sum + value, 0) /
          values.length;

        return `
          <div class="subject-bar-row">

            <span>${escapeHTML(subject)}</span>

            <div class="subject-bar-track">
              <i style="width:${Math.max(
                0,
                Math.min(100, averageForSubject)
              )}%"></i>
            </div>

            <strong>${Math.round(averageForSubject)}%</strong>

          </div>
        `;
      }).join("");
  }


  // =========================================
  // RENDER EVERYTHING
  // =========================================

  function renderAll() {
    renderProfile();
    renderHome();
    renderAssignments();
    renderCalendar();
    renderPlanner();
    renderGrades();
    renderMaterials();
    renderAnalytics();
    renderTimer();
  }


  // =========================================
  // FOCUS TIMER
  // =========================================

  function renderTimer() {
    const minutes = Math.floor(remainingSeconds / 60);

    const seconds = remainingSeconds % 60;

    elements.timer.textContent =
      `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    elements.timerButton.textContent =
      timerRunning
        ? "Pause session"
        : (
            remainingSeconds < selectedMinutes * 60 &&
            remainingSeconds > 0
              ? "Resume session"
              : "Start session"
          );

    elements.timerCaption.textContent =
      timerRunning
        ? "STAY WITH THIS MOMENT"
        : "MINUTES OF FOCUS";
  }


  function stopTimerInterval() {
    if (timerInterval !== null) {
      window.clearInterval(timerInterval);
      timerInterval = null;
    }
  }


  function pauseTimer() {
    if (!timerRunning) {
      return;
    }

    remainingSeconds = Math.max(
      0,
      Math.ceil((timerEndsAt - Date.now()) / 1000)
    );

    timerRunning = false;
    timerEndsAt = null;

    stopTimerInterval();

    renderTimer();

    elements.timerNote.textContent =
      "Paused. Take a breath, then pick it back up.";
  }


  function completeTimer() {
    timerRunning = false;
    timerEndsAt = null;
    remainingSeconds = 0;

    stopTimerInterval();

    state.sessions.push({
      id: makeId(),
      date: todayISO(),
      minutes: selectedMinutes,
      completed: true,
      completedAt: new Date().toISOString(),
    });

    saveState();

    renderTimer();
    renderHome();
    renderAnalytics();

    elements.timerButton.textContent = "Start again";

    elements.timerNote.textContent =
      "Session complete. Time was recorded.";

    showToast("Focus session complete. Your session was recorded.");
  }


  function timerTick() {
    remainingSeconds = Math.max(
      0,
      Math.ceil((timerEndsAt - Date.now()) / 1000)
    );

    renderTimer();

    if (remainingSeconds <= 0) {
      completeTimer();
    }
  }


  function startOrPauseTimer() {
    if (timerRunning) {
      pauseTimer();
      return;
    }

    if (remainingSeconds <= 0) {
      remainingSeconds = selectedMinutes * 60;
    }

    timerRunning = true;

    timerEndsAt =
      Date.now() + remainingSeconds * 1000;

    elements.timerNote.textContent =
      "Focus session running.";

    renderTimer();

    timerInterval = window.setInterval(
      timerTick,
      250
    );
  }


  function resetTimer() {
    timerRunning = false;
    timerEndsAt = null;

    stopTimerInterval();

    remainingSeconds = selectedMinutes * 60;

    elements.timerNote.textContent =
      "Ready for the next session.";

    renderTimer();
  }


  // =========================================
  // EDIT EXISTING RECORDS
  // =========================================

  function openAssignmentForEdit(id) {
    const item = state.assignments.find(
      (entry) => entry.id === id
    );

    if (!item) {
      return;
    }

    resetDialogForm("assignment-dialog");

    $("#assignment-id").value = item.id;
    $("#assignment-title").value = item.title;
    $("#assignment-subject").value = item.subject;
    $("#assignment-due").value = item.dueDate;
    $("#assignment-priority").value = item.priority || "normal";
    $("#assignment-notes").value = item.notes || "";

    $("#assignment-dialog-title").textContent =
      "Edit assignment";

    openDialog("assignment-dialog");
  }


  function openEventForEdit(id) {
    const item = state.events.find(
      (entry) => entry.id === id
    );

    if (!item) {
      return;
    }

    resetDialogForm("event-dialog");

    $("#event-id").value = item.id;
    $("#event-title").value = item.title;
    $("#event-date").value = item.date;
    $("#event-time").value = item.time || "";
    $("#event-type").value = item.type || "Other";
    $("#event-duration").value = String(item.duration || 60);
    $("#event-notes").value = item.notes || "";

    $("#event-dialog-title").textContent =
      "Edit calendar event";

    openDialog("event-dialog");
  }


  function openTaskForEdit(id) {
    const item = state.tasks.find(
      (entry) => entry.id === id
    );

    if (!item) {
      return;
    }

    resetDialogForm("task-dialog");

    $("#task-id").value = item.id;
    $("#task-title").value = item.title;
    $("#task-subject").value = item.subject || "";
    $("#task-date").value = item.date || "";

    $("#task-dialog-title").textContent =
      "Edit study task";

    openDialog("task-dialog");
  }


  function openGradeForEdit(id) {
    const item = state.grades.find(
      (entry) => entry.id === id
    );

    if (!item) {
      return;
    }

    resetDialogForm("grade-dialog");

    $("#grade-id").value = item.id;
    $("#grade-title").value = item.title;
    $("#grade-subject").value = item.subject;
    $("#grade-date").value = item.date;
    $("#grade-score").value = item.score;
    $("#grade-max").value = item.maxScore;

    $("#grade-dialog-title").textContent =
      "Edit grade";

    openDialog("grade-dialog");
  }


  function openMaterialForEdit(id) {
    const item = state.materials.find(
      (entry) => entry.id === id
    );

    if (!item) {
      return;
    }

    resetDialogForm("material-dialog");

    $("#material-id").value = item.id;
    $("#material-title").value = item.title;
    $("#material-subject").value = item.subject || "";
    $("#material-type").value = item.type || "Other";
    $("#material-url").value = item.url || "";
    $("#material-notes").value = item.notes || "";

    $("#material-dialog-title").textContent =
      "Edit resource";

    openDialog("material-dialog");
  }


  // =========================================
  // NAVIGATION AND DIALOG EVENTS
  // =========================================

  function bindNavigation() {
    document.addEventListener("click", (event) => {

      const viewLink = event.target.closest("[data-view]");

      if (viewLink) {
        event.preventDefault();

        switchView(viewLink.dataset.view);

        return;
      }


      const goView = event.target.closest("[data-go-view]");

      if (goView) {
        switchView(goView.dataset.goView);
        return;
      }


      const openButton = event.target.closest("[data-open-dialog]");

      if (openButton) {
        const dialogId = openButton.dataset.openDialog;

        if (
          dialogId === "event-dialog" &&
          openButton.dataset.eventType
        ) {
          $("#event-type").value =
            openButton.dataset.eventType;
        }

        openDialog(dialogId);

        return;
      }


      const closeButton = event.target.closest("[data-close-dialog]");

      if (closeButton) {
        closeDialog(closeButton);
      }

    });


    elements.avatar.addEventListener(
      "click",
      () => switchView("settings")
    );


    document.addEventListener("click", (event) => {
      const dialog = event.target.closest("dialog");

      if (dialog && event.target === dialog) {
        dialog.close();
      }
    });


    $$("dialog").forEach((dialog) => {
      dialog.addEventListener("close", () => {
        resetDialogForm(dialog.id);
      });
    });
  }


  // =========================================
  // ASSIGNMENT FORM
  // =========================================

  function bindAssignmentForm() {
    $("#assignment-form").addEventListener("submit", (event) => {
      event.preventDefault();

      const id = $("#assignment-id").value;

      const existing = state.assignments.find(
        (item) => item.id === id
      );

      const item = {
        id: id || makeId(),

        title: $("#assignment-title").value.trim(),

        subject: $("#assignment-subject").value.trim(),

        dueDate: $("#assignment-due").value,

        priority: $("#assignment-priority").value,

        notes: $("#assignment-notes").value.trim(),

        completed: existing ? existing.completed : false,

        createdAt: existing
          ? existing.createdAt
          : new Date().toISOString(),
      };


      if (!item.title || !item.subject || !item.dueDate) {
        return showToast(
          "Add an assignment name, subject, and due date.",
          true
        );
      }


      if (existing) {
        state.assignments = state.assignments.map(
          (entry) => entry.id === id ? item : entry
        );
      } else {
        state.assignments.push(item);
      }


      saveState();

      $("#assignment-dialog").close();

      renderAll();

      showToast(
        existing
          ? "Assignment updated."
          : "Assignment added."
      );
    });


    elements.assignments.addEventListener("click", (event) => {
      const button = event.target.closest("[data-assignment-action]");

      if (!button) {
        return;
      }

      const {
        assignmentAction: action,
        id
      } = button.dataset;

      const item = state.assignments.find(
        (entry) => entry.id === id
      );

      if (!item) {
        return;
      }


      if (action === "edit") {
        openAssignmentForEdit(id);
      }


      if (action === "toggle") {
        item.completed = !item.completed;

        item.completedAt = item.completed
          ? new Date().toISOString()
          : null;

        saveState();

        renderAll();

        showToast(
          item.completed
            ? "Assignment marked complete."
            : "Assignment reopened."
        );
      }


      if (
        action === "delete" &&
        window.confirm(`Delete "${item.title}"?`)
      ) {
        state.assignments = state.assignments.filter(
          (entry) => entry.id !== id
        );

        saveState();

        renderAll();

        showToast("Assignment deleted.");
      }
    });


    $$("[data-assignment-filter]").forEach((button) => {
      button.addEventListener("click", () => {

        assignmentFilter = button.dataset.assignmentFilter;

        $$("[data-assignment-filter]").forEach((item) => {
          const active = item === button;

          item.classList.toggle("is-active", active);

          item.setAttribute(
            "aria-pressed",
            String(active)
          );
        });

        renderAssignments();
      });
    });


    elements.assignmentSearch.addEventListener(
      "input",
      renderAssignments
    );
  }


  // =========================================
  // CALENDAR EVENT FORM
  // =========================================

  function bindEventForm() {
    $("#event-form").addEventListener("submit", (event) => {
      event.preventDefault();

      const id = $("#event-id").value;

      const existing = state.events.find(
        (item) => item.id === id
      );

      const item = {
        id: id || makeId(),

        title: $("#event-title").value.trim(),

        date: $("#event-date").value,

        time: $("#event-time").value,

        type: $("#event-type").value,

        duration: Number($("#event-duration").value) || 60,

        notes: $("#event-notes").value.trim(),

        createdAt: existing
          ? existing.createdAt
          : new Date().toISOString(),
      };


      if (!item.title || !item.date) {
        return showToast(
          "Add an event title and date.",
          true
        );
      }


      if (existing) {
        state.events = state.events.map(
          (entry) => entry.id === id ? item : entry
        );
      } else {
        state.events.push(item);
      }


      selectedDateISO = item.date;

      calendarCursor = fromISODate(item.date);

      saveState();

      $("#event-dialog").close();

      renderAll();

      showToast(
        existing
          ? "Event updated."
          : "Event added."
      );
    });


    elements.calendarDays.addEventListener("click", (event) => {
      const dayButton = event.target.closest("[data-calendar-date]");

      if (!dayButton) {
        return;
      }

      selectedDateISO = dayButton.dataset.calendarDate;

      const selected = fromISODate(selectedDateISO);

      calendarCursor = new Date(
        selected.getFullYear(),
        selected.getMonth(),
        1
      );

      renderCalendar();
    });


    elements.selectedEvents.addEventListener("click", (event) => {
      const button = event.target.closest("[data-event-action]");

      if (!button) {
        return;
      }

      const {
        eventAction: action,
        id
      } = button.dataset;

      const item = state.events.find(
        (entry) => entry.id === id
      );

      if (!item) {
        return;
      }


      if (action === "edit") {
        openEventForEdit(id);
      }


      if (
        action === "delete" &&
        window.confirm(`Delete "${item.title}" from your calendar?`)
      ) {
        state.events = state.events.filter(
          (entry) => entry.id !== id
        );

        saveState();

        renderAll();

        showToast("Calendar event deleted.");
      }
    });


    $("#calendar-prev").addEventListener("click", () => {
      calendarCursor = new Date(
        calendarCursor.getFullYear(),
        calendarCursor.getMonth() - 1,
        1
      );

      selectedDateISO = toISODate(calendarCursor);

      renderCalendar();
    });


    $("#calendar-next").addEventListener("click", () => {
      calendarCursor = new Date(
        calendarCursor.getFullYear(),
        calendarCursor.getMonth() + 1,
        1
      );

      selectedDateISO = toISODate(calendarCursor);

      renderCalendar();
    });


    $("#calendar-today").addEventListener("click", () => {
      calendarCursor = new Date();

      selectedDateISO = todayISO();

      renderCalendar();
    });
  }


  // =========================================
  // STUDY TASK FORM
  // =========================================

  function bindTaskForm() {
    $("#task-form").addEventListener("submit", (event) => {
      event.preventDefault();

      const id = $("#task-id").value;

      const existing = state.tasks.find(
        (item) => item.id === id
      );

      const item = {
        id: id || makeId(),

        title: $("#task-title").value.trim(),

        subject: $("#task-subject").value.trim(),

        date: $("#task-date").value,

        completed: existing ? existing.completed : false,

        createdAt: existing
          ? existing.createdAt
          : new Date().toISOString(),
      };


      if (!item.title) {
        return showToast(
          "Give your study task a name.",
          true
        );
      }


      if (existing) {
        state.tasks = state.tasks.map(
          (entry) => entry.id === id ? item : entry
        );
      } else {
        state.tasks.push(item);
      }


      saveState();

      $("#task-dialog").close();

      renderAll();

      showToast(
        existing
          ? "Study task updated."
          : "Study task added."
      );
    });


    elements.planner.addEventListener("click", (event) => {
      const button = event.target.closest("[data-task-action]");

      if (!button || button.type === "checkbox") {
        return;
      }

      const {
        taskAction: action,
        id
      } = button.dataset;

      const item = state.tasks.find(
        (entry) => entry.id === id
      );

      if (!item) {
        return;
      }


      if (action === "edit") {
        openTaskForEdit(id);
      }


      if (
        action === "delete" &&
        window.confirm(`Delete "${item.title}"?`)
      ) {
        state.tasks = state.tasks.filter(
          (entry) => entry.id !== id
        );

        saveState();

        renderAll();
      }
    });


    elements.planner.addEventListener("change", (event) => {
      const checkbox = event.target.closest(
        'input[data-task-action="toggle"]'
      );

      if (!checkbox) {
        return;
      }

      const item = state.tasks.find(
        (entry) => entry.id === checkbox.dataset.id
      );

      if (!item) {
        return;
      }

      item.completed = checkbox.checked;

      saveState();

      renderAll();
    });
  }


  // =========================================
  // GRADE FORM
  // =========================================

  function bindGradeForm() {
    $("#grade-form").addEventListener("submit", (event) => {
      event.preventDefault();

      const id = $("#grade-id").value;

      const score = Number($("#grade-score").value);

      const maxScore = Number($("#grade-max").value);


      if (
        !Number.isFinite(score) ||
        !Number.isFinite(maxScore) ||
        maxScore <= 0 ||
        score < 0 ||
        score > maxScore
      ) {
        return showToast(
          "Check the score and points possible. The score cannot exceed the maximum.",
          true
        );
      }


      const existing = state.grades.find(
        (item) => item.id === id
      );

      const item = {
        id: id || makeId(),

        title: $("#grade-title").value.trim(),

        subject: $("#grade-subject").value.trim(),

        date: $("#grade-date").value,

        score,

        maxScore,

        createdAt: existing
          ? existing.createdAt
          : new Date().toISOString(),
      };


      if (!item.title || !item.subject || !item.date) {
        return showToast(
          "Complete the assessment name, subject, and date.",
          true
        );
      }


      if (existing) {
        state.grades = state.grades.map(
          (entry) => entry.id === id ? item : entry
        );
      } else {
        state.grades.push(item);
      }


      saveState();

      $("#grade-dialog").close();

      renderAll();

      showToast(
        existing
          ? "Grade updated."
          : "Grade recorded."
      );
    });


    elements.grades.addEventListener("click", (event) => {
      const button = event.target.closest("[data-grade-action]");

      if (!button) {
        return;
      }

      const {
        gradeAction: action,
        id
      } = button.dataset;

      const item = state.grades.find(
        (entry) => entry.id === id
      );

      if (!item) {
        return;
      }


      if (action === "edit") {
        openGradeForEdit(id);
      }


      if (
        action === "delete" &&
        window.confirm(`Delete the grade for "${item.title}"?`)
      ) {
        state.grades = state.grades.filter(
          (entry) => entry.id !== id
        );

        saveState();

        renderAll();

        showToast("Grade deleted.");
      }
    });
  }


  // =========================================
  // STUDY MATERIAL FORM
  // =========================================

  function bindMaterialForm() {
    $("#material-form").addEventListener("submit", (event) => {
      event.preventDefault();

      const id = $("#material-id").value;

      const rawUrl = $("#material-url").value.trim();

      const url = normalizeResourceUrl(rawUrl);

      if (rawUrl && !url) {
        return showToast(
          "Use a complete http:// or https:// link.",
          true
        );
      }


      const existing = state.materials.find(
        (item) => item.id === id
      );

      const item = {
        id: id || makeId(),

        title: $("#material-title").value.trim(),

        subject: $("#material-subject").value.trim(),

        type: $("#material-type").value,

        url,

        notes: $("#material-notes").value.trim(),

        createdAt: existing
          ? existing.createdAt
          : new Date().toISOString(),
      };


      if (!item.title) {
        return showToast(
          "Give this resource a title.",
          true
        );
      }


      if (existing) {
        state.materials = state.materials.map(
          (entry) => entry.id === id ? item : entry
        );
      } else {
        state.materials.push(item);
      }


      saveState();

      $("#material-dialog").close();

      renderAll();

      showToast(
        existing
          ? "Resource updated."
          : "Resource saved."
      );
    });


    elements.materials.addEventListener("click", (event) => {
      const button = event.target.closest("[data-material-action]");

      if (!button) {
        return;
      }

      const {
        materialAction: action,
        id
      } = button.dataset;

      const item = state.materials.find(
        (entry) => entry.id === id
      );

      if (!item) {
        return;
      }


      if (action === "edit") {
        openMaterialForEdit(id);
      }


      if (
        action === "delete" &&
        window.confirm(`Delete "${item.title}" from your library?`)
      ) {
        state.materials = state.materials.filter(
          (entry) => entry.id !== id
        );

        saveState();

        renderAll();

        showToast("Resource deleted.");
      }
    });


    elements.materialsSearch.addEventListener(
      "input",
      renderMaterials
    );
  }


  // =========================================
  // FOCUS TIMER CONTROLS
  // =========================================

  function bindFocusTimer() {
    elements.timerButton.addEventListener(
      "click",
      startOrPauseTimer
    );

    elements.timerReset.addEventListener(
      "click",
      resetTimer
    );


    $$("[data-minutes]").forEach((button) => {
      button.addEventListener("click", () => {

        if (timerRunning) {
          pauseTimer();
        }

        selectedMinutes =
          Number(button.dataset.minutes) || 25;

        remainingSeconds = selectedMinutes * 60;


        $$("[data-minutes]").forEach((preset) => {
          const selected = preset === button;

          preset.classList.toggle(
            "is-selected",
            selected
          );

          preset.setAttribute(
            "aria-pressed",
            String(selected)
          );
        });


        elements.timerNote.textContent =
          `${selectedMinutes} minutes set aside for focused work.`;

        renderTimer();
      });
    });
  }


  // =========================================
  // PROFILE AND BACKUPS
  // =========================================

  function bindProfileAndBackups() {
    $("#profile-form").addEventListener("submit", (event) => {
      event.preventDefault();

      const name = $("#profile-name-input").value.trim();

      if (!name) {
        return showToast(
          "Enter a display name.",
          true
        );
      }

      state.profileName = name;

      saveState();

      renderProfile();

      showToast("Profile saved.");
    });


    $("#backup-export").addEventListener(
      "click",
      exportBackup
    );


    $("#backup-import-button").addEventListener(
      "click",
      () => $("#backup-file-input").click()
    );


    $("#backup-file-input").addEventListener(
      "change",
      importBackup
    );


    $("#clear-data-button").addEventListener("click", () => {
      const accepted = window.confirm(
        "Clear all VAYRO data saved in this browser? This cannot be undone unless you have an exported backup."
      );

      if (!accepted) {
        return;
      }

      const name = state.profileName;

      state = {
        ...emptyState(),
        profileName: name
      };

      saveState();

      resetTimer();

      renderAll();

      showToast("Your local workspace has been cleared.");
    });
  }


  // =========================================
  // BACKUP EXPORT AND IMPORT
  // =========================================

  function downloadBlob(filename, content, mimeType) {
    const blob = new Blob(
      [content],
      { type: mimeType }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.append(link);

    link.click();

    link.remove();

    window.setTimeout(
      () => URL.revokeObjectURL(url),
      1000
    );
  }


  function exportBackup() {
    const backup = {
      ...state,
      exportedAt: new Date().toISOString(),
      app: "VAYRO",
    };

    downloadBlob(
      `vayro-backup-${todayISO()}.json`,
      JSON.stringify(backup, null, 2),
      "application/json"
    );

    showToast("Backup downloaded.");
  }


  async function importBackup(event) {
    const file = event.target.files && event.target.files[0];

    if (!file) {
      return;
    }

    try {
      const parsed = JSON.parse(
        await file.text()
      );

      const fields = [
        "assignments",
        "events",
        "tasks",
        "grades",
        "materials",
        "sessions",
      ];


      if (
        !parsed ||
        typeof parsed !== "object" ||
        !fields.every((field) => Array.isArray(parsed[field]))
      ) {
        throw new Error(
          "This file is not a VAYRO workspace backup."
        );
      }


      if (!window.confirm(
        "Restore this backup? It will replace the data currently saved in this browser."
      )) {
        return;
      }


      state = {
        ...emptyState(),
        ...parsed,
        version: 1,

        profileName:
          typeof parsed.profileName === "string"
            ? parsed.profileName.slice(0, 40)
            : "Student",
      };

      saveState();

      renderAll();

      showToast("Backup restored.");

    } catch (error) {
      showToast(
        error.message || "The backup file could not be read.",
        true
      );

    } finally {
      event.target.value = "";
    }
  }


  // =========================================
  // CALENDAR FILE EXPORT
  // =========================================

  function icsEscape(value) {
    return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }


  function exportCalendarICS() {
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//VAYRO//Academic Workspace//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];


    state.events
      .slice()
      .sort((a, b) =>
        `${a.date} ${a.time || ""}`.localeCompare(
          `${b.date} ${b.time || ""}`
        )
      )
      .forEach((event) => {

        const startTime = event.time || "09:00";

        const [hours, minutes] =
          startTime.split(":").map(Number);

        const start =
          `${String(event.date).replace(/-/g, "")}T` +
          `${String(hours || 0).padStart(2, "0")}` +
          `${String(minutes || 0).padStart(2, "0")}00`;

        const endDate = new Date(
          `${event.date}T${startTime}:00`
        );

        endDate.setMinutes(
          endDate.getMinutes() +
          (Number(event.duration) || 60)
        );

        const end =
          `${toISODate(endDate).replace(/-/g, "")}T` +
          `${String(endDate.getHours()).padStart(2, "0")}` +
          `${String(endDate.getMinutes()).padStart(2, "0")}00`;


        lines.push(
          "BEGIN:VEVENT",

          `UID:${icsEscape(event.id)}@vayro.local`,

          `DTSTAMP:${new Date().toISOString()
            .replace(/[-:]/g, "")
            .replace(/\.\d{3}/, "")}`,

          `DTSTART:${start}`,

          `DTEND:${end}`,

          `SUMMARY:${icsEscape(event.title)}`,

          `DESCRIPTION:${icsEscape(
            `${event.type || "Event"}${event.notes ? `, ${event.notes}` : ""}`
          )}`,

          "END:VEVENT"
        );
      });


    lines.push("END:VCALENDAR");


    downloadBlob(
      `vayro-calendar-${todayISO()}.ics`,
      `${lines.join("\r\n")}\r\n`,
      "text/calendar;charset=utf-8"
    );


    showToast(
      state.events.length
        ? "Calendar file exported."
        : "An empty calendar file was exported. Add events first to include them."
    );
  }


  // =========================================
  // CALENDAR FILE IMPORT
  // =========================================

  function unfoldICS(text) {
    return text
      .replace(/\r?\n[ \t]/g, "")
      .split(/\r?\n/);
  }


  function unescapeICS(value) {
    return String(value || "")
      .replace(/\\n/gi, "\n")
      .replace(/\\,/g, ",")
      .replace(/\\;/g, ";")
      .replace(/\\\\/g, "\\");
  }


  function parseICSDate(line) {
    if (!line) {
      return null;
    }

    const value = line.split(":").slice(1).join(":").trim();

    if (/^\d{8}$/.test(value)) {
      return {
        date:
          `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`,
        time: "",
      };
    }


    const match = value.match(
      /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/
    );

    if (!match) {
      return null;
    }


    if (match[7]) {
      const date = new Date(
        Date.UTC(
          Number(match[1]),
          Number(match[2]) - 1,
          Number(match[3]),
          Number(match[4]),
          Number(match[5]),
          Number(match[6] || 0)
        )
      );

      return {
        date: toISODate(date),

        time:
          `${String(date.getHours()).padStart(2, "0")}:` +
          `${String(date.getMinutes()).padStart(2, "0")}`,
      };
    }


    return {
      date: `${match[1]}-${match[2]}-${match[3]}`,
      time: `${match[4]}:${match[5]}`,
    };
  }


  function importCalendarICS(event) {
    const file = event.target.files && event.target.files[0];

    if (!file) {
      return;
    }


    file.text()
      .then((text) => {

        const lines = unfoldICS(text);

        const imported = [];

        let current = null;


        lines.forEach((line) => {

          if (line === "BEGIN:VEVENT") {
            current = {};

          } else if (line === "END:VEVENT" && current) {

            if (current.title && current.start) {
              imported.push({
                id: makeId(),
                title: current.title,
                date: current.start.date,
                time: current.start.time,
                type: current.type || "Other",
                duration: 60,
                notes: current.description || "",
                createdAt: new Date().toISOString(),
              });
            }

            current = null;

          } else if (current) {

            const separator = line.indexOf(":");

            if (separator < 0) {
              return;
            }

            const key = line
              .slice(0, separator)
              .split(";")[0]
              .toUpperCase();

            const value = line.slice(separator + 1);


            if (key === "SUMMARY") {
              current.title = unescapeICS(value);
            }

            if (key === "DESCRIPTION") {
              current.description = unescapeICS(value);
            }

            if (key === "DTSTART") {
              current.start = parseICSDate(line);
            }

            if (key === "CATEGORIES") {
              current.type = unescapeICS(value).split(",")[0];
            }
          }
        });


        if (!imported.length) {
          showToast(
            "No supported calendar events were found in that file.",
            true
          );

          return;
        }


        state.events.push(...imported);

        saveState();

        renderAll();

        showToast(
          `${imported.length} calendar event${imported.length === 1 ? "" : "s"} imported.`
        );

      })
      .catch(() => {
        showToast(
          "That calendar file could not be read.",
          true
        );
      })
      .finally(() => {
        event.target.value = "";
      });
  }


  function bindCalendarFileTools() {

    $$("[data-export-ics]").forEach((button) => {
      button.addEventListener(
        "click",
        exportCalendarICS
      );
    });


    $$("[data-import-ics]").forEach((button) => {
      button.addEventListener(
        "click",
        () => $("#ics-file-input").click()
      );
    });


    $("#ics-file-input").addEventListener(
      "change",
      importCalendarICS
    );
  }


  // =========================================
  // GLOBAL ACTIONS
  // =========================================

  function bindGlobalActions() {

    $("#profile-shortcut").addEventListener(
      "click",
      () => switchView("settings")
    );


    document.addEventListener("keydown", (event) => {

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();

        switchView("assignments");

        elements.assignmentSearch.focus();
      }


      if (event.key === "Escape") {
        $$("dialog[open]").forEach((dialog) => {
          dialog.close();
        });
      }
    });
  }


  // =========================================
  // APPLICATION INITIALIZATION
  // =========================================

  function init() {

    renderDateAndClock();

    window.setInterval(
      renderDateAndClock,
      1000
    );

    bindNavigation();

    bindAssignmentForm();

    bindEventForm();

    bindTaskForm();

    bindGradeForm();

    bindMaterialForm();

    bindFocusTimer();

    bindProfileAndBackups();

    bindCalendarFileTools();

    bindGlobalActions();

    renderAll();
  }


  // Start VAYRO

  init();

})();
