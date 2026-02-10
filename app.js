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
    ctx.strokeStyle = "#ff9800";
    ctx.lineWidth = 3;
    ctx.strokeRect(
      -block.width / 2 - 4,
      -block.height / 2 - 4,
      block.width + 8,
      block.height + 8
    );
  }

  ctx.restore();
};

const render = () => {
  drawBackground();
  blocks.forEach((block) => drawBlock(block, block.id === selectedId));
};

const overlapsHorizontally = (a, b) => Math.abs(a.x - b.x) < a.width / 2 + b.width / 2;

const applyGravity = () => {
  const groundY = canvas.height - GRID_SIZE;

  blocks.forEach((block) => {
    if (block.id === draggedId) {
      block.vy = 0;
      return;
    }

    block.vy = Math.min(block.vy + GRAVITY, MAX_FALL_SPEED);
    block.y += block.vy;

    const halfHeight = block.height / 2;
    const halfWidth = block.width / 2;
    const leftBound = halfWidth;
    const rightBound = canvas.width - halfWidth;

    block.x = clamp(snap(block.x), leftBound, rightBound);

    let landingY = groundY - halfHeight;

    blocks.forEach((other) => {
      if (other.id === block.id || other.id === draggedId) return;
      if (!overlapsHorizontally(block, other)) return;

      const otherTop = other.y - other.height / 2;
      const blockBottom = block.y + halfHeight;

      if (blockBottom > otherTop && block.y < other.y) {
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
  const halfWidth = block.width / 2;

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
      block.x = clamp(snap(block.x - step), block.width / 2, canvas.width - block.width / 2);
      break;
    case "ArrowRight":
      block.x = clamp(snap(block.x + step), block.width / 2, canvas.width - block.width / 2);
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
