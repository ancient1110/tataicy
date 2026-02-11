const canvas = document.getElementById("editor");
const ctx = canvas.getContext("2d");

const materialSelect = document.getElementById("material");
const sizeSelect = document.getElementById("size");
const verticalToggle = document.getElementById("vertical");
const armPlaceButton = document.getElementById("arm-place");
const rotateButton = document.getElementById("rotate");
const deleteButton = document.getElementById("delete");
const clearButton = document.getElementById("clear");
const buildControls = document.getElementById("build-controls");
const hint = document.getElementById("hint");

const heavyButton = document.getElementById("test-heavy");
const windButton = document.getElementById("test-wind");
const quakeButton = document.getElementById("test-quake");
const startButton = document.getElementById("test-start");
const restoreButton = document.getElementById("test-restore");
const testProgress = document.getElementById("test-progress");
const testStatus = document.getElementById("test-status");

const { Engine, World, Bodies, Body, Query, Collision, Constraint, Vector } = Matter;

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
let isTestingActive = false;
let preTestSnapshot = null;
let adhesiveLinks = [];

const snap = (value) => Math.round(value / GRID_SIZE) * GRID_SIZE;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const getIntensityRatio = () => Number(testProgress.value) / 100;

const getSelectedBlock = () => blocks.find((block) => block.id === selectedId) || null;
const getDraggedBlock = () => blocks.find((block) => block.id === draggedId) || null;

const updateTestButtonState = () => {
  [heavyButton, windButton, quakeButton].forEach((button) => button.classList.remove("selected"));
  if (!currentTestType) return;
  if (currentTestType === "heavy") heavyButton.classList.add("selected");
  if (currentTestType === "wind") windButton.classList.add("selected");
  if (currentTestType === "quake") quakeButton.classList.add("selected");
};

const updateBuildControlsState = () => {
  const disabled = isTestingActive;
  [materialSelect, sizeSelect, verticalToggle, armPlaceButton, rotateButton, deleteButton, clearButton].forEach((el) => {
    el.disabled = disabled;
  });
  buildControls.classList.toggle("disabled", disabled);
};

const updatePlaceArmUI = () => {
  armPlaceButton.classList.toggle("armed", isPlaceArmed);
  armPlaceButton.textContent = isPlaceArmed ? "放置模式（点击退出）" : "加载组件";
  if (isTestingActive) {
    hint.textContent = "测试进行中：已锁定搭建操作。可调节强度观察破坏；点击“恢复原状”回到测试前。";
    return;
  }
  hint.textContent = isPlaceArmed
    ? "放置模式：可持续点击空白处放置组件；再次点击“放置模式”按钮可退出。"
    : "先点击“加载组件”进入放置模式；再次点击可退出。放置模式下可持续点击空白处放置组件。";
};

const updateTestStatus = () => {
  const intensity = Number(testProgress.value);
  if (!currentTestType) {
    testStatus.textContent = `状态：待机（强度 ${intensity}%）`;
    return;
  }

  if (!isTestingActive) {
    testStatus.textContent = `状态：已选择${testLabels[currentTestType]}（强度 ${intensity}%，点击“开始测试”生效）`;
    return;
  }

  testStatus.textContent = `状态：测试中 - ${testLabels[currentTestType]}（强度 ${intensity}%）`;
};

const resetWorldGravity = () => {
  engine.gravity.x = 0;
  engine.gravity.y = 1;
};

const computeOverlapLength = (bodyA, bodyB) => {
  const overlapX = Math.min(bodyA.bounds.max.x, bodyB.bounds.max.x) - Math.max(bodyA.bounds.min.x, bodyB.bounds.min.x);
  const overlapY = Math.min(bodyA.bounds.max.y, bodyB.bounds.max.y) - Math.max(bodyA.bounds.min.y, bodyB.bounds.min.y);
  if (overlapX <= 0 || overlapY <= 0) return 0;
  return Math.max(Math.min(overlapX, 120), Math.min(overlapY, 120));
};

const createAdhesionConstraintsForPair = (bodyA, bodyB, contact, normal, overlapLength) => {
  const tangent = Vector.perp(normal);
  const unitTangent = Vector.normalise(tangent);
  const offset = clamp(overlapLength * 0.2, 4, 20);
  const stiffness = clamp(0.0012 + overlapLength * 0.00005, 0.0012, 0.0065);

  const points = [
    contact,
    Vector.add(contact, Vector.mult(unitTangent, offset)),
    Vector.sub(contact, Vector.mult(unitTangent, offset)),
  ];

  return points.map((point) => Constraint.create({
    bodyA,
    bodyB,
    pointA: Vector.sub(point, bodyA.position),
    pointB: Vector.sub(point, bodyB.position),
    length: 0,
    stiffness,
    damping: 0.08,
  }));
};

const createAdhesionLinks = () => {
  clearAdhesionLinks();

  for (let i = 0; i < blocks.length; i += 1) {
    for (let j = i + 1; j < blocks.length; j += 1) {
      const bodyA = blocks[i].body;
      const bodyB = blocks[j].body;
      const collision = Collision.collides(bodyA, bodyB);
      if (!collision || !collision.collided) continue;

      const overlapLength = computeOverlapLength(bodyA, bodyB);
      if (overlapLength < 6) continue;

      const contact = collision.supports?.[0]
        ? { x: collision.supports[0].x, y: collision.supports[0].y }
        : { x: (bodyA.position.x + bodyB.position.x) / 2, y: (bodyA.position.y + bodyB.position.y) / 2 };

      const fallbackNormal = Vector.normalise(Vector.sub(bodyB.position, bodyA.position));
      const normal = collision.normal && (collision.normal.x !== 0 || collision.normal.y !== 0)
        ? collision.normal
        : (fallbackNormal.x === 0 && fallbackNormal.y === 0 ? { x: 1, y: 0 } : fallbackNormal);

      const constraints = createAdhesionConstraintsForPair(bodyA, bodyB, contact, normal, overlapLength);
      World.add(world, constraints);
      adhesiveLinks.push({ bodyA, bodyB, constraints });
    }
  }
};

