require("dotenv").config();
const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const express = require("express");
const moment = require("moment");
const path = require('path');
const manifest = require("./manifest.json");
const { getAiringAnime } = require("./scrapers/ranker");
const AniList = require("./scrapers/Anilist");
const Storage = require("./classes/Storage");
const { getNetflixOrignals } = require("./scrapers/netflix");

const PORT = process.env.PORT || 7000;
const omdbAPIKey = process.env.OMDB_API_KEY;
const UPDATE_INTERVAL_DAYS = 7; // Update every 7 days
const storagePath = path.join(__dirname, "/storage/db.json");
const db = new Storage(storagePath);

const builder = new addonBuilder(manifest);

// Global update lock to prevent multiple simultaneous updates
let isUpdating = false;
let lastUpdateAttempt = 0;

// Date helper functions
function getCurrentDate() {
  return moment().format();
}

function addDays(days) {
  return moment().add(days, 'days').format();
}

function shouldUpdateCache() {
  const nextUpdateDate = db.get("nextUpdateDate");
  const updatedOn = db.get("updatedOn");
  
  // If no update date exists, we should update
  if (!nextUpdateDate) return true;
  
  // Check if current time is after the next update date
  return moment().isAfter(moment(nextUpdateDate));
}

// Cache initialization function
async function initializeCache() {
  if (isUpdating) {
    console.log('⏳ Update already in progress, skipping...');
    return;
  }

  const now = Date.now();
  // Prevent update attempts more than once per minute
  if (now - lastUpdateAttempt < 60000) {
    console.log('⏳ Update attempted too recently, skipping...');
    return;
  }

  isUpdating = true;
  lastUpdateAttempt = now;

  try {
    console.log('🔄 Starting cache update...');
    
    const anilist = new AniList(omdbAPIKey);
    const MAX_ANIME = 50;

    // Update all catalogs sequentially with delays to avoid rate limits
    const catalogs = [
      { key: "top-airing-ranker", fetch: () => getAiringAnime(MAX_ANIME) },
      { key: "top-airing-anilist", fetch: () => anilist.getAiringNow(MAX_ANIME) },
      { key: "top-anilist", fetch: () => anilist.getTopAnime(MAX_ANIME) },
      { key: "season-anilist", fetch: () => anilist.getSeasonalAnime(MAX_ANIME) },
      { key: "popular-anilist", fetch: () => anilist.getPopularAnime(MAX_ANIME) },
      { key: "next-to-watch-anilist", fetch: () => anilist.getNextToWatch(MAX_ANIME) },
      { key: "upcoming-anilist", fetch: () => anilist.getUpcomingAnime(MAX_ANIME) },
      { key: "top-netflix-originals", fetch: () => getNetflixOrignals(MAX_ANIME) }
    ];

    for (const catalog of catalogs) {
      try {
        console.log(`📦 Updating ${catalog.key}...`);
        const data = await catalog.fetch();
        if (data && data.length > 0) {
          db.set(catalog.key, data);
          console.log(`✅ ${catalog.key} updated with ${data.length} items`);
        }
        // Wait 3 seconds between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.error(`❌ Failed to update ${catalog.key}:`, error.message);
        // Continue with next catalog even if one fails
      }
    }

    // Set next update date to 7 days from now
    const updatedOn = getCurrentDate();
    const nextUpdateDate = addDays(UPDATE_INTERVAL_DAYS);
    
    db.set("updatedOn", updatedOn);
    db.set("nextUpdateDate", nextUpdateDate);
    
    console.log('✅ Cache update completed successfully');
    console.log(`📅 Next update scheduled for: ${nextUpdateDate}`);

  } catch (error) {
    console.error('❌ Cache update failed:', error);
  } finally {
    isUpdating = false;
  }
}

// --- Define Stremio Catalog Handler ---
builder.defineCatalogHandler(async ({ id, config }) => {
  try {
    if (!omdbAPIKey) {
      console.log('❌ OMDB API key missing');
      return { metas: [] };
    }

    const cacheKey = id;
    let cachedData = db.get(cacheKey) || [];
    
    // Check if we should update (only every 7 days)
    const needsUpdate = shouldUpdateCache();
    
    console.log(`[${cacheKey}] Cached items: ${cachedData.length}, Needs update: ${needsUpdate}`);

    // Trigger update if needed (but don't wait for it)
    if (needsUpdate && cachedData.length > 0) {
      console.log('🔄 Update needed, triggering background update...');
      initializeCache().catch(console.error); // Run in background, don't await
    }
    
    // If no cached data and not currently updating, try to initialize
    if (cachedData.length === 0 && !isUpdating) {
      console.log('🔄 No cached data found, initializing cache...');
      // For empty cache, wait for initialization
      await initializeCache();
      cachedData = db.get(cacheKey) || [];
    }

    // Return data for the requested catalog
    const selectedCatalog = Object.keys(config || {});
    const selected = selectedCatalog.some((o) => o === id);
    const finalData = (selected && cachedData) || [];

    console.log(`[${cacheKey}] Returning ${finalData.length} items`);
    return { metas: finalData };

  } catch (err) {
    console.error("❌ Catalog handler error:", err);
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

// ✅ Endpoint: Manually trigger cache update
app.post("/update-cache", async (req, res) => {
  try {
    if (isUpdating) {
      return res.status(429).json({ 
        success: false, 
        message: "Update already in progress" 
      });
    }
    
    await initializeCache();
    res.json({ 
      success: true, 
      message: "Cache update triggered manually" 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ✅ Endpoint: Get cache status
app.get("/cache-status", (req, res) => {
  const status = {
    isUpdating,
    lastUpdateAttempt: new Date(lastUpdateAttempt).toISOString(),
    updatedOn: db.get("updatedOn"),
    nextUpdateDate: db.get("nextUpdateDate"),
    shouldUpdate: shouldUpdateCache(),
    catalogs: {}
  };

  // Add info for each catalog
  const catalogKeys = [
    "top-airing-ranker", "top-airing-anilist", "top-anilist", 
    "season-anilist", "popular-anilist", "next-to-watch-anilist", 
    "upcoming-anilist", "top-netflix-originals"
  ];

  catalogKeys.forEach(key => {
    const data = db.get(key) || [];
    status.catalogs[key] = {
      itemCount: data.length,
      lastUpdated: data.length > 0 ? "Has data" : "No data"
    };
  });

  res.json(status);
});

// ✅ Start the Express API on a separate port
const EXPRESS_PORT = process.env.EXPRESS_PORT || 7001;
app.listen(EXPRESS_PORT, () => {
  console.log(`🟢 Express endpoint running on http://localhost:${EXPRESS_PORT}`);
  console.log(`📊 Cache status: http://localhost:${EXPRESS_PORT}/cache-status`);
  console.log(`🔄 Manual update: POST http://localhost:${EXPRESS_PORT}/update-cache`);
});