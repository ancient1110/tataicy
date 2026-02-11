const canvas = document.getElementById("editor");
const ctx = canvas.getContext("2d");

const materialSelect = document.getElementById("material");
const sizeSelect = document.getElementById("size");
const verticalToggle = document.getElementById("vertical");
const armPlaceButton = document.getElementById("arm-place");
const rotateButton = document.getElementById("rotate");
const deleteButton = document.getElementById("delete");
const clearButton = document.getElementById("clear");
const hint = document.getElementById("hint");

const heavyButton = document.getElementById("test-heavy");
const windButton = document.getElementById("test-wind");
const quakeButton = document.getElementById("test-quake");
const stopButton = document.getElementById("test-stop");
const testProgress = document.getElementById("test-progress");
const testStatus = document.getElementById("test-status");

const { Engine, World, Bodies, Body, Query } = Matter;

const GRID_SIZE = 10;

const materials = {
  wood: { fill: "#c58b4a", stroke: "#8d5a24", density: 0.0012, friction: 0.7, restitution: 0.1 },
  stone: { fill: "#8f98a3", stroke: "#5f6b7a", density: 0.003, friction: 0.9, restitution: 0.02 },
  glass: { fill: "#dff4ff", stroke: "#7cc0df", density: 0.0017, friction: 0.18, restitution: 0.08 },
};

const sizeOptions = {
  small: { width: 40, height: 20 },
  medium: { width: 80, height: 20 },
  large: { width: 120, height: 20 },
};

const testLabels = {
  heavy: "重物冲击测试",
  wind: "风力扰动测试",
  quake: "地震摇晃测试",
};

const engine = Engine.create({ gravity: { x: 0, y: 1 } });
const { world } = engine;

const boundaryThickness = 100;
World.add(world, [
  Bodies.rectangle(canvas.width / 2, canvas.height + boundaryThickness / 2, canvas.width + boundaryThickness * 2, boundaryThickness, { isStatic: true }),
  Bodies.rectangle(-boundaryThickness / 2, canvas.height / 2, boundaryThickness, canvas.height * 2, { isStatic: true }),
  Bodies.rectangle(canvas.width + boundaryThickness / 2, canvas.height / 2, boundaryThickness, canvas.height * 2, { isStatic: true }),
]);

const blocks = [];
let selectedId = null;
let draggedId = null;
let dragOffset = { x: 0, y: 0 };
let animationFrame = null;
let currentTestType = null;
let isPlaceArmed = false;

const snap = (value) => Math.round(value / GRID_SIZE) * GRID_SIZE;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const getIntensityRatio = () => Number(testProgress.value) / 100;

const getSelectedBlock = () => blocks.find((block) => block.id === selectedId) || null;
const getDraggedBlock = () => blocks.find((block) => block.id === draggedId) || null;

const updatePlaceArmUI = () => {
  armPlaceButton.classList.toggle("armed", isPlaceArmed);
  armPlaceButton.textContent = isPlaceArmed ? "放置模式（点击退出）" : "加载组件";
  hint.textContent = isPlaceArmed
    ? "放置模式：可持续点击空白处放置组件；再次点击“放置模式”按钮可退出。"
    : "先点击“加载组件”进入放置模式；再次点击可退出。放置模式下可持续点击空白处放置组件。";
};

const updateTestStatus = () => {
  const intensity = Number(testProgress.value);
  if (!currentTestType || intensity === 0) {
    testStatus.textContent = `状态：待机（强度 ${intensity}%）`;
    return;
  }

  testStatus.textContent = `状态：${testLabels[currentTestType]}（强度 ${intensity}%）`;
};

const resetWorldGravity = () => {
  engine.gravity.x = 0;
  engine.gravity.y = 1;
};

const applyTestForces = () => {
  resetWorldGravity();
  if (!currentTestType) return;

  const strength = getIntensityRatio();
  if (strength <= 0) return;

  const elapsed = performance.now();

  if (currentTestType === "heavy") {
    const topLine = canvas.height * 0.4;
    blocks.forEach((block) => {
      if (block.id === draggedId || block.body.position.y > topLine) return;
      Body.applyForce(block.body, block.body.position, { x: 0, y: 0.0042 * strength * block.body.mass });
    });
  }

  if (currentTestType === "wind") {
    const base = (0.00025 + Math.sin(elapsed / 250) * 0.00008) * strength;
    blocks.forEach((block) => {
      if (block.id === draggedId) return;
      const heightFactor = 1 + (1 - block.body.position.y / canvas.height) * 0.5;
      Body.applyForce(block.body, block.body.position, { x: base * heightFactor * block.body.mass, y: 0 });
    });
  }

  if (currentTestType === "quake") {
    engine.gravity.x = Math.sin(elapsed / 90) * 0.22 * strength;
    engine.gravity.y = 1 + Math.sin(elapsed / 120) * 0.1 * strength;

    blocks.forEach((block) => {
      if (block.id === draggedId) return;
      Body.applyForce(block.body, block.body.position, {
        x: Math.sin(elapsed / 58) * 0.00075 * strength * block.body.mass,
        y: Math.cos(elapsed / 72) * 0.00045 * strength * block.body.mass,
      });
    });
  }
};

