const canvas = document.getElementById("editor");
const ctx = canvas.getContext("2d");

const materialSelect = document.getElementById("material");
const sizeSelect = document.getElementById("size");
const verticalToggle = document.getElementById("vertical");
const rotateButton = document.getElementById("rotate");
const deleteButton = document.getElementById("delete");
const clearButton = document.getElementById("clear");

const GRID_SIZE = 10;
const GRAVITY = 0.6;
const MAX_FALL_SPEED = 18;

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

const snap = (value) => Math.round(value / GRID_SIZE) * GRID_SIZE;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getSelectedBlock = () => blocks.find((block) => block.id === selectedId) || null;
const getDraggedBlock = () => blocks.find((block) => block.id === draggedId) || null;

const getPhysicsSize = (block) => {
  // 旋转 90°/270° 时，碰撞包围盒宽高互换，避免竖放/旋转时穿模。
  const quarterTurns = ((block.rotation % 360) + 360) % 360;
  const swap = quarterTurns === 90 || quarterTurns === 270;
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
    const { width: pWidth, height: pHeight } = getPhysicsSize(block);
    ctx.strokeStyle = "#ff9800";
    ctx.lineWidth = 3;
    ctx.strokeRect(-pWidth / 2 - 4, -pHeight / 2 - 4, pWidth + 8, pHeight + 8);
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

const applyGravity = () => {
  const groundY = canvas.height - GRID_SIZE;

  blocks.forEach((block) => {
    if (block.id === draggedId) {
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

    block.vy = Math.min(block.vy + GRAVITY, MAX_FALL_SPEED);
    block.y += block.vy;
    block.x = clamp(snap(block.x), leftBound, rightBound);

    let landingY = groundY - halfHeight;
    const nextBottom = block.y + halfHeight;

    blocks.forEach((other) => {
      if (other.id === block.id || other.id === draggedId) return;
      if (!overlapsHorizontally(block, other)) return;

      const otherSize = getPhysicsSize(other);
      const otherTop = other.y - otherSize.height / 2;

      // 同时处理“本帧穿过表面”和“已发生轻微重叠”两种情况。
      const crossedTop = previousBottom <= otherTop && nextBottom >= otherTop;
      const overlappingFromAbove = nextBottom > otherTop && block.y <= other.y;

      if (crossedTop || overlappingFromAbove) {
        landingY = Math.min(landingY, otherTop - halfHeight);
      }
    });

    if (block.y > landingY) {
      block.y = landingY;
      block.vy = 0;
    }
  });
};

const tick = () => {
  applyGravity();
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
      break;
    case "ArrowRight":
      block.x = clamp(snap(block.x + step), size.width / 2, canvas.width - size.width / 2);
      break;
    default:
      return;
  }

  event.preventDefault();
});

if (animationFrame) {
  cancelAnimationFrame(animationFrame);
}
animationFrame = requestAnimationFrame(tick);
