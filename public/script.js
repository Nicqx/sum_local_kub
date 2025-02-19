let gridSize = parseInt(localStorage.getItem("gridSize")) || 4; // Pályaméret megőrzése
let puzzleData = { numbers: [], solution: [] };
let startTime = null;
let timerInterval = null;
let finalTime = null;
let currentSeed = null;
let rowSums = [];
let colSums = [];
let history = [];
let isExtremeMode = false;
let negativeIndices = new Set(); // Negatív számokat tároló halmaz

// Globális változó a session ID tárolására
let currentSessionId = "1";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Kinyerjük a session ID-t az URL-ből (pl. /85437)
    let pathParts = window.location.pathname.split("/");
    let sessionFromUrl = pathParts[1] || "1"; // Ha nincs, akkor alapértelmezett "1"
    currentSessionId = sessionFromUrl; // Tároljuk a globális változóban

    // Lekérjük az adott session adatait a /api/session/:session végpontról
    let response = await fetch(`/api/session/${sessionFromUrl}`);
    if (!response.ok) {
      // Ha a session nem létezik, visszairányítjuk a főoldalra
      window.location.href = "/";
      return;
    }
    let data = await response.json(); // Várt formátum: { seed: "563351", extremeMode: "0", negativeIndices: "" }
    currentSeed = parseInt(data.seed);
    isExtremeMode = parseInt(data.extremeMode) === 1;
    negativeIndices = new Set(
      data.negativeIndices ? data.negativeIndices.split(",").map(Number) : []
    );

    console.log("Betöltött session:", sessionFromUrl, "Seed:", currentSeed);
    document.getElementById("sizeSelector").value = gridSize;
    document.getElementById("extremeMode").checked = isExtremeMode;
    startGame(currentSeed);
  } catch (error) {
    console.error("Hiba a session adatok betöltésekor:", error);
  }

  document.getElementById("sizeSelector").addEventListener("change", () => {
    changeGridSize();
  });
  document.getElementById("extremeMode").addEventListener("change", async () => {
  // Frissítsük a globális változót
  isExtremeMode = document.getElementById("extremeMode").checked;
  
  // Generáljunk negatív indexeket, ha extrém mód be van kapcsolva
  let newNegativeIndices = "";
  if (isExtremeMode) {
    let indices = [];
    for (let i = 0; i < gridSize * gridSize; i++) {
      if (Math.random() < 0.5) { // 50% eséllyel negatív lesz
        indices.push(i);
      }
    }
    newNegativeIndices = indices.join(",");
  }
  
  // Küldjük el a PUT kérést a session frissítésére a jelenlegi session ID-vel
  try {
    await fetch(`/api/session/${currentSessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seed: currentSeed.toString(), // jelenlegi seed megtartása
        extremeMode: isExtremeMode ? "1" : "0",
        negativeIndices: newNegativeIndices
      })
    });
    // Frissítsük a játékot a jelenlegi seed alapján
    startGame(currentSeed);
  } catch (error) {
    console.error("Hiba az extrém mód frissítésekor:", error);
  }
});

  // Új session létrehozása gomb eseménykezelése
  const newSessionBtn = document.getElementById("newSessionBtn");
  if (newSessionBtn) {
    newSessionBtn.addEventListener("click", async () => {
      try {
        let response = await fetch("/api/session/new", {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
        let data = await response.json();
        // Átirányítjuk a felhasználót az új session URL-re (pl. /85437)
        window.location.href = `/${data.sessionId}`;
      } catch (err) {
        console.error("Hiba az új session létrehozásakor:", err);
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
  history = []; // Visszavonás előzmény törlése

  if (!seed) {
    console.error("Seed nem elérhető, új generálás szükséges!");
    return;
  }

  currentSeed = seed; // Seed megtartása
  generatePuzzle(currentSeed);
}

function pseudoRandom(seed) {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return (seed >>> 16) / 65536; // 0 és 1 közötti véletlen szám
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
      let value = (rng % 9) + 1; // 1-9 közötti értékek

      // Extrém mód logika: ha be van kapcsolva, lehet negatív is
      if (isExtremeMode && negativeIndices.has(i * gridSize + j)) {
        value *= -1;
      }

      puzzleData.numbers.push(value);

      let isDeleted = pseudoRandom(rng) < 0.35; // Véletlenszerű törlés
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
      cell.id = `cell-${i}-${j}`; // Egyedi azonosító minden cellának
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
  
  // MENTÉS: Lépés előtt tároljuk az állapotot
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
      let elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      document.getElementById("timer").textContent = `Idő: ${elapsedTime} másodperc`;
    }
  }, 100);
}

function checkWinCondition() {
  let allCorrectDelete = true;
  let allCorrectKeep = true;

  document.querySelectorAll(".cell").forEach(cell => {
    let index = parseInt(cell.dataset.index);
    let isSolution = puzzleData.solution.includes(index);
    
    if (isSolution) {
      if (!cell.classList.contains("delete")) {
        allCorrectDelete = false;
      }
      if (cell.classList.contains("keep")) {
        allCorrectKeep = false;
      }
    } else {
      if (!cell.classList.contains("keep")) {
        allCorrectKeep = false;
      }
      if (cell.classList.contains("delete")) {
        allCorrectDelete = false;
      }
    }
  });

  if (allCorrectDelete || allCorrectKeep) {
    clearInterval(timerInterval);
    alert(`Gratulálok! Az időd: ${document.getElementById("timer").textContent}`);
    document.querySelectorAll(".cell").forEach(cell => {
      let index = parseInt(cell.dataset.index);
      if (puzzleData.solution.includes(index)) {
        cell.classList.add("delete");
      } else {
        cell.classList.add("keep");
      }
    });
  }
}

// Módosított generateNewSeed, amely a session PUT végpontot hívja
function generateNewSeed() {
  // Generáljunk új seedet (a kliens által, és küldjük a backendnek)
  const newSeed = Math.floor(Math.random() * 1000000).toString();
  // Itt továbbra is feltételezzük, hogy az extrém mód és negatív indexek nem változnak – vagy ezt igény szerint módosítjuk
  fetch(`/api/session/${currentSessionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      seed: newSeed,
      extremeMode: isExtremeMode ? "1" : "0",
      negativeIndices: "" // vagy generálj új negatív indexeket, ha szükséges
    })
  })
    .then(() => {
      // Utána lekérjük az új session adatokat
      return fetch(`/api/session/${currentSessionId}`);
    })
    .then(response => response.json())
    .then(data => {
      currentSeed = parseInt(data.seed);
      isExtremeMode = parseInt(data.extremeMode) === 1;
      negativeIndices = new Set(
        data.negativeIndices ? data.negativeIndices.split(",").map(Number) : []
      );
      document.getElementById("extremeMode").checked = isExtremeMode;
      startGame(currentSeed);
    })
    .catch(error => console.error("Hiba a seed generálásakor:", error));
}