const drawBlock = (block, isSelected) => {
  const { body, width, height } = block;
  const { fill, stroke } = materials[block.material];

  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);

  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.fillRect(-width / 2, -height / 2, width, height);
  ctx.strokeRect(-width / 2, -height / 2, width, height);

  if (isSelected) {
    ctx.strokeStyle = "#ff9800";
    ctx.lineWidth = 3;
    ctx.strokeRect(-width / 2 - 4, -height / 2 - 4, width + 8, height + 8);
  }

  ctx.restore();
};

const render = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  blocks.forEach((block) => drawBlock(block, block.id === selectedId));
};

const createBlock = (x, y) => {
  const size = sizeOptions[sizeSelect.value];
  const isVertical = verticalToggle.checked;
  const width = isVertical ? size.height : size.width;
  const height = isVertical ? size.width : size.height;

  const halfWidth = width / 2;
  const px = clamp(snap(x), halfWidth, canvas.width - halfWidth);
  const py = snap(y);

  const material = materialSelect.value;
  const body = Bodies.rectangle(px, py, width, height, {
    density: materials[material].density,
    friction: materials[material].friction,
    restitution: materials[material].restitution,
    frictionAir: 0.02,
  });

  const block = {
    id: crypto.randomUUID(),
    material,
    width,
    height,
    body,
  };

  blocks.push(block);
  World.add(world, body);
  selectedId = block.id;
};

const findBlockAt = (x, y) => {
  const hit = Query.point(
    blocks.map((block) => block.body),
    { x, y },
  )[0];
  if (!hit) return null;
  return blocks.find((block) => block.body === hit) || null;
};

const getCanvasPoint = (event) => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
};

const resetBodyMotion = (body) => {
  Body.setVelocity(body, { x: 0, y: 0 });
  Body.setAngularVelocity(body, 0);
};

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  const { x, y } = getCanvasPoint(event);
  const found = findBlockAt(x, y);

  if (found) {
    selectedId = found.id;
    draggedId = found.id;
    dragOffset = { x: found.body.position.x - x, y: found.body.position.y - y };
    Body.setStatic(found.body, true);
    resetBodyMotion(found.body);
    canvas.setPointerCapture(event.pointerId);
    return;
  }

  if (isPlaceArmed) {
    createBlock(x, y);
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (!draggedId) return;
  const block = getDraggedBlock();
  if (!block) return;

  const { x, y } = getCanvasPoint(event);
  const nx = snap(x + dragOffset.x);
  const ny = snap(y + dragOffset.y);

  const bounds = block.body.bounds;
  const halfWidth = (bounds.max.x - bounds.min.x) / 2;
  const clampedX = clamp(nx, halfWidth, canvas.width - halfWidth);

  Body.setPosition(block.body, { x: clampedX, y: ny });
  resetBodyMotion(block.body);
});

const finishDrag = (event) => {
  if (!draggedId) return;
  const block = getDraggedBlock();
  if (block) {
    Body.setStatic(block.body, false);
    resetBodyMotion(block.body);
  }

  if (event?.pointerId !== undefined && canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  draggedId = null;
};

canvas.addEventListener("pointerup", finishDrag);
canvas.addEventListener("pointercancel", finishDrag);
canvas.addEventListener("pointerleave", finishDrag);

armPlaceButton.addEventListener("click", () => {
  isPlaceArmed = !isPlaceArmed;
  updatePlaceArmUI();
});

rotateButton.addEventListener("click", () => {
  const block = getSelectedBlock();
  if (!block) return;
  Body.rotate(block.body, Math.PI / 2);
  resetBodyMotion(block.body);
});

deleteButton.addEventListener("click", () => {
  if (!selectedId) return;
  const index = blocks.findIndex((block) => block.id === selectedId);
  if (index < 0) return;

  World.remove(world, blocks[index].body);
  blocks.splice(index, 1);
  selectedId = null;
});

clearButton.addEventListener("click", () => {
  blocks.forEach((block) => World.remove(world, block.body));
  blocks.length = 0;
  selectedId = null;
  draggedId = null;
  currentTestType = null;
  testProgress.value = 0;
  resetWorldGravity();
  updateTestStatus();
});

const startTest = (type) => {
  currentTestType = type;
  updateTestStatus();
};

heavyButton.addEventListener("click", () => startTest("heavy"));
windButton.addEventListener("click", () => startTest("wind"));
quakeButton.addEventListener("click", () => startTest("quake"));
stopButton.addEventListener("click", () => {
  currentTestType = null;
  resetWorldGravity();
  updateTestStatus();
});

testProgress.addEventListener("input", updateTestStatus);

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
  const { x, y } = block.body.position;
  let nextX = x;
  let nextY = y;

  switch (event.key) {
    case "ArrowUp":
      nextY -= step;
      break;
    case "ArrowDown":
      nextY += step;
      break;
    case "ArrowLeft":
      nextX -= step;
      break;
    case "ArrowRight":
      nextX += step;
      break;
    default:
      return;
  }

  const bounds = block.body.bounds;
  const halfWidth = (bounds.max.x - bounds.min.x) / 2;

  Body.setPosition(block.body, {
    x: clamp(snap(nextX), halfWidth, canvas.width - halfWidth),
    y: snap(nextY),
  });
  resetBodyMotion(block.body);
  event.preventDefault();
});

const tick = () => {
  applyTestForces();
  Engine.update(engine, 1000 / 60);
  render();
  animationFrame = requestAnimationFrame(tick);
};

updatePlaceArmUI();
updateTestStatus();
if (animationFrame) cancelAnimationFrame(animationFrame);
animationFrame = requestAnimationFrame(tick);
