const canvas = document.getElementById("editor");
const ctx = canvas.getContext("2d");

const materialSelect = document.getElementById("material");
const sizeSelect = document.getElementById("size");
const verticalToggle = document.getElementById("vertical");
const rotateButton = document.getElementById("rotate");
const deleteButton = document.getElementById("delete");
const clearButton = document.getElementById("clear");

const heavyButton = document.getElementById("test-heavy");
const windButton = document.getElementById("test-wind");
const quakeButton = document.getElementById("test-quake");
const stopButton = document.getElementById("test-stop");
const testProgress = document.getElementById("test-progress");
const testStatus = document.getElementById("test-status");

const GRID_SIZE = 10;
const GRAVITY = 0.6;
const MAX_FALL_SPEED = 18;
const AIR_DRAG = 0.96;
const TEST_DURATION_MS = 10000;

const materials = {
  wood: { fill: "#c58b4a", stroke: "#8d5a24" },
  stone: { fill: "#8f98a3", stroke: "#5f6b7a" },
  ice: { fill: "#b9e8ff", stroke: "#6bbce3" },
};

const sizeOptions = {
  small: { width: 40, height: 20 },
  medium: { width: 80, height: 20 },
  large: { width: 120, height: 20 },
};

const blocks = [];
let selectedId = null;
let draggedId = null;
let dragOffset = { x: 0, y: 0 };
let animationFrame = null;

let currentTest = null;

const snap = (value) => Math.round(value / GRID_SIZE) * GRID_SIZE;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getSelectedBlock = () => blocks.find((block) => block.id === selectedId) || null;
const getDraggedBlock = () => blocks.find((block) => block.id === draggedId) || null;

const getPhysicsSize = (block) => {
  const normalized = ((block.rotation % 360) + 360) % 360;
  const swap = normalized === 90 || normalized === 270;
  return {
    width: swap ? block.height : block.width,
    height: swap ? block.width : block.height,
  };
};

const drawBackground = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};

const drawBlock = (block, isSelected) => {
  ctx.save();
  ctx.translate(block.x, block.y);
  ctx.rotate((block.rotation * Math.PI) / 180);

  ctx.fillStyle = materials[block.material].fill;
  ctx.strokeStyle = materials[block.material].stroke;
  ctx.lineWidth = 2;
  ctx.fillRect(-block.width / 2, -block.height / 2, block.width, block.height);
  ctx.strokeRect(-block.width / 2, -block.height / 2, block.width, block.height);

  if (isSelected) {
    // 选中框与方块一起旋转，不再保持轴对齐。
    ctx.strokeStyle = "#ff9800";
    ctx.lineWidth = 3;
    ctx.strokeRect(-block.width / 2 - 4, -block.height / 2 - 4, block.width + 8, block.height + 8);
  }

  ctx.restore();
};

const render = () => {
  drawBackground();
  blocks.forEach((block) => drawBlock(block, block.id === selectedId));
};

const overlapsHorizontally = (a, b) => {
  const aSize = getPhysicsSize(a);
  const bSize = getPhysicsSize(b);
  return Math.abs(a.x - b.x) < aSize.width / 2 + bSize.width / 2;
};

