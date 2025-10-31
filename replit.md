# Overview

Dongtube API is a modular Express.js server that aggregates various third-party content services. It provides a unified, performant, and user-friendly interface for diverse online content, optimized for low-end devices. Key capabilities include downloading media from social platforms (TikTok, Instagram, YouTube, Facebook, Spotify), generating AI images, scraping anime/manga sites, fetching news, processing images, and offering traditional Indonesian fortune-telling (primbon) services.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Core Design Principles
- **Route Auto-Loading**: Dynamically discovers and registers route modules, promoting modularity and simplifying endpoint management.
- **Hot-Reload System**: Automatically detects changes to route files and reloads them without restarting the server, ensuring zero-downtime. This system uses a centralized `RouteManager` service with mutex locking, Chokidar-based file watching, atomic router swapping, and database synchronization for endpoint metadata. It also provides admin control for manual triggers and status monitoring, and integrates with cache refreshing.
- **Optimized for Low-End Devices**: Implements a 4-tier adaptive performance system based on device detection, dynamically adjusting animations, CSS effects, and resource loading for smooth performance on devices with 2-4GB RAM.
- **Centralized HTTP Client**: A reusable `HTTPClient` with automatic retry logic, consistent timeouts, and standard User-Agent headers for reliable web scraping.
- **Validation Layer**: Centralized utility for URL validation and empty string detection to ensure request integrity.
- **Consistent Error Handling**: `asyncHandler` wrapper provides consistent JSON error responses for all asynchronous route handlers.
- **Content Delivery Strategy**: Supports JSON, direct binary responses, and URL redirection for various content types.

## UI/UX & Frontend
- **Adaptive Rendering**: Adjusts rendering settings based on device performance tiers for Three.js animations and CSS effects.
- **Enhanced Media Preview System**: Features a modern glassmorphism UI with animated gradients, responsive grid layouts, custom audio player, image gallery, and fullscreen modal. Includes advanced media type detection and actions.
- **Accessibility**: Includes `prefers-reduced-motion` support.
- **Social Media Integration**: Implements Open Graph, Twitter Card tags, and SEO meta tags.
- **Smart VIP Popup Logic**: Differentiates between three states: unauthenticated users (login prompt), authenticated non-VIP users (upgrade prompt), and expired VIP users (renewal prompt with expiration date), displaying context-sensitive messages based on authentication and VIP status.
- **UI Layer Management**: Ensures proper z-index hierarchy and prevents overlapping issues for interactive elements.
- **Tab-Aware Audio Control**: Background music automatically pauses/resumes based on tab visibility using the Visibility API.
- **Powerful Admin Panel**: Full-featured interface for managing API endpoints with CRUD operations, bulk actions, inline status toggling, advanced filtering, and a statistics dashboard.

## Feature Specifications
- **Premium Route Management System**: Allows administrators to toggle VIP access for API endpoints via an admin panel with auto-registration, bulk operations, and real-time updates.
- **VIP Access Protection**: Middleware comprehensively validates VIP status including role checking and expiration date validation (`vipExpiresAt`). Provides contextual error messages differentiating between unauthenticated users, non-VIP users, and expired VIP users with tailored upgrade/renewal prompts.
- **VIP Expiration Validation**: Utility function `isVIPValid()` validates VIP status considering both role and expiration date across backend and frontend, ensuring consistent access control.
- **Unrestricted Admin Control**: Admin-set VIP statuses are never automatically reverted, admins bypass all VIP checks, can force-update user roles, perform bulk user updates, and grant permanent VIP access.
- **Premium Content Security**: Backend sanitization prevents premium endpoint details from being sent to non-VIP users. Uses composite keys for method-specific access and JWT-based authentication for documentation access.
- **VIP Endpoint Cache System**: In-memory caching with a 5-second TTL, automatic invalidation on admin changes, and debug logging.
- **Caching Strategy**: Implements in-memory Map-based caching with TTL for specific data to reduce database queries.
- **Background Music**: Auto-plays background music with a visual vinyl disc animation and volume controls.
- **Security**: Admin routes are protected by authentication, authorization middleware, JWT tokens, role-based access control (RBAC), and bcrypt password hashing.
- **Instant VIP Access System**: `refresh-token` endpoint allows users to get updated access immediately after role changes without logout/login, with real-time database checks for VIP status.
- **Real-Time VIP Access System**: Server-Sent Events (SSE) infrastructure broadcasts role changes instantly to connected users, eliminating the need for manual refresh or logout/login. Features include:
  - EventEmitter-based pub/sub system for role change notifications
  - Per-user SSE streams with automatic reconnection and exponential backoff
  - Frontend auto-refresh token system that updates JWT immediately upon role changes
  - Authenticated SSE endpoint with httpOnly cookie support and graceful handling for unauthenticated users
  - Automatic page reload after token refresh to apply all changes
  - Heartbeat mechanism for connection keep-alive
  - Smart connection management that skips SSE connection for unauthenticated users to prevent unnecessary 401 errors
- **Indonesian Primbon Services**: Provides various traditional Indonesian fortune-telling services including name analysis, compatibility checks, lucky numbers, health predictions, Javanese/Balinese matchmaking, business predictions, dream interpretation, and zodiac information. All endpoints support URL encoding and both GET/POST methods.
- **Category-Based Endpoint Filtering**: Admin endpoint to filter endpoints by category with pagination, protected by authentication.

## Module Organization
- Routes are organized by function for enhanced maintainability.

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
- **Social Media Platforms**: TikTok (`tikwm.com`), Instagram (`igram.website`), Facebook (`a2zconverter.com`), Xiaohongshu/RedNote (`rednote-downloader.io`), Snackvideo.
- **Image Processing**: `removebg.one`, `ihancer.com`, `texttoimage.org`.
- **AI Generation**: Ideogram (via Firebase Cloud Functions `chatbotandroid-3894d.cloudfunctions.net`).
- **Content Aggregation**: MyAnimeList, AniList GraphQL API, Anichin, Oploverz, Samehadaku.
- **News Sources**: Tribunnews, Kompas, `justice.gov`.
- **Indonesian Services**: Primbon.com.
- **Other Services**: `waifu.pics`, `api.imgflip.com`, `lrclib.net`, Google Drive.

## Deployment
- **Vercel**
- **Node.js >= 18.0.0**