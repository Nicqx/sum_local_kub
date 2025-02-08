let gridSize = parseInt(localStorage.getItem("gridSize")) || 4; // 🔥 Pályaméret megőrzése
let puzzleData = { numbers: [], solution: [] };
let startTime = null;
let timerInterval = null;
let finalTime = null;
let currentSeed = null;
let rowSums = [];
let colSums = [];
let history = [];
let isExtremeMode = false;
let negativeIndices = new Set(); // 🔥 Negatív számokat tároló halmaz

document.addEventListener("DOMContentLoaded", async () => {
	    try {
		            let response = await fetch("/random_szam.txt");
		            let data = await response.text(); // 🔥 Itt biztosítjuk, hogy a data létezik!

		            let parsedData = data.trim().split(":");
		            currentSeed = parseInt(parsedData[0]);
		            isExtremeMode = parseInt(parsedData[1]) === 1;
		            negativeIndices = new Set(parsedData[2] ? parsedData[2].split(",").map(Number) : []);

	    		    console.log("Betöltött seed:", currentSeed);
	    		    document.getElementById("sizeSelector").value = gridSize; // ✅ Méret visszaállítása
            		    document.getElementById("extremeMode").checked = isExtremeMode; // 🔥 Extrém mód kapcsoló beállítása
            		    startGame(currentSeed); // 🔄 Csak a meglévő seedet használjuk!
  	    } catch (error) {
	          	    console.error("Hiba a seed betöltésekor:", error);
	    }
    document.getElementById("sizeSelector").addEventListener("change", () => {
    	changeGridSize();
    });
    document.getElementById("extremeMode").addEventListener("change", (event) => {
        startGame(currentSeed); // 🔥 Most már nem változtatja az extrém módot utólag! 
    });
});

function reloadPage() {
	    location.reload(); // 🔥 Újratölti az oldalt anélkül, hogy új seedet generálna
}

function changeGridSize() {
	    gridSize = parseInt(document.getElementById("sizeSelector").value);
	    localStorage.setItem("gridSize", gridSize); // ✅ Pályaméret mentése
	    startGame(currentSeed);
}

function startGame(seed) {
    startTime = null;
    finalTime = null;
    clearInterval(timerInterval);
    document.getElementById("timer").textContent = "Idő: 00:00";
    history = []; // 🔥 Visszavonás előzmény törlése

    if (!seed) {
        console.error("Seed nem elérhető, új generálás szükséges!");
        return;
    }

    currentSeed = seed; // 🔒 Seed megtartása
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
	
	    // 🔥 Extrém mód logika: ha be van kapcsolva, lehet negatív is
            if (isExtremeMode && negativeIndices.has(i * gridSize + j)) {
                value *= -1;
            }

            puzzleData.numbers.push(value);

            let isDeleted = pseudoRandom(rng) < 0.35; // 🔥 Véletlenszerű törlés
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
            cell.id = `cell-${i}-${j}`; // 🔥 Egyedi azonosító minden cellának
            cell.addEventListener("click", () => toggleCellState(cell));
            grid.appendChild(cell);
        }

        const rowSumCell = document.createElement("div");
        rowSumCell.classList.add("cell", "sum-cell");
        rowSumCell.style.background = "#ddd";
        rowSumCell.style.fontWeight = "bold";
        rowSumCell.textContent = rowSums[i];
        rowSumCell.id = `sum-row-${i}`; // 🔥 Hozzáadunk egy azonosítót a sorösszeg mezőkhöz!
        grid.appendChild(rowSumCell);
	rowSumCell.addEventListener("click", () => completeRow(i));
    }

    for (let j = 0; j < gridSize; j++) {
        const colSumCell = document.createElement("div");
        colSumCell.classList.add("cell", "sum-cell");
        colSumCell.style.background = "#ddd";
        colSumCell.style.fontWeight = "bold";
        colSumCell.textContent = colSums[j];
	colSumCell.id = `sum-col-${j}`; // 🔥 Hozzáadunk egy azonosítót az oszlopösszeg mezőkhöz!
        grid.appendChild(colSumCell);
	colSumCell.addEventListener("click", () => completeColumn(j));
    }

    const emptyCorner = document.createElement("div");
    emptyCorner.classList.add("cell", "sum-cell");
    emptyCorner.style.background = "#ddd";
    emptyCorner.textContent = "";
    grid.appendChild(emptyCorner);
    updateSumHighlights(); // ✅ Pálya generálás után azonnal lefuttatjuk az ellenőrzést
}

function saveHistory() {
    let currentState = Array.from(document.querySelectorAll(".cell"))
        .map(cell => ({
            index: cell.dataset.index,
            classList: Array.from(cell.classList) // 🔥 Cellák állapotának mentése
        }));
    history.push(currentState);
}

