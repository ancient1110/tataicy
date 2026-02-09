const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const windInput = document.getElementById("wind");
const gravityInput = document.getElementById("gravity");
const windValue = document.getElementById("windValue");
const gravityValue = document.getElementById("gravityValue");
const blocksLeftEl = document.getElementById("blocksLeft");
const integrityEl = document.getElementById("integrity");
const hitsEl = document.getElementById("hits");
const statusEl = document.getElementById("status");

const resetButton = document.getElementById("reset");
const nextButton = document.getElementById("next");

const groundY = 420;
const slingAnchor = { x: 160, y: 360 };
const maxPull = 110;
const launchLimit = 3;

let levelIndex = 0;
let launches = 0;
let hits = 0;
let animationFrame = null;

const levels = [
  [
    { x: 640, y: 320, w: 70, h: 80 },
    { x: 720, y: 320, w: 70, h: 80 },
    { x: 680, y: 240, w: 120, h: 50 },
    { x: 680, y: 190, w: 90, h: 40 },
  ],
  [
    { x: 620, y: 320, w: 60, h: 100 },
    { x: 690, y: 320, w: 60, h: 100 },
    { x: 760, y: 320, w: 60, h: 100 },
    { x: 690, y: 230, w: 140, h: 60 },
    { x: 690, y: 160, w: 90, h: 45 },
  ],
  [
    { x: 650, y: 330, w: 80, h: 70 },
    { x: 740, y: 330, w: 80, h: 70 },
    { x: 695, y: 250, w: 160, h: 60 },
    { x: 695, y: 180, w: 110, h: 50 },
    { x: 695, y: 120, w: 80, h: 40 },
  ],
];

let blocks = [];
let bird = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let lastTime = performance.now();

function updateControlValues() {
  windValue.textContent = windInput.value;
  gravityValue.textContent = `${(Number(gravityInput.value) / 10).toFixed(1)}x`;
}

function createBird() {
  return {
    x: slingAnchor.x,
    y: slingAnchor.y,
    r: 16,
    vx: 0,
    vy: 0,
    launched: false,
    settled: false,
  };
}

function createBlocks() {
  return levels[levelIndex].map((block) => ({
    ...block,
    vx: 0,
    vy: 0,
    dynamic: false,
    health: 3,
  }));
}

function resetLevel() {
  cancelAnimationFrame(animationFrame);
  launches = 0;
  hits = 0;
  blocks = createBlocks();
  bird = createBird();
  statusEl.textContent = "拖拽弹弓准备发射。";
  updateStats();
  lastTime = performance.now();
  animate(lastTime);
}

function nextLevel() {
  levelIndex = (levelIndex + 1) % levels.length;
  resetLevel();
}

function updateStats() {
  const totalBlocks = levels[levelIndex].length;
  const remaining = blocks.length;
  blocksLeftEl.textContent = `${remaining}`;
  integrityEl.textContent = `${Math.round((remaining / totalBlocks) * 100)}%`;
  hitsEl.textContent = `${hits}`;
}

function applyPhysics(delta) {
  const gravity = Number(gravityInput.value) * 0.8;
  const wind = Number(windInput.value) * 0.6;

  if (bird.launched && !bird.settled) {
    bird.vy += gravity * delta;
    bird.vx += wind * delta * 0.4;
    bird.x += bird.vx * delta;
    bird.y += bird.vy * delta;

    if (bird.y + bird.r > groundY) {
      bird.y = groundY - bird.r;
      bird.vy *= -0.3;
      bird.vx *= 0.7;
      if (Math.abs(bird.vy) < 30) {
        bird.settled = true;
      }
    }

    if (bird.x - bird.r < 0 || bird.x + bird.r > canvas.width) {
      bird.vx *= -0.4;
    }
  }

  blocks.forEach((block) => {
    if (block.dynamic) {
      block.vy += gravity * delta;
      block.vx += wind * delta * 0.2;
      block.x += block.vx * delta;
      block.y += block.vy * delta;

      if (block.y + block.h / 2 > groundY) {
        block.y = groundY - block.h / 2;
        block.vy *= -0.2;
        block.vx *= 0.6;
        if (Math.abs(block.vy) < 20) {
          block.vy = 0;
        }
      }

      if (block.x - block.w / 2 < 0 || block.x + block.w / 2 > canvas.width) {
        block.vx *= -0.4;
      }
    }
  });
}

function checkCollisions() {
  if (!bird.launched || bird.settled) return;

  blocks.forEach((block) => {
    const dx = Math.abs(bird.x - block.x);
    const dy = Math.abs(bird.y - block.y);
    const overlapX = dx < block.w / 2 + bird.r;
    const overlapY = dy < block.h / 2 + bird.r;

    if (overlapX && overlapY) {
      block.dynamic = true;
      block.health -= 1;
      block.vx += bird.vx * 0.35;
      block.vy -= Math.abs(bird.vy) * 0.2 + 80;
      bird.vx *= 0.6;
      bird.vy *= -0.2;
      hits += 1;
    }
  });

  blocks = blocks.filter((block) => block.health > 0);
}

