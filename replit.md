# Overview

Dongtube API is a modular Express.js server that aggregates various third-party content services. It features an auto-loading architecture for route modules, simplifying endpoint registration. The API supports downloading media from social platforms (TikTok, Instagram, YouTube, Facebook, Spotify), generating AI images, scraping anime/manga sites, fetching news, processing images, and traditional Indonesian fortune-telling (primbon) services. The project aims to provide a unified, performant, and user-friendly interface for diverse online content, optimized for low-end devices.

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
- **Powerful Admin Panel** (Updated: Oct 30, 2025):
  - **Endpoint Management Dashboard**: Full-featured interface (`/admin-panel.html`) for managing all API endpoints with complete CRUD operations
  - **Bulk Operations**: Select multiple endpoints with checkboxes and batch update their VIP/Free status simultaneously
  - **Inline Status Toggle**: Quick one-click toggle to change endpoint status between VIP and Free directly from the table
  - **Add/Edit/Delete Endpoints**: Modal-based forms for creating new endpoints or editing existing ones with full field support (path, method, name, category, description, VIP status)
  - **Advanced Filtering**: Real-time search across endpoint paths/names/descriptions with category and status filters
  - **Auto-loading Categories**: Dynamic category filter that automatically populates from database
  - **Statistics Dashboard**: Real-time display of total users, VIP users, premium endpoints, and free endpoints
  - **Full Access Control**: Admin authentication required, with prominent navigation to user management and site exit
  - **Responsive Design**: Optimized for desktop and mobile devices with modern glassmorphism UI

## Feature Specifications
- **Premium Route Management System**: Allows administrators to toggle VIP access for any API endpoint via an admin panel. Features auto-registration of routes, bulk operations, search/filter capabilities, and real-time updates.
- **VIP Access Protection**: Middleware automatically checks for VIP status, providing detailed error messages and WhatsApp contact links for upgrade requests to non-VIP users.
- **100% Unrestricted Admin Control** (Updated: Oct 30, 2025):
  - **No Auto-Downgrade**: Admin-set VIP statuses are never automatically reverted, regardless of expiry dates. System respects admin decisions completely.
  - **Complete Admin Bypass**: Admin role bypasses all VIP checks and restrictions, providing unrestricted access to all endpoints.
  - **Force Update Capability**: Admin can force-update any user's role and VIP status without validation or restrictions via `/admin/users/:id/force-update`.
  - **Bulk Operations**: Admin can update multiple users simultaneously via `/admin/users/bulk-update` endpoint.
  - **Permanent VIP Option**: Admin can grant VIP with no expiry date (null vipExpiresAt) using the 'permanent' duration option.
  - **Full Endpoint Control**: Admin can freely toggle any endpoint between free and premium status via `/admin/endpoints/:id/toggle-premium`.
- **Premium Content Security** (Updated: Oct 2025):
  - **Backend Sanitization**: The `/api/docs` endpoint implements server-side data sanitization to prevent premium endpoint details from being sent to non-VIP users' browsers
  - **Composite Key Lookup**: Uses `${method}:${path}` composite keys to correctly handle endpoints with the same path but different access levels per HTTP method (e.g., GET free, POST premium)
  - **Zero-Trust Architecture**: Even if frontend protection is bypassed, backend ensures premium metadata (params, parameters, examples, placeholder) is never transmitted to unauthorized users
  - **Premium Lock Screen**: Frontend displays a visual lock screen with upgrade prompt and WhatsApp contact for premium endpoints, providing clear UX feedback
  - **JWT-Based Authentication**: Validates user premium status via JWT tokens before serving full endpoint documentation
- **Caching Strategy**: Implements in-memory Map-based caching with TTL for specific data (e.g., news endpoints) to reduce database queries and improve performance.
- **Background Music**: Auto-plays background music with a visual vinyl disc animation and volume controls, starting on page load or first user interaction.
- **Security**: Admin routes are protected by authentication, authorization middleware, JWT tokens, role-based access control (RBAC), and bcrypt password hashing.
- **Indonesian Primbon (Fortune-Telling) Services** (Added: Oct 30, 2025):
  - **Name Meaning Analysis**: Interprets the spiritual meaning and characteristics of Indonesian names
  - **Name Compatibility**: Checks relationship compatibility between two names
  - **Lucky Numbers**: Analyzes phone numbers for fortune and luck predictions
  - **Health Predictions**: Predicts potential health issues based on name, birthdate, and location
  - **Javanese & Balinese Match-Making**: Traditional matchmaking calculations based on weton (Javanese calendar)
  - **Business & Wealth Predictions**: Analyzes business potential and fortune based on weton
  - **Dream Interpretation**: Interprets the meaning of dreams according to primbon tradition
  - **Zodiac Information**: Provides detailed zodiac sign characteristics and predictions
  - **URL Encoding**: All endpoints properly encode parameters to handle Indonesian names with spaces and special characters
  - **Dual Method Support**: All 10 primbon endpoints support both GET and POST methods (20 route handlers total)
- **Category-Based Endpoint Filtering** (Added: Oct 30, 2025):
  - Admin endpoint `/admin/endpoints/category/:category` to filter endpoints by category
  - Supports pagination with configurable limit and offset
  - Protected by admin authentication and authorization
  - Enables filtering by special categories like "dev" for development endpoints

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
- **Indonesian Services**:
    - Primbon.com (traditional fortune-telling and divination)
- **Other Services**:
    - `waifu.pics`
    - `api.imgflip.com`
    - `lrclib.net`
    - Google Drive

## Deployment
- **Vercel**
- **Node.js >= 18.0.0**