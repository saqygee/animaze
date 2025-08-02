const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const { getIMDbId } = require("../classes/imdb");

async function getAiringAnime(pageLimit) {
  try {
    const baseURL = "https://cache-api.ranker.com/lists/2235482/items";
    let allAnimes = [];
    let offset = 0;
    const limit = pageLimit || 10;
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
    const chunk = await Promise.all(
      items.map(async ({ rank, node, image }) => {
        const title = node?.name;
        if (title) {
          const id = await getIMDbId(node?.name);
          return {
            id: id || uuidv4(), // Fallback if no OMDb result
            rank,
            poster: image?.thumbImgUrl || null,
            name: title,
            description: node?.nodeWiki?.wikiText || "",
            type: "series",
          };
        }
      })
    );

    allAnimes.push(...chunk);
    return allAnimes.filter(Boolean);
  } catch (err) {
    console.error("Failed to fetch:", err.message);
  }
}
module.exports = {
  getAiringAnime,
};
