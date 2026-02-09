const materials = [
  {
    id: "wood",
    name: "木质模块",
    height: 2,
    cost: 120,
    weight: 35,
    stability: 18,
    color: "#c97b5f",
    detail: "轻便，成本低，抗风一般",
  },
  {
    id: "steel",
    name: "钢结构模块",
    height: 2.5,
    cost: 260,
    weight: 60,
    stability: 30,
    color: "#5b8def",
    detail: "强度高，抗震优秀，成本高",
  },
  {
    id: "concrete",
    name: "混凝土模块",
    height: 2.2,
    cost: 200,
    weight: 70,
    stability: 26,
    color: "#7f8c8d",
    detail: "稳重抗压，抗风好",
  },
  {
    id: "glass",
    name: "玻璃模块",
    height: 1.8,
    cost: 180,
    weight: 30,
    stability: 12,
    color: "#6dd5c9",
    detail: "美观，抗震较弱",
  },
];

const tower = [];

const materialsEl = document.getElementById("materials");
const towerEl = document.getElementById("tower");
const heightEl = document.getElementById("height");
const costEl = document.getElementById("cost");
const stabilityEl = document.getElementById("stability");
const resultEl = document.getElementById("result");

const loadInput = document.getElementById("load");
const windInput = document.getElementById("wind");
const quakeInput = document.getElementById("quake");
const loadValue = document.getElementById("loadValue");
const windValue = document.getElementById("windValue");
const quakeValue = document.getElementById("quakeValue");

function renderMaterials() {
  materialsEl.innerHTML = "";
  materials.forEach((material) => {
    const card = document.createElement("div");
    card.className = "material";
    card.innerHTML = `
      <div class="name">${material.name}</div>
      <div class="meta">高度 +${material.height}m · 造价 ${material.cost}元</div>
      <div class="meta">重量 ${material.weight}kg · 稳定性 +${material.stability}</div>
      <div class="meta">${material.detail}</div>
    `;
    card.addEventListener("click", () => addBlock(material));
    materialsEl.appendChild(card);
  });
}

function addBlock(material) {
  tower.push({ ...material });
  renderTower();
}

function removeTopBlock() {
  tower.pop();
  renderTower();
}

function renderTower() {
  towerEl.innerHTML = "";
  tower.slice().reverse().forEach((block) => {
    const blockEl = document.createElement("div");
    blockEl.className = "block";
    blockEl.style.background = block.color;
    blockEl.innerHTML = `
      <span>${block.name}</span>
      <span>+${block.height}m</span>
    `;
    towerEl.appendChild(blockEl);
  });

  const totalHeight = tower.reduce((sum, block) => sum + block.height, 0);
  const totalCost = tower.reduce((sum, block) => sum + block.cost, 0);
  const baseStability = tower.reduce((sum, block) => sum + block.stability, 0);

  heightEl.textContent = `${totalHeight.toFixed(1)} m`;
  costEl.textContent = `${totalCost} 元`;
  stabilityEl.textContent = baseStability ? `${baseStability} 分` : "--";
}

function updateControlValues() {
  loadValue.textContent = loadInput.value;
  windValue.textContent = windInput.value;
  quakeValue.textContent = quakeInput.value;
}

function simulate() {
  if (tower.length === 0) {
    resultEl.textContent = "塔台为空，请添加材料后再测试。";
    return;
  }

  const totalHeight = tower.reduce((sum, block) => sum + block.height, 0);
  const totalWeight = tower.reduce((sum, block) => sum + block.weight, 0);
  const baseStability = tower.reduce((sum, block) => sum + block.stability, 0);

  const loadFactor = Number(loadInput.value) * 0.08;
  const windFactor = Number(windInput.value) * (totalHeight * 0.6);
  const quakeFactor = Number(quakeInput.value) * (totalWeight * 0.05);

  const stabilityScore = Math.max(
    0,
    Math.round(baseStability * 1.2 - loadFactor - windFactor - quakeFactor)
  );

  stabilityEl.textContent = `${stabilityScore} 分`;

  let status = "";
  let advice = "";

  if (stabilityScore >= 70) {
    status = "✅ 塔台在当前条件下非常稳定。";
    advice = "可以尝试增加高度或用更轻的材料降低成本。";
  } else if (stabilityScore >= 40) {
    status = "⚠️ 塔台基本稳定，但需要关注风险。";
    advice = "建议在底部加入更稳固的结构或降低风力影响。";
  } else {
    status = "❌ 塔台有倒塌风险。";
    advice = "请减少高度、降低重物质量或提高抗震材料比例。";
  }

  resultEl.innerHTML = `
    <strong>${status}</strong>
    <p>重物影响：-${loadFactor.toFixed(1)}，风力影响：-${windFactor.toFixed(1)}，地震影响：-${quakeFactor.toFixed(1)}</p>
    <p>${advice}</p>
  `;
}

renderMaterials();
renderTower();
updateControlValues();

loadInput.addEventListener("input", updateControlValues);
windInput.addEventListener("input", updateControlValues);
quakeInput.addEventListener("input", updateControlValues);

materialsEl.addEventListener("dblclick", removeTopBlock);

const simulateButton = document.getElementById("simulate");
simulateButton.addEventListener("click", simulate);

const resetButton = document.getElementById("reset");
resetButton.addEventListener("click", () => {
  tower.length = 0;
  renderTower();
  resultEl.textContent = "塔台已清空，请重新搭建。";
});
