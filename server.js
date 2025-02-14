const express = require("express");
const Redis = require("ioredis");
const path = require("path");

const app = express();
const PORT = 8080;

// Redis kapcsolat: a Kubernetes-ben a Redis Service neve pl. "redis-service"
const redis = new Redis({
  host: process.env.REDIS_HOST || "redis-service",
  port: process.env.REDIS_PORT || 6379,
});

app.use(express.static("public"));
app.use(express.json());

// Ha még nincs tárolva session adat a Redis-ben, állítsuk be az alapértelmezett értékeket.
// Itt az alapértelmezett seed: 123456, extrém mód ki, negatív indexek: üres.
async function ensureDefaultSession() {
  const data = await redis.get("sessionData");
  if (!data) {
    await redis.set("sessionData", "123456:0:");
  }
}
ensureDefaultSession();

// GET végpont: A Redis-ben tárolt session adatokat küldi vissza, ugyanabban a formátumban, mint a korábbi fájl (pl. "123456:0:" vagy "seed:extreme:negIndices")
app.get("/random_szam.txt", async (req, res) => {
  try {
    const data = await redis.get("sessionData");
    if (!data) {
      return res.send("123456:0:");
    }
    res.send(data);
  } catch (err) {
    console.error("Hiba a Redis olvasásakor:", err);
    res.status(500).send("Hiba a Redis olvasásakor");
  }
});

// PUT végpont: Új seed generálása, extrém mód érték és negatív indexek kiszámítása, majd ezek mentése a Redis-ben
app.put("/random_szam.txt", async (req, res) => {
  const newSeed = Math.floor(Math.random() * 1000000);
  const extremeMode = Math.random() < 0.5 ? 1 : 0; // 50% esély extrém módra

  let negativeIndices = [];
  if (extremeMode) {
    for (let i = 0; i < 81; i++) { // 9x9 max méret, de a játék a megfelelő méretig nézi
      if (Math.random() < 0.5) { // 50% eséllyel negatív lesz
        negativeIndices.push(i);
      }
    }
  }

  const newContent = `${newSeed}:${extremeMode}:${negativeIndices.join(",")}`;

  try {
    await redis.set("sessionData", newContent);
    res.send(`Új seed generálva: ${newSeed}, Extrém mód: ${extremeMode}, Negatív számok: ${negativeIndices}`);
  } catch (err) {
    console.error("Hiba a Redis írásakor:", err);
    res.status(500).send("Hiba a Redis írásakor");
  }
});

app.listen(PORT, () => {
  console.log(`Szerver fut: http://localhost:${PORT}`);
});

// Új végpont, amely JSON formátumban adja vissza a session adatokat
app.get("/session/current", async (req, res) => {
  try {
    const data = await redis.get("sessionData");
    if (!data) {
      // Ha nincs adat, visszaküldheted az alapértelmezett értékeket
      return res.json({ seed: "123456", extremeMode: "0", negativeIndices: "" });
    }
    // A korábban mentett formátum: "seed:extremeMode:negativeIndices"
    const parts = data.split(":");
    res.json({ seed: parts[0], extremeMode: parts[1], negativeIndices: parts[2] });
  } catch (err) {
    console.error("Hiba a Redis olvasásakor:", err);
    res.status(500).json({ error: "Hiba a session adatok olvasásakor" });
  }
});
