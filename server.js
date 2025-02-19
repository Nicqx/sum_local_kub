const express = require("express");
const Redis = require("ioredis");
const path = require("path");

const app = express();
const PORT = 8080;

// Redis kapcsolat: a Kubernetes-ben a Redis Service neve (vagy helyileg "redis-service")
const redis = new Redis({
  host: process.env.REDIS_HOST || "redis-service",
  port: process.env.REDIS_PORT || 6379,
});

app.use(express.json());
// Statikus fájlok kiszolgálása a "public" mappából
app.use(express.static("public"));

/* --- Session API végpontok (/api/session/...) --- */

// Biztosítjuk, hogy a "1" session mindig létezzen (nincs TTL)
async function ensureDefaultSession() {
  const key = "session:1";
  const exists = await redis.exists(key);
  if (!exists) {
    await redis.set(key, "123456:0:", "NX");
    console.log("Default session '1' created.");
  }
}
ensureDefaultSession();

// GET /api/session/current – lekéri az alapértelmezett ("1") session adatait
app.get("/api/session/current", async (req, res) => {
  const key = "session:1";
  try {
    const data = await redis.get(key);
    if (!data) {
      return res.json({ seed: "123456", extremeMode: "0", negativeIndices: "" });
    }
    const parts = data.split(":");
    res.json({ seed: parts[0], extremeMode: parts[1] || "0", negativeIndices: parts[2] || "" });
  } catch (err) {
    console.error("Error retrieving default session:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/session/:session – lekéri az adott session adatait
app.get("/api/session/:session", async (req, res) => {
  const sessionId = req.params.session;
  const key = `session:${sessionId}`;
  try {
    const data = await redis.get(key);
    if (!data) {
      return res.status(404).json({ error: "Session not found" });
    }
    const parts = data.split(":");
    res.json({ seed: parts[0], extremeMode: parts[1] || "0", negativeIndices: parts[2] || "" });
  } catch (err) {
    console.error("Error retrieving session:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/session/new – Új session létrehozása (5 számjegyű sessionId, TTL 1 óra)
app.post("/api/session/new", async (req, res) => {
  let sessionId;
  do {
    sessionId = (Math.floor(Math.random() * 90000) + 10000).toString();
  } while (sessionId === "1"); // Ne legyen "1"
  
  const seed = Math.floor(Math.random() * 1000000).toString();
  const extremeMode = "0"; // alapértelmezetten ki van kapcsolva
  const negativeIndices = ""; // üres
  const key = `session:${sessionId}`;
  
  try {
    await redis.set(key, `${seed}:${extremeMode}:${negativeIndices}`, "EX", 3600);
    res.json({ sessionId, seed, extremeMode, negativeIndices });
  } catch (err) {
    console.error("Error creating new session:", err);
    res.status(500).send("Server error");
  }
});

// PUT /api/session/:session – Meglévő session adatainak frissítése
app.put("/api/session/:session", async (req, res) => {
  const sessionId = req.params.session;
  const key = `session:${sessionId}`;
  const { seed, extremeMode, negativeIndices } = req.body;
  if (!seed) {
    return res.status(400).send("Missing seed");
  }
  try {
    if (sessionId === "1") {
      // Az alap sessionnél nincs TTL
      await redis.set(key, `${seed}:${extremeMode}:${negativeIndices}`);
    } else {
      await redis.set(key, `${seed}:${extremeMode}:${negativeIndices}`, "EX", 3600);
    }
    res.json({ sessionId, seed, extremeMode, negativeIndices });
  } catch (err) {
    console.error("Error updating session:", err);
    res.status(500).send("Server error");
  }
});

/* --- Catch-all: minden nem API kéréshez szolgáltatjuk az index.html-t --- */
app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
