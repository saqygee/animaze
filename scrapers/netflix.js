const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const { getIMDbId } = require("../classes/imdb");

async function getNetflixOrignals(pageLimit) {
  try {
    const baseURL =
      "https://www.whats-on-netflix.com/wp-content/plugins/whats-on-netflix/json/originalanime.json";

    const limit = pageLimit || 10;
    const { data } = await axios.get(baseURL, {
      params: {
        _: "_=1754177644573",
      },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      },
    });

    if (data && data.length > 0) {
      const rankedAnime = data
        .filter((o) => o.imdb !== null && o.imdb !== "")
        .sort((a, b) => {
          const ratingA = parseFloat(a.imdb.replace("/10", "").trim());
          const ratingB = parseFloat(b.imdb.replace("/10", "").trim());
          return ratingB - ratingA; // descending
        });
      const dataItems = rankedAnime.filter(Boolean).slice(0, limit);
      const allAnimes = await Promise.all(
        dataItems.map(async (item) => {
          const title = item?.title;
          if (title) {
            const id = await getIMDbId(title);
            return {
              id: id || uuidv4(), // Fallback if no OMDb result
              poster: item?.image_portrait || null,
              name: title,
              description: item.description || "",
              type: "series",
            };
          }
        })
      );

      return allAnimes.filter(Boolean);
    }
    return [];
  } catch (err) {
    console.error("Failed to fetch:", err.message);
  }
}
module.exports = {
  getNetflixOrignals,
};