function undoMove() {
    if (history.length === 0) return; // 📌 Ha nincs mit visszavonni, kilép

    let lastState = history.pop(); // 🔄 Az utolsó lépés betöltése

    lastState.forEach(state => {
        let cell = document.querySelector(`[data-index='${state.index}']`);
        if (cell) {
            cell.className = "cell"; // 🔄 Alaphelyzetbe állítjuk
            state.classList.forEach(cls => cell.classList.add(cls)); // 🔥 Az előző osztályokat visszaadjuk
        }
    });

    updateSumHighlights(); // 🔄 Frissítjük a kiemeléseket
}

function toggleCellState(cell) {
    if (!startTime) {
        startTime = Date.now();
        startTimer();
    }
    
    // 🔥 MENTÉS: Lépés előtt tároljuk az állapotot
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
                allCorrectDelete = false; // Ha egy pirosra jelölendő nincs pirosan, akkor nem nyerhetünk
            }
            if (cell.classList.contains("keep")) {
                allCorrectKeep = false; // Ha egy pirosra jelölendő zöld, akkor nem nyerhetünk
            }
        } else {
            if (!cell.classList.contains("keep")) {
                allCorrectKeep = false; // Ha egy zöldre jelölendő nincs zölden, akkor nem nyerhetünk
            }
            if (cell.classList.contains("delete")) {
                allCorrectDelete = false; // Ha egy zöldre jelölendő piros, akkor nem nyerhetünk
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

function generateNewSeed() {
    fetch("/random_szam.txt", { method: "PUT" })
        .then(() => {
            fetch("/random_szam.txt")
                .then(response => response.text())
                .then(data => {
		    let parsedData = data.trim().split(":");
		    currentSeed = parseInt(parsedData[0]);
		    isExtremeMode = parseInt(parsedData[1]) === 1;
		    negativeIndices = new Set(parsedData[2] ? parsedData[2].split(",").map(Number) : []);
			                    
		    document.getElementById("extremeMode").checked = isExtremeMode;
		    startGame(currentSeed);

                });
        })
        .catch(error => console.error("Hiba a seed generálásakor:", error));
}

function resetBoard() {
    document.querySelectorAll(".cell").forEach(cell => {
        cell.classList.remove("delete", "keep");
    });
}

function giveHint() {
    let unmarkedCells = Array.from(document.querySelectorAll(".cell"))
        .filter(cell => !cell.classList.contains("delete") && !cell.classList.contains("keep") && cell.dataset.index);

    if (unmarkedCells.length === 0) return; // Ha minden jelölve van, ne adjon tippet

    let hintCell = unmarkedCells[Math.floor(Math.random() * unmarkedCells.length)];
    let index = parseInt(hintCell.dataset.index);
    let isSolution = puzzleData.solution.includes(index);

    if (isSolution) {
        hintCell.style.backgroundColor = "rgba(255, 0, 0, 0.3)"; // Halvány piros, ha törlendő
    } else {
        hintCell.style.backgroundColor = "rgba(0, 255, 0, 0.3)"; // Halvány zöld, ha megtartandó
    }

    // 3 másodperc után visszaállítjuk az eredeti háttérszínt
    setTimeout(() => {
        hintCell.style.backgroundColor = "";
    }, 3000);
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

function completeRow(rowIndex) {
    let rowSumElement = document.getElementById(`sum-row-${rowIndex}`);
    if (!rowSumElement.classList.contains("highlight")) return; // Ha nem halványzöld, ne csináljunk semmit!

    for (let col = 0; col < gridSize; col++) {
        let cell = document.getElementById(`cell-${rowIndex}-${col}`);
        if (!cell) continue;
        if (!cell.classList.contains("delete") && !cell.classList.contains("keep")) {
            cell.classList.add("keep"); // Maradék fehér mezőket zöldre állítjuk
        }
    }
    updateSumHighlights(); // Frissítjük a jelöléseket
}

function completeColumn(colIndex) {
    let colSumElement = document.getElementById(`sum-col-${colIndex}`);
    if (!colSumElement.classList.contains("highlight")) return; // Ha nem halványzöld, ne csináljunk semmit!

    for (let row = 0; row < gridSize; row++) {
        let cell = document.getElementById(`cell-${row}-${colIndex}`);
        if (!cell) continue;
        if (!cell.classList.contains("delete") && !cell.classList.contains("keep")) {
            cell.classList.add("keep"); // Maradék fehér mezőket zöldre állítjuk
        }
    }
    updateSumHighlights(); // Frissítjük a jelöléseket
}
