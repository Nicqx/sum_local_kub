let gridSize = parseInt(localStorage.getItem("gridSize")) || 4;
let puzzleData = { numbers: [], solution: [] };
let startTime = null;
let timerInterval = null;
let finalTime = null;
let currentSeed = null;
let rowSums = [];
let colSums = [];
let history = [];
let isExtremeMode = false;
let negativeIndices = new Set();
let currentSessionId = "1";

const API_BASE = "/sumplete/api"; // 🔥 új alapútvonal minden API-híváshoz

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const sessionFromUrl = pathParts[1] || "1"; // /sumplete/:sessionId
    currentSessionId = sessionFromUrl;

    const response = await fetch(`${API_BASE}/session/${sessionFromUrl}`);
    if (!response.ok) {
      window.location.href = "/sumplete/";
      return;
    }
    const data = await response.json();
    currentSeed = parseInt(data.seed);
    isExtremeMode = parseInt(data.extremeMode) === 1;
    negativeIndices = new Set(data.negativeIndices ? data.negativeIndices.split(",").map(Number) : []);

    document.getElementById("sizeSelector").value = gridSize;
    document.getElementById("extremeMode").checked = isExtremeMode;
    startGame(currentSeed);
  } catch (error) {
    console.error("Hiba a session adatok betöltésekor:", error);
  }

  document.getElementById("sizeSelector").addEventListener("change", changeGridSize);

  document.getElementById("extremeMode").addEventListener("change", async () => {
    isExtremeMode = document.getElementById("extremeMode").checked;
    let newNegativeIndices = "";
    if (isExtremeMode) {
      let indices = [];
      for (let i = 0; i < gridSize * gridSize; i++) {
        if (Math.random() < 0.5) indices.push(i);
      }
      newNegativeIndices = indices.join(",");
    }

    try {
      await fetch(`${API_BASE}/session/${currentSessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed: currentSeed.toString(),
          extremeMode: isExtremeMode ? "1" : "0",
          negativeIndices: newNegativeIndices
        })
      });

      const updated = await fetch(`${API_BASE}/session/${currentSessionId}`).then(r => r.json());
      currentSeed = parseInt(updated.seed);
      isExtremeMode = parseInt(updated.extremeMode) === 1;
      negativeIndices = new Set(updated.negativeIndices ? updated.negativeIndices.split(",").map(Number) : []);
      startGame(currentSeed);
    } catch (error) {
      console.error("Extrém mód frissítési hiba:", error);
    }
  });

  const newSessionBtn = document.getElementById("newSessionBtn");
  if (newSessionBtn) {
    newSessionBtn.addEventListener("click", async () => {
      try {
        const resp = await fetch(`${API_BASE}/session/new`, { method: "POST" });
        const newData = await resp.json();
        window.location.href = `/sumplete/${newData.sessionId}`;
      } catch (err) {
        console.error("Hiba új session létrehozásakor:", err);
      }
    });
  }
});

function reloadPage() {
  location.reload();
}

function changeGridSize() {
  gridSize = parseInt(document.getElementById("sizeSelector").value);
  localStorage.setItem("gridSize", gridSize);
  startGame(currentSeed);
}

function startGame(seed) {
  startTime = null;
  finalTime = null;
  clearInterval(timerInterval);
  document.getElementById("timer").textContent = "Idő: 00:00";
  history = [];
  if (!seed) return;
  currentSeed = seed;
  generatePuzzle(seed);
}

function pseudoRandom(seed) {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return (seed >>> 16) / 65536;
}

function generatePuzzle(seed) {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = `repeat(${gridSize + 1}, 50px)`;
  grid.style.gridTemplateRows = `repeat(${gridSize + 1}, 50px)`;
  grid.style.gap = "5px";
  grid.style.margin = "20px auto";

  puzzleData.numbers = [];
  puzzleData.solution = [];
  rowSums = Array(gridSize).fill(0);
  colSums = Array(gridSize).fill(0);
  let rng = seed;

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      rng = (rng * 1664525 + 1013904223) % 4294967296;
      let value = (rng % 9) + 1;
      if (isExtremeMode && negativeIndices.has(i * gridSize + j)) value *= -1;
      puzzleData.numbers.push(value);
      const isDeleted = pseudoRandom(rng) < 0.35;
      if (isDeleted) {
        puzzleData.solution.push(i * gridSize + j);
      } else {
        rowSums[i] += value;
        colSums[j] += value;
      }
      const cell = document.createElement("div");
      cell.classList.add("cell");
      cell.textContent = value;
      cell.dataset.index = i * gridSize + j;
      cell.id = `cell-${i}-${j}`;
      cell.addEventListener("click", () => toggleCellState(cell));
      grid.appendChild(cell);
    }
    const rowSumCell = document.createElement("div");
    rowSumCell.classList.add("cell", "sum-cell");
    rowSumCell.style.background = "#ddd";
    rowSumCell.style.fontWeight = "bold";
    rowSumCell.textContent = rowSums[i];
    rowSumCell.id = `sum-row-${i}`;
    grid.appendChild(rowSumCell);
    rowSumCell.addEventListener("click", () => completeRow(i));
  }

  for (let j = 0; j < gridSize; j++) {
    const colSumCell = document.createElement("div");
    colSumCell.classList.add("cell", "sum-cell");
    colSumCell.style.background = "#ddd";
    colSumCell.style.fontWeight = "bold";
    colSumCell.textContent = colSums[j];
    colSumCell.id = `sum-col-${j}`;
    grid.appendChild(colSumCell);
    colSumCell.addEventListener("click", () => completeColumn(j));
  }

  const emptyCorner = document.createElement("div");
  emptyCorner.classList.add("cell", "sum-cell");
  emptyCorner.style.background = "#ddd";
  emptyCorner.textContent = "";
  grid.appendChild(emptyCorner);

  updateSumHighlights();
}

function saveHistory() {
  let currentState = Array.from(document.querySelectorAll(".cell")).map(cell => ({
    index: cell.dataset.index,
    classList: Array.from(cell.classList)
  }));
  history.push(currentState);
}

function undoMove() {
  if (history.length === 0) return;
  let lastState = history.pop();
  lastState.forEach(state => {
    let cell = document.querySelector(`[data-index='${state.index}']`);
    if (cell) {
      cell.className = "cell";
      state.classList.forEach(cls => cell.classList.add(cls));
    }
  });
  updateSumHighlights();
}

function toggleCellState(cell) {
  if (!startTime) {
    startTime = Date.now();
    startTimer();
  }
  saveHistory();
  if (cell.classList.contains("delete")) {
    cell.classList.remove("delete");
    cell.classList.add("keep");
  } else if (cell.classList.contains("keep")) {
    cell.classList.remove("keep");
  } else {
    cell.classList.add("delete");
  }
  updateSumHighlights();
  checkWinCondition();
}

function startTimer() {
  timerInterval = setInterval(() => {
    if (finalTime === null) {
      let elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      document.getElementById("timer").textContent = `Idő: ${elapsed} másodperc`;
    }
  }, 100);
}

function checkWinCondition() {
  let allCorrectDelete = true, allCorrectKeep = true;
  document.querySelectorAll(".cell").forEach(cell => {
    let index = parseInt(cell.dataset.index);
    let isSolution = puzzleData.solution.includes(index);
    if (isSolution) {
      if (!cell.classList.contains("delete")) allCorrectDelete = false;
      if (cell.classList.contains("keep")) allCorrectKeep = false;
    } else {
      if (!cell.classList.contains("keep")) allCorrectKeep = false;
      if (cell.classList.contains("delete")) allCorrectDelete = false;
    }
  });
  if (allCorrectDelete || allCorrectKeep) {
    clearInterval(timerInterval);
    alert(`Gratulálok! Az időd: ${document.getElementById("timer").textContent}`);
    document.querySelectorAll(".cell").forEach(cell => {
      let index = parseInt(cell.dataset.index);
      if (puzzleData.solution.includes(index)) cell.classList.add("delete");
      else cell.classList.add("keep");
    });
  }
}

function generateNewSeed() {
  const newSeed = Math.floor(Math.random() * 1000000).toString();
  const newNegatives = isExtremeMode
    ? Array.from({ length: gridSize * gridSize })
        .map((_, i) => (Math.random() < 0.5 ? i : null))
        .filter(i => i !== null)
        .join(",")
    : "";

  fetch(`${API_BASE}/session/${currentSessionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      seed: newSeed,
      extremeMode: isExtremeMode ? "1" : "0",
      negativeIndices: newNegatives
    })
  })
    .then(() => fetch(`${API_BASE}/session/${currentSessionId}`))
    .then(res => res.json())
    .then(data => {
      currentSeed = parseInt(data.seed);
      isExtremeMode = parseInt(data.extremeMode) === 1;
      negativeIndices = new Set(data.negativeIndices ? data.negativeIndices.split(",").map(Number) : []);
      document.getElementById("extremeMode").checked = isExtremeMode;
      startGame(currentSeed);
    })
    .catch(err => console.error("Seed generálási hiba:", err));
}

