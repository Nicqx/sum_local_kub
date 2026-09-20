const express = require("express");
const Redis = require("ioredis");
const path = require("path");

const app = express();

const PORT = Number(process.env.PORT || 8080);
const REDIS_HOST = process.env.REDIS_HOST || "redis-service";
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const REDIS_KEY_PREFIX = process.env.REDIS_KEY_PREFIX || "sumplete:session";
const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 3600);

const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  retryStrategy(times) {
    return Math.min(times * 100, 3000);
  },
});

app.use(express.json());
app.use("/sumplete", express.static(path.join(__dirname, "public")));

app.get("/livez", (req, res) => {
  res.json({ ok: true });
});

function sessionKey(sessionId) {
  return `${REDIS_KEY_PREFIX}:${sessionId}`;
}

function legacySessionKey(sessionId) {
  return `session:${sessionId}`;
}

function encodeSession({ seed, extremeMode = "0", negativeIndices = "" }) {
  return `${seed}:${extremeMode || "0"}:${negativeIndices || ""}`;
}

function decodeSession(raw) {
  const parts = String(raw || "").split(":");
  return {
    seed: parts[0] || "123456",
    extremeMode: parts[1] || "0",
    negativeIndices: parts[2] || "",
  };
}

async function getSessionData(sessionId) {
  const key = sessionKey(sessionId);
  let data = await redis.get(key);

  if (!data) {
    // Kompatibilitás a korábbi kulcsnévvel: session:<id>
    data = await redis.get(legacySessionKey(sessionId));
  }

  if (!data && sessionId === "1") {
    return { seed: "123456", extremeMode: "0", negativeIndices: "" };
  }

  return data ? decodeSession(data) : null;
}

async function saveSessionData(sessionId, payload) {
  const key = sessionKey(sessionId);
  const encoded = encodeSession(payload);

  if (sessionId === "1") {
    await redis.set(key, encoded);
  } else {
    await redis.set(key, encoded, "EX", SESSION_TTL_SECONDS);
  }
}

function createSessionId() {
  return (Math.floor(Math.random() * 90000) + 10000).toString();
}

app.get("/healthz", async (req, res) => {
  try {
    await redis.ping();
    res.json({ ok: true, redis: "ok" });
  } catch (err) {
    console.error("Health check failed:", err);
    res.status(500).json({ ok: false, redis: "error" });
  }
});

app.get("/sumplete/api/session/current", async (req, res) => {
  try {
    const data = await getSessionData("1");
    res.json(data);
  } catch (err) {
    console.error("Error retrieving default session:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/sumplete/api/session/:session", async (req, res) => {
  const sessionId = req.params.session;

  try {
    const data = await getSessionData(sessionId);

    if (!data) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json(data);
  } catch (err) {
    console.error("Error retrieving session:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/sumplete/api/session/new", async (req, res) => {
  const extremeMode = "0";
  const negativeIndices = "";

  try {
    for (let attempt = 0; attempt < 20; attempt++) {
      const sessionId = createSessionId();

      if (sessionId === "1") {
        continue;
      }

      const seed = Math.floor(Math.random() * 1000000).toString();
      const key = sessionKey(sessionId);
      const value = encodeSession({ seed, extremeMode, negativeIndices });

      const result = await redis.set(
        key,
        value,
        "EX",
        SESSION_TTL_SECONDS,
        "NX"
      );

      if (result === "OK") {
        return res.json({ sessionId, seed, extremeMode, negativeIndices });
      }
    }

    res.status(503).json({ error: "Could not allocate session id" });
  } catch (err) {
    console.error("Error creating new session:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/sumplete/api/session/:session", async (req, res) => {
  const sessionId = req.params.session;
  const { seed, extremeMode = "0", negativeIndices = "" } = req.body || {};

  if (!seed) {
    return res.status(400).json({ error: "Missing seed" });
  }

  try {
    const payload = {
      seed: String(seed),
      extremeMode: String(extremeMode || "0"),
      negativeIndices: String(negativeIndices || ""),
    };

    await saveSessionData(sessionId, payload);

    res.json({ sessionId, ...payload });
  } catch (err) {
    console.error("Error updating session:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/sumplete", (req, res) => {
  res.redirect("/sumplete/");
});

app.get("/sumplete/*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Sumplete server running on port ${PORT}`);
  console.log(`✅ Public path: /sumplete`);
  console.log(`✅ Redis: ${REDIS_HOST}:${REDIS_PORT}`);
  console.log(`✅ Redis key prefix: ${REDIS_KEY_PREFIX}`);
});
