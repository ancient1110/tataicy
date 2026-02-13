// Stable wrapper: keep this file minimal to reduce future merge conflicts.
(() => {
  const script = document.createElement("script");
  script.src = `editor-runtime.js?v=20260211-6-${Date.now()}`;
  script.defer = true;
  document.body.appendChild(script);
})();
