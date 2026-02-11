diff --git a/editor-runtime.js b/editor-runtime.js
index a2d02560e674e1a3a01bbf69a8260a7bc6e358b0..8e43ccf4d9586e503ddae8fa836daa0fb00f1d32 100644
--- a/editor-runtime.js
+++ b/editor-runtime.js
@@ -1,389 +1,382 @@
 const canvas = document.getElementById("editor");
 const ctx = canvas.getContext("2d");
 
 const materialSelect = document.getElementById("material");
 const sizeSelect = document.getElementById("size");
 const verticalToggle = document.getElementById("vertical");
+const armPlaceButton = document.getElementById("arm-place");
 const rotateButton = document.getElementById("rotate");
 const deleteButton = document.getElementById("delete");
 const clearButton = document.getElementById("clear");
+const hint = document.getElementById("hint");
 
 const heavyButton = document.getElementById("test-heavy");
 const windButton = document.getElementById("test-wind");
 const quakeButton = document.getElementById("test-quake");
 const stopButton = document.getElementById("test-stop");
 const testProgress = document.getElementById("test-progress");
 const testStatus = document.getElementById("test-status");
 
+const { Engine, World, Bodies, Body, Query } = Matter;
+
 const GRID_SIZE = 10;
-const GRAVITY = 0.6;
-const MAX_FALL_SPEED = 18;
-const AIR_DRAG = 0.96;
 const TEST_DURATION_MS = 10000;
 
 const materials = {
-  wood: { fill: "#c58b4a", stroke: "#8d5a24" },
-  stone: { fill: "#8f98a3", stroke: "#5f6b7a" },
-  ice: { fill: "#b9e8ff", stroke: "#6bbce3" },
+  wood: { fill: "#c58b4a", stroke: "#8d5a24", density: 0.0012, friction: 0.7, restitution: 0.1 },
+  stone: { fill: "#8f98a3", stroke: "#5f6b7a", density: 0.003, friction: 0.9, restitution: 0.02 },
+  glass: { fill: "#dff4ff", stroke: "#7cc0df", density: 0.0017, friction: 0.18, restitution: 0.08 },
 };
 
 const sizeOptions = {
   small: { width: 40, height: 20 },
   medium: { width: 80, height: 20 },
   large: { width: 120, height: 20 },
 };
 
+const engine = Engine.create({ gravity: { x: 0, y: 1 } });
+const { world } = engine;
+
+const boundaryThickness = 100;
+World.add(world, [
+  Bodies.rectangle(canvas.width / 2, canvas.height + boundaryThickness / 2, canvas.width + boundaryThickness * 2, boundaryThickness, { isStatic: true }),
+  Bodies.rectangle(-boundaryThickness / 2, canvas.height / 2, boundaryThickness, canvas.height * 2, { isStatic: true }),
+  Bodies.rectangle(canvas.width + boundaryThickness / 2, canvas.height / 2, boundaryThickness, canvas.height * 2, { isStatic: true }),
+]);
+
 const blocks = [];
 let selectedId = null;
 let draggedId = null;
 let dragOffset = { x: 0, y: 0 };
 let animationFrame = null;
-
 let currentTest = null;
+let isPlaceArmed = false;
 
 const snap = (value) => Math.round(value / GRID_SIZE) * GRID_SIZE;
 const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
 
 const getSelectedBlock = () => blocks.find((block) => block.id === selectedId) || null;
 const getDraggedBlock = () => blocks.find((block) => block.id === draggedId) || null;
 
-const getPhysicsSize = (block) => {
-  const normalized = ((block.rotation % 360) + 360) % 360;
-  const swap = normalized === 90 || normalized === 270;
-  return {
-    width: swap ? block.height : block.width,
-    height: swap ? block.width : block.height,
-  };
-};
-
-const drawBackground = () => {
-  ctx.clearRect(0, 0, canvas.width, canvas.height);
-};
-
-const drawBlock = (block, isSelected) => {
-  ctx.save();
-  ctx.translate(block.x, block.y);
-  ctx.rotate((block.rotation * Math.PI) / 180);
-
-  ctx.fillStyle = materials[block.material].fill;
-  ctx.strokeStyle = materials[block.material].stroke;
-  ctx.lineWidth = 2;
-  ctx.fillRect(-block.width / 2, -block.height / 2, block.width, block.height);
-  ctx.strokeRect(-block.width / 2, -block.height / 2, block.width, block.height);
-
-  if (isSelected) {
-    // 选中框与方块一起旋转，不再保持轴对齐。
-    ctx.strokeStyle = "#ff9800";
-    ctx.lineWidth = 3;
-    ctx.strokeRect(-block.width / 2 - 4, -block.height / 2 - 4, block.width + 8, block.height + 8);
-  }
-
-  ctx.restore();
-};
-
-const render = () => {
-  drawBackground();
-  blocks.forEach((block) => drawBlock(block, block.id === selectedId));
-};
-
-const overlapsHorizontally = (a, b) => {
-  const aSize = getPhysicsSize(a);
-  const bSize = getPhysicsSize(b);
-  return Math.abs(a.x - b.x) < aSize.width / 2 + bSize.width / 2;
+const updatePlaceArmUI = () => {
+  armPlaceButton.classList.toggle("armed", isPlaceArmed);
+  armPlaceButton.textContent = isPlaceArmed ? "加载中（点画布放置）" : "加载组件";
+  hint.textContent = isPlaceArmed
+    ? "点击画布空白处放置 1 个组件；放置后自动回到拖拽模式。"
+    : "先点击“加载组件”，再点击空白处放置；平时仅可拖拽已有建筑块。";
 };
 
 const updateTestStatus = () => {
   if (!currentTest) {
     testStatus.textContent = "状态：待机";
     testProgress.value = 0;
     return;
   }
+
   const elapsed = performance.now() - currentTest.startedAt;
   const percent = clamp((elapsed / currentTest.durationMs) * 100, 0, 100);
   testProgress.value = percent;
   testStatus.textContent = `状态：${currentTest.label}（${percent.toFixed(0)}%）`;
 
   if (elapsed >= currentTest.durationMs) {
     currentTest = null;
+    engine.gravity.x = 0;
+    engine.gravity.y = 1;
     testStatus.textContent = "状态：测试完成";
     testProgress.value = 100;
   }
 };
 
 const startTest = (type, label) => {
   currentTest = {
     type,
     label,
     startedAt: performance.now(),
     durationMs: TEST_DURATION_MS,
   };
   updateTestStatus();
 };
 
 const applyTestForces = () => {
+  engine.gravity.x = 0;
+  engine.gravity.y = 1;
   if (!currentTest) return;
 
   const elapsed = performance.now() - currentTest.startedAt;
 
   if (currentTest.type === "heavy") {
-    // 模拟重物周期性压顶：对顶部构件施加向下冲击。
-    const topThreshold = canvas.height * 0.45;
-    if (Math.floor(elapsed / 240) % 2 === 0) {
-      blocks.forEach((block) => {
-        if (block.y < topThreshold && block.id !== draggedId) {
-          block.vy += 0.9;
-        }
-      });
-    }
-  }
-
-  if (currentTest.type === "wind") {
-    // 模拟阵风：横向持续推力，叠加轻微摆动。
-    const gust = 0.22 + Math.sin(elapsed / 180) * 0.08;
+    const topLine = canvas.height * 0.35;
     blocks.forEach((block) => {
-      if (block.id !== draggedId) {
-        block.vx += gust;
-      }
+      if (block.id === draggedId || block.body.position.y > topLine) return;
+      Body.applyForce(block.body, block.body.position, { x: 0, y: 0.0038 * block.body.mass });
     });
   }
 
-  if (currentTest.type === "quake") {
-    // 模拟地震：左右快速震动。
-    const shake = Math.sin(elapsed / 60) * 0.9;
+  if (currentTest.type === "wind") {
+    const base = 0.00055 + Math.sin(elapsed / 260) * 0.00018;
     blocks.forEach((block) => {
-      if (block.id !== draggedId) {
-        block.vx += shake;
-      }
+      if (block.id === draggedId) return;
+      const heightFactor = 1 + (1 - block.body.position.y / canvas.height) * 0.55;
+      Body.applyForce(block.body, block.body.position, { x: base * heightFactor * block.body.mass, y: 0 });
     });
   }
-};
 
-const applyPhysics = () => {
-  const groundY = canvas.height - GRID_SIZE;
+  if (currentTest.type === "quake") {
+    engine.gravity.x = Math.sin(elapsed / 95) * 0.22;
+    engine.gravity.y = 1 + Math.sin(elapsed / 115) * 0.08;
 
-  blocks.forEach((block) => {
-    if (block.id === draggedId) {
-      block.vx = 0;
-      block.vy = 0;
-      return;
+    if (Math.floor(elapsed / 130) % 2 === 0) {
+      blocks.forEach((block) => {
+        if (block.id === draggedId) return;
+        Body.applyForce(block.body, block.body.position, {
+          x: Math.sin(elapsed / 60) * 0.00085 * block.body.mass,
+          y: Math.cos(elapsed / 75) * 0.00042 * block.body.mass,
+        });
+      });
     }
+  }
+};
 
-    const size = getPhysicsSize(block);
-    const halfHeight = size.height / 2;
-    const halfWidth = size.width / 2;
-
-    const leftBound = halfWidth;
-    const rightBound = canvas.width - halfWidth;
-
-    const previousY = block.y;
-    const previousBottom = previousY + halfHeight;
-
-    block.vx *= AIR_DRAG;
-    block.x += block.vx;
-    block.x = clamp(block.x, leftBound, rightBound);
-
-    block.vy = Math.min(block.vy + GRAVITY, MAX_FALL_SPEED);
-    block.y += block.vy;
-
-    let landingY = groundY - halfHeight;
-    const nextBottom = block.y + halfHeight;
-
-    blocks.forEach((other) => {
-      if (other.id === block.id || other.id === draggedId) return;
-      if (!overlapsHorizontally(block, other)) return;
-
-      const otherSize = getPhysicsSize(other);
-      const otherTop = other.y - otherSize.height / 2;
+const drawBlock = (block, isSelected) => {
+  const { body, width, height } = block;
+  const { fill, stroke } = materials[block.material];
 
-      const crossedTop = previousBottom <= otherTop && nextBottom >= otherTop;
-      const overlappingFromAbove = nextBottom > otherTop && block.y <= other.y;
+  ctx.save();
+  ctx.translate(body.position.x, body.position.y);
+  ctx.rotate(body.angle);
 
-      if (crossedTop || overlappingFromAbove) {
-        landingY = Math.min(landingY, otherTop - halfHeight);
-      }
-    });
+  ctx.fillStyle = fill;
+  ctx.strokeStyle = stroke;
+  ctx.lineWidth = 2;
+  ctx.fillRect(-width / 2, -height / 2, width, height);
+  ctx.strokeRect(-width / 2, -height / 2, width, height);
 
-    if (block.y > landingY) {
-      block.y = landingY;
-      block.vy = 0;
-      block.vx *= 0.9;
-    }
+  if (isSelected) {
+    ctx.strokeStyle = "#ff9800";
+    ctx.lineWidth = 3;
+    ctx.strokeRect(-width / 2 - 4, -height / 2 - 4, width + 8, height + 8);
+  }
 
-    block.x = snap(block.x);
-  });
+  ctx.restore();
 };
 
-const tick = () => {
-  applyTestForces();
-  applyPhysics();
-  updateTestStatus();
-  render();
-  animationFrame = requestAnimationFrame(tick);
+const render = () => {
+  ctx.clearRect(0, 0, canvas.width, canvas.height);
+  blocks.forEach((block) => drawBlock(block, block.id === selectedId));
 };
 
 const createBlock = (x, y) => {
   const size = sizeOptions[sizeSelect.value];
   const isVertical = verticalToggle.checked;
   const width = isVertical ? size.height : size.width;
   const height = isVertical ? size.width : size.height;
+
   const halfWidth = width / 2;
+  const px = clamp(snap(x), halfWidth, canvas.width - halfWidth);
+  const py = snap(y);
+
+  const material = materialSelect.value;
+  const body = Bodies.rectangle(px, py, width, height, {
+    density: materials[material].density,
+    friction: materials[material].friction,
+    restitution: materials[material].restitution,
+    frictionAir: 0.02,
+  });
 
   const block = {
     id: crypto.randomUUID(),
-    x: clamp(snap(x), halfWidth, canvas.width - halfWidth),
-    y: snap(y),
+    material,
     width,
     height,
-    material: materialSelect.value,
-    rotation: 0,
-    vx: 0,
-    vy: 0,
+    body,
   };
 
   blocks.push(block);
+  World.add(world, body);
   selectedId = block.id;
 };
 
 const findBlockAt = (x, y) => {
-  for (let i = blocks.length - 1; i >= 0; i -= 1) {
-    const block = blocks[i];
-    const dx = x - block.x;
-    const dy = y - block.y;
-    const angle = (-block.rotation * Math.PI) / 180;
-    const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
-    const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
-
-    if (Math.abs(localX) <= block.width / 2 && Math.abs(localY) <= block.height / 2) {
-      return block;
-    }
-  }
-  return null;
+  const hit = Query.point(
+    blocks.map((block) => block.body),
+    { x, y },
+  )[0];
+  if (!hit) return null;
+  return blocks.find((block) => block.body === hit) || null;
 };
 
 const getCanvasPoint = (event) => {
   const rect = canvas.getBoundingClientRect();
   return {
     x: event.clientX - rect.left,
     y: event.clientY - rect.top,
   };
 };
 
+const resetBodyMotion = (body) => {
+  Body.setVelocity(body, { x: 0, y: 0 });
+  Body.setAngularVelocity(body, 0);
+};
+
 canvas.addEventListener("pointerdown", (event) => {
   event.preventDefault();
   const { x, y } = getCanvasPoint(event);
   const found = findBlockAt(x, y);
 
   if (found) {
     selectedId = found.id;
     draggedId = found.id;
-    dragOffset = { x: found.x - x, y: found.y - y };
+    dragOffset = { x: found.body.position.x - x, y: found.body.position.y - y };
+    Body.setStatic(found.body, true);
+    resetBodyMotion(found.body);
     canvas.setPointerCapture(event.pointerId);
-  } else {
+    return;
+  }
+
+  if (isPlaceArmed) {
     createBlock(x, y);
+    isPlaceArmed = false;
+    updatePlaceArmUI();
   }
 });
 
 canvas.addEventListener("pointermove", (event) => {
   if (!draggedId) return;
   const block = getDraggedBlock();
   if (!block) return;
 
   const { x, y } = getCanvasPoint(event);
-  const { width } = getPhysicsSize(block);
-  const halfWidth = width / 2;
+  const nx = snap(x + dragOffset.x);
+  const ny = snap(y + dragOffset.y);
+
+  const bounds = block.body.bounds;
+  const halfWidth = (bounds.max.x - bounds.min.x) / 2;
+  const clampedX = clamp(nx, halfWidth, canvas.width - halfWidth);
 
-  block.x = clamp(snap(x + dragOffset.x), halfWidth, canvas.width - halfWidth);
-  block.y = snap(y + dragOffset.y);
-  block.vx = 0;
-  block.vy = 0;
+  Body.setPosition(block.body, { x: clampedX, y: ny });
+  resetBodyMotion(block.body);
 });
 
 const finishDrag = (event) => {
   if (!draggedId) return;
+  const block = getDraggedBlock();
+  if (block) {
+    Body.setStatic(block.body, false);
+    resetBodyMotion(block.body);
+  }
+
   if (event?.pointerId !== undefined && canvas.hasPointerCapture(event.pointerId)) {
     canvas.releasePointerCapture(event.pointerId);
   }
+
   draggedId = null;
 };
 
 canvas.addEventListener("pointerup", finishDrag);
 canvas.addEventListener("pointercancel", finishDrag);
 canvas.addEventListener("pointerleave", finishDrag);
 
+armPlaceButton.addEventListener("click", () => {
+  isPlaceArmed = !isPlaceArmed;
+  updatePlaceArmUI();
+});
+
 rotateButton.addEventListener("click", () => {
   const block = getSelectedBlock();
   if (!block) return;
-  block.rotation = (block.rotation + 90) % 360;
+  Body.rotate(block.body, Math.PI / 2);
+  resetBodyMotion(block.body);
 });
 
 deleteButton.addEventListener("click", () => {
   if (!selectedId) return;
   const index = blocks.findIndex((block) => block.id === selectedId);
-  if (index >= 0) {
-    blocks.splice(index, 1);
-    selectedId = null;
-  }
+  if (index < 0) return;
+
+  World.remove(world, blocks[index].body);
+  blocks.splice(index, 1);
+  selectedId = null;
 });
 
 clearButton.addEventListener("click", () => {
+  blocks.forEach((block) => World.remove(world, block.body));
   blocks.length = 0;
   selectedId = null;
   draggedId = null;
   currentTest = null;
+  engine.gravity.x = 0;
+  engine.gravity.y = 1;
   updateTestStatus();
 });
 
 heavyButton.addEventListener("click", () => startTest("heavy", "重物冲击测试"));
 windButton.addEventListener("click", () => startTest("wind", "风力扰动测试"));
 quakeButton.addEventListener("click", () => startTest("quake", "地震摇晃测试"));
 stopButton.addEventListener("click", () => {
   currentTest = null;
+  engine.gravity.x = 0;
+  engine.gravity.y = 1;
   updateTestStatus();
 });
 
 window.addEventListener("keydown", (event) => {
   const block = getSelectedBlock();
   if (!block) return;
 
   if (event.key === "Delete" || event.key === "Backspace") {
     event.preventDefault();
     deleteButton.click();
     return;
   }
 
   if (event.key.toLowerCase() === "r") {
     event.preventDefault();
     rotateButton.click();
     return;
   }
 
   const step = event.shiftKey ? GRID_SIZE * 2 : GRID_SIZE;
-  const size = getPhysicsSize(block);
+  const { x, y } = block.body.position;
+  let nextX = x;
+  let nextY = y;
 
   switch (event.key) {
     case "ArrowUp":
-      block.y = snap(block.y - step);
-      block.vy = 0;
+      nextY -= step;
       break;
     case "ArrowDown":
-      block.y = snap(block.y + step);
-      block.vy = 0;
+      nextY += step;
       break;
     case "ArrowLeft":
-      block.x = clamp(snap(block.x - step), size.width / 2, canvas.width - size.width / 2);
-      block.vx = 0;
+      nextX -= step;
       break;
     case "ArrowRight":
-      block.x = clamp(snap(block.x + step), size.width / 2, canvas.width - size.width / 2);
-      block.vx = 0;
+      nextX += step;
       break;
     default:
       return;
   }
 
+  const bounds = block.body.bounds;
+  const halfWidth = (bounds.max.x - bounds.min.x) / 2;
+
+  Body.setPosition(block.body, {
+    x: clamp(snap(nextX), halfWidth, canvas.width - halfWidth),
+    y: snap(nextY),
+  });
+  resetBodyMotion(block.body);
   event.preventDefault();
 });
 
+const tick = () => {
+  applyTestForces();
+  updateTestStatus();
+  Engine.update(engine, 1000 / 60);
+  render();
+  animationFrame = requestAnimationFrame(tick);
+};
+
+updatePlaceArmUI();
 updateTestStatus();
 if (animationFrame) cancelAnimationFrame(animationFrame);
 animationFrame = requestAnimationFrame(tick);
