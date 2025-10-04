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

// In-memory storage with update tracking
const memoryStorage = new Map();
const updatePromises = new Map(); // Track ongoing updates to prevent duplicate updates

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
    console.log('shouldUpdate: ', shouldUpdate, 'for catalog:', cacheKey);

    if (shouldUpdate) {
      // Check if an update is already in progress for this catalog
      if (!updatePromises.has(cacheKey)) {
        console.log('Starting update for catalog:', cacheKey);
        
        const updatePromise = (async () => {
          try {
            const updatedOn = getCurrentDate();
            const willNextUpdateOn = addDays(NEXT_DAYS);

            console.log('Setting next update to:', willNextUpdateOn);
            console.log('Updated on:', updatedOn);

            memoryStorage.set("updatedOn", updatedOn);
            memoryStorage.set("nextUpdateDate", willNextUpdateOn);

            let newData = [];
            switch (cacheKey) {
              case "top-airing-ranker":
                newData = await getAiringAnime(MAX_ANIME);
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
              case "top-netflix-originals":
                newData = await getNetflixOrignals(MAX_ANIME);
                break;
              default:
                break;
            }
            
            memoryStorage.set(cacheKey, newData);
            console.log('Update completed for catalog:', cacheKey, 'with', newData.length, 'items');
            return newData;
          } catch (error) {
            console.error('Update failed for catalog:', cacheKey, error);
            throw error;
          } finally {
            // Clean up the promise tracker
            updatePromises.delete(cacheKey);
          }
        })();

        updatePromises.set(cacheKey, updatePromise);
        
        // Wait for the update to complete and use the new data
        cachedData = await updatePromise;
      } else {
        // Update already in progress, wait for it to complete
        console.log('Update already in progress for catalog:', cacheKey, 'waiting...');
        cachedData = await updatePromises.get(cacheKey);
      }
    } else {
      // No update needed, use cached data
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
    // If there's an error, try to return whatever cached data we have
    const cachedData = memoryStorage.get(id) || [];
    return { metas: cachedData };
  }
});

// --- Serve Stremio Interface ---
serveHTTP(builder.getInterface(), { port: PORT });