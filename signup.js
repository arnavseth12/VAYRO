(() => {
  "use strict";

  const steps = Array.from(document.querySelectorAll(".setup-step"));
  const selections = { workload: [] };
  const stepCaptions = ["A little context", "Your real life", "Make it easier", "A comfortable pace", "Your workspace", "A new friend"];
  const stepCount = document.querySelector("#step-count");
  const caption = document.querySelector("#step-caption");
  const progress = document.querySelector(".onboarding-progress");
  const progressFill = document.querySelector("#progress-fill");
  const backButton = document.querySelector("#back-button");
  const nextButton = document.querySelector("#next-button");
  const nameInput = document.querySelector("#display-name");
  const companionNameInput = document.querySelector("#companion-name");
  const hatchButton = document.querySelector("#pet-hatch-button");
  const hatchScene = document.querySelector(".hatch-scene");
  const hatchMessage = document.querySelector("#hatch-message");
  const hatchPetHost = document.querySelector("#hatch-pet-host");
  const buddyNameField = document.querySelector("#buddy-name-field");
  const finish = document.querySelector("#setup-finish");
  const actions = document.querySelector("#setup-actions");
  let petHatched = false;
  let petHatching = false;
  let currentStep = 0;

  const previewStart = new Date();
  previewStart.setHours(0, 0, 0, 0);
  previewStart.setDate(previewStart.getDate() - ((previewStart.getDay() + 6) % 7));
  document.querySelectorAll(".preview-day").forEach((day, index) => {
    const date = new Date(previewStart);
    date.setDate(previewStart.getDate() + index);
    day.querySelector("[data-preview-weekday]").textContent = date.toLocaleDateString(undefined, { weekday: "short" });
    day.querySelector("[data-preview-day]").textContent = date.getDate();
    day.classList.toggle("is-today", date.toDateString() === new Date().toDateString());
  });

  function hasAnswer(stepIndex = currentStep) {
    if (stepIndex === 1) return selections.workload.length > 0;
    if (stepIndex === 4) return true;
    if (stepIndex === 5) return petHatched;
    return Boolean(steps[stepIndex].querySelector('.choice[aria-pressed="true"]'));
  }

  function updateProgress() {
    stepCount.textContent = `Step ${currentStep + 1} of ${steps.length}`;
    caption.textContent = stepCaptions[currentStep];
    progress.setAttribute("aria-valuenow", String(currentStep + 1));
    progressFill.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
    backButton.disabled = currentStep === 0;
    nextButton.disabled = !hasAnswer();
    nextButton.innerHTML = currentStep === steps.length - 1 ? 'Build my workspace <span aria-hidden="true">→</span>' : 'Next <span aria-hidden="true">→</span>';
  }

  function showStep(index) {
    currentStep = index;
    steps.forEach((step, stepIndex) => {
      const active = stepIndex === currentStep;
      step.hidden = !active;
      step.classList.toggle("active", active);
    });
    updateProgress();
    if (currentStep === 4) updateSummary();
    steps[currentStep].querySelector("legend").focus();
  }

  function updateSummary() {
    const workload = selections.workload.length ? selections.workload.join(", ").toLowerCase() : "your studies";
    const challenge = selections.challenge ? selections.challenge.toLowerCase() : "your week";
    const pace = selections.pace ? selections.pace.toLowerCase() : "own";
    document.querySelector("#setup-summary").textContent = `A ${pace} pace for ${workload}, with a little help ${challenge}. You can fine-tune everything inside.`;
  }

  function chosenPetName() {
    return (companionNameInput.value || "").trim().slice(0, 16) || "Moss";
  }

  function hatchBuddy() {
    if (petHatching) return;
    if (petHatched) {
      hatchMessage.textContent = chosenPetName() + " found a tiny leaf and brought it back for you.";
      hatchButton.classList.remove("is-cracking");
      hatchButton.classList.add("is-reacting");
      window.setTimeout(() => hatchButton.classList.remove("is-reacting"), 800);
      return;
    }
    petHatching = true;
    hatchButton.classList.add("is-cracking");
    hatchButton.setAttribute("aria-label", "Your study buddy is hatching");
    hatchMessage.textContent = "A little crackle... here comes your new friend.";
    window.setTimeout(() => {
      petHatching = false;
      petHatched = true;
      hatchScene.classList.add("is-hatched");
      hatchButton.classList.remove("is-cracking");
      hatchButton.classList.add("is-hatched");
      hatchButton.setAttribute("aria-label", "Say hello to your new buddy, " + chosenPetName());
      document.querySelector("#hatch-tap-hint").textContent = "Say hi to " + chosenPetName();
      hatchPetHost.innerHTML = window.VayroPet.sprite(0, "hatchling-art");
      hatchMessage.textContent = "Hi! I'm " + chosenPetName() + ". I love tiny discoveries and tagging along. Breaks are always okay.";
      buddyNameField.hidden = false;
      updateProgress();
      companionNameInput.focus();
    }, 650);
  }

  function completeSetup() {
    let savedName = "";
    try { savedName = JSON.parse(localStorage.getItem("vayro-workspace-v2") || "{}").profileName || ""; } catch {}
    const profileName = nameInput.value.trim().slice(0, 32) || String(savedName).trim().slice(0, 32) || "Student";
    const preferences = {
      stage: selections.stage,
      workload: selections.workload.slice(),
      challenge: selections.challenge,
      pace: selections.pace,
      onboarded: true
    };
    try {
      const stored = JSON.parse(localStorage.getItem("vayro-workspace-v2") || "{}");
      const workspace = stored && typeof stored === "object" ? stored : {};
      const savedCompanion = workspace.companion && typeof workspace.companion === "object" ? workspace.companion : {};
      localStorage.setItem("vayro-workspace-v2", JSON.stringify({
        profileName,
        assignments: Array.isArray(workspace.assignments) ? workspace.assignments : [],
        events: Array.isArray(workspace.events) ? workspace.events : [],
        tasks: Array.isArray(workspace.tasks) ? workspace.tasks : [],
        grades: Array.isArray(workspace.grades) ? workspace.grades : [],
        materials: Array.isArray(workspace.materials) ? workspace.materials : [],
        sessions: Array.isArray(workspace.sessions) ? workspace.sessions : [],
        ...workspace,
        profileName,
        companion: { ...savedCompanion, name: chosenPetName(), hatchedAt: savedCompanion.hatchedAt || new Date().toISOString() },
        preferences
      }));
      localStorage.setItem("vayro-onboarding", JSON.stringify(preferences));
    } catch {
      document.querySelector("#setup-summary").textContent = "Your browser could not save this setup. You can still explore VAYRO; some browsers block local storage for local files.";
    }

    document.querySelector("#finish-name").textContent = profileName;
    document.querySelector("#finish-detail").textContent = `${selections.stage || "Your studies"} · ${selections.pace || "Your"} pace · saved on this device`;
    document.querySelector("#finish-detail").textContent = chosenPetName() + " is ready to explore with you.";
    steps.forEach((step) => { step.hidden = true; });
    document.querySelector(".onboarding-progress-wrap").hidden = true;
    actions.hidden = true;
    finish.hidden = false;
    finish.querySelector("h2").focus();
  }

  document.querySelectorAll(".choice").forEach((button) => {
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      const { key, value } = button.dataset;
      if (button.classList.contains("multi")) {
        const chosen = selections[key];
        const index = chosen.indexOf(value);
        if (index >= 0) chosen.splice(index, 1);
        else chosen.push(value);
        button.setAttribute("aria-pressed", String(index < 0));
      } else {
        steps[currentStep].querySelectorAll(`.choice[data-key="${key}"]`).forEach((item) => item.setAttribute("aria-pressed", "false"));
        selections[key] = value;
        button.setAttribute("aria-pressed", "true");
      }
      updateProgress();
    });
  });

  nextButton.addEventListener("click", () => {
    if (!hasAnswer()) return;
    if (currentStep === steps.length - 1) completeSetup();
    else showStep(currentStep + 1);
  });
  backButton.addEventListener("click", () => { if (currentStep > 0) showStep(currentStep - 1); });
  nameInput.addEventListener("input", updateProgress);
  hatchButton.addEventListener("click", hatchBuddy);
  companionNameInput.addEventListener("input", () => {
    if (petHatched) {
      hatchButton.setAttribute("aria-label", "Say hello to your new buddy, " + chosenPetName());
      document.querySelector("#hatch-tap-hint").textContent = "Say hi to " + chosenPetName();
      hatchMessage.textContent = "Hi! I'm " + chosenPetName() + ". I love tiny discoveries and tagging along. Breaks are always okay.";
    }
  });
  nameInput.addEventListener("keydown", (event) => { if (event.key === "Enter" && !nextButton.disabled) { event.preventDefault(); nextButton.click(); } });
  steps.forEach((step) => { const legend = step.querySelector("legend"); legend.tabIndex = -1; });
  updateProgress();
})();
