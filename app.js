require("dotenv").config();
const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = require("./manifest.json");
const { addDays, dayAfter, getCurrentDate } = require("./utils/helpers");
const { getAiringAnime } = require("./scrapers/ranker");
const AniList = require("./scrapers/Anilist");

const PORT = process.env.PORT || 7000;
const omdbAPIKey = process.env.OMDB_API_KEY;
const NEXT_DAYS = process.env.NEXT_DAYS || 1;

// In-memory storage with individual catalog tracking
const memoryStorage = new Map();
const updatePromises = new Map();
const catalogUpdateDates = new Map(); // Track update dates per catalog

const builder = new addonBuilder(manifest);

// Initialize catalog update dates
const initializeCatalogDates = () => {
  const validCatalogs = [
    "top-airing-ranker",
    "top-airing-anilist", 
    "top-anilist",
    "season-anilist",
    "popular-anilist",
    "next-to-watch-anilist",
    "upcoming-anilist",
    "trending-now-anilist"
  ];
  
  validCatalogs.forEach(catalog => {
    if (!catalogUpdateDates.has(catalog)) {
      catalogUpdateDates.set(catalog, null);
    }
  });
};

builder.defineCatalogHandler(async ({ id, config }) => {
  try {
    if (!omdbAPIKey) return { metas: [] };

    // Initialize catalog dates on first run
    initializeCatalogDates();

    const validCatalogs = new Set([
      "top-airing-ranker",
      "top-airing-anilist",
      "top-anilist", 
      "season-anilist",
      "popular-anilist",
      "next-to-watch-anilist",
      "upcoming-anilist",
      "trending-now-anilist"    
    ]);

    if (!validCatalogs.has(id)) {
      return { metas: [] };
    }

    const anilist = new AniList(omdbAPIKey);
    const cacheKey = id;
    const MAX_ANIME = 30;

    let cachedData = memoryStorage.get(cacheKey) || [];
    const catalogNextUpdate = catalogUpdateDates.get(cacheKey);

    // Check if this specific catalog needs update
    const shouldUpdate = !catalogNextUpdate || dayAfter(catalogNextUpdate) || cachedData.length <= 0;
    
    console.log(`Catalog: ${cacheKey}, Should Update: ${shouldUpdate}, Next Update: ${catalogNextUpdate}`);

    if (shouldUpdate) {
      if (!updatePromises.has(cacheKey)) {
        console.log(`Starting update for catalog: ${cacheKey}`);

        const updatePromise = (async () => {
          try {
            const updatedOn = getCurrentDate();
            const willNextUpdateOn = addDays(NEXT_DAYS);

            console.log(`Setting next update for ${cacheKey} to: ${willNextUpdateOn}`);
            console.log(`Updated ${cacheKey} on: ${updatedOn}`);

            // Set update date for this specific catalog
            catalogUpdateDates.set(cacheKey, willNextUpdateOn);

            let newData = [];

            switch (cacheKey) {
              case "top-airing-ranker":
                newData = await getAiringAnime(50);
                break;
              case "top-airing-anilist":
                newData = await anilist.getAiringNow(MAX_ANIME);
                break;
              case "top-anilist":
                newData = await anilist.getTopAnime(MAX_ANIME);
                break;
              case "season-anilist":
                newData = await anilist.getSeasonalAnime(MAX_ANIME);
                break;
              case "popular-anilist":
                newData = await anilist.getPopularAnime(MAX_ANIME);
                break;
              case "next-to-watch-anilist":
                newData = await anilist.getNextToWatch(MAX_ANIME);
                break;
              case "upcoming-anilist":
                newData = await anilist.getUpcomingAnime(MAX_ANIME);
                break;
              case "trending-now-anilist":
                newData = await anilist.getTrendingNow(MAX_ANIME);
                break;
              default:
                console.log(`Unknown catalog key: ${cacheKey}`);
                newData = [];
                break;
            }

            memoryStorage.set(cacheKey, newData);
            console.log(`Update completed for catalog: ${cacheKey} with ${newData?.length} items`);
            return newData;
          } catch (error) {
            console.error(`Update failed for catalog: ${cacheKey}`, error);
            throw error;
          } finally {
            updatePromises.delete(cacheKey);
          }
        })();

        updatePromises.set(cacheKey, updatePromise);
        cachedData = await updatePromise;
      } else {
        console.log(`Update already in progress for catalog: ${cacheKey}, waiting...`);
        cachedData = await updatePromises.get(cacheKey);
      }
    } else {
      if (cachedData.length <= 0) {
        cachedData = memoryStorage.get(cacheKey) || [];
      }
    }

    const selectedCatalog = Object.keys(config);
    const selected = selectedCatalog.some((o) => o === id);
    cachedData = (selected && cachedData) || [];

    return { metas: cachedData };
  } catch (err) {
    console.error("Catalog handler error:", err);
    const cachedData = memoryStorage.get(id) || [];
    return { metas: cachedData };
  }
});

serveHTTP(builder.getInterface(), { port: PORT });
