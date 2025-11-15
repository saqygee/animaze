# Changelog
## [1.3.0] - 2025-11-06
   -'Added Trending now category'
   -'Title clean function improved'
   -'randomization of catalog lists'
## [1.2.3] - 2025-11-06
   -'Added ip logging for usage tracking'
   -'ignored request from old catalogs'
## [1.2.2] - 2025-10-04
  -'Removed broken netflix list'
  -'Fixed render circular upading problem'
## [1.2.1] - 2025-10-04
- **Minor fixes**:
    -'Added endpoint for db.json file'
    -'Fixed seasonal Autumn bug in anilist query'
    -'Added current update date in db.json'
## [1.1.1] - 2025-08-02
- **Netflix catalog support** using whats-on-netflix.com with the following new feature flags:
   - 'Top Netflix Originals - netflix'
## [1.1.0] - 2025-08-02

### Added
- **Anilist catalog support** with the following new feature flags:
  - `Top Airing Anilist`
  - `Top Anime Anilist`
  - `Ongoing Season Anilist`
  - `Popular Anime Anilist`
  - `Next to Watch Anilist`
  - `Upcoming Anime Anilist`
- **Stremio custom configuration**
- **Custom storage class** to replace third-party persistence

### Changed
- Switched to a new **IMDb fetcher** with a faster and more reliable approach (no rate limits)

### Removed
- Dependency on `node-persist`
- Removed `omdb` integration
