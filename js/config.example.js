/**
 * AI-Based Intelligent Mobility Platform Configuration Template
 * 
 * Instructions:
 * 1. Copy this file to `js/config.js`
 * 2. Add your free API keys for OpenRouteService and OpenWeatherMap
 * 3. The application will automatically use live keys, or gracefully fall back
 *    to open high-availability demo services if keys are missing.
 */

export const CONFIG = {
  // OpenRouteService API Key (Get free key at: https://openrouteservice.org/dev/#/signup)
  ORS_API_KEY: 'YOUR_ORS_API_KEY',

  // OpenWeatherMap API Key (Get free key at: https://openweathermap.org/api)
  OWM_API_KEY: 'YOUR_OWM_API_KEY',

  // Base API Endpoints
  API_ENDPOINTS: {
    nominatim: 'https://nominatim.openstreetmap.org',
    ors: 'https://api.openrouteservice.org/v2/directions/driving-car',
    owm: 'https://api.openweathermap.org/data/2.5/weather',
    overpass: 'https://overpass-api.de/api/interpreter',
    // Graceful fallback endpoints when keys are not configured
    osrmFallback: 'https://router.project-osrm.org/route/v1/driving',
    openMeteoFallback: 'https://api.open-meteo.com/v1/forecast'
  },

  // Map Tile Providers (CartoDB Light and Dark)
  MAP_TILES: {
    light: {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
      maxZoom: 19
    },
    dark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
      maxZoom: 19
    }
  },

  // Default sample route coordinates (Kanpur Central to IIT Kanpur)
  DEFAULT_SAMPLE: {
    source: {
      name: 'Kanpur Central Railway Station',
      lat: 26.4539,
      lon: 80.3512
    },
    destination: {
      name: 'Indian Institute of Technology Kanpur (IITK)',
      lat: 26.5123,
      lon: 80.2329
    }
  },

  // Overpass parking search radius in meters
  PARKING_SEARCH_RADIUS_METERS: 2000,

  // Nominatim rate-limiting and debounce delay (ms)
  NOMINATIM_DEBOUNCE_MS: 500,
  NOMINATIM_MIN_INTERVAL_MS: 1000,

  // Request timeout in milliseconds
  REQUEST_TIMEOUT_MS: 10000
};