function resetBoard() {
  document.querySelectorAll(".cell").forEach(cell => {
    cell.classList.remove("delete", "keep");
  });
}

function giveHint() {
  let unmarkedCells = Array.from(document.querySelectorAll(".cell")).filter(cell =>
    !cell.classList.contains("delete") && !cell.classList.contains("keep") && cell.dataset.index
  );
  if (unmarkedCells.length === 0) return;
  let hintCell = unmarkedCells[Math.floor(Math.random() * unmarkedCells.length)];
  let index = parseInt(hintCell.dataset.index);
  let isSolution = puzzleData.solution.includes(index);
  if (isSolution) {
    hintCell.style.backgroundColor = "rgba(255, 0, 0, 0.3)";
  } else {
    hintCell.style.backgroundColor = "rgba(0, 255, 0, 0.3)";
  }
  setTimeout(() => {
    hintCell.style.backgroundColor = "";
  }, 3000);
}

function completeColumn(colIndex) {
  let colSumElement = document.getElementById(`sum-col-${colIndex}`);
  if (!colSumElement.classList.contains("highlight")) return; // Ha az oszlopösszeg nem van kiemelve, nem csinálunk semmit!
  
  for (let row = 0; row < gridSize; row++) {
    let cell = document.getElementById(`cell-${row}-${colIndex}`);
    if (!cell) continue;
    if (!cell.classList.contains("delete") && !cell.classList.contains("keep")) {
      cell.classList.add("keep"); // Állítsuk az oszlopban lévő nem jelölt cellákat "keep" osztályra
    }
  }
  
  updateSumHighlights(); // Frissítsük az összeg kiemeléseket
}

function completeRow(rowIndex) {
  let rowSumElement = document.getElementById(`sum-row-${rowIndex}`);
  if (!rowSumElement.classList.contains("highlight")) return; // Ha a sorösszeg nincs kiemelve, nem csinálunk semmit!
  
  for (let col = 0; col < gridSize; col++) {
    let cell = document.getElementById(`cell-${rowIndex}-${col}`);
    if (!cell) continue;
    if (!cell.classList.contains("delete") && !cell.classList.contains("keep")) {
      cell.classList.add("keep"); // Állítsuk a sorban lévő nem jelölt cellákat "keep" osztályra
    }
  }
  
  updateSumHighlights();
}

function updateSumHighlights() {
  if (!rowSums || !colSums) return;

  // Sorösszegek frissítése és kiemelése
  for (let row = 0; row < gridSize; row++) {
    let currentRowSum = 0;
    for (let col = 0; col < gridSize; col++) {
      let cell = document.getElementById(`cell-${row}-${col}`);
      if (!cell) continue;
      let cellValue = parseInt(cell.innerText) || 0;
      if (!cell.classList.contains("delete")) {
        currentRowSum += cellValue;
      }
    }
    let rowSumElement = document.getElementById(`sum-row-${row}`);
    if (rowSumElement) {
      if (currentRowSum === rowSums[row]) {
        rowSumElement.classList.add("highlight");
      } else {
        rowSumElement.classList.remove("highlight");
      }
    }
  }

  // Oszlopösszegek frissítése és kiemelése
  for (let col = 0; col < gridSize; col++) {
    let currentColSum = 0;
    for (let row = 0; row < gridSize; row++) {
      let cell = document.getElementById(`cell-${row}-${col}`);
      if (!cell) continue;
      let cellValue = parseInt(cell.innerText) || 0;
      if (!cell.classList.contains("delete")) {
        currentColSum += cellValue;
      }
    }
    let colSumElement = document.getElementById(`sum-col-${col}`);
    if (colSumElement) {
      if (currentColSum === colSums[col]) {
        colSumElement.classList.add("highlight");
      } else {
        colSumElement.classList.remove("highlight");
      }
    }
  }
}
