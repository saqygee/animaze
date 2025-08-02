const axios = require('axios');

/**
 * Normalize title to match IMDb's suggestion format
 * e.g., "Dan Da Dan" -> "dandadan"
 */
function normalizeForIMDbQuery(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/gi, '');
}

/**
 * Get IMDb ID from a title, handling normalization (e.g. "Dan Da Dan" -> "dandadan")
 * @param {string} title - Scraped or human-readable title
 * @returns {Promise<string|null>} - IMDb ID like "tt1234567", or null if not found
 */
async function getIMDbId(title) {
  const normalized = normalizeForIMDbQuery(title);
  const first = normalized[0];
  const url = `https://v2.sg.media-imdb.com/suggestion/${first}/${normalized}.json`;

  try {
    const res = await axios.get(url);
    const json = res.data;
    if (!json.d || json.d.length === 0) return null;

    // Optional: Try to match by title similarity
    const match = json.d.find(item =>
      normalizeForIMDbQuery(item.l) === normalized
    ) || json.d[0]; // fallback: take first result

    return match?.id || null;
  } catch (error) {
    console.error('IMDb suggestion lookup failed:', error.message);
    return null;
  }
}

// Example:
getIMDbId("stranger things").then(console.log); // → "tt4574334"



