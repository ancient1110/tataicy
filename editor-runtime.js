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

const { Engine, World, Bodies, Body, Collision, Constraint, Vector } = Matter;

const GRID_SIZE = 10;
const BUILD_GRAVITY_STEP = 6;

const materials = {
  wood: { fill: "#c58b4a", stroke: "#8d5a24", density: 0.0012, friction: 0.7, restitution: 0.1 },
  stone: { fill: "#8f98a3", stroke: "#5f6b7a", density: 0.003, friction: 0.9, restitution: 0.02 },
  glass: { fill: "#dff4ff", stroke: "#7cc0df", density: 0.0017, friction: 0.18, restitution: 0.08 },
};

const sizeOptions = {
  small: { kind: "rect", width: 40, height: 20 },
  medium: { kind: "rect", width: 80, height: 20 },
  large: { kind: "rect", width: 120, height: 20 },
  square: { kind: "rect", width: 40, height: 40 },
  triangle: { kind: "triangle", width: 40, height: 40 },
};

const testLabels = {
  heavy: "重物冲击测试",
  wind: "风力扰动测试",
  quake: "地震摇晃测试",
};

const blocks = [];
let selectedId = null;
let draggedId = null;
let dragOffset = { x: 0, y: 0 };
let animationFrame = null;
let currentTestType = null;
let isPlaceArmed = false;
let isTestingActive = false;
let preTestSnapshot = null;

let testEngine = null;
let testBodies = [];
let testBodyMap = new Map();
let adhesiveLinks = [];

const snap = (value) => Math.round(value / GRID_SIZE) * GRID_SIZE;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const getIntensityRatio = () => Number(testProgress.value) / 100;

const getSelectedBlock = () => blocks.find((block) => block.id === selectedId) || null;
const getDraggedBlock = () => blocks.find((block) => block.id === draggedId) || null;

const getTriangleCentroidOffset = (width, height, angle = 0) => {
  const localX = -width / 6;
  const localY = height / 6;
  if (angle === 0) return { x: localX, y: localY };
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: localX * cos - localY * sin,
    y: localX * sin + localY * cos,
  };
};

const getFootprintSize = (block) => {
  if (block.shape === "triangle") {
    return { width: block.width, height: block.height };
  }
  const quarterTurns = Math.round(block.rotation / (Math.PI / 2));
  const isVertical = Math.abs(quarterTurns) % 2 === 1;
  return {
    width: isVertical ? block.height : block.width,
    height: isVertical ? block.width : block.height,
  };
};

const getAabb = (block) => {
  const size = getFootprintSize(block);
  return {
    left: block.x - size.width / 2,
    right: block.x + size.width / 2,
    top: block.y - size.height / 2,
    bottom: block.y + size.height / 2,
    width: size.width,
    height: size.height,
  };
};

const isOverlapping = (a, b) => {
  const aa = getAabb(a);
  const bb = getAabb(b);
  return aa.left < bb.right && aa.right > bb.left && aa.top < bb.bottom && aa.bottom > bb.top;
};

const getSupportY = (block) => {
  const bb = getAabb(block);
  let supportY = canvas.height - bb.height / 2;

  blocks.forEach((other) => {
    if (other.id === block.id) return;
    const ob = getAabb(other);
    const horizontalOverlap = bb.left < ob.right && bb.right > ob.left;
    if (!horizontalOverlap) return;

    const candidate = ob.top - bb.height / 2;
    if (candidate >= block.y - 0.1 && candidate < supportY) {
      supportY = candidate;
    }
  });

  return supportY;
};

const resolveImmediateOverlaps = (block) => {
  let moved = false;
  for (let i = 0; i < blocks.length; i += 1) {
    const other = blocks[i];
    if (other.id === block.id) continue;
    if (!isOverlapping(block, other)) continue;

    const selfBox = getAabb(block);
    const otherBox = getAabb(other);
    const overlap = selfBox.bottom - otherBox.top;
    if (overlap > 0) {
      block.y -= overlap;
      moved = true;
    }
  }
  return moved;
};

