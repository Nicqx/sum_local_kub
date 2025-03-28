const express = require("express");
const Redis = require("ioredis");
const path = require("path");

const app = express();
const PORT = 8080;

// Redis kapcsolat
const redis = new Redis({
  host: process.env.REDIS_HOST || "redis-service",
  port: process.env.REDIS_PORT || 6379,
});

app.use(express.json());
app.use("/sumplete", express.static(path.join(__dirname, "public")));

// Session API-k átkerülnek /sumplete/api alá
app.get("/sumplete/api/session/current", async (req, res) => {
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

app.get("/sumplete/api/session/:session", async (req, res) => {
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

app.post("/sumplete/api/session/new", async (req, res) => {
  let sessionId;
  do {
    sessionId = (Math.floor(Math.random() * 90000) + 10000).toString();
  } while (sessionId === "1");

  const seed = Math.floor(Math.random() * 1000000).toString();
  const extremeMode = "0";
  const negativeIndices = "";
  const key = `session:${sessionId}`;

  try {
    await redis.set(key, `${seed}:${extremeMode}:${negativeIndices}`, "EX", 3600);
    res.json({ sessionId, seed, extremeMode, negativeIndices });
  } catch (err) {
    console.error("Error creating new session:", err);
    res.status(500).send("Server error");
  }
});

app.put("/sumplete/api/session/:session", async (req, res) => {
  const sessionId = req.params.session;
  const key = `session:${sessionId}`;
  const { seed, extremeMode, negativeIndices } = req.body;
  if (!seed) return res.status(400).send("Missing seed");

  try {
    if (sessionId === "1") {
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

// Catch-all route: ha bármi másra jön kérés, visszaadjuk az index.html-t
app.get("/sumplete/*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Szerver fut: http://localhost:${PORT}/sumplete`);
});
