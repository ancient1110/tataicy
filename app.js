// Runtime loader with self-healing fallback for accidental patch-text commits.
(() => {
  const runtimeUrl = `editor-runtime.js?v=20260211-7-${Date.now()}`;

  const looksLikeUnifiedDiff = (text) => {
    const head = text.slice(0, 400);
    return /^diff --git /m.test(head) || /^@@ /m.test(head);
  };

  const recoverFromUnifiedDiff = (text) => {
    const lines = text.split("\n");
    const recovered = [];

    lines.forEach((line) => {
      if (line.startsWith("diff --git ") || line.startsWith("index ") || line.startsWith("--- ") || line.startsWith("+++ ") || line.startsWith("@@ ")) {
        return;
      }
      if (line.startsWith("+")) {
        recovered.push(line.slice(1));
        return;
      }
      if (line.startsWith(" ")) {
        recovered.push(line.slice(1));
        return;
      }
      if (line.startsWith("-")) {
        return;
      }
      recovered.push(line);
    });

    return recovered.join("\n");
  };

  const injectScriptText = (sourceText) => {
    const blob = new Blob([sourceText], { type: "text/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    const script = document.createElement("script");
    script.src = blobUrl;
    script.defer = true;
    script.onload = () => URL.revokeObjectURL(blobUrl);
    document.body.appendChild(script);
  };

  fetch(runtimeUrl, { cache: "no-store" })
    .then((response) => response.text())
    .then((text) => {
      if (!looksLikeUnifiedDiff(text)) {
        injectScriptText(text);
        return;
      }

      const recovered = recoverFromUnifiedDiff(text);
      injectScriptText(recovered);
      console.warn("Detected accidental diff text in editor-runtime.js; loaded recovered runtime source.");
    })
    .catch(() => {
      // Final fallback: direct script loading path.
      const script = document.createElement("script");
      script.src = runtimeUrl;
      script.defer = true;
      document.body.appendChild(script);
    });
})();