function drawBackground() {
  ctx.fillStyle = "#cfe4ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#e9f3ff";
  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);

  ctx.fillStyle = "#93c47d";
  ctx.fillRect(0, groundY, canvas.width, 100);

  ctx.fillStyle = "#7fb069";
  ctx.fillRect(0, groundY + 16, canvas.width, 60);
}

function drawSlingshot() {
  ctx.strokeStyle = "#6b4b3a";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(slingAnchor.x - 20, slingAnchor.y + 40);
  ctx.lineTo(slingAnchor.x, slingAnchor.y - 10);
  ctx.lineTo(slingAnchor.x + 20, slingAnchor.y + 40);
  ctx.stroke();

  ctx.strokeStyle = "#3d2c21";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(slingAnchor.x - 8, slingAnchor.y + 14);
  ctx.lineTo(bird.x, bird.y);
  ctx.lineTo(slingAnchor.x + 8, slingAnchor.y + 14);
  ctx.stroke();
}

function drawBlocks() {
  blocks.forEach((block) => {
    ctx.fillStyle = block.dynamic ? "#f6b26b" : "#8e7cc3";
    ctx.strokeStyle = "#5b4e7a";
    ctx.lineWidth = 2;
    ctx.save();
    ctx.translate(block.x, block.y);
    ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
    ctx.strokeRect(-block.w / 2, -block.h / 2, block.w, block.h);
    ctx.restore();
  });
}

function drawBird() {
  ctx.fillStyle = "#e74c3c";
  ctx.beginPath();
  ctx.arc(bird.x, bird.y, bird.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(bird.x + 6, bird.y - 4, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2c3e50";
  ctx.beginPath();
  ctx.arc(bird.x + 7, bird.y - 4, 2.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f39c12";
  ctx.beginPath();
  ctx.moveTo(bird.x + 12, bird.y + 2);
  ctx.lineTo(bird.x + 22, bird.y + 6);
  ctx.lineTo(bird.x + 12, bird.y + 10);
  ctx.closePath();
  ctx.fill();
}

function drawAimLine() {
  if (!isDragging) return;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(slingAnchor.x, slingAnchor.y);
  ctx.lineTo(bird.x, bird.y);
  ctx.stroke();
}

function animate(timestamp) {
  const delta = Math.min(32, timestamp - lastTime) / 1000;
  lastTime = timestamp;

  applyPhysics(delta);
  checkCollisions();

  drawBackground();
  drawBlocks();
  drawSlingshot();
  drawAimLine();
  drawBird();

  updateStats();

  if (blocks.length === 0) {
    statusEl.textContent = "🎉 塔台被摧毁！点击“下一座塔”继续。";
  } else if (launches >= launchLimit && bird.settled) {
    statusEl.textContent = "⚠️ 发射次数已用完，建议重置关卡。";
  }

  animationFrame = requestAnimationFrame(animate);
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function startDrag(event) {
  if (launches >= launchLimit || bird.launched) return;
  const { x, y } = pointerPosition(event);
  const distance = Math.hypot(x - bird.x, y - bird.y);
  if (distance > bird.r + 10) return;

  isDragging = true;
  dragOffset = { x: bird.x - x, y: bird.y - y };
  statusEl.textContent = "松手发射试验球。";
}

function drag(event) {
  if (!isDragging) return;
  const { x, y } = pointerPosition(event);
  let targetX = x + dragOffset.x;
  let targetY = y + dragOffset.y;
  const dx = targetX - slingAnchor.x;
  const dy = targetY - slingAnchor.y;
  const distance = Math.hypot(dx, dy);
  if (distance > maxPull) {
    const ratio = maxPull / distance;
    targetX = slingAnchor.x + dx * ratio;
    targetY = slingAnchor.y + dy * ratio;
  }
  bird.x = targetX;
  bird.y = targetY;
}

function endDrag() {
  if (!isDragging) return;
  isDragging = false;

  const dx = slingAnchor.x - bird.x;
  const dy = slingAnchor.y - bird.y;
  bird.vx = dx * 3.2;
  bird.vy = dy * 3.2;
  bird.launched = true;
  launches += 1;
  statusEl.textContent = `第 ${launches} 次发射完成。`;

  setTimeout(() => {
    if (bird.settled || bird.y > groundY - bird.r) {
      bird = createBird();
      statusEl.textContent = launches >= launchLimit
        ? "发射次数已用完。"
        : "准备下一次发射。";
    }
  }, 1600);
}

windInput.addEventListener("input", updateControlValues);
gravityInput.addEventListener("input", updateControlValues);

canvas.addEventListener("pointerdown", startDrag);
canvas.addEventListener("pointermove", drag);
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointerleave", endDrag);

resetButton.addEventListener("click", resetLevel);
nextButton.addEventListener("click", nextLevel);

updateControlValues();
resetLevel();