const updateTestStatus = () => {
  if (!currentTest) {
    testStatus.textContent = "状态：待机";
    testProgress.value = 0;
    return;
  }
  const elapsed = performance.now() - currentTest.startedAt;
  const percent = clamp((elapsed / currentTest.durationMs) * 100, 0, 100);
  testProgress.value = percent;
  testStatus.textContent = `状态：${currentTest.label}（${percent.toFixed(0)}%）`;

  if (elapsed >= currentTest.durationMs) {
    currentTest = null;
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
  if (!currentTest) return;

  const elapsed = performance.now() - currentTest.startedAt;

  if (currentTest.type === "heavy") {
    // 模拟重物周期性压顶：对顶部构件施加向下冲击。
    const topThreshold = canvas.height * 0.45;
    if (Math.floor(elapsed / 240) % 2 === 0) {
      blocks.forEach((block) => {
        if (block.y < topThreshold && block.id !== draggedId) {
          block.vy += 0.9;
        }
      });
    }
  }

  if (currentTest.type === "wind") {
    // 模拟阵风：横向持续推力，叠加轻微摆动。
    const gust = 0.22 + Math.sin(elapsed / 180) * 0.08;
    blocks.forEach((block) => {
      if (block.id !== draggedId) {
        block.vx += gust;
      }
    });
  }

  if (currentTest.type === "quake") {
    // 模拟地震：左右快速震动。
    const shake = Math.sin(elapsed / 60) * 0.9;
    blocks.forEach((block) => {
      if (block.id !== draggedId) {
        block.vx += shake;
      }
    });
  }
};

const applyPhysics = () => {
  const groundY = canvas.height - GRID_SIZE;

  blocks.forEach((block) => {
    if (block.id === draggedId) {
      block.vx = 0;
      block.vy = 0;
      return;
    }

    const size = getPhysicsSize(block);
    const halfHeight = size.height / 2;
    const halfWidth = size.width / 2;

    const leftBound = halfWidth;
    const rightBound = canvas.width - halfWidth;

    const previousY = block.y;
    const previousBottom = previousY + halfHeight;

    block.vx *= AIR_DRAG;
    block.x += block.vx;
    block.x = clamp(block.x, leftBound, rightBound);

    block.vy = Math.min(block.vy + GRAVITY, MAX_FALL_SPEED);
    block.y += block.vy;

    let landingY = groundY - halfHeight;
    const nextBottom = block.y + halfHeight;

    blocks.forEach((other) => {
      if (other.id === block.id || other.id === draggedId) return;
      if (!overlapsHorizontally(block, other)) return;

      const otherSize = getPhysicsSize(other);
      const otherTop = other.y - otherSize.height / 2;

      const crossedTop = previousBottom <= otherTop && nextBottom >= otherTop;
      const overlappingFromAbove = nextBottom > otherTop && block.y <= other.y;

      if (crossedTop || overlappingFromAbove) {
        landingY = Math.min(landingY, otherTop - halfHeight);
      }
    });

    if (block.y > landingY) {
      block.y = landingY;
      block.vy = 0;
      block.vx *= 0.9;
    }

    block.x = snap(block.x);
  });
};

const tick = () => {
  applyTestForces();
  applyPhysics();
  updateTestStatus();
  render();
  animationFrame = requestAnimationFrame(tick);
};

const createBlock = (x, y) => {
  const size = sizeOptions[sizeSelect.value];
  const isVertical = verticalToggle.checked;
  const width = isVertical ? size.height : size.width;
  const height = isVertical ? size.width : size.height;
  const halfWidth = width / 2;

  const block = {
    id: crypto.randomUUID(),
    x: clamp(snap(x), halfWidth, canvas.width - halfWidth),
    y: snap(y),
    width,
    height,
    material: materialSelect.value,
    rotation: 0,
    vx: 0,
    vy: 0,
  };

  blocks.push(block);
  selectedId = block.id;
};

const findBlockAt = (x, y) => {
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = blocks[i];
    const dx = x - block.x;
    const dy = y - block.y;
    const angle = (-block.rotation * Math.PI) / 180;
    const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
    const localY = dx * Math.sin(angle) + dy * Math.cos(angle);

    if (Math.abs(localX) <= block.width / 2 && Math.abs(localY) <= block.height / 2) {
      return block;
    }
  }
  return null;
};

const getCanvasPoint = (event) => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
};

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  const { x, y } = getCanvasPoint(event);
  const found = findBlockAt(x, y);

  if (found) {
    selectedId = found.id;
    draggedId = found.id;
    dragOffset = { x: found.x - x, y: found.y - y };
    canvas.setPointerCapture(event.pointerId);
  } else {
    createBlock(x, y);
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (!draggedId) return;
  const block = getDraggedBlock();
  if (!block) return;

  const { x, y } = getCanvasPoint(event);
  const { width } = getPhysicsSize(block);
  const halfWidth = width / 2;

  block.x = clamp(snap(x + dragOffset.x), halfWidth, canvas.width - halfWidth);
  block.y = snap(y + dragOffset.y);
  block.vx = 0;
  block.vy = 0;
});

const finishDrag = (event) => {
  if (!draggedId) return;
  if (event?.pointerId !== undefined && canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
  draggedId = null;
};

canvas.addEventListener("pointerup", finishDrag);
canvas.addEventListener("pointercancel", finishDrag);
canvas.addEventListener("pointerleave", finishDrag);

rotateButton.addEventListener("click", () => {
  const block = getSelectedBlock();
  if (!block) return;
  block.rotation = (block.rotation + 90) % 360;
});

deleteButton.addEventListener("click", () => {
  if (!selectedId) return;
  const index = blocks.findIndex((block) => block.id === selectedId);
  if (index >= 0) {
    blocks.splice(index, 1);
    selectedId = null;
  }
});

clearButton.addEventListener("click", () => {
  blocks.length = 0;
  selectedId = null;
  draggedId = null;
  currentTest = null;
  updateTestStatus();
});

heavyButton.addEventListener("click", () => startTest("heavy", "重物冲击测试"));
windButton.addEventListener("click", () => startTest("wind", "风力扰动测试"));
quakeButton.addEventListener("click", () => startTest("quake", "地震摇晃测试"));
stopButton.addEventListener("click", () => {
  currentTest = null;
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
  const size = getPhysicsSize(block);

  switch (event.key) {
    case "ArrowUp":
      block.y = snap(block.y - step);
      block.vy = 0;
      break;
    case "ArrowDown":
      block.y = snap(block.y + step);
      block.vy = 0;
      break;
    case "ArrowLeft":
      block.x = clamp(snap(block.x - step), size.width / 2, canvas.width - size.width / 2);
      block.vx = 0;
      break;
    case "ArrowRight":
      block.x = clamp(snap(block.x + step), size.width / 2, canvas.width - size.width / 2);
      block.vx = 0;
      break;
    default:
      return;
  }

  event.preventDefault();
});

updateTestStatus();
if (animationFrame) cancelAnimationFrame(animationFrame);
animationFrame = requestAnimationFrame(tick);
