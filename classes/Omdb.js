const axios = require('axios');
const Fuse = require("fuse.js");

async function fetchOMDbSearch(title,omdbAPIKey) {
  async function fetchOMDb(query) {
    const { data } = await axios.get('http://www.omdbapi.com/', {
      params: {
        s: query,
        apikey: omdbAPIKey,
        type: "series",
      },
    });
    return data.Search || [];
  }

  try {
    const results = await fetchOMDb(title);

    // Use fuzzy search on results
    const fuse = new Fuse(results, {
      keys: ['Title'],
      threshold: 0.3, // Adjust sensitivity (0 = exact, 1 = very loose)
    });

    const matches = fuse.search(title);
    if (matches.length > 0) {
      return matches.map(match => match.item);
    }

    // Retry: remove spaces and search again
    const retryResults = await fetchOMDb(title.replace(/\s+/g, ""));
    const retryFuse = new Fuse(retryResults, {
      keys: ['Title'],
      threshold: 0.3,
    });

    const retryMatches = retryFuse.search(title);
    return retryMatches.map(match => match.item);
  } catch (err) {
    console.error("OMDb fetch error:", err.message);
    return [];
  }
}
module.exports = {fetchOMDbSearch};