diff --git a/editor-runtime.js b/editor-runtime.js
index 35a9e8844ac63d3b17ba5b0e8c92e70fb073c2e0..8172b7fbe12fd1fce641675496ef5e27629b7bd1 100644
--- a/editor-runtime.js
+++ b/editor-runtime.js
@@ -1,714 +1,686 @@
-diff --git a/editor-runtime.js b/editor-runtime.js
-index a2d02560e674e1a3a01bbf69a8260a7bc6e358b0..6e7b222ff5c51eb74ec2c57b50d3bcc5fd553555 100644
---- a/editor-runtime.js
-+++ b/editor-runtime.js
-@@ -1,389 +1,516 @@
- const canvas = document.getElementById("editor");
- const ctx = canvas.getContext("2d");
- 
- const materialSelect = document.getElementById("material");
- const sizeSelect = document.getElementById("size");
- const verticalToggle = document.getElementById("vertical");
-+const armPlaceButton = document.getElementById("arm-place");
- const rotateButton = document.getElementById("rotate");
- const deleteButton = document.getElementById("delete");
- const clearButton = document.getElementById("clear");
-+const buildControls = document.getElementById("build-controls");
-+const hint = document.getElementById("hint");
- 
- const heavyButton = document.getElementById("test-heavy");
- const windButton = document.getElementById("test-wind");
- const quakeButton = document.getElementById("test-quake");
--const stopButton = document.getElementById("test-stop");
-+const startButton = document.getElementById("test-start");
-+const restoreButton = document.getElementById("test-restore");
- const testProgress = document.getElementById("test-progress");
- const testStatus = document.getElementById("test-status");
- 
-+const { Engine, World, Bodies, Body, Query, Collision, Constraint, Vector } = Matter;
-+
- const GRID_SIZE = 10;
--const GRAVITY = 0.6;
--const MAX_FALL_SPEED = 18;
--const AIR_DRAG = 0.96;
--const TEST_DURATION_MS = 10000;
- 
- const materials = {
--  wood: { fill: "#c58b4a", stroke: "#8d5a24" },
--  stone: { fill: "#8f98a3", stroke: "#5f6b7a" },
--  ice: { fill: "#b9e8ff", stroke: "#6bbce3" },
-+  wood: { fill: "#c58b4a", stroke: "#8d5a24", density: 0.0012, friction: 0.7, restitution: 0.1 },
-+  stone: { fill: "#8f98a3", stroke: "#5f6b7a", density: 0.003, friction: 0.9, restitution: 0.02 },
-+  glass: { fill: "#dff4ff", stroke: "#7cc0df", density: 0.0017, friction: 0.18, restitution: 0.08 },
- };
- 
- const sizeOptions = {
-   small: { width: 40, height: 20 },
-   medium: { width: 80, height: 20 },
-   large: { width: 120, height: 20 },
- };
- 
-+const testLabels = {
-+  heavy: "重物冲击测试",
-+  wind: "风力扰动测试",
-+  quake: "地震摇晃测试",
-+};
-+
- const blocks = [];
- let selectedId = null;
- let draggedId = null;
- let dragOffset = { x: 0, y: 0 };
- let animationFrame = null;
-+let currentTestType = null;
-+let isPlaceArmed = false;
-+let isTestingActive = false;
-+let preTestSnapshot = null;
- 
--let currentTest = null;
-+let testEngine = null;
-+let testBodies = [];
-+let testBodyMap = new Map();
-+let adhesiveLinks = [];
- 
- const snap = (value) => Math.round(value / GRID_SIZE) * GRID_SIZE;
- const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
-+const getIntensityRatio = () => Number(testProgress.value) / 100;
- 
- const getSelectedBlock = () => blocks.find((block) => block.id === selectedId) || null;
- const getDraggedBlock = () => blocks.find((block) => block.id === draggedId) || null;
- 
--const getPhysicsSize = (block) => {
--  const normalized = ((block.rotation % 360) + 360) % 360;
--  const swap = normalized === 90 || normalized === 270;
--  return {
--    width: swap ? block.height : block.width,
--    height: swap ? block.width : block.height,
--  };
-+const updateTestButtonState = () => {
-+  [heavyButton, windButton, quakeButton].forEach((button) => button.classList.remove("selected"));
-+  if (currentTestType === "heavy") heavyButton.classList.add("selected");
-+  if (currentTestType === "wind") windButton.classList.add("selected");
-+  if (currentTestType === "quake") quakeButton.classList.add("selected");
- };
- 
--const drawBackground = () => {
--  ctx.clearRect(0, 0, canvas.width, canvas.height);
-+const updateBuildControlsState = () => {
-+  const disabled = isTestingActive;
-+  [materialSelect, sizeSelect, verticalToggle, armPlaceButton, rotateButton, deleteButton, clearButton].forEach((el) => {
-+    el.disabled = disabled;
-+  });
-+  buildControls.classList.toggle("disabled", disabled);
- };
- 
--const drawBlock = (block, isSelected) => {
--  ctx.save();
--  ctx.translate(block.x, block.y);
--  ctx.rotate((block.rotation * Math.PI) / 180);
--
--  ctx.fillStyle = materials[block.material].fill;
--  ctx.strokeStyle = materials[block.material].stroke;
--  ctx.lineWidth = 2;
--  ctx.fillRect(-block.width / 2, -block.height / 2, block.width, block.height);
--  ctx.strokeRect(-block.width / 2, -block.height / 2, block.width, block.height);
--
--  if (isSelected) {
--    // 选中框与方块一起旋转，不再保持轴对齐。
--    ctx.strokeStyle = "#ff9800";
--    ctx.lineWidth = 3;
--    ctx.strokeRect(-block.width / 2 - 4, -block.height / 2 - 4, block.width + 8, block.height + 8);
-+const updatePlaceArmUI = () => {
-+  armPlaceButton.classList.toggle("armed", isPlaceArmed);
-+  armPlaceButton.textContent = isPlaceArmed ? "放置模式（点击退出）" : "加载组件";
-+  if (isTestingActive) {
-+    hint.textContent = "测试进行中：已锁定搭建操作。点击“恢复原状”可静态回溯到测试前。";
-+    return;
-   }
--
--  ctx.restore();
--};
--
--const render = () => {
--  drawBackground();
--  blocks.forEach((block) => drawBlock(block, block.id === selectedId));
--};
--
--const overlapsHorizontally = (a, b) => {
--  const aSize = getPhysicsSize(a);
--  const bSize = getPhysicsSize(b);
--  return Math.abs(a.x - b.x) < aSize.width / 2 + bSize.width / 2;
-+  hint.textContent = isPlaceArmed
-+    ? "搭建模式（非物理）：可持续点击空白处放置组件，再次点击按钮退出。"
-+    : "当前为非物理搭建模式，拖拽/旋转更容易；点击“加载组件”后可连续放置。";
- };
- 
- const updateTestStatus = () => {
--  if (!currentTest) {
--    testStatus.textContent = "状态：待机";
--    testProgress.value = 0;
-+  const intensity = Number(testProgress.value);
-+  if (!currentTestType) {
-+    testStatus.textContent = `状态：待机（强度 ${intensity}%）`;
-     return;
-   }
--  const elapsed = performance.now() - currentTest.startedAt;
--  const percent = clamp((elapsed / currentTest.durationMs) * 100, 0, 100);
--  testProgress.value = percent;
--  testStatus.textContent = `状态：${currentTest.label}（${percent.toFixed(0)}%）`;
--
--  if (elapsed >= currentTest.durationMs) {
--    currentTest = null;
--    testStatus.textContent = "状态：测试完成";
--    testProgress.value = 100;
-+  if (!isTestingActive) {
-+    testStatus.textContent = `状态：已选择${testLabels[currentTestType]}（强度 ${intensity}%，点击“开始测试”生效）`;
-+    return;
-   }
-+  testStatus.textContent = `状态：测试中 - ${testLabels[currentTestType]}（强度 ${intensity}%）`;
- };
- 
--const startTest = (type, label) => {
--  currentTest = {
--    type,
--    label,
--    startedAt: performance.now(),
--    durationMs: TEST_DURATION_MS,
--  };
--  updateTestStatus();
--};
--
--const applyTestForces = () => {
--  if (!currentTest) return;
--
--  const elapsed = performance.now() - currentTest.startedAt;
--
--  if (currentTest.type === "heavy") {
--    // 模拟重物周期性压顶：对顶部构件施加向下冲击。
--    const topThreshold = canvas.height * 0.45;
--    if (Math.floor(elapsed / 240) % 2 === 0) {
--      blocks.forEach((block) => {
--        if (block.y < topThreshold && block.id !== draggedId) {
--          block.vy += 0.9;
--        }
--      });
--    }
--  }
--
--  if (currentTest.type === "wind") {
--    // 模拟阵风：横向持续推力，叠加轻微摆动。
--    const gust = 0.22 + Math.sin(elapsed / 180) * 0.08;
--    blocks.forEach((block) => {
--      if (block.id !== draggedId) {
--        block.vx += gust;
--      }
--    });
--  }
--
--  if (currentTest.type === "quake") {
--    // 模拟地震：左右快速震动。
--    const shake = Math.sin(elapsed / 60) * 0.9;
--    blocks.forEach((block) => {
--      if (block.id !== draggedId) {
--        block.vx += shake;
--      }
--    });
-+const getRenderState = (block) => {
-+  if (!isTestingActive) {
-+    return { x: block.x, y: block.y, angle: block.rotation };
-   }
-+  const body = testBodyMap.get(block.id);
-+  if (!body) return { x: block.x, y: block.y, angle: block.rotation };
-+  return { x: body.position.x, y: body.position.y, angle: body.angle };
- };
- 
--const applyPhysics = () => {
--  const groundY = canvas.height - GRID_SIZE;
--
--  blocks.forEach((block) => {
--    if (block.id === draggedId) {
--      block.vx = 0;
--      block.vy = 0;
--      return;
--    }
--
--    const size = getPhysicsSize(block);
--    const halfHeight = size.height / 2;
--    const halfWidth = size.width / 2;
--
--    const leftBound = halfWidth;
--    const rightBound = canvas.width - halfWidth;
--
--    const previousY = block.y;
--    const previousBottom = previousY + halfHeight;
--
--    block.vx *= AIR_DRAG;
--    block.x += block.vx;
--    block.x = clamp(block.x, leftBound, rightBound);
--
--    block.vy = Math.min(block.vy + GRAVITY, MAX_FALL_SPEED);
--    block.y += block.vy;
--
--    let landingY = groundY - halfHeight;
--    const nextBottom = block.y + halfHeight;
--
--    blocks.forEach((other) => {
--      if (other.id === block.id || other.id === draggedId) return;
--      if (!overlapsHorizontally(block, other)) return;
--
--      const otherSize = getPhysicsSize(other);
--      const otherTop = other.y - otherSize.height / 2;
-+const drawBlock = (block, isSelected) => {
-+  const { width, height } = block;
-+  const { fill, stroke } = materials[block.material];
-+  const state = getRenderState(block);
- 
--      const crossedTop = previousBottom <= otherTop && nextBottom >= otherTop;
--      const overlappingFromAbove = nextBottom > otherTop && block.y <= other.y;
-+  ctx.save();
-+  ctx.translate(state.x, state.y);
-+  ctx.rotate(state.angle);
- 
--      if (crossedTop || overlappingFromAbove) {
--        landingY = Math.min(landingY, otherTop - halfHeight);
--      }
--    });
-+  ctx.fillStyle = fill;
-+  ctx.strokeStyle = stroke;
-+  ctx.lineWidth = 2;
-+  ctx.fillRect(-width / 2, -height / 2, width, height);
-+  ctx.strokeRect(-width / 2, -height / 2, width, height);
- 
--    if (block.y > landingY) {
--      block.y = landingY;
--      block.vy = 0;
--      block.vx *= 0.9;
--    }
-+  if (isSelected && !isTestingActive) {
-+    ctx.strokeStyle = "#ff9800";
-+    ctx.lineWidth = 3;
-+    ctx.strokeRect(-width / 2 - 4, -height / 2 - 4, width + 8, height + 8);
-+  }
- 
--    block.x = snap(block.x);
--  });
-+  ctx.restore();
- };
- 
--const tick = () => {
--  applyTestForces();
--  applyPhysics();
--  updateTestStatus();
--  render();
--  animationFrame = requestAnimationFrame(tick);
-+const render = () => {
-+  ctx.clearRect(0, 0, canvas.width, canvas.height);
-+  blocks.forEach((block) => drawBlock(block, block.id === selectedId));
- };
- 
- const createBlock = (x, y) => {
-   const size = sizeOptions[sizeSelect.value];
-   const isVertical = verticalToggle.checked;
-   const width = isVertical ? size.height : size.width;
-   const height = isVertical ? size.width : size.height;
-   const halfWidth = width / 2;
- 
-   const block = {
-     id: crypto.randomUUID(),
-     x: clamp(snap(x), halfWidth, canvas.width - halfWidth),
-     y: snap(y),
-     width,
-     height,
--    material: materialSelect.value,
-     rotation: 0,
--    vx: 0,
--    vy: 0,
-+    material: materialSelect.value,
-   };
- 
-   blocks.push(block);
-   selectedId = block.id;
- };
- 
- const findBlockAt = (x, y) => {
-   for (let i = blocks.length - 1; i >= 0; i -= 1) {
-     const block = blocks[i];
-     const dx = x - block.x;
-     const dy = y - block.y;
--    const angle = (-block.rotation * Math.PI) / 180;
-+    const angle = -block.rotation;
-     const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
-     const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
--
-     if (Math.abs(localX) <= block.width / 2 && Math.abs(localY) <= block.height / 2) {
-       return block;
-     }
-   }
-   return null;
- };
- 
- const getCanvasPoint = (event) => {
-   const rect = canvas.getBoundingClientRect();
-   return {
-     x: event.clientX - rect.left,
-     y: event.clientY - rect.top,
-   };
- };
- 
-+const computeOverlapLength = (bodyA, bodyB) => {
-+  const overlapX = Math.min(bodyA.bounds.max.x, bodyB.bounds.max.x) - Math.max(bodyA.bounds.min.x, bodyB.bounds.min.x);
-+  const overlapY = Math.min(bodyA.bounds.max.y, bodyB.bounds.max.y) - Math.max(bodyA.bounds.min.y, bodyB.bounds.min.y);
-+  if (overlapX <= 0 || overlapY <= 0) return 0;
-+  return Math.max(Math.min(overlapX, 120), Math.min(overlapY, 120));
-+};
-+
-+const createAdhesionConstraintsForPair = (bodyA, bodyB, contact, normal, overlapLength) => {
-+  const tangent = Vector.perp(normal);
-+  const unitTangent = Vector.normalise(tangent);
-+  const offset = clamp(overlapLength * 0.2, 4, 20);
-+  const stiffness = clamp(0.0012 + overlapLength * 0.00005, 0.0012, 0.0065);
-+
-+  const points = [
-+    contact,
-+    Vector.add(contact, Vector.mult(unitTangent, offset)),
-+    Vector.sub(contact, Vector.mult(unitTangent, offset)),
-+  ];
-+
-+  return points.map((point) => Constraint.create({
-+    bodyA,
-+    bodyB,
-+    pointA: Vector.sub(point, bodyA.position),
-+    pointB: Vector.sub(point, bodyB.position),
-+    length: 0,
-+    stiffness,
-+    damping: 0.08,
-+  }));
-+};
-+
-+const clearTestWorld = () => {
-+  if (!testEngine) return;
-+  adhesiveLinks.forEach((link) => link.constraints.forEach((constraint) => World.remove(testEngine.world, constraint)));
-+  adhesiveLinks = [];
-+  testBodies = [];
-+  testBodyMap = new Map();
-+  testEngine = null;
-+};
-+
-+const createTestWorld = () => {
-+  testEngine = Engine.create({ gravity: { x: 0, y: 1 } });
-+
-+  const boundary = 100;
-+  World.add(testEngine.world, [
-+    Bodies.rectangle(canvas.width / 2, canvas.height + boundary / 2, canvas.width + boundary * 2, boundary, { isStatic: true }),
-+    Bodies.rectangle(-boundary / 2, canvas.height / 2, boundary, canvas.height * 2, { isStatic: true }),
-+    Bodies.rectangle(canvas.width + boundary / 2, canvas.height / 2, boundary, canvas.height * 2, { isStatic: true }),
-+  ]);
-+
-+  testBodies = blocks.map((block) => {
-+    const body = Bodies.rectangle(block.x, block.y, block.width, block.height, {
-+      angle: block.rotation,
-+      density: materials[block.material].density,
-+      friction: materials[block.material].friction,
-+      restitution: materials[block.material].restitution,
-+      frictionAir: 0.02,
-+    });
-+    return { id: block.id, body };
-+  });
-+
-+  testBodyMap = new Map(testBodies.map((item) => [item.id, item.body]));
-+  World.add(testEngine.world, testBodies.map((item) => item.body));
-+
-+  adhesiveLinks = [];
-+  for (let i = 0; i < testBodies.length; i += 1) {
-+    for (let j = i + 1; j < testBodies.length; j += 1) {
-+      const bodyA = testBodies[i].body;
-+      const bodyB = testBodies[j].body;
-+      const collision = Collision.collides(bodyA, bodyB);
-+      if (!collision || !collision.collided) continue;
-+
-+      const overlapLength = computeOverlapLength(bodyA, bodyB);
-+      if (overlapLength < 6) continue;
-+
-+      const contact = collision.supports?.[0]
-+        ? { x: collision.supports[0].x, y: collision.supports[0].y }
-+        : { x: (bodyA.position.x + bodyB.position.x) / 2, y: (bodyA.position.y + bodyB.position.y) / 2 };
-+
-+      const fallbackNormal = Vector.normalise(Vector.sub(bodyB.position, bodyA.position));
-+      const normal = collision.normal && (collision.normal.x !== 0 || collision.normal.y !== 0)
-+        ? collision.normal
-+        : (fallbackNormal.x === 0 && fallbackNormal.y === 0 ? { x: 1, y: 0 } : fallbackNormal);
-+
-+      const constraints = createAdhesionConstraintsForPair(bodyA, bodyB, contact, normal, overlapLength);
-+      World.add(testEngine.world, constraints);
-+      adhesiveLinks.push({ bodyA, bodyB, constraints });
-+    }
-+  }
-+};
-+
-+const updateAdhesionLinks = () => {
-+  if (!testEngine) return;
-+  adhesiveLinks = adhesiveLinks.filter((link) => {
-+    const overlapX = Math.min(link.bodyA.bounds.max.x, link.bodyB.bounds.max.x) - Math.max(link.bodyA.bounds.min.x, link.bodyB.bounds.min.x);
-+    const overlapY = Math.min(link.bodyA.bounds.max.y, link.bodyB.bounds.max.y) - Math.max(link.bodyA.bounds.min.y, link.bodyB.bounds.min.y);
-+    if (overlapX <= 0 || overlapY <= 0) {
-+      link.constraints.forEach((constraint) => World.remove(testEngine.world, constraint));
-+      return false;
-+    }
-+    return true;
-+  });
-+};
-+
-+const snapshotBeforeTest = () => {
-+  preTestSnapshot = {
-+    selectedId,
-+    isPlaceArmed,
-+    currentTestType,
-+    intensity: Number(testProgress.value),
-+    blocks: blocks.map((block) => ({ ...block })),
-+  };
-+};
-+
-+const restoreSnapshot = () => {
-+  if (!preTestSnapshot) return;
-+  blocks.length = 0;
-+  preTestSnapshot.blocks.forEach((block) => blocks.push({ ...block }));
-+  selectedId = preTestSnapshot.selectedId;
-+  draggedId = null;
-+  isPlaceArmed = preTestSnapshot.isPlaceArmed;
-+  currentTestType = preTestSnapshot.currentTestType;
-+  testProgress.value = preTestSnapshot.intensity;
-+  updateTestButtonState();
-+};
-+
-+const startTesting = () => {
-+  if (isTestingActive || !currentTestType || blocks.length === 0) return;
-+  snapshotBeforeTest();
-+  createTestWorld();
-+  isTestingActive = true;
-+  draggedId = null;
-+  updateBuildControlsState();
-+  updatePlaceArmUI();
-+  updateTestStatus();
-+};
-+
-+const restoreState = () => {
-+  if (!preTestSnapshot) return;
-+  isTestingActive = false;
-+  clearTestWorld();
-+  restoreSnapshot();
-+  updateBuildControlsState();
-+  updatePlaceArmUI();
-+  updateTestStatus();
-+};
-+
-+const applyTestForces = () => {
-+  if (!isTestingActive || !currentTestType || !testEngine) return;
-+
-+  testEngine.gravity.x = 0;
-+  testEngine.gravity.y = 1;
-+  updateAdhesionLinks();
-+
-+  const strength = getIntensityRatio();
-+  if (strength <= 0) return;
-+  const elapsed = performance.now();
-+
-+  if (currentTestType === "heavy") {
-+    const topLine = canvas.height * 0.4;
-+    testBodies.forEach(({ body }) => {
-+      if (body.position.y > topLine) return;
-+      Body.applyForce(body, body.position, { x: 0, y: 0.0042 * strength * body.mass });
-+    });
-+  }
-+
-+  if (currentTestType === "wind") {
-+    const base = (0.00025 + Math.sin(elapsed / 250) * 0.00008) * strength;
-+    testBodies.forEach(({ body }) => {
-+      const heightFactor = 1 + (1 - body.position.y / canvas.height) * 0.5;
-+      Body.applyForce(body, body.position, { x: base * heightFactor * body.mass, y: 0 });
-+    });
-+  }
-+
-+  if (currentTestType === "quake") {
-+    testEngine.gravity.x = Math.sin(elapsed / 90) * 0.22 * strength;
-+    testEngine.gravity.y = 1 + Math.sin(elapsed / 120) * 0.1 * strength;
-+    testBodies.forEach(({ body }) => {
-+      Body.applyForce(body, body.position, {
-+        x: Math.sin(elapsed / 58) * 0.00075 * strength * body.mass,
-+        y: Math.cos(elapsed / 72) * 0.00045 * strength * body.mass,
-+      });
-+    });
-+  }
-+};
-+
- canvas.addEventListener("pointerdown", (event) => {
-+  if (isTestingActive) return;
-   event.preventDefault();
-+
-   const { x, y } = getCanvasPoint(event);
-   const found = findBlockAt(x, y);
- 
-   if (found) {
-     selectedId = found.id;
-     draggedId = found.id;
-     dragOffset = { x: found.x - x, y: found.y - y };
-     canvas.setPointerCapture(event.pointerId);
--  } else {
--    createBlock(x, y);
-+    return;
-   }
-+
-+  if (isPlaceArmed) createBlock(x, y);
- });
- 
- canvas.addEventListener("pointermove", (event) => {
--  if (!draggedId) return;
-+  if (isTestingActive || !draggedId) return;
-   const block = getDraggedBlock();
-   if (!block) return;
- 
-   const { x, y } = getCanvasPoint(event);
--  const { width } = getPhysicsSize(block);
--  const halfWidth = width / 2;
-+  const nx = snap(x + dragOffset.x);
-+  const ny = snap(y + dragOffset.y);
-+  const halfWidth = block.width / 2;
- 
--  block.x = clamp(snap(x + dragOffset.x), halfWidth, canvas.width - halfWidth);
--  block.y = snap(y + dragOffset.y);
--  block.vx = 0;
--  block.vy = 0;
-+  block.x = clamp(nx, halfWidth, canvas.width - halfWidth);
-+  block.y = ny;
- });
- 
- const finishDrag = (event) => {
-   if (!draggedId) return;
-   if (event?.pointerId !== undefined && canvas.hasPointerCapture(event.pointerId)) {
-     canvas.releasePointerCapture(event.pointerId);
-   }
-   draggedId = null;
- };
- 
- canvas.addEventListener("pointerup", finishDrag);
- canvas.addEventListener("pointercancel", finishDrag);
- canvas.addEventListener("pointerleave", finishDrag);
- 
-+armPlaceButton.addEventListener("click", () => {
-+  if (isTestingActive) return;
-+  isPlaceArmed = !isPlaceArmed;
-+  updatePlaceArmUI();
-+});
-+
- rotateButton.addEventListener("click", () => {
-+  if (isTestingActive) return;
-   const block = getSelectedBlock();
-   if (!block) return;
--  block.rotation = (block.rotation + 90) % 360;
-+  block.rotation = (block.rotation + Math.PI / 2) % (Math.PI * 2);
- });
- 
- deleteButton.addEventListener("click", () => {
--  if (!selectedId) return;
-+  if (isTestingActive || !selectedId) return;
-   const index = blocks.findIndex((block) => block.id === selectedId);
--  if (index >= 0) {
--    blocks.splice(index, 1);
--    selectedId = null;
--  }
-+  if (index < 0) return;
-+  blocks.splice(index, 1);
-+  selectedId = null;
- });
- 
- clearButton.addEventListener("click", () => {
-+  if (isTestingActive) return;
-   blocks.length = 0;
-   selectedId = null;
-   draggedId = null;
--  currentTest = null;
-+  currentTestType = null;
-+  testProgress.value = 0;
-+  updateTestButtonState();
-   updateTestStatus();
- });
- 
--heavyButton.addEventListener("click", () => startTest("heavy", "重物冲击测试"));
--windButton.addEventListener("click", () => startTest("wind", "风力扰动测试"));
--quakeButton.addEventListener("click", () => startTest("quake", "地震摇晃测试"));
--stopButton.addEventListener("click", () => {
--  currentTest = null;
-+const selectTest = (type) => {
-+  currentTestType = type;
-+  updateTestButtonState();
-   updateTestStatus();
--});
-+};
-+
-+heavyButton.addEventListener("click", () => selectTest("heavy"));
-+windButton.addEventListener("click", () => selectTest("wind"));
-+quakeButton.addEventListener("click", () => selectTest("quake"));
-+startButton.addEventListener("click", startTesting);
-+restoreButton.addEventListener("click", restoreState);
-+
-+testProgress.addEventListener("input", updateTestStatus);
- 
- window.addEventListener("keydown", (event) => {
-+  if (isTestingActive) return;
-   const block = getSelectedBlock();
-   if (!block) return;
- 
-   if (event.key === "Delete" || event.key === "Backspace") {
-     event.preventDefault();
-     deleteButton.click();
-     return;
-   }
- 
-   if (event.key.toLowerCase() === "r") {
-     event.preventDefault();
-     rotateButton.click();
-     return;
-   }
- 
-   const step = event.shiftKey ? GRID_SIZE * 2 : GRID_SIZE;
--  const size = getPhysicsSize(block);
- 
-   switch (event.key) {
-     case "ArrowUp":
-       block.y = snap(block.y - step);
--      block.vy = 0;
-       break;
-     case "ArrowDown":
-       block.y = snap(block.y + step);
--      block.vy = 0;
-       break;
-     case "ArrowLeft":
--      block.x = clamp(snap(block.x - step), size.width / 2, canvas.width - size.width / 2);
--      block.vx = 0;
-+      block.x = clamp(snap(block.x - step), block.width / 2, canvas.width - block.width / 2);
-       break;
-     case "ArrowRight":
--      block.x = clamp(snap(block.x + step), size.width / 2, canvas.width - size.width / 2);
--      block.vx = 0;
-+      block.x = clamp(snap(block.x + step), block.width / 2, canvas.width - block.width / 2);
-       break;
-     default:
-       return;
-   }
- 
-   event.preventDefault();
- });
- 
-+const tick = () => {
-+  applyTestForces();
-+  if (isTestingActive && testEngine) {
-+    Engine.update(testEngine, 1000 / 60);
-+  }
-+  render();
-+  animationFrame = requestAnimationFrame(tick);
-+};
-+
-+updateBuildControlsState();
-+updateTestButtonState();
-+updatePlaceArmUI();
- updateTestStatus();
- if (animationFrame) cancelAnimationFrame(animationFrame);
- animationFrame = requestAnimationFrame(tick);
+const canvas = document.getElementById("editor");
+const ctx = canvas.getContext("2d");
+
+const materialSelect = document.getElementById("material");
+const sizeSelect = document.getElementById("size");
+const widthSlider = document.getElementById("width-slider");
+const heightSlider = document.getElementById("height-slider");
+const widthValue = document.getElementById("width-value");
+const heightValue = document.getElementById("height-value");
+const rotationSlider = document.getElementById("rotation-slider");
+const rotationValue = document.getElementById("rotation-value");
+const verticalToggle = document.getElementById("vertical");
+const armPlaceButton = document.getElementById("arm-place");
+const rotateButton = document.getElementById("rotate");
+const deleteButton = document.getElementById("delete");
+const clearButton = document.getElementById("clear");
+const buildControls = document.getElementById("build-controls");
+const hint = document.getElementById("hint");
+
+const heavyButton = document.getElementById("test-heavy");
+const windButton = document.getElementById("test-wind");
+const quakeButton = document.getElementById("test-quake");
+const startButton = document.getElementById("test-start");
+const restoreButton = document.getElementById("test-restore");
+const testProgress = document.getElementById("test-progress");
+const testStatus = document.getElementById("test-status");
+
+const { Engine, World, Bodies, Body, Query, Collision, Constraint, Vector } = Matter;
+
+const GRID_SIZE = 10;
+const BUILD_GRAVITY_STEP = 6;
+const ROTATE_STEP_RAD = Math.PI / 12;
+
+const materials = {
+  wood: { fill: "#c58b4a", stroke: "#8d5a24", density: 0.0012, friction: 0.7, restitution: 0.1 },
+  stone: { fill: "#8f98a3", stroke: "#5f6b7a", density: 0.003, friction: 0.9, restitution: 0.02 },
+  glass: { fill: "#dff4ff", stroke: "#7cc0df", density: 0.0017, friction: 0.18, restitution: 0.08 },
+};
+
+const sizeOptions = {
+  small: { width: 40, height: 20 },
+  medium: { width: 80, height: 20 },
+  large: { width: 120, height: 20 },
+};
+
+const testLabels = {
+  heavy: "重物冲击测试",
+  wind: "风力扰动测试",
+  quake: "地震摇晃测试",
+};
+
+const blocks = [];
+let selectedId = null;
+let draggedId = null;
+let dragOffset = { x: 0, y: 0 };
+let animationFrame = null;
+let currentTestType = null;
+let isPlaceArmed = false;
+let isTestingActive = false;
+let preTestSnapshot = null;
+
+let testEngine = null;
+let testBodies = [];
+let testBodyMap = new Map();
+let adhesiveLinks = [];
+
+const snap = (value) => Math.round(value / GRID_SIZE) * GRID_SIZE;
+const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
+const getIntensityRatio = () => Number(testProgress.value) / 100;
+
+const getSelectedBlock = () => blocks.find((block) => block.id === selectedId) || null;
+const getDraggedBlock = () => blocks.find((block) => block.id === draggedId) || null;
+
+const normalizeAngle = (radians) => {
+  const full = Math.PI * 2;
+  return ((radians % full) + full) % full;
+};
+
+const getFootprintSize = (block) => {
+  const angle = normalizeAngle(block.rotation);
+  const cos = Math.abs(Math.cos(angle));
+  const sin = Math.abs(Math.sin(angle));
+  return {
+    width: block.width * cos + block.height * sin,
+    height: block.width * sin + block.height * cos,
+  };
+};
+
+const getAabb = (block) => {
+  const size = getFootprintSize(block);
+  return {
+    left: block.x - size.width / 2,
+    right: block.x + size.width / 2,
+    top: block.y - size.height / 2,
+    bottom: block.y + size.height / 2,
+    width: size.width,
+    height: size.height,
+  };
+};
+
+const isOverlapping = (a, b) => {
+  const aa = getAabb(a);
+  const bb = getAabb(b);
+  return aa.left < bb.right && aa.right > bb.left && aa.top < bb.bottom && aa.bottom > bb.top;
+};
+
+const getSupportY = (block) => {
+  const bb = getAabb(block);
+  let supportY = canvas.height - bb.height / 2;
+
+  blocks.forEach((other) => {
+    if (other.id === block.id) return;
+    const ob = getAabb(other);
+    const horizontalOverlap = bb.left < ob.right && bb.right > ob.left;
+    if (!horizontalOverlap) return;
+
+    const candidate = ob.top - bb.height / 2;
+    if (candidate >= block.y - 0.1 && candidate < supportY) {
+      supportY = candidate;
+    }
+  });
+
+  return supportY;
+};
+
+const resolveImmediateOverlaps = (block) => {
+  let moved = false;
+  for (let i = 0; i < blocks.length; i += 1) {
+    const other = blocks[i];
+    if (other.id === block.id) continue;
+    if (!isOverlapping(block, other)) continue;
+
+    const selfBox = getAabb(block);
+    const otherBox = getAabb(other);
+    const overlap = selfBox.bottom - otherBox.top;
+    if (overlap > 0) {
+      block.y -= overlap;
+      moved = true;
+    }
+  }
+  return moved;
+};
+
+const settleBuildWorld = () => {
+  if (isTestingActive) return;
+
+  // 先处理拖拽/创建产生的相交，再做简化重力下落（仅竖直，不翻倒）。
+  for (let i = 0; i < 4; i += 1) {
+    let changed = false;
+    blocks.forEach((block) => {
+      if (draggedId === block.id) return;
+
+      const size = getFootprintSize(block);
+      block.x = clamp(snap(block.x), size.width / 2, canvas.width - size.width / 2);
+
+      if (resolveImmediateOverlaps(block)) changed = true;
+      const supportY = getSupportY(block);
+      const targetY = snap(supportY);
+      if (block.y < targetY) {
+        block.y = Math.min(block.y + BUILD_GRAVITY_STEP, targetY);
+        changed = true;
+      }
+    });
+
+    if (!changed) break;
+  }
+};
+
+const updateTestButtonState = () => {
+  [heavyButton, windButton, quakeButton].forEach((button) => button.classList.remove("selected"));
+  if (currentTestType === "heavy") heavyButton.classList.add("selected");
+  if (currentTestType === "wind") windButton.classList.add("selected");
+  if (currentTestType === "quake") quakeButton.classList.add("selected");
+};
+
+const updateBuildControlsState = () => {
+  const disabled = isTestingActive;
+  [materialSelect, sizeSelect, widthSlider, heightSlider, rotationSlider, verticalToggle, armPlaceButton, rotateButton, deleteButton, clearButton].forEach((el) => {
+    el.disabled = disabled;
+  });
+  buildControls.classList.toggle("disabled", disabled);
+};
+
+const updatePlaceArmUI = () => {
+  armPlaceButton.classList.toggle("armed", isPlaceArmed);
+  armPlaceButton.textContent = isPlaceArmed ? "放置模式（点击退出）" : "加载组件";
+  if (isTestingActive) {
+    hint.textContent = "测试进行中：已锁定搭建操作。点击“恢复原状”可静态回溯到测试前。";
+    return;
+  }
+  hint.textContent = isPlaceArmed
+    ? "搭建模式（非物理）：可持续点击空白处放置组件，支持拖拽滑条自定义尺寸与角度。"
+    : "当前为非物理搭建模式：可拖拽调整宽高和旋转角度；点击“加载组件”后可连续放置。";
+};
+
+const updateTestStatus = () => {
+  const intensity = Number(testProgress.value);
+  if (!currentTestType) {
+    testStatus.textContent = `状态：待机（强度 ${intensity}%）`;
+    return;
+  }
+  if (!isTestingActive) {
+    testStatus.textContent = `状态：已选择${testLabels[currentTestType]}（强度 ${intensity}%，点击“开始测试”生效）`;
+    return;
+  }
+  testStatus.textContent = `状态：测试中 - ${testLabels[currentTestType]}（强度 ${intensity}%）`;
+};
+
+const getRenderState = (block) => {
+  if (!isTestingActive) {
+    return { x: block.x, y: block.y, angle: block.rotation };
+  }
+  const body = testBodyMap.get(block.id);
+  if (!body) return { x: block.x, y: block.y, angle: block.rotation };
+  return { x: body.position.x, y: body.position.y, angle: body.angle };
+};
+
+const drawBlock = (block, isSelected) => {
+  const { width, height } = block;
+  const { fill, stroke } = materials[block.material];
+  const state = getRenderState(block);
+
+  ctx.save();
+  ctx.translate(state.x, state.y);
+  ctx.rotate(state.angle);
+
+  ctx.fillStyle = fill;
+  ctx.strokeStyle = stroke;
+  ctx.lineWidth = 2;
+  ctx.fillRect(-width / 2, -height / 2, width, height);
+  ctx.strokeRect(-width / 2, -height / 2, width, height);
+
+  if (isSelected && !isTestingActive) {
+    ctx.strokeStyle = "#ff9800";
+    ctx.lineWidth = 3;
+    ctx.strokeRect(-width / 2 - 4, -height / 2 - 4, width + 8, height + 8);
+  }
+
+  ctx.restore();
+};
+
+const render = () => {
+  ctx.clearRect(0, 0, canvas.width, canvas.height);
+  blocks.forEach((block) => drawBlock(block, block.id === selectedId));
+};
+
+const syncDimensionLabels = () => {
+  widthValue.textContent = widthSlider.value;
+  heightValue.textContent = heightSlider.value;
+  rotationValue.textContent = `${rotationSlider.value}°`;
+};
+
+const applyPresetSize = () => {
+  if (sizeSelect.value === "custom") return;
+  const preset = sizeOptions[sizeSelect.value];
+  if (!preset) return;
+  widthSlider.value = String(preset.width);
+  heightSlider.value = String(preset.height);
+  syncDimensionLabels();
+};
+
+const syncControlsFromSelection = () => {
+  const block = getSelectedBlock();
+  if (!block) return;
+  widthSlider.value = String(Math.round(block.width / GRID_SIZE) * GRID_SIZE);
+  heightSlider.value = String(Math.round(block.height / GRID_SIZE) * GRID_SIZE);
+  rotationSlider.value = String(Math.round((normalizeAngle(block.rotation) * 180) / Math.PI));
+  sizeSelect.value = "custom";
+  syncDimensionLabels();
+};
+
+const applySlidersToSelectedBlock = () => {
+  const block = getSelectedBlock();
+  if (!block || isTestingActive) return;
+  block.width = Number(widthSlider.value);
+  block.height = Number(heightSlider.value);
+  block.rotation = (Number(rotationSlider.value) * Math.PI) / 180;
+  sizeSelect.value = "custom";
+  settleBuildWorld();
+};
+
+const createBlock = (x, y) => {
+  const baseWidth = Number(widthSlider.value);
+  const baseHeight = Number(heightSlider.value);
+  const isVertical = verticalToggle.checked;
+  const width = isVertical ? baseHeight : baseWidth;
+  const height = isVertical ? baseWidth : baseHeight;
+  const rotation = (Number(rotationSlider.value) * Math.PI) / 180;
+  const footprint = getFootprintSize({ width, height, rotation });
+
+  const block = {
+    id: crypto.randomUUID(),
+    x: clamp(snap(x), footprint.width / 2, canvas.width - footprint.width / 2),
+    y: snap(y),
+    width,
+    height,
+    rotation,
+    material: materialSelect.value,
+  };
+
+  blocks.push(block);
+  selectedId = block.id;
+  syncControlsFromSelection();
+  settleBuildWorld();
+};
+
+const findBlockAt = (x, y) => {
+  for (let i = blocks.length - 1; i >= 0; i -= 1) {
+    const block = blocks[i];
+    const dx = x - block.x;
+    const dy = y - block.y;
+    const angle = -block.rotation;
+    const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
+    const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
+    if (Math.abs(localX) <= block.width / 2 && Math.abs(localY) <= block.height / 2) {
+      return block;
+    }
+  }
+  return null;
+};
+
+const getCanvasPoint = (event) => {
+  const rect = canvas.getBoundingClientRect();
+  return {
+    x: event.clientX - rect.left,
+    y: event.clientY - rect.top,
+  };
+};
+
+const computeOverlapLength = (bodyA, bodyB) => {
+  const overlapX = Math.min(bodyA.bounds.max.x, bodyB.bounds.max.x) - Math.max(bodyA.bounds.min.x, bodyB.bounds.min.x);
+  const overlapY = Math.min(bodyA.bounds.max.y, bodyB.bounds.max.y) - Math.max(bodyA.bounds.min.y, bodyB.bounds.min.y);
+  if (overlapX <= 0 || overlapY <= 0) return 0;
+  return Math.max(Math.min(overlapX, 120), Math.min(overlapY, 120));
+};
+
+const createAdhesionConstraintsForPair = (bodyA, bodyB, contact, normal, overlapLength) => {
+  const tangent = Vector.perp(normal);
+  const unitTangent = Vector.normalise(tangent);
+  const offset = clamp(overlapLength * 0.2, 4, 20);
+  const stiffness = clamp(0.0012 + overlapLength * 0.00005, 0.0012, 0.0065);
+
+  const points = [
+    contact,
+    Vector.add(contact, Vector.mult(unitTangent, offset)),
+    Vector.sub(contact, Vector.mult(unitTangent, offset)),
+  ];
+
+  return points.map((point) => Constraint.create({
+    bodyA,
+    bodyB,
+    pointA: Vector.sub(point, bodyA.position),
+    pointB: Vector.sub(point, bodyB.position),
+    length: 0,
+    stiffness,
+    damping: 0.08,
+  }));
+};
+
+const clearTestWorld = () => {
+  if (!testEngine) return;
+  adhesiveLinks.forEach((link) => link.constraints.forEach((constraint) => World.remove(testEngine.world, constraint)));
+  adhesiveLinks = [];
+  testBodies = [];
+  testBodyMap = new Map();
+  testEngine = null;
+};
+
+const createTestWorld = () => {
+  testEngine = Engine.create({ gravity: { x: 0, y: 1 } });
+
+  const boundary = 100;
+  World.add(testEngine.world, [
+    Bodies.rectangle(canvas.width / 2, canvas.height + boundary / 2, canvas.width + boundary * 2, boundary, { isStatic: true }),
+    Bodies.rectangle(-boundary / 2, canvas.height / 2, boundary, canvas.height * 2, { isStatic: true }),
+    Bodies.rectangle(canvas.width + boundary / 2, canvas.height / 2, boundary, canvas.height * 2, { isStatic: true }),
+  ]);
+
+  testBodies = blocks.map((block) => {
+    const body = Bodies.rectangle(block.x, block.y, block.width, block.height, {
+      angle: block.rotation,
+      density: materials[block.material].density,
+      friction: materials[block.material].friction,
+      restitution: materials[block.material].restitution,
+      frictionAir: 0.02,
+    });
+    return { id: block.id, body };
+  });
+
+  testBodyMap = new Map(testBodies.map((item) => [item.id, item.body]));
+  World.add(testEngine.world, testBodies.map((item) => item.body));
+
+  adhesiveLinks = [];
+  for (let i = 0; i < testBodies.length; i += 1) {
+    for (let j = i + 1; j < testBodies.length; j += 1) {
+      const bodyA = testBodies[i].body;
+      const bodyB = testBodies[j].body;
+      const collision = Collision.collides(bodyA, bodyB);
+      if (!collision || !collision.collided) continue;
+
+      const overlapLength = computeOverlapLength(bodyA, bodyB);
+      if (overlapLength < 6) continue;
+
+      const contact = collision.supports?.[0]
+        ? { x: collision.supports[0].x, y: collision.supports[0].y }
+        : { x: (bodyA.position.x + bodyB.position.x) / 2, y: (bodyA.position.y + bodyB.position.y) / 2 };
+
+      const fallbackNormal = Vector.normalise(Vector.sub(bodyB.position, bodyA.position));
+      const normal = collision.normal && (collision.normal.x !== 0 || collision.normal.y !== 0)
+        ? collision.normal
+        : (fallbackNormal.x === 0 && fallbackNormal.y === 0 ? { x: 1, y: 0 } : fallbackNormal);
+
+      const constraints = createAdhesionConstraintsForPair(bodyA, bodyB, contact, normal, overlapLength);
+      World.add(testEngine.world, constraints);
+      adhesiveLinks.push({ bodyA, bodyB, constraints });
+    }
+  }
+};
+
+const updateAdhesionLinks = () => {
+  if (!testEngine) return;
+  adhesiveLinks = adhesiveLinks.filter((link) => {
+    const overlapX = Math.min(link.bodyA.bounds.max.x, link.bodyB.bounds.max.x) - Math.max(link.bodyA.bounds.min.x, link.bodyB.bounds.min.x);
+    const overlapY = Math.min(link.bodyA.bounds.max.y, link.bodyB.bounds.max.y) - Math.max(link.bodyA.bounds.min.y, link.bodyB.bounds.min.y);
+    if (overlapX <= 0 || overlapY <= 0) {
+      link.constraints.forEach((constraint) => World.remove(testEngine.world, constraint));
+      return false;
+    }
+    return true;
+  });
+};
+
+const snapshotBeforeTest = () => {
+  preTestSnapshot = {
+    selectedId,
+    isPlaceArmed,
+    currentTestType,
+    intensity: Number(testProgress.value),
+    blocks: blocks.map((block) => ({ ...block })),
+  };
+};
+
+const restoreSnapshot = () => {
+  if (!preTestSnapshot) return;
+  blocks.length = 0;
+  preTestSnapshot.blocks.forEach((block) => blocks.push({ ...block }));
+  selectedId = preTestSnapshot.selectedId;
+  draggedId = null;
+  isPlaceArmed = preTestSnapshot.isPlaceArmed;
+  currentTestType = preTestSnapshot.currentTestType;
+  testProgress.value = preTestSnapshot.intensity;
+  updateTestButtonState();
+};
+
+const startTesting = () => {
+  if (isTestingActive || !currentTestType || blocks.length === 0) return;
+  snapshotBeforeTest();
+  createTestWorld();
+  isTestingActive = true;
+  draggedId = null;
+  updateBuildControlsState();
+  updatePlaceArmUI();
+  updateTestStatus();
+};
+
+const restoreState = () => {
+  if (!preTestSnapshot) return;
+  isTestingActive = false;
+  clearTestWorld();
+  restoreSnapshot();
+  updateBuildControlsState();
+  updatePlaceArmUI();
+  updateTestStatus();
+};
+
+const applyTestForces = () => {
+  if (!isTestingActive || !currentTestType || !testEngine) return;
+
+  testEngine.gravity.x = 0;
+  testEngine.gravity.y = 1;
+  updateAdhesionLinks();
+
+  const strength = getIntensityRatio();
+  if (strength <= 0) return;
+  const elapsed = performance.now();
+
+  if (currentTestType === "heavy") {
+    const topLine = canvas.height * 0.4;
+    testBodies.forEach(({ body }) => {
+      if (body.position.y > topLine) return;
+      Body.applyForce(body, body.position, { x: 0, y: 0.0042 * strength * body.mass });
+    });
+  }
+
+  if (currentTestType === "wind") {
+    const base = (0.00025 + Math.sin(elapsed / 250) * 0.00008) * strength;
+    testBodies.forEach(({ body }) => {
+      const heightFactor = 1 + (1 - body.position.y / canvas.height) * 0.5;
+      Body.applyForce(body, body.position, { x: base * heightFactor * body.mass, y: 0 });
+    });
+  }
+
+  if (currentTestType === "quake") {
+    testEngine.gravity.x = Math.sin(elapsed / 90) * 0.22 * strength;
+    testEngine.gravity.y = 1 + Math.sin(elapsed / 120) * 0.1 * strength;
+    testBodies.forEach(({ body }) => {
+      Body.applyForce(body, body.position, {
+        x: Math.sin(elapsed / 58) * 0.00075 * strength * body.mass,
+        y: Math.cos(elapsed / 72) * 0.00045 * strength * body.mass,
+      });
+    });
+  }
+};
+
+canvas.addEventListener("pointerdown", (event) => {
+  if (isTestingActive) return;
+  event.preventDefault();
+
+  const { x, y } = getCanvasPoint(event);
+  const found = findBlockAt(x, y);
+
+  if (found) {
+    selectedId = found.id;
+    syncControlsFromSelection();
+    draggedId = found.id;
+    dragOffset = { x: found.x - x, y: found.y - y };
+    canvas.setPointerCapture(event.pointerId);
+    return;
+  }
+
+  if (isPlaceArmed) createBlock(x, y);
+});
+
+canvas.addEventListener("pointermove", (event) => {
+  if (isTestingActive || !draggedId) return;
+  const block = getDraggedBlock();
+  if (!block) return;
+
+  const { x, y } = getCanvasPoint(event);
+  const nx = snap(x + dragOffset.x);
+  const ny = snap(y + dragOffset.y);
+  const footprint = getFootprintSize(block);
+  const halfWidth = footprint.width / 2;
+
+  block.x = clamp(nx, halfWidth, canvas.width - halfWidth);
+  block.y = ny;
+  settleBuildWorld();
+});
+
+const finishDrag = (event) => {
+  if (!draggedId) return;
+  if (event?.pointerId !== undefined && canvas.hasPointerCapture(event.pointerId)) {
+    canvas.releasePointerCapture(event.pointerId);
+  }
+  draggedId = null;
+};
+
+canvas.addEventListener("pointerup", finishDrag);
+canvas.addEventListener("pointercancel", finishDrag);
+canvas.addEventListener("pointerleave", finishDrag);
+
+armPlaceButton.addEventListener("click", () => {
+  if (isTestingActive) return;
+  isPlaceArmed = !isPlaceArmed;
+  updatePlaceArmUI();
+});
+
+rotateButton.addEventListener("click", () => {
+  if (isTestingActive) return;
+  const block = getSelectedBlock();
+  if (!block) return;
+  block.rotation = normalizeAngle(block.rotation + ROTATE_STEP_RAD);
+  rotationSlider.value = String(Math.round((block.rotation * 180) / Math.PI));
+  rotationValue.textContent = `${rotationSlider.value}°`;
+  settleBuildWorld();
+});
+
+deleteButton.addEventListener("click", () => {
+  if (isTestingActive || !selectedId) return;
+  const index = blocks.findIndex((block) => block.id === selectedId);
+  if (index < 0) return;
+  blocks.splice(index, 1);
+  selectedId = null;
+});
+
+clearButton.addEventListener("click", () => {
+  if (isTestingActive) return;
+  blocks.length = 0;
+  selectedId = null;
+  draggedId = null;
+  currentTestType = null;
+  testProgress.value = 0;
+  updateTestButtonState();
+  updateTestStatus();
+});
+
+const selectTest = (type) => {
+  currentTestType = type;
+  updateTestButtonState();
+  updateTestStatus();
+};
+
+heavyButton.addEventListener("click", () => selectTest("heavy"));
+windButton.addEventListener("click", () => selectTest("wind"));
+quakeButton.addEventListener("click", () => selectTest("quake"));
+startButton.addEventListener("click", startTesting);
+restoreButton.addEventListener("click", restoreState);
+
+testProgress.addEventListener("input", updateTestStatus);
+sizeSelect.addEventListener("change", () => {
+  applyPresetSize();
+  applySlidersToSelectedBlock();
+});
+
+[widthSlider, heightSlider, rotationSlider].forEach((slider) => {
+  slider.addEventListener("input", () => {
+    syncDimensionLabels();
+    applySlidersToSelectedBlock();
+  });
+});
+
+
+window.addEventListener("keydown", (event) => {
+  if (isTestingActive) return;
+  const block = getSelectedBlock();
+  if (!block) return;
+
+  if (event.key === "Delete" || event.key === "Backspace") {
+    event.preventDefault();
+    deleteButton.click();
+    return;
+  }
+
+  if (event.key.toLowerCase() === "r") {
+    event.preventDefault();
+    rotateButton.click();
+    return;
+  }
+
+  const step = event.shiftKey ? GRID_SIZE * 2 : GRID_SIZE;
+
+  switch (event.key) {
+    case "ArrowUp":
+      block.y = snap(block.y - step);
+      break;
+    case "ArrowDown":
+      block.y = snap(block.y + step);
+      break;
+    case "ArrowLeft":
+      {
+        const footprint = getFootprintSize(block);
+        block.x = clamp(snap(block.x - step), footprint.width / 2, canvas.width - footprint.width / 2);
+      }
+      break;
+    case "ArrowRight":
+      {
+        const footprint = getFootprintSize(block);
+        block.x = clamp(snap(block.x + step), footprint.width / 2, canvas.width - footprint.width / 2);
+      }
+      break;
+    default:
+      return;
+  }
+
+  event.preventDefault();
+  settleBuildWorld();
+});
+
+const tick = () => {
+  settleBuildWorld();
+  applyTestForces();
+  if (isTestingActive && testEngine) {
+    Engine.update(testEngine, 1000 / 60);
+  }
+  render();
+  animationFrame = requestAnimationFrame(tick);
+};
+
+applyPresetSize();
+syncDimensionLabels();
+updateBuildControlsState();
+updateTestButtonState();
+updatePlaceArmUI();
+updateTestStatus();
+if (animationFrame) cancelAnimationFrame(animationFrame);
+animationFrame = requestAnimationFrame(tick);
