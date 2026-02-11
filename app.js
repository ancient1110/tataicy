// Stable wrapper: keep this file minimal to reduce future merge conflicts.
(() => {
  const script = document.createElement("script");
  script.src = `editor-runtime.js?v=${encodeURIComponent("20260211-1")}`;
  document.body.appendChild(script);
})();
