(() => {
  "use strict";

  if (document.querySelector(".moon-guide-fab")) return;

  const answers = [
    { match: /moss|buddy|companion|grow|growth|pet/i, text: "Moss gets a new look after 3, 8, and 15 completed focus sessions. There’s no deadline, and breaks never take anything away." },
    { match: /save|data|private|stored|backup|export|import/i, text: "Your work stays in this browser on this device. Open Settings → Backup to download a copy or restore one later." },
    { match: /timer|focus|session|pause/i, text: "Choose 25, 45, or 60 minutes, then press Start. You can pause or change the length whenever you need. A completed session is saved to your focus history." },
    { match: /assignment|deadline|due date|homework/i, text: "Open Assignments to add a class, due date, and note. Your next deadlines also appear in Upcoming today and the calendar." },
    { match: /calendar|class|event|schedule/i, text: "Open Calendar to add classes, tests, study time, or personal events. Select a day to see what is already planned." },
    { match: /planner|steps|break.*down|big task/i, text: "Study planner lets you split a larger piece of work into smaller steps and keep the next action visible." },
    { match: /grade|score|average/i, text: "Open Grades to save a score and its maximum points. Vayro calculates your average from the scores you enter." },
    { match: /library|material|resource|link/i, text: "Study library is a place to save links, notes, videos, and other resources for later." },
    { match: /signup|setup|change.*answer|skip/i, text: "Setup answers stay on this device. You can go back while setting up, skip the process, and change your workspace choices later." }
  ];

  const fab = document.createElement("button");
  fab.className = "moon-guide-fab";
  fab.type = "button";
  fab.setAttribute("aria-label", "Ask the Moon guide");
  fab.setAttribute("aria-controls", "moon-guide-panel");
  fab.setAttribute("aria-expanded", "false");
  fab.innerHTML = '<span class="moon-guide-fab-sprite" aria-hidden="true"></span><span class="moon-guide-fab-label">Ask the Moon</span>';

  const panel = document.createElement("section");
  panel.className = "moon-guide-panel";
  panel.id = "moon-guide-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("aria-labelledby", "moon-guide-title");
  panel.hidden = true;
  panel.innerHTML = `
    <header class="moon-guide-head">
      <span class="moon-guide-avatar" aria-hidden="true"></span>
      <div><p class="moon-guide-kicker">A little help, whenever</p><h2 id="moon-guide-title">Ask the Moon</h2></div>
      <button class="moon-guide-close" type="button" aria-label="Close Moon guide">×</button>
    </header>
    <div class="moon-guide-log" role="log" aria-live="polite" aria-relevant="additions">
      <p class="moon-guide-bubble moon-guide-answer">Hi, I can help you find your way around Vayro. What would make tonight easier?</p>
    </div>
    <div class="moon-guide-suggestions" aria-label="Suggested questions">
      <button type="button" data-guide-question="How does Moss grow?">How does Moss grow?</button>
      <button type="button" data-guide-question="Where is my work saved?">Where is my work saved?</button>
      <button type="button" data-guide-question="How does the focus timer work?">How does the timer work?</button>
    </div>
    <form class="moon-guide-form">
      <label class="sr-only" for="moon-guide-input">Ask the Moon guide a question</label>
      <input id="moon-guide-input" name="question" maxlength="180" autocomplete="off" placeholder="Ask a Vayro question…" required>
      <button class="button primary" type="submit">Ask</button>
    </form>`;

  document.body.append(fab, panel);
  const closeButton = panel.querySelector(".moon-guide-close");
  const log = panel.querySelector(".moon-guide-log");
  const form = panel.querySelector(".moon-guide-form");
  const input = panel.querySelector("#moon-guide-input");

  function setOpen(open) {
    panel.hidden = !open;
    fab.setAttribute("aria-expanded", String(open));
    if (open) input.focus();
    else fab.focus();
  }

  function addBubble(text, kind) {
    const bubble = document.createElement("p");
    bubble.className = "moon-guide-bubble moon-guide-" + kind;
    bubble.textContent = text;
    log.append(bubble);
    log.scrollTop = log.scrollHeight;
  }

  function getAnswer(question) {
    const found = answers.find((item) => item.match.test(question));
    return found ? found.text : "I can help with assignments, your calendar, the study planner, grades, backups, the focus timer, and Moss’s growth. Try one of the questions below, or open the matching page from the menu.";
  }

  function ask(question) {
    const cleanQuestion = String(question || "").trim();
    if (!cleanQuestion) return;
    addBubble(cleanQuestion, "question");
    addBubble(getAnswer(cleanQuestion), "answer");
  }

  fab.addEventListener("click", () => setOpen(panel.hidden));
  closeButton.addEventListener("click", () => setOpen(false));
  panel.querySelectorAll("[data-guide-question]").forEach((button) => {
    button.addEventListener("click", () => ask(button.dataset.guideQuestion));
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    ask(input.value);
    input.value = "";
    input.focus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) setOpen(false);
  });
  if (new URLSearchParams(location.search).get("tour") === "1") {
    setOpen(true);
    addBubble("Welcome to your desk! Upcoming today shows deadlines and events. Assignments stores due dates, Study planner holds smaller steps, and Calendar shows your schedule. The focus timer saves completed sessions, and Moss grows along with them. Your work stays on this device. Ask me about any page whenever you need.", "answer");
    history.replaceState(null, "", location.pathname);
  }
})();
