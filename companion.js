(() => {
  "use strict";

  function sprite(stage, extraClass) {
    const tier = Math.max(0, Math.min(3, Number(stage) || 0));
    const classes = ["pixel-pet", extraClass || ""].filter(Boolean).join(" ");
    return '<span class="' + classes + '" data-stage="' + tier + '" aria-hidden="true"><span class="pixel-pet-stage"></span></span>';
  }

  window.VayroPet = Object.freeze({ sprite });
})();
