// Stable wrapper: keep this file minimal to reduce future merge conflicts.
(() => {
  const script = document.createElement("script");
  script.src = "editor-runtime.js";
  document.body.appendChild(script);
})();
