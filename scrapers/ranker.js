const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const Fuse = require("fuse.js");

async function getAiringAnime(omdbAPIKey,db) {
  const baseURL = "https://cache-api.ranker.com/lists/2235482/items";
  let allAnimes = [];
  let offset = 0;
  const limit = 10;
  let hasMore = true;
  
  while (hasMore) {
    try {
      const { data } = await axios.get(baseURL, {
        params: {
          limit,
          offset,
          useDefaultNodeLinks: false,
          include:
            "votes,wikiText,rankings,serviceProviders,openListItemContributors,taggedLists",
          propertyFetchType: "SHOWN_ON_LIST_ONLY",
          xrClient: "ranker-v3-client",
        },
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
      });

      const items = data?.listItems ?? [];
      if (items.length === 0) {
        hasMore = false;
        break;
      }

      const chunk = await Promise.all(
        items.map(async ({ rank, node, image }) => {
          const omdbResults = await fetchOMDbSearch(node?.name,omdbAPIKey);
          return {
            id: omdbResults?.[0]?.imdbID || uuidv4(), // Fallback if no OMDb result
            rank,
            poster: image?.thumbImgUrl || null,
            name: node?.name,
            description: node?.nodeWiki?.wikiText || "",
            type: "series",
          };
        })
      );

      allAnimes.push(...chunk);
      offset += limit;
    } catch (err) {
      console.error("Failed to fetch:", err.message);
      break;
    }
  }

  //console.log(`✅ Total animes fetched: ${allAnimes.length}`);
  //console.log(allAnimes);
   await db.set('airing',allAnimes);
}
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

module.exports = {
  getAiringAnime,
};
