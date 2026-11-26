(() => {
  "use strict";

  function sprite(stage, extraClass) {
    const tier = Math.max(0, Math.min(3, Number(stage) || 0));
    const classes = ["pixel-pet", extraClass || ""].filter(Boolean).join(" ");
    return '<span class="' + classes + '" data-stage="' + tier + '" aria-hidden="true">' +
      '<svg class="pixel-pet-art" viewBox="0 0 64 64" role="presentation" focusable="false">' +
        '<g shape-rendering="crispEdges">' +
          '<rect x="20" y="55" width="28" height="3" fill="#d8d2c4"/>' +
          '<rect x="48" y="32" width="9" height="8" fill="#31513e"/><rect x="53" y="27" width="7" height="8" fill="#31513e"/>' +
          '<rect x="51" y="34" width="7" height="4" fill="#789d70"/><rect x="56" y="29" width="4" height="4" fill="#d5a35d"/>' +
          '<rect x="27" y="12" width="9" height="8" fill="#31513e"/>' +
          '<rect x="15" y="8" width="16" height="7" fill="#31513e"/><rect x="19" y="4" width="11" height="5" fill="#31513e"/>' +
          '<rect x="35" y="6" width="13" height="6" fill="#31513e"/><rect x="39" y="10" width="13" height="5" fill="#31513e"/>' +
          '<rect x="27" y="12" width="6" height="6" fill="#759c70"/>' +
          '<rect x="19" y="9" width="11" height="4" fill="#98bb83"/><rect x="22" y="5" width="7" height="4" fill="#98bb83"/>' +
          '<rect x="37" y="7" width="9" height="4" fill="#98bb83"/><rect x="41" y="11" width="9" height="3" fill="#98bb83"/>' +
          '<rect x="24" y="17" width="16" height="4" fill="#31513e"/>' +
          '<rect x="18" y="21" width="28" height="4" fill="#31513e"/>' +
          '<rect x="14" y="25" width="36" height="4" fill="#31513e"/>' +
          '<rect x="12" y="29" width="40" height="4" fill="#31513e"/>' +
          '<rect x="12" y="33" width="40" height="4" fill="#31513e"/>' +
          '<rect x="14" y="37" width="36" height="4" fill="#31513e"/>' +
          '<rect x="18" y="41" width="28" height="4" fill="#31513e"/>' +
          '<rect x="22" y="45" width="20" height="4" fill="#31513e"/>' +
          '<rect x="18" y="49" width="10" height="5" fill="#31513e"/><rect x="36" y="49" width="10" height="5" fill="#31513e"/>' +
          '<rect x="26" y="19" width="12" height="3" fill="#8fb17e"/>' +
          '<rect x="21" y="23" width="23" height="3" fill="#8fb17e"/>' +
          '<rect x="17" y="27" width="31" height="4" fill="#8fb17e"/>' +
          '<rect x="16" y="31" width="32" height="4" fill="#8fb17e"/>' +
          '<rect x="18" y="35" width="28" height="4" fill="#8fb17e"/>' +
          '<rect x="22" y="39" width="20" height="4" fill="#8fb17e"/>' +
          '<rect x="25" y="43" width="14" height="3" fill="#8fb17e"/>' +
          '<rect x="21" y="29" width="25" height="9" fill="#f0e8d6"/>' +
          '<rect x="25" y="29" width="4" height="4" fill="#263b35"/><rect x="38" y="29" width="4" height="4" fill="#263b35"/>' +
          '<rect x="21" y="34" width="4" height="2" fill="#d88773"/><rect x="45" y="34" width="4" height="2" fill="#d88773"/>' +
          '<rect x="31" y="35" width="5" height="2" fill="#263b35"/>' +
          '<g data-min-stage="1">' +
            '<rect x="17" y="39" width="31" height="4" fill="#bf7054"/><rect x="38" y="41" width="5" height="7" fill="#bf7054"/>' +
            '<rect x="18" y="39" width="5" height="2" fill="#dc9670"/>' +
          '</g>' +
          '<g data-min-stage="2">' +
            '<rect x="12" y="34" width="9" height="9" fill="#8d674a"/><rect x="14" y="36" width="5" height="5" fill="#d3ad6c"/>' +
            '<rect x="15" y="37" width="3" height="2" fill="#f0e8d6"/>' +
          '</g>' +
          '<g data-min-stage="3">' +
            '<rect x="10" y="22" width="4" height="4" fill="#f0c36d"/><rect x="7" y="25" width="10" height="3" fill="#f0c36d"/><rect x="10" y="28" width="4" height="3" fill="#f0c36d"/>' +
            '<rect x="49" y="21" width="3" height="3" fill="#f0c36d"/><rect x="47" y="24" width="7" height="2" fill="#f0c36d"/><rect x="49" y="26" width="3" height="3" fill="#f0c36d"/>' +
          '</g>' +
        '</g>' +
      '</svg>' +
    '</span>';
  }

  window.VayroPet = Object.freeze({ sprite });
})();
