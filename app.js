// Stable wrapper: load runtime directly so local file:// opening also works.
(() => {
  const script = document.createElement("script");
  script.src = `editor-runtime.js?v=20260213-1-${Date.now()}`;
  script.defer = true;
  document.body.appendChild(script);
})();
