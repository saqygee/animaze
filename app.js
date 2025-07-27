require("dotenv").config();
const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const manifest = require("./manifest.json");
const PORT = process.env.PORT || 7000;
const builder = new addonBuilder(manifest);
const { addDays, dayAfter } = require("./utils/helpers");
const { getAiringAnime } = require("./scrapers/ranker");

let cachedData = [];
let nextUpdateTimestamp = addDays(7);

builder.defineCatalogHandler(async () => {
  const omdbAPIKey = process.env.OMDB_API_KEY;
  if(!omdbAPIKey){
    return {metas:[]}
  }
  if (cachedData.length <= 0) {
    cachedData = await getAiringAnime(omdbAPIKey);
  } else if (dayAfter(nextUpdateTimestamp)) {
    cachedData = await getAiringAnime(omdbAPIKey);
    nextUpdateTimestamp = addDays(7);
  }
  return Promise.resolve({ metas:cachedData });
});

// 🚀 Serve it
serveHTTP(builder.getInterface(), { port: PORT });
