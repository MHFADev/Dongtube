# Overview

Dongtube API is a modular Express.js server that provides a unified interface for various third-party content services. The system uses an auto-loading architecture where route modules are automatically discovered and registered, eliminating the need to manually configure endpoints in the main server file. The API serves as an aggregation layer for downloading media from social platforms (TikTok, Instagram, YouTube, Facebook, Spotify), generating AI images, scraping anime/manga sites, fetching news, and processing images.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Performance Optimizations (Oct 2025)

The website has been optimized for low-end devices (RAM 2-4GB) with comprehensive performance improvements:

## 4-Tier Adaptive Performance System
- **Automatic device detection**: High / Medium / Low / Potato tiers
- **Smart scoring system**: Based on RAM, CPU cores, and lightweight benchmark (<5ms)
- **iOS-friendly detection**: Avoids misclassifying modern iPhones as low-end
- **Adaptive rendering**: Each tier receives optimized settings automatically

## Three.js Animation Optimizations
- **High tier** (8GB+ RAM): 19 particles, full effects
- **Medium tier** (4-8GB RAM): 12 particles, reduced effects
- **Low tier** (2-4GB RAM): 6 particles (68% reduction), minimal effects
- **Potato tier** (<2GB RAM): CSS-only fallback, Three.js disabled
- Frame throttling (skip frames on low-end devices)
- Disabled antialiasing for better GPU performance
- Capped pixel ratio to 1.5-2 based on device tier
- Set renderer to low-power mode
- Auto-pause animation when browser tab is hidden (saves CPU/GPU)
- Debounced window resize events (150ms delay)

## CSS & Rendering Optimizations
- Added `prefers-reduced-motion` support - disables all animations for users who prefer reduced motion
- Completely removed backdrop-filter on mobile devices (<768px) - major performance killer
- Increased background opacity from 0.85 to 0.95 to compensate for removed blur
- Added CSS containment for better paint performance
- `will-change` only applied during hover/active states (more efficient)
- Optimized shadow effects reduced on low-tier devices
- **ALL Endpoint Menu Animations REMOVED** (Oct 29, 2025):
  - Removed ALL transitions from `.endpoint` elements
  - Removed border sliding animation (::before pseudo-element)
  - Removed hover transform (translateX + scale)
  - Removed hover box-shadow animation
  - Removed shimmer animation on active state (::after pseudo-element)
  - Removed pulse animation on method badges
  - Removed arrow rotation animation
  - Changed endpoint body from slide animation to instant display:none/block
  - Result: **ZERO LAG** when opening/closing endpoint menus, instant response

## Resource Loading Optimizations
- Added `loading="lazy"` to all images (logo, thumbnails)
- Added `defer` attribute to Three.js and script.js for non-blocking load
- Async font loading with print media trick
- Font preconnect to googleapis

## Social Media Integration (Oct 29, 2025)
- **Open Graph tags**: Attractive preview cards on Facebook, WhatsApp, LinkedIn, Telegram
- **Twitter Card tags**: Rich media cards when shared on Twitter/X
- **SEO meta tags**: Improved search engine visibility
- Preview images use existing logo.jpg asset
- Implemented on both index.html (API docs) and download-tiktok.html

## Enhanced Media Preview System (Oct 29, 2025) - MAJOR UPDATE
- **Modern UI/UX Design**: Complete redesign with glassmorphism effects, animated gradients, and sophisticated styling
  - Beautiful media preview cards with hover effects and smooth transitions
  - Responsive grid layout with auto-fit columns (1-3 columns based on screen size)
  - Glowing animated borders and shimmer effects
  - Dark theme optimized with orange/gold accent colors matching website theme
  
- **Advanced Media Detection**: Enhanced `extractMediaUrls()` function with improved accuracy
  - Detects images (.jpg, .jpeg, .png, .gif, .webp, .svg, .bmp)
  - Detects videos (.mp4, .webm, .mov, .m3u8, .avi, .mkv)
  - Detects audio (.mp3, .m4a, .wav, .ogg, .opus, .flac, .aac)
  - Uses both key name analysis and regex pattern matching
  - Priority system to rank media by type (audio > video > images)
  - Removes duplicate URLs automatically
  
- **Custom Audio Player** (~150 lines of CSS + JS):
  - Visual waveform animation with 8 animated bars
  - Custom play/pause button with icon switching
  - Interactive progress bar with click-to-seek functionality
  - Time display (current time / total duration)
  - Volume control slider with icon
  - Auto-pause other audio players when playing new one
  - Elegant styling with orange gradients and animations
  
- **Image Gallery System**:
  - Multiple images displayed in thumbnail grid
  - Click thumbnails to switch main image
  - Fullscreen view with navigation arrows
  - Active thumbnail highlighting
  - Lazy loading for performance
  
- **Fullscreen Modal**:
  - Beautiful overlay with blur backdrop
  - Large media display for images and videos
  - Close button (×) and click-outside-to-close
  - Navigation arrows for image galleries (prev/next)
  - Smooth fade-in animations
  - Prevents body scroll when open
  
- **Video Player**:
  - Native HTML5 video controls
  - Smooth opacity fade-in on load
  - Responsive container with rounded corners
  - Error handling for unsupported formats
  
- **Media Actions**:
  - Download button for all media types (images, videos, audio)
  - Copy URL to clipboard with visual notification
  - Elegant button styling with icons
  - Toast notifications for user feedback
  
- **Responsive Design** (Mobile-First):
  - 100% responsive across all devices
  - Mobile (<768px): Single column layout, touch-optimized controls
  - Tablet (768px-1024px): 2-column grid
  - Desktop (>1024px): 3-column grid
  - Adaptive font sizes and spacing
  - Touch-friendly button sizes on mobile
  
- **Performance Optimizations**:
  - Lazy loading for images
  - Efficient event listeners with proper cleanup
  - Debounced resize handlers
  - Minimal DOM manipulations
  - CSS animations using GPU acceleration (transform, opacity)
  
- **Code Architecture**:
  - ~555 lines of dedicated CSS for media preview components
  - Modular JavaScript functions for each feature
  - Separation of concerns (rendering, controls, utilities)
  - Error handling throughout
  - Clean, maintainable code structure

## Background Music (Oct 29, 2025)
- **Auto-play background music**: Plays music.opus file on page load
- **Fallback mechanism**: If browser blocks autoplay, starts on first user interaction
- **Vinyl disc animation**: Spinning animation synced with play/pause state
- **Volume control**: Adjustable volume slider (default: 50%)
- **Play/Pause control**: Toggle button with visual feedback

## Result
- Website runs smoothly on 2GB RAM phones with adaptive optimizations
- Endpoint menu has ZERO lag - all animations removed
- Beautiful social media previews when sharing links
- Performance scales automatically based on device capabilities

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