const settleBuildWorld = () => {
  if (isTestingActive) return;

  // 先处理拖拽/创建产生的相交，再做简化重力下落（仅竖直，不翻倒）。
  for (let i = 0; i < 4; i += 1) {
    let changed = false;
    blocks.forEach((block) => {
      if (draggedId === block.id) return;

      const size = getFootprintSize(block);
      block.x = clamp(snap(block.x), size.width / 2, canvas.width - size.width / 2);

      if (resolveImmediateOverlaps(block)) changed = true;
      const supportY = getSupportY(block);
      const targetY = snap(supportY);
      if (block.y < targetY) {
        block.y = Math.min(block.y + BUILD_GRAVITY_STEP, targetY);
        changed = true;
      }
    });

    if (!changed) break;
  }
};

const updateTestButtonState = () => {
  [heavyButton, windButton, quakeButton].forEach((button) => button.classList.remove("selected"));
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
    hint.textContent = "测试进行中：已锁定搭建操作。点击“恢复原状”可静态回溯到测试前。";
    return;
  }
  hint.textContent = isPlaceArmed
    ? "搭建模式（非物理）：可持续点击空白处放置组件，再次点击按钮退出。"
    : "当前为非物理搭建模式，拖拽/旋转更容易；点击“加载组件”后可连续放置。";
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

const getRenderState = (block) => {
  if (!isTestingActive) {
    return { x: block.x, y: block.y, angle: block.rotation };
  }
  const body = testBodyMap.get(block.id);
  if (!body) return { x: block.x, y: block.y, angle: block.rotation };

  if (block.shape === "triangle") {
    const centroidOffset = getTriangleCentroidOffset(block.width, block.height, body.angle);
    return {
      x: body.position.x - centroidOffset.x,
      y: body.position.y - centroidOffset.y,
      angle: body.angle,
    };
  }

  return { x: body.position.x, y: body.position.y, angle: body.angle };
};

