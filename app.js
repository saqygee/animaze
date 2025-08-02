require("dotenv").config();
const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const manifest = require("./manifest.json");
const PORT = process.env.PORT || 7000;
const builder = new addonBuilder(manifest);
const path = require("path");
const { addDays, dayAfter } = require("./utils/helpers");
const { getAiringAnime } = require("./scrapers/ranker");
const AniList = require("./scrapers/Anilist");
const Storage = require("./classes/Storage");
//!INIT BLOCK
const omdbAPIKey = process.env.OMDB_API_KEY;
const NEXT_DAYS = process.env.NEXT_DAYS;
const storagePath = path.join(__dirname, "/storage/db.json");
const db = new Storage(storagePath);

builder.defineCatalogHandler(async ({ id, config }) => {
  try {
    if (!omdbAPIKey) return { metas: [] };

    const anilist = new AniList(omdbAPIKey);
    const cacheKey = id; // Store metas under this ID
    const MAX_ANIME = 50;
    let cachedData = db.get(cacheKey) || [];
    let nextUpdateDate = db.get("nextUpdateDate");

    const selectedCatalog = Object.keys(config);

    const shouldUpdate =
      !nextUpdateDate || dayAfter(nextUpdateDate) || cachedData.length <= 0;

    if (shouldUpdate) {
      // Update shared date once
      db.set("nextUpdateDate", addDays(7));
      console.log(`Updating catalog: ${cacheKey}`);

      switch (cacheKey) {
        case "top-airing-ranker":
          const rankerResults = await getAiringAnime(MAX_ANIME);
          db.set(cacheKey, rankerResults);
          break;
        case "top-airing-anilist":
          const anilistResults = await anilist.getAiringNow(MAX_ANIME);
          db.set(cacheKey, anilistResults);
          break;
        case "top-anilist":
          const topAnilistResults = await anilist.getTopAnime(MAX_ANIME);
          db.set(cacheKey, topAnilistResults);
          break;
        case "season-anilist":
          const seasonalAnilistResults = await anilist.getSeasonalAnime(
            MAX_ANIME
          );
          db.set(cacheKey, seasonalAnilistResults);
          break;
        case "popular-anilist":
          const POPULARAnilistResults = await anilist.getPopularAnime(
            MAX_ANIME
          );
          db.set(cacheKey, POPULARAnilistResults);
          break;
        case "next-to-watch-anilist":
          const nextAnilistResults = await anilist.getNextToWatch(MAX_ANIME);
          db.set(cacheKey, nextAnilistResults);
          break;
        case "upcoming-anilist":
          const upcomingAnilistResults = await anilist.getUpcomingAnime(
            MAX_ANIME
          );
          db.set(cacheKey, upcomingAnilistResults);
          break;
        default:
          break;
      }
    }
    //! Executes only initally
    if (cachedData.length <= 0) cachedData = db.get(cacheKey);
    //! meta for selected anime
    const selected = selectedCatalog.some((o) => o === id);
    cachedData = (selected && cachedData) || [];
    return { metas: cachedData };
  } catch (err) {
    console.error("Catalog handler error:", err);
    return { metas: [] };
  }
});

// 🚀 Serve it
serveHTTP(builder.getInterface(), { port: PORT });
