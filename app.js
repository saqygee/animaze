require("dotenv").config();
const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const manifest = require("./manifest.json");
const PORT = process.env.PORT || 7000;
const builder = new addonBuilder(manifest);
const path = require("path");
const { addDays, dayAfter } = require("./utils/helpers");
const { getAiringAnime } = require("./scrapers/ranker");
const NodePersist = require("./classes/NodePersist");

//!INIT BLOCK
const omdbAPIKey = process.env.OMDB_API_KEY;
const NEXT_DAYS = process.env.NEXT_DAYS;
const storagePath = path.join(__dirname, "/storage");
const db = new NodePersist(storagePath);

builder.defineCatalogHandler(async () => {
  if (!omdbAPIKey) return { metas: [] };

  let cachedData = (await db.get("airing")) || [];
  let nextUpdateDate = await db.get("nextUpdateDate");

  if (!nextUpdateDate || dayAfter(nextUpdateDate) || cachedData.length <= 0) {
    await db.set("nextUpdateDate", addDays(NEXT_DAYS));
    await getAiringAnime(omdbAPIKey, db);
    cachedData = (await db.get("airing")) || [];
  }

  return { metas: cachedData };
});

// 🚀 Serve it
serveHTTP(builder.getInterface(), { port: PORT });
