# Overview

Dongtube API is a modular Express.js server that provides a unified interface for various third-party content services. The system uses an auto-loading architecture where route modules are automatically discovered and registered, eliminating the need to manually configure endpoints in the main server file. The API serves as an aggregation layer for downloading media from social platforms (TikTok, Instagram, YouTube, Facebook, Spotify), generating AI images, scraping anime/manga sites, fetching news, and processing images.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Performance Optimizations (Oct 2025)

The website has been optimized for low-end devices (RAM 2-4GB) with the following improvements:

## Three.js Animation Optimizations
- Reduced particle count from 20 to 19 (5% reduction as requested)
- Disabled antialiasing for better GPU performance
- Capped pixel ratio to 1.5 for low-end devices
- Set renderer to low-power mode
- Auto-pause animation when browser tab is hidden (saves CPU/GPU)
- Debounced window resize events (150ms delay)

## CSS & Rendering Optimizations
- Added `prefers-reduced-motion` support - disables all animations for users who prefer reduced motion
- Reduced backdrop-filter blur from 20px to 10px
- Completely removed backdrop-filter on mobile devices (<768px)
- Increased background opacity from 0.85 to 0.95 to reduce blur dependency
- Added `will-change: transform` only to necessary elements
- GPU acceleration optimized

## Resource Loading Optimizations
- Added `loading="lazy"` to all images (logo, thumbnails)
- Added `defer` attribute to Three.js and script.js for non-blocking load
- Async font loading with print media trick
- Font preconnect to googleapis

## Result
Website now runs smoothly on devices with 2-4GB RAM without sacrificing visual quality (animations reduced by only 5% as requested).

# System Architecture

## Route Auto-Loading System

The core architectural decision is the **auto-load route pattern**. Instead of manually importing and mounting routes in `server.js`, the system dynamically discovers all `.js` files in the `routes/` directory at startup and registers them automatically. Each route module exports:

- A default Express Router with mounted endpoints
- Optional metadata object describing the route's purpose and parameters

**Rationale:** This pattern provides extreme modularity - developers can add new endpoints by simply dropping a file in the `routes/` folder without touching the main server configuration. This scales well for API aggregation services where new integrations are frequently added.

**Trade-offs:** The auto-loading adds startup complexity and makes it harder to track which routes are active without inspecting the filesystem. However, this is acceptable since the API is primarily an integration layer with independent route modules.

## HTTP Client Architecture

A reusable `HTTPClient` utility class (`utils/HTTPClient.js`) wraps axios with:

- Automatic retry logic (up to 2 retries with exponential backoff)
- Consistent timeout configuration (30 seconds default)
- Standard User-Agent headers for web scraping

**Rationale:** Many routes scrape third-party websites that occasionally have transient failures. The retry mechanism improves reliability without requiring each route to implement its own retry logic. This centralizes error handling and reduces code duplication across 30+ route files.

## Validation Layer

A centralized validation utility (`utils/validation.js`) provides:

- URL validation with optional domain checking
- Empty string detection
- Async error handler wrapper for Express routes

**Rationale:** The API accepts user-provided URLs to various services. Centralized validation ensures consistent security checks and reduces the risk of injection attacks or malformed requests propagating to third-party services.

## Frontend Architecture

Static HTML/CSS/JS files in `public/` provide:

- API documentation interface (`index.html`)
- Interactive TikTok downloader UI (`download-tiktok.html`)
- Three.js animated background (`script.js`)

**Rationale:** Self-documenting APIs improve developer experience. The frontend is kept simple (vanilla JS, no build step) to maintain the lightweight nature of the API server.

## Content Delivery Strategy

Routes handle multiple response types:

- **JSON responses** for structured data (search results, metadata)
- **Direct binary responses** for images/videos (using `res.end(buffer)`)
- **URL redirection** for proxied downloads

**Rationale:** Different use cases require different delivery methods. Direct binary responses avoid unnecessary network hops for image endpoints, while JSON responses provide flexibility for client-side rendering of search results.

## Error Handling Pattern

Async routes use a wrapper function (`asyncHandler`) that catches errors and returns consistent JSON error responses with appropriate HTTP status codes.

**Rationale:** Express doesn't natively handle rejected promises in async route handlers. The wrapper ensures errors don't crash the server and provides consistent error response formatting across all endpoints.

## Caching Strategy

Select routes implement in-memory Map-based caching with TTL (time-to-live):

- News endpoints: 15-minute cache
- Other endpoints: No default caching (real-time data)

**Rationale:** News content changes infrequently, making it an ideal caching candidate. Social media content changes constantly and user expectations are for fresh data, so those routes skip caching. The simple Map-based approach avoids external dependencies like Redis for this lightweight API.

## Module Organization

Routes are organized by function rather than by technology:

- `route-tiktok.js`, `route-youtube.js` - Social media downloaders
- `route-image.js` - Image processing (OCR, background removal)
- `route-anime.js`, `route-mal.js` - Anime/manga aggregation
- `route-news.js` - News scraping

**Rationale:** Functional organization makes it easier to find and maintain related endpoints. Since routes are auto-loaded, there's no performance penalty for having many small files versus few large files.

# External Dependencies

## Core Framework
- **Express.js** - Web framework for routing and middleware

## HTTP & Web Scraping
- **axios** - HTTP client for API calls and web scraping
- **cheerio** - HTML parsing for scraping third-party sites
- **needle** - Alternative HTTP client for specific routes
- **form-data** - Multipart form data for file uploads to external APIs

## Media & Content
- **yt-search** - YouTube search functionality (no official API key required)

## Utilities
- **chalk** - Terminal output coloring for development logs
- **uuid** - Generate unique identifiers for API requests

## Third-Party Service Integrations

### Social Media Platforms
- **TikTok** - tikwm.com API for watermark-free downloads
- **Instagram** - igram.website for media extraction
- **Facebook** - a2zconverter.com proxy service
- **Xiaohongshu/RedNote** - rednote-downloader.io API
- **Snackvideo** - Direct scraping of video metadata

### Image Processing
- **removebg.one** - Background removal API
- **ihancer.com** - Image quality enhancement
- **texttoimage.org** - Text-to-image generation

### AI Generation
- **Ideogram** - AI image generation via Firebase Cloud Functions
- **chatbotandroid-3894d.cloudfunctions.net** - Backend for Ideogram integration

### Content Aggregation
- **MyAnimeList** - Anime/manga database scraping
- **AniList GraphQL API** - Alternative anime database
- **Anichin, Oploverz, Samehadaku** - Anime streaming sites (scraping)

### News Sources
- **Tribunnews, Kompas** - Indonesian news outlets (web scraping)
- **justice.gov** - U.S. Department of Justice press releases

### Other Services
- **waifu.pics** - Random anime images API
- **api.imgflip.com** - Meme templates
- **lrclib.net** - Song lyrics search
- **Google Drive** - Direct download link generation

## Deployment
- **Vercel** - Configured for serverless deployment with `vercel.json`
- **Node.js >= 18.0.0** - ES modules support required