function resetBoard() {
  document.querySelectorAll(".cell").forEach(cell => {
    cell.classList.remove("delete", "keep");
  });
}

function giveHint() {
  const unmarked = Array.from(document.querySelectorAll(".cell"))
    .filter(c => !c.classList.contains("delete") && !c.classList.contains("keep") && c.dataset.index);
  if (unmarked.length === 0) return;
  const hint = unmarked[Math.floor(Math.random() * unmarked.length)];
  const index = parseInt(hint.dataset.index);
  const isSolution = puzzleData.solution.includes(index);
  hint.style.backgroundColor = isSolution ? "rgba(255,0,0,0.3)" : "rgba(0,255,0,0.3)";
  setTimeout(() => hint.style.backgroundColor = "", 3000);
}

function updateSumHighlights() {
  for (let row = 0; row < gridSize; row++) {
    let sum = 0;
    for (let col = 0; col < gridSize; col++) {
      const cell = document.getElementById(`cell-${row}-${col}`);
      if (cell && !cell.classList.contains("delete")) {
        sum += parseInt(cell.innerText) || 0;
      }
    }
    const rowSumEl = document.getElementById(`sum-row-${row}`);
    rowSumEl?.classList.toggle("highlight", sum === rowSums[row]);
  }

  for (let col = 0; col < gridSize; col++) {
    let sum = 0;
    for (let row = 0; row < gridSize; row++) {
      const cell = document.getElementById(`cell-${row}-${col}`);
      if (cell && !cell.classList.contains("delete")) {
        sum += parseInt(cell.innerText) || 0;
      }
    }
    const colSumEl = document.getElementById(`sum-col-${col}`);
    colSumEl?.classList.toggle("highlight", sum === colSums[col]);
  }
}

function completeRow(rowIndex) {
  const rowSumEl = document.getElementById(`sum-row-${rowIndex}`);
  if (!rowSumEl?.classList.contains("highlight")) return;
  for (let col = 0; col < gridSize; col++) {
    const cell = document.getElementById(`cell-${rowIndex}-${col}`);
    if (cell && !cell.classList.contains("delete") && !cell.classList.contains("keep")) {
      cell.classList.add("keep");
    }
  }
  updateSumHighlights();
}

function completeColumn(colIndex) {
  const colSumEl = document.getElementById(`sum-col-${colIndex}`);
  if (!colSumEl?.classList.contains("highlight")) return;
  for (let row = 0; row < gridSize; row++) {
    const cell = document.getElementById(`cell-${row}-${colIndex}`);
    if (cell && !cell.classList.contains("delete") && !cell.classList.contains("keep")) {
      cell.classList.add("keep");
    }
  }
  updateSumHighlights();
}
