/**
 * OpenStreetMap Nominatim Geocoding API Client
 * 
 * Complies with Nominatim Usage Policy:
 * - In-memory LRU-style cache
 * - Rate limited to max 1 request per second
 * - Proper Accept-Language header
 */

import { CONFIG } from '../config.js';
import { fetchWithTimeout, nominatimRateLimiter } from '../utils.js';

// In-memory cache for search queries and coordinate pairs (session-only, zero persistent storage)
const searchCache = new Map();
const reverseCache = new Map();

/**
 * Search locations by address string
 * @param {string} query 
 * @returns {Promise<Array<{name: string, displayName: string, lat: number, lon: number}>>}
 */
export async function searchAddress(query) {
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return [];
  }

  const cleanQuery = query.trim().toLowerCase();

  // Check in-memory cache
  if (searchCache.has(cleanQuery)) {
    return searchCache.get(cleanQuery);
  }

  // Enforce Nominatim 1 req/sec policy
  await nominatimRateLimiter.throttle();

  const url = new URL(`${CONFIG.API_ENDPOINTS.nominatim}/search`);
  url.searchParams.set('q', cleanQuery);
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '5');

  try {
    const response = await fetchWithTimeout(
      url.toString(),
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'AIBasedMobilityPlatform/1.0 (Educational Capstone Project)'
        }
      },
      CONFIG.REQUEST_TIMEOUT_MS
    );

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Nominatim rate limit reached. Please wait a moment before searching again.');
      }
      throw new Error(`Geocoding failed with status ${response.status}`);
    }

    const data = await response.json();
    const results = (data || []).map((item) => ({
      name: item.name || item.display_name.split(',')[0],
      displayName: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      type: item.type,
      importance: item.importance
    }));

    // Cache the result
    searchCache.set(cleanQuery, results);
    return results;
  } catch (error) {
    console.warn('[Nominatim] Search error:', error.message);
    throw error;
  }
}

/**
 * Reverse geocode latitude and longitude to a human-readable address
 * @param {number} lat 
 * @param {number} lon 
 * @returns {Promise<{name: string, displayName: string, lat: number, lon: number}>}
 */
export async function reverseGeocode(lat, lon) {
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (reverseCache.has(cacheKey)) {
    return reverseCache.get(cacheKey);
  }

  await nominatimRateLimiter.throttle();

  const url = new URL(`${CONFIG.API_ENDPOINTS.nominatim}/reverse`);
  url.searchParams.set('lat', lat.toString());
  url.searchParams.set('lon', lon.toString());
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');

  try {
    const response = await fetchWithTimeout(
      url.toString(),
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'AIBasedMobilityPlatform/1.0 (Educational Capstone Project)'
        }
      },
      CONFIG.REQUEST_TIMEOUT_MS
    );

    if (!response.ok) {
      throw new Error(`Reverse geocoding failed with status ${response.status}`);
    }

    const data = await response.json();
    const result = {
      name: data.name || (data.display_name ? data.display_name.split(',')[0] : 'Current Location'),
      displayName: data.display_name || 'Current Location',
      lat: parseFloat(data.lat),
      lon: parseFloat(data.lon)
    };

    reverseCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.warn('[Nominatim] Reverse geocode error:', error.message);
    // Graceful fallback to raw coordinate string if reverse geocoding is unavailable
    return {
      name: `Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
      displayName: `Coordinates: ${lat.toFixed(5)}, ${lon.toFixed(5)}`,
      lat,
      lon
    };
  }
}