const drawBlock = (block, isSelected) => {
  const { width, height } = getFootprintSize(block);
  const { fill, stroke } = materials[block.material];
  const state = getRenderState(block);

  ctx.save();
  ctx.translate(state.x, state.y);
  ctx.rotate(state.angle);

  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;

  if (block.shape === "triangle") {
    ctx.beginPath();
    ctx.moveTo(-width / 2, height / 2);
    ctx.lineTo(-width / 2, -height / 2);
    ctx.lineTo(width / 2, height / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.strokeRect(-width / 2, -height / 2, width, height);
  }

  if (isSelected && !isTestingActive) {
    ctx.strokeStyle = "#ff9800";
    ctx.lineWidth = 3;
    if (block.shape === "triangle") {
      ctx.beginPath();
      ctx.moveTo(-width / 2 - 4, height / 2 + 4);
      ctx.lineTo(-width / 2 - 4, -height / 2 - 4);
      ctx.lineTo(width / 2 + 4, height / 2 + 4);
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.strokeRect(-width / 2 - 4, -height / 2 - 4, width + 8, height + 8);
    }
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
  const shouldSwap = size.kind === "rect" && size.width !== size.height && isVertical;
  const width = shouldSwap ? size.height : size.width;
  const height = shouldSwap ? size.width : size.height;
  const halfWidth = width / 2;

  const block = {
    id: crypto.randomUUID(),
    x: clamp(snap(x), halfWidth, canvas.width - halfWidth),
    y: snap(y),
    width,
    height,
    shape: size.kind,
    rotation: 0,
    material: materialSelect.value,
  };

  blocks.push(block);
  selectedId = block.id;
  settleBuildWorld();
};

const isPointInTriangle = (x, y, ax, ay, bx, by, cx, cy) => {
  const denominator = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (denominator === 0) return false;
  const u = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / denominator;
  const v = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / denominator;
  const w = 1 - u - v;
  return u >= 0 && v >= 0 && w >= 0;
};

const findBlockAt = (x, y) => {
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = blocks[i];
    const dx = x - block.x;
    const dy = y - block.y;
    const angle = -block.rotation;
    const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
    const localY = dx * Math.sin(angle) + dy * Math.cos(angle);

    if (block.shape === "triangle") {
      const halfW = block.width / 2;
      const halfH = block.height / 2;
      if (isPointInTriangle(localX, localY, -halfW, halfH, -halfW, -halfH, halfW, halfH)) {
        return block;
      }
      continue;
    }

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

const clearTestWorld = () => {
  if (!testEngine) return;
  adhesiveLinks.forEach((link) => link.constraints.forEach((constraint) => World.remove(testEngine.world, constraint)));
  adhesiveLinks = [];
  testBodies = [];
  testBodyMap = new Map();
  testEngine = null;
};

const createPhysicsBody = (block) => {
  if (block.shape === "triangle") {
    const vertices = [
      { x: -block.width / 2, y: block.height / 2 },
      { x: -block.width / 2, y: -block.height / 2 },
      { x: block.width / 2, y: block.height / 2 },
    ];
    const centroidOffset = getTriangleCentroidOffset(block.width, block.height, block.rotation);
    const body = Bodies.fromVertices(block.x + centroidOffset.x, block.y + centroidOffset.y, [vertices], {
      density: materials[block.material].density,
      friction: materials[block.material].friction,
      restitution: materials[block.material].restitution,
      frictionAir: 0.02,
    }, true);
    Body.setAngle(body, block.rotation);
    return body;
  }

  return Bodies.rectangle(block.x, block.y, block.width, block.height, {
    angle: block.rotation,
    density: materials[block.material].density,
    friction: materials[block.material].friction,
    restitution: materials[block.material].restitution,
    frictionAir: 0.02,
  });
};

const createTestWorld = () => {
  testEngine = Engine.create({ gravity: { x: 0, y: 1 } });

  const boundary = 100;
  World.add(testEngine.world, [
    Bodies.rectangle(canvas.width / 2, canvas.height + boundary / 2, canvas.width + boundary * 2, boundary, { isStatic: true }),
    Bodies.rectangle(-boundary / 2, canvas.height / 2, boundary, canvas.height * 2, { isStatic: true }),
    Bodies.rectangle(canvas.width + boundary / 2, canvas.height / 2, boundary, canvas.height * 2, { isStatic: true }),
  ]);

  testBodies = blocks.map((block) => ({ id: block.id, body: createPhysicsBody(block) }));

  testBodyMap = new Map(testBodies.map((item) => [item.id, item.body]));
  World.add(testEngine.world, testBodies.map((item) => item.body));

  adhesiveLinks = [];
  for (let i = 0; i < testBodies.length; i += 1) {
    for (let j = i + 1; j < testBodies.length; j += 1) {
      const bodyA = testBodies[i].body;
      const bodyB = testBodies[j].body;
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
      World.add(testEngine.world, constraints);
      adhesiveLinks.push({ bodyA, bodyB, constraints });
    }
  }
};

const updateAdhesionLinks = () => {
  if (!testEngine) return;
  adhesiveLinks = adhesiveLinks.filter((link) => {
    const overlapX = Math.min(link.bodyA.bounds.max.x, link.bodyB.bounds.max.x) - Math.max(link.bodyA.bounds.min.x, link.bodyB.bounds.min.x);
    const overlapY = Math.min(link.bodyA.bounds.max.y, link.bodyB.bounds.max.y) - Math.max(link.bodyA.bounds.min.y, link.bodyB.bounds.min.y);
    if (overlapX <= 0 || overlapY <= 0) {
      link.constraints.forEach((constraint) => World.remove(testEngine.world, constraint));
      return false;
    }
    return true;
  });
};

const snapshotBeforeTest = () => {
  preTestSnapshot = {
    selectedId,
    isPlaceArmed,
    currentTestType,
    intensity: Number(testProgress.value),
    blocks: blocks.map((block) => ({ ...block })),
  };
};

const restoreSnapshot = () => {
  if (!preTestSnapshot) return;
  blocks.length = 0;
  preTestSnapshot.blocks.forEach((block) => blocks.push({ ...block }));
  selectedId = preTestSnapshot.selectedId;
  draggedId = null;
  isPlaceArmed = preTestSnapshot.isPlaceArmed;
  currentTestType = preTestSnapshot.currentTestType;
  testProgress.value = preTestSnapshot.intensity;
  updateTestButtonState();
};

const startTesting = () => {
  if (isTestingActive || !currentTestType || blocks.length === 0) return;
  snapshotBeforeTest();
  createTestWorld();
  isTestingActive = true;
  draggedId = null;
  updateBuildControlsState();
  updatePlaceArmUI();
  updateTestStatus();
};

const restoreState = () => {
  if (!preTestSnapshot) return;
  isTestingActive = false;
  clearTestWorld();
  restoreSnapshot();
  updateBuildControlsState();
  updatePlaceArmUI();
  updateTestStatus();
};

const applyTestForces = () => {
  if (!isTestingActive || !currentTestType || !testEngine) return;

  testEngine.gravity.x = 0;
  testEngine.gravity.y = 1;
  updateAdhesionLinks();

  const strength = getIntensityRatio();
  if (strength <= 0) return;
  const elapsed = performance.now();

  if (currentTestType === "heavy") {
    const topLine = canvas.height * 0.4;
    testBodies.forEach(({ body }) => {
      if (body.position.y > topLine) return;
      Body.applyForce(body, body.position, { x: 0, y: 0.0042 * strength * body.mass });
    });
  }

  if (currentTestType === "wind") {
    const base = (0.00025 + Math.sin(elapsed / 250) * 0.00008) * strength;
    testBodies.forEach(({ body }) => {
      const heightFactor = 1 + (1 - body.position.y / canvas.height) * 0.5;
      Body.applyForce(body, body.position, { x: base * heightFactor * body.mass, y: 0 });
    });
  }

  if (currentTestType === "quake") {
    testEngine.gravity.x = Math.sin(elapsed / 90) * 0.22 * strength;
    testEngine.gravity.y = 1 + Math.sin(elapsed / 120) * 0.1 * strength;
    testBodies.forEach(({ body }) => {
      Body.applyForce(body, body.position, {
        x: Math.sin(elapsed / 58) * 0.00075 * strength * body.mass,
        y: Math.cos(elapsed / 72) * 0.00045 * strength * body.mass,
      });
    });
  }
};

canvas.addEventListener("pointerdown", (event) => {
  if (isTestingActive) return;
  event.preventDefault();

  const { x, y } = getCanvasPoint(event);
  const found = findBlockAt(x, y);

  if (found) {
    selectedId = found.id;
    draggedId = found.id;
    dragOffset = { x: found.x - x, y: found.y - y };
    canvas.setPointerCapture(event.pointerId);
    return;
  }

  if (isPlaceArmed) createBlock(x, y);
});

canvas.addEventListener("pointermove", (event) => {
  if (isTestingActive || !draggedId) return;
  const block = getDraggedBlock();
  if (!block) return;

  const { x, y } = getCanvasPoint(event);
  const nx = snap(x + dragOffset.x);
  const ny = snap(y + dragOffset.y);
  const footprint = getFootprintSize(block);
  const halfWidth = footprint.width / 2;

  block.x = clamp(nx, halfWidth, canvas.width - halfWidth);
  block.y = ny;
  settleBuildWorld();
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

armPlaceButton.addEventListener("click", () => {
  if (isTestingActive) return;
  isPlaceArmed = !isPlaceArmed;
  updatePlaceArmUI();
});

rotateButton.addEventListener("click", () => {
  if (isTestingActive) return;
  const block = getSelectedBlock();
  if (!block) return;
  block.rotation = (block.rotation + Math.PI / 2) % (Math.PI * 2);
  settleBuildWorld();
});

deleteButton.addEventListener("click", () => {
  if (isTestingActive || !selectedId) return;
  const index = blocks.findIndex((block) => block.id === selectedId);
  if (index < 0) return;
  blocks.splice(index, 1);
  selectedId = null;
});

clearButton.addEventListener("click", () => {
  if (isTestingActive) return;
  blocks.length = 0;
  selectedId = null;
  draggedId = null;
  currentTestType = null;
  testProgress.value = 0;
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

  switch (event.key) {
    case "ArrowUp":
      block.y = snap(block.y - step);
      break;
    case "ArrowDown":
      block.y = snap(block.y + step);
      break;
    case "ArrowLeft":
      {
        const footprint = getFootprintSize(block);
        block.x = clamp(snap(block.x - step), footprint.width / 2, canvas.width - footprint.width / 2);
      }
      break;
    case "ArrowRight":
      {
        const footprint = getFootprintSize(block);
        block.x = clamp(snap(block.x + step), footprint.width / 2, canvas.width - footprint.width / 2);
      }
      break;
    default:
      return;
  }

  event.preventDefault();
  settleBuildWorld();
});

const tick = () => {
  settleBuildWorld();
  applyTestForces();
  if (isTestingActive && testEngine) {
    Engine.update(testEngine, 1000 / 60);
  }
  render();
  animationFrame = requestAnimationFrame(tick);
};

updateBuildControlsState();
updateTestButtonState();
updatePlaceArmUI();
updateTestStatus();
if (animationFrame) cancelAnimationFrame(animationFrame);
animationFrame = requestAnimationFrame(tick);
