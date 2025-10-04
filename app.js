require("dotenv").config();
const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const express = require("express");
const fs = require("fs");
const path = require("path");

const manifest = require("./manifest.json");
const { addDays, dayAfter, getCurrentDate } = require("./utils/helpers");
const { getAiringAnime } = require("./scrapers/ranker");
const AniList = require("./scrapers/Anilist");
const Storage = require("./classes/Storage");
const { getNetflixOrignals } = require("./scrapers/netflix");

const PORT = process.env.PORT || 7000;
const omdbAPIKey = process.env.OMDB_API_KEY;
const NEXT_DAYS = process.env.NEXT_DAYS || 3;
const storagePath = path.join(__dirname, "/storage/db.json");
const db = new Storage(storagePath);

const builder = new addonBuilder(manifest);

// --- Define Stremio Catalog Handler ---
builder.defineCatalogHandler(async ({ id, config }) => {
  try {
    if (!omdbAPIKey) return { metas: [] };

    const anilist = new AniList(omdbAPIKey);
    const cacheKey = id;
    const MAX_ANIME = 50;
    let cachedData = db.get(cacheKey) || [];
    let nextUpdateDate = db.get("nextUpdateDate");

    

    const shouldUpdate = !nextUpdateDate || dayAfter(nextUpdateDate) || cachedData.length <= 0;

    if (shouldUpdate) {
      const updatedOn =  getCurrentDate();
      const willNextUpdateOn =  addDays(NEXT_DAYS)

      console.log('willNextUpdateOn: ', willNextUpdateOn);
      console.log('updatedOn: ', updatedOn);

      
      db.set("updatedOn",updatedOn);
      db.set("nextUpdateDate",willNextUpdateOn);

      switch (cacheKey) {
        case "top-airing-ranker":
          db.set(cacheKey, await getAiringAnime(MAX_ANIME));
          break;
        case "top-airing-anilist":
          db.set(cacheKey, await anilist.getAiringNow(MAX_ANIME));
          break;
        case "top-anilist":
          db.set(cacheKey, await anilist.getTopAnime(MAX_ANIME));
          break;
        case "season-anilist":
          db.set(cacheKey, await anilist.getSeasonalAnime(MAX_ANIME));
          break;
        case "popular-anilist":
          db.set(cacheKey, await anilist.getPopularAnime(MAX_ANIME));
          break;
        case "next-to-watch-anilist":
          db.set(cacheKey, await anilist.getNextToWatch(MAX_ANIME));
          break;
        case "upcoming-anilist":
          db.set(cacheKey, await anilist.getUpcomingAnime(MAX_ANIME));
          break;
        case "top-netflix-originals":
          db.set(cacheKey, await getNetflixOrignals(MAX_ANIME));
          break;
        default:
          break;
      }
    }

    if (cachedData.length <= 0) cachedData = db.get(cacheKey);

    const selectedCatalog = Object.keys(config);
    const selected = selectedCatalog.some((o) => o === id);
    cachedData = (selected && cachedData) || [];

    return { metas: cachedData };
  } catch (err) {
    console.error("Catalog handler error:", err);
    return { metas: [] };
  }
});

// --- Serve Stremio Interface ---
serveHTTP(builder.getInterface(), { port: PORT });

// --- Express App for Custom Endpoints ---
const app = express();

// ✅ Endpoint: Get database content
app.get("/db", (req, res) => {
  try {
    const data = fs.readFileSync(storagePath, "utf-8");
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.parse(data));
  } catch (err) {
    console.error("Error reading db.json:", err);
    res.status(500).json({ error: "Failed to read database file." });
  }
});

// ✅ Start the Express API on a separate port
const EXPRESS_PORT = process.env.EXPRESS_PORT || 7001;
app.listen(EXPRESS_PORT, () => {
  console.log(`🟢 Express endpoint running on http://localhost:${EXPRESS_PORT}/db`);
});