const updateAdhesionLinks = () => {
  adhesiveLinks = adhesiveLinks.filter((link) => {
    const overlapX = Math.min(link.bodyA.bounds.max.x, link.bodyB.bounds.max.x) - Math.max(link.bodyA.bounds.min.x, link.bodyB.bounds.min.x);
    const overlapY = Math.min(link.bodyA.bounds.max.y, link.bodyB.bounds.max.y) - Math.max(link.bodyA.bounds.min.y, link.bodyB.bounds.min.y);
    if (overlapX <= 0 || overlapY <= 0) {
      link.constraints.forEach((constraint) => World.remove(world, constraint));
      return false;
    }
    return true;
  });
};

const clearAdhesionLinks = () => {
  adhesiveLinks.forEach((link) => link.constraints.forEach((constraint) => World.remove(world, constraint)));
  adhesiveLinks = [];
};

const snapshotBeforeTest = () => {
  preTestSnapshot = {
    selectedId,
    draggedId,
    isPlaceArmed,
    currentTestType,
    intensity: Number(testProgress.value),
    blocks: blocks.map((block) => ({
      id: block.id,
      position: { x: block.body.position.x, y: block.body.position.y },
      angle: block.body.angle,
      isStatic: block.body.isStatic,
      velocity: { x: block.body.velocity.x, y: block.body.velocity.y },
      angularVelocity: block.body.angularVelocity,
    })),
  };
};

const restoreSnapshot = () => {
  if (!preTestSnapshot) return;

  preTestSnapshot.blocks.forEach((snapBlock) => {
    const block = blocks.find((item) => item.id === snapBlock.id);
    if (!block) return;

    Body.setStatic(block.body, !!snapBlock.isStatic);
    Body.setPosition(block.body, snapBlock.position);
    Body.setAngle(block.body, snapBlock.angle);
    block.body.positionPrev.x = snapBlock.position.x;
    block.body.positionPrev.y = snapBlock.position.y;
    block.body.anglePrev = snapBlock.angle;
    Body.setVelocity(block.body, { x: 0, y: 0 });
    Body.setAngularVelocity(block.body, 0);
    block.body.force.x = 0;
    block.body.force.y = 0;
    block.body.torque = 0;
  });

  selectedId = preTestSnapshot.selectedId;
  draggedId = null;
  isPlaceArmed = preTestSnapshot.isPlaceArmed;
  currentTestType = preTestSnapshot.currentTestType;
  testProgress.value = preTestSnapshot.intensity;
  updateTestButtonState();
  Engine.update(engine, 0);
};

const startTesting = () => {
  if (isTestingActive || !currentTestType) return;
  snapshotBeforeTest();
  isTestingActive = true;
  draggedId = null;
  clearAdhesionLinks();
  createAdhesionLinks();
  updateBuildControlsState();
  updatePlaceArmUI();
  updateTestStatus();
};

const restoreState = () => {
  if (!preTestSnapshot) return;
  isTestingActive = false;
  clearAdhesionLinks();
  restoreSnapshot();
  resetWorldGravity();
  updateBuildControlsState();
  updatePlaceArmUI();
  updateTestStatus();
};

const applyTestForces = () => {
  resetWorldGravity();
  if (!isTestingActive || !currentTestType) return;

  updateAdhesionLinks();

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
  if (isTestingActive) return;
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
  if (isTestingActive || !draggedId) return;
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
  if (isTestingActive) return;
  isPlaceArmed = !isPlaceArmed;
  updatePlaceArmUI();
});

rotateButton.addEventListener("click", () => {
  if (isTestingActive) return;
  const block = getSelectedBlock();
  if (!block) return;
  Body.rotate(block.body, Math.PI / 2);
  resetBodyMotion(block.body);
});

deleteButton.addEventListener("click", () => {
  if (isTestingActive || !selectedId) return;
  const index = blocks.findIndex((block) => block.id === selectedId);
  if (index < 0) return;

  World.remove(world, blocks[index].body);
  blocks.splice(index, 1);
  selectedId = null;
});

clearButton.addEventListener("click", () => {
  if (isTestingActive) return;
  blocks.forEach((block) => World.remove(world, block.body));
  blocks.length = 0;
  selectedId = null;
  draggedId = null;
  currentTestType = null;
  testProgress.value = 0;
  clearAdhesionLinks();
  resetWorldGravity();
  updateTestButtonState();
  updateTestStatus();
});

const selectTest = (type) => {
  currentTestType = type;
  updateTestButtonState();
  updateTestStatus();
};

heavyButton.addEventListener("click", () => selectTest("heavy"));
windButton.addEventListener("click", () => selectTest("wind"));
quakeButton.addEventListener("click", () => selectTest("quake"));
startButton.addEventListener("click", startTesting);
restoreButton.addEventListener("click", restoreState);

testProgress.addEventListener("input", updateTestStatus);

window.addEventListener("keydown", (event) => {
  if (isTestingActive) return;
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

updateBuildControlsState();
updateTestButtonState();
updatePlaceArmUI();
updateTestStatus();
if (animationFrame) cancelAnimationFrame(animationFrame);
animationFrame = requestAnimationFrame(tick);
