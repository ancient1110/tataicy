const canvas = document.getElementById("editor");
const ctx = canvas.getContext("2d");

const materialSelect = document.getElementById("material");
const sizeSelect = document.getElementById("size");
const verticalToggle = document.getElementById("vertical");
const rotateButton = document.getElementById("rotate");
const deleteButton = document.getElementById("delete");
const clearButton = document.getElementById("clear");

const GRID_SIZE = 10;
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

const snap = (value) => Math.round(value / GRID_SIZE) * GRID_SIZE;

const getSelectedBlock = () => blocks.find((block) => block.id === selectedId) || null;

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

const createBlock = (x, y) => {
  const size = sizeOptions[sizeSelect.value];
  const isVertical = verticalToggle.checked;
  const width = isVertical ? size.height : size.width;
  const height = isVertical ? size.width : size.height;
  const block = {
    id: crypto.randomUUID(),
    x: snap(x),
    y: snap(y),
    width,
    height,
    material: materialSelect.value,
    rotation: 0,
  };
  blocks.push(block);
  selectedId = block.id;
  render();
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

canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const found = findBlockAt(x, y);
  if (found) {
    selectedId = found.id;
    render();
    return;
  }
  createBlock(x, y);
});

rotateButton.addEventListener("click", () => {
  const block = getSelectedBlock();
  if (!block) return;
  block.rotation = (block.rotation + 90) % 360;
  render();
});

deleteButton.addEventListener("click", () => {
  if (!selectedId) return;
  const index = blocks.findIndex((block) => block.id === selectedId);
  if (index >= 0) {
    blocks.splice(index, 1);
    selectedId = null;
    render();
  }
});

clearButton.addEventListener("click", () => {
  blocks.length = 0;
  selectedId = null;
  render();
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
      break;
    case "ArrowDown":
      block.y = snap(block.y + step);
      break;
    case "ArrowLeft":
      block.x = snap(block.x - step);
      break;
    case "ArrowRight":
      block.x = snap(block.x + step);
      break;
    default:
      return;
  }
  event.preventDefault();
  render();
});

render();
