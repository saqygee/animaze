const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const { fetchOMDbSearch } = require("../classes/Omdb");
const { getCurrentSeason } = require("../utils/helpers");
const { getIMDbId } = require("../classes/imdb");

class AniList {
  constructor(omdbAPIKey) {
    this.apiUrl = "https://graphql.anilist.co";
    this._omdbAPIKey = omdbAPIKey;
  }

  async _query(query, variables = {}) {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          query,
          variables,
        },
        {
          "Content-Type": "application/json",
          Accept: "application/json",
        }
      );

      if (response.data.errors)
        throw new Error(response.data.errors[0].message);
      return response.data.data;
    } catch (err) {
      console.error("AniList GraphQL Query Failed:");
      console.error("Query:", query);
      console.error("Variables:", variables);
      console.error("Status:", err.response?.status);
      console.error("Data:", err.response?.data);
      throw new Error(`AniList API Error: ${err}`);
    }
  }
  async _omdbProcess(data) {
    try {
      const result = await Promise.all(
        data.map(async (series) => {
          const title =
            series?.title.english || series?.title.romaji || undefined;
          const id = await getIMDbId(title);
          if (title) {
            return {
              id: id || uuidv4(), // Fallback if no OMDb result
              poster: series?.coverImage.large || null,
              name: title || "",
              description: series.description || "",
              type: "series",
            };
          }
        })
      );
      return result.filter(Boolean);
    } catch (err) {
      console.log("_omdbProcess:", err);
    }
  }
  async getAiringNow(limit = 10) {
    const query = `
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC) {
            id
            title { english  romaji }
            episodes
            coverImage {
              large
            }
            description
          }
        }
      }
    `;
    const data = await this._query(query, { page: 1, perPage: limit });
    const seriesData = this._omdbProcess(data.Page.media);

    return seriesData;
  }

  async getTopAnime(limit = 10) {
    const query = `
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, sort: SCORE_DESC) {
            id
            title {
              english
              romaji
            }
            averageScore
            
            coverImage {
              large
            }
            description(asHtml: false)
          }
        }
      }
    `;

    const variables = {
      page: 1,
      perPage: limit,
    };

    const data = await this._query(query, variables);

    if (!data?.Page?.media) {
      throw new Error("Invalid response structure from AniList API");
    }

    const seriesData = this._omdbProcess(data.Page.media);
    return seriesData;
  }

  async getSeasonalAnime(limit = 10) {
    const season = getCurrentSeason();
    const year = new Date().getFullYear();
    const query = `
      query ($season: MediaSeason, $seasonYear: Int, $perPage: Int) {
        Page(page: 1, perPage: $perPage) {
          media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC) {
            id
            title {
              english
              romaji
            }
            
            coverImage {
              large
            }
            averageScore
            description
          }
        }
      }
    `;

    const data = await this._query(query, {
      season,
      seasonYear: year,
      perPage: limit,
    });

    if (!data?.Page?.media) {
      throw new Error("Invalid response structure from AniList API");
    }

    const seriesData = this._omdbProcess(data.Page.media);
    return seriesData;
  }

  async getPopularAnime(limit = 10) {
    const query = `
      query ($perPage: Int) {
        Page(page: 1, perPage: $perPage) {
          media(type: ANIME, sort: POPULARITY_DESC) {
            id
            title { english romaji }
            popularity
            
            coverImage {
              large
            }
          }
        }
      }
    `;
    const data = await this._query(query, {
      perPage: limit,
    });
    if (!data?.Page?.media) {
      throw new Error("Invalid response structure from AniList API");
    }

    const seriesData = this._omdbProcess(data.Page.media);
    return seriesData;
  }

  async getNextToWatch(limit = 5) {
    const query = `
    query ($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: ANIME, sort: POPULARITY_DESC) {
          id
          title {
            english
            romaji
          }
          coverImage {
            large
          }
          description
          recommendations(sort: RATING_DESC, perPage: 5) {
            nodes {
              mediaRecommendation {
                id
                title {
                  english
                  romaji
                }
                coverImage {
                  large
                }
                description
              }
            }
          }
        }
      }
    }
  `;

    const data = await this._query(query, { perPage: limit });

    if (!data?.Page?.media) {
      throw new Error("Invalid response structure from AniList API");
    }

    // Flatten all recommendations from all media into a single array
    const allRecommendations = data.Page.media.flatMap((media) =>
      media.recommendations.nodes.map((rec) => rec.mediaRecommendation)
    );

    // Map each recommendation asynchronously
    const seriesData = await Promise.all(
      allRecommendations.map(async (recommendation) => {
        const title =
          recommendation?.title.english ||
          recommendation?.title.romaji ||
          undefined;

        const id = await getIMDbId(title);
        if (title) {
          return {
            id: id || uuidv4(),
            poster: recommendation?.coverImage?.large || null,
            name: title,
            description:
              recommendation?.description || "No description available",
            type: "series",
          };
        }
      })
    );

    return seriesData.filter(Boolean);
  }

  async getUpcomingAnime(limit = 10) {
    const query = `
      query ($perPage: Int) {
        Page(page: 1, perPage: $perPage) {
          media(type: ANIME, status: NOT_YET_RELEASED, sort: POPULARITY_DESC) {
            id
            title { english romaji }
            startDate { year month day }
            coverImage {
                large
            }
            description
          }
        }
      }
    `;
    const data = await this._query(query, {
      perPage: limit,
    });
    if (!data?.Page?.media) {
      throw new Error("Invalid response structure from AniList API");
    }
    const seriesData = this._omdbProcess(data.Page.media);
    return seriesData;
  }

  async getAnimeByGenre(genre, limit = 10) {
    const query = `
      query ($genre: String, $perPage: Int) {
        Page(page: 1, perPage: $perPage) {
          media(type: ANIME, genre_in: [$genre], sort: POPULARITY_DESC) {
            id
            title { english }
            genres
            
            coverImage {
              large
            }
          }
        }
      }
    `;
    const data = await this._query(query, { genre, perPage: limit });
    return data.Page.media;
  }
}

module.exports = AniList;
