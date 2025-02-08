const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 8080;
const FILE_PATH = path.join(__dirname, "public", "random_szam.txt");

app.use(express.static("public"));
app.use(express.json());

// 📌 Ha a fájl nem létezik, hozzunk létre egy alapértelmezett seedet
if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, "123456:0:"); // Alapértelmezett seed, extrém mód ki
}

// Olvassuk be és küldjük vissza a `random_szam.txt` tartalmát
app.get("/random_szam.txt", (req, res) => {
    fs.readFile(FILE_PATH, "utf8", (err, data) => {
	if (err) {
            return res.status(500).send("Hiba a fájl olvasásakor");
        }
        res.send(data);
    });
});

// 📌 Új seed generálása és extrém mód mentése
app.put("/random_szam.txt", (req, res) => {
    const newSeed = Math.floor(Math.random() * 1000000);
    const extremeMode = Math.random() < 0.5 ? 1 : 0; // 50% esély extrém módra

    let negativeIndices = [];
    if (extremeMode) {
        for (let i = 0; i < 81; i++) { // 9x9 max méret, de a játék úgyis csak a megfelelő méretig nézi
            if (Math.random() < 0.5) { // 50% eséllyel negatív lesz
                negativeIndices.push(i);
            }
        }
    }

    const newContent = `${newSeed}:${extremeMode}:${negativeIndices.join(",")}`;

    fs.writeFile(FILE_PATH, newContent, (err) => {
        if (err) {
            return res.status(500).send("Hiba a fájl írásakor");
        }
        res.send(`Új seed generálva: ${newSeed}, Extrém mód: ${extremeMode}, Negatív számok: ${negativeIndices}`);
    });
});

app.listen(PORT, () => {
    console.log(`Szerver fut: http://localhost:${PORT}`);
});
