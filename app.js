require("dotenv").config();
const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const express = require("express");

const manifest = require("./manifest.json");
const { addDays, dayAfter, getCurrentDate } = require("./utils/helpers");
const { getAiringAnime } = require("./scrapers/ranker");
const AniList = require("./scrapers/Anilist");
const { getNetflixOrignals } = require("./scrapers/netflix");

const PORT = process.env.PORT || 7000;
const omdbAPIKey = process.env.OMDB_API_KEY;
const NEXT_DAYS = process.env.NEXT_DAYS || 3;

// In-memory storage instead of file-based storage
const memoryStorage = new Map();

const builder = new addonBuilder(manifest);

// --- Define Stremio Catalog Handler ---
builder.defineCatalogHandler(async ({ id, config }) => {
  try {
    if (!omdbAPIKey) return { metas: [] };

    const anilist = new AniList(omdbAPIKey);
    const cacheKey = id;
    const MAX_ANIME = 50;
    let cachedData = memoryStorage.get(cacheKey) || [];
    let nextUpdateDate = memoryStorage.get("nextUpdateDate");

    const shouldUpdate = !nextUpdateDate || dayAfter(nextUpdateDate) || cachedData.length <= 0;
    console.log('shouldUpdate: ', shouldUpdate);

    if (shouldUpdate) {
      const updatedOn = getCurrentDate();
      const willNextUpdateOn = addDays(NEXT_DAYS);

      console.log('willNextUpdateOn: ', willNextUpdateOn);
      console.log('updatedOn: ', updatedOn);

      memoryStorage.set("updatedOn", updatedOn);
      memoryStorage.set("nextUpdateDate", willNextUpdateOn);

      switch (cacheKey) {
        case "top-airing-ranker":
          memoryStorage.set(cacheKey, await getAiringAnime(MAX_ANIME));
          break;
        case "top-airing-anilist":
          memoryStorage.set(cacheKey, await anilist.getAiringNow(MAX_ANIME));
          break;
        case "top-anilist":
          memoryStorage.set(cacheKey, await anilist.getTopAnime(MAX_ANIME));
          break;
        case "season-anilist":
          memoryStorage.set(cacheKey, await anilist.getSeasonalAnime(MAX_ANIME));
          break;
        case "popular-anilist":
          memoryStorage.set(cacheKey, await anilist.getPopularAnime(MAX_ANIME));
          break;
        case "next-to-watch-anilist":
          memoryStorage.set(cacheKey, await anilist.getNextToWatch(MAX_ANIME));
          break;
        case "upcoming-anilist":
          memoryStorage.set(cacheKey, await anilist.getUpcomingAnime(MAX_ANIME));
          break;
        case "top-netflix-originals":
          memoryStorage.set(cacheKey, await getNetflixOrignals(MAX_ANIME));
          break;
        default:
          break;
      }
    }

    if (cachedData.length <= 0) cachedData = memoryStorage.get(cacheKey);

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