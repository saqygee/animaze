const axios = require('axios');

/**
 * Clean title by removing season/part labels
 * e.g., "Attack on Titan Season 4 Part 2" -> "Attack on Titan"
 */
function cleanTitle(title) {
  if (typeof title !== 'string') return '';
  return title
    // Remove everything after season/part/final season patterns including the pattern itself
    .replace(/(season\s*\d+|part\s*\d+|final\s*season).*/gi, '')
    // Remove years in parentheses like (2024), (1999), etc.
    .replace(/\(\s*\d{4}\s*\)/g, '')
    // Remove empty parenthesis if any
    .replace(/\(\s*\)/g, '')
    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ')
    .trim();
}
/**
 * Normalize title to match IMDb's suggestion format
 * e.g., "Dan Da Dan" -> "dandadan"
 */
function normalizeForIMDbQuery(str) {
  if (typeof str !== 'string') {
    console.warn('normalizeForIMDbQuery: invalid input', str);
    return '';
  }
  return str.toLowerCase().replace(/[^a-z0-9]/gi, '');
}

/**
 * Get IMDb ID from a title, handling normalization and cleaning
 * @param {string} title - Scraped or human-readable title
 * @returns {Promise<string|null>} - IMDb ID like "tt1234567", or null if not found
 */
async function getIMDbId(title) {
  if (typeof title !== 'string' || !title.trim()) {
    console.error('getIMDbId: invalid title input', title);
    return null;
  }

  const cleaned = cleanTitle(title);
  const normalized = normalizeForIMDbQuery(cleaned);

  if (!normalized) {
    console.error('getIMDbId: normalized title is empty');
    return null;
  }

  const first = normalized[0];
  const url = `https://v2.sg.media-imdb.com/suggestion/${first}/${normalized}.json`;

  try {
    const res = await axios.get(url);
    const json = res.data;
    if (!json.d || json.d.length === 0) return null;

    const match = json.d.find(item =>
      normalizeForIMDbQuery(item.l) === normalized
    ) || json.d[0];

    return match?.id || null;
  } catch (error) {
    console.error('IMDb suggestion lookup failed:', error.message);
    return null;
  }
}

module.exports = { getIMDbId };
