# Overview

Dongtube API is a modular Express.js server that aggregates various third-party content services. It features an auto-loading architecture for route modules, simplifying endpoint registration. The API supports downloading media from social platforms (TikTok, Instagram, YouTube, Facebook, Spotify), generating AI images, scraping anime/manga sites, fetching news, and processing images. The project aims to provide a unified, performant, and user-friendly interface for diverse online content, optimized for low-end devices.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Core Design Principles
- **Route Auto-Loading**: Dynamically discovers and registers route modules from the `routes/` directory at startup, promoting modularity and simplifying endpoint management.
- **Optimized for Low-End Devices**: Implements a 4-tier adaptive performance system based on device detection (RAM, CPU), dynamically adjusting animations (Three.js particles), CSS effects (backdrop-filter removal on mobile, optimized shadows), and resource loading (lazy loading, `defer` attributes) to ensure smooth performance on devices with 2-4GB RAM.
- **Centralized HTTP Client**: A reusable `HTTPClient` (wrapping Axios) provides automatic retry logic, consistent timeouts, and standard User-Agent headers, enhancing reliability for web scraping across various routes.
- **Validation Layer**: A centralized utility for URL validation (including domain checking) and empty string detection, ensuring consistent security and request integrity.
- **Consistent Error Handling**: An `asyncHandler` wrapper provides consistent JSON error responses with appropriate HTTP status codes for all asynchronous route handlers.
- **Content Delivery Strategy**: Supports JSON for structured data, direct binary responses for media, and URL redirection for proxied downloads, adapting to various content types.

## UI/UX & Frontend
- **Adaptive Rendering**: Automatically adjusts rendering settings based on device performance tiers (High, Medium, Low, Potato) for Three.js animations and CSS effects.
- **Enhanced Media Preview System**: Features a modern glassmorphism UI with animated gradients, responsive grid layouts, custom audio player with waveform animation, image gallery, and fullscreen modal for media display. Includes advanced media type detection and actions like download and URL copy.
- **Accessibility**: Includes `prefers-reduced-motion` support.
- **Social Media Integration**: Implements Open Graph and Twitter Card tags, along with SEO meta tags, for improved shareability and search engine visibility.
- **Admin Panel**: A modern web interface (`/admin-panel.html`) for managing premium routes, users, and viewing statistics, requiring admin login.

## Feature Specifications
- **Premium Route Management System**: Allows administrators to toggle VIP access for any API endpoint via an admin panel. Features auto-registration of routes, bulk operations, search/filter capabilities, and real-time updates.
- **VIP Access Protection**: Middleware automatically checks for VIP status, providing detailed error messages and WhatsApp contact links for upgrade requests to non-VIP users.
- **Premium Content Security** (Updated: Oct 2025):
  - **Backend Sanitization**: The `/api/docs` endpoint implements server-side data sanitization to prevent premium endpoint details from being sent to non-VIP users' browsers
  - **Composite Key Lookup**: Uses `${method}:${path}` composite keys to correctly handle endpoints with the same path but different access levels per HTTP method (e.g., GET free, POST premium)
  - **Zero-Trust Architecture**: Even if frontend protection is bypassed, backend ensures premium metadata (params, parameters, examples, placeholder) is never transmitted to unauthorized users
  - **Premium Lock Screen**: Frontend displays a visual lock screen with upgrade prompt and WhatsApp contact for premium endpoints, providing clear UX feedback
  - **JWT-Based Authentication**: Validates user premium status via JWT tokens before serving full endpoint documentation
- **Caching Strategy**: Implements in-memory Map-based caching with TTL for specific data (e.g., news endpoints) to reduce database queries and improve performance.
- **Background Music**: Auto-plays background music with a visual vinyl disc animation and volume controls, starting on page load or first user interaction.
- **Security**: Admin routes are protected by authentication, authorization middleware, JWT tokens, role-based access control (RBAC), and bcrypt password hashing.

## Module Organization
- Routes are organized by function (e.g., `route-tiktok.js`, `route-image.js`) rather than technology, enhancing maintainability.

# External Dependencies

## Core Framework
- **Express.js**

## HTTP & Web Scraping
- **axios**
- **cheerio**
- **needle**
- **form-data**

## Media & Content
- **yt-search**

## Utilities
- **chalk**
- **uuid**

## Third-Party Service Integrations
- **Social Media Platforms**:
    - TikTok (via `tikwm.com`)
    - Instagram (via `igram.website`)
    - Facebook (via `a2zconverter.com`)
    - Xiaohongshu/RedNote (via `rednote-downloader.io`)
    - Snackvideo (direct scraping)
- **Image Processing**:
    - `removebg.one`
    - `ihancer.com`
    - `texttoimage.org`
- **AI Generation**:
    - Ideogram (via Firebase Cloud Functions `chatbotandroid-3894d.cloudfunctions.net`)
- **Content Aggregation**:
    - MyAnimeList (scraping)
    - AniList GraphQL API
    - Anichin, Oploverz, Samehadaku (scraping)
- **News Sources**:
    - Tribunnews, Kompas (web scraping)
    - `justice.gov`
- **Other Services**:
    - `waifu.pics`
    - `api.imgflip.com`
    - `lrclib.net`
    - Google Drive

## Deployment
- **Vercel**
- **Node.js >= 18.0.0**