/**
 * Routing API Service
 * 
 * Supports OpenRouteService (driving-car profile) with automatic graceful fallback
 * to OSRM public service when API keys are not supplied or unauthenticated.
 */

import { CONFIG } from '../config.js';
import { fetchWithTimeout, calculateDistance } from '../utils.js';

/**
 * Fetch driving route between origin and destination
 * 
 * @param {Object} origin - { lat, lon }
 * @param {Object} destination - { lat, lon }
 * @returns {Promise<Object>} Standardized route data
 */
export async function getDrivingRoute(origin, destination) {
  if (!origin?.lat || !origin?.lon || !destination?.lat || !destination?.lon) {
    throw new Error('Valid origin and destination coordinates are required for routing.');
  }

  const hasValidOrsKey = CONFIG.ORS_API_KEY &&
    CONFIG.ORS_API_KEY.trim() !== '' &&
    CONFIG.ORS_API_KEY !== 'YOUR_ORS_API_KEY';

  if (hasValidOrsKey) {
    try {
      return await fetchOpenRouteService(origin, destination);
    } catch (orsError) {
      console.warn('[Routing] ORS failed, falling back to OSRM:', orsError.message);
      return await fetchOSRMRoute(origin, destination, orsError.message);
    }
  } else {
    // Graceful zero-key fallback using public OSRM driving engine
    return await fetchOSRMRoute(origin, destination, 'OpenRouteService API key not configured in js/config.js. Using public OSRM driving engine.');
  }
}

/**
 * Call OpenRouteService directions API
 */
async function fetchOpenRouteService(origin, destination) {
  const url = `${CONFIG.API_ENDPOINTS.ors}/geojson`;

  const body = {
    coordinates: [
      [origin.lon, origin.lat],
      [destination.lon, destination.lat]
    ],
    instructions: true,
    preference: 'recommended'
  };

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/json, application/geo+json',
        'Authorization': CONFIG.ORS_API_KEY,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(body)
    },
    CONFIG.REQUEST_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ORS responded with HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const feature = data.features?.[0];
  if (!feature) {
    throw new Error('No route found between these locations on OpenRouteService.');
  }

  // GeoJSON coordinates in ORS are [lon, lat], Leaflet polyline expects [lat, lon]
  const leafletCoords = feature.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
  const summary = feature.properties.summary;
  const segments = feature.properties.segments?.[0];

  const steps = (segments?.steps || []).map((step) => ({
    instruction: step.instruction,
    distance: step.distance,
    duration: step.duration,
    type: step.type,
    name: step.name
  }));

  return {
    coordinates: leafletCoords,
    distanceMeters: summary.distance,
    durationSeconds: summary.duration,
    steps,
    provider: 'OpenRouteService (Live)',
    isFallback: false
  };
}

/**
 * Fallback to public Open Source Routing Machine (OSRM)
 */
async function fetchOSRMRoute(origin, destination, fallbackNotice = '') {
  const url = `${CONFIG.API_ENDPOINTS.osrmFallback}/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson&steps=true`;

  try {
    const response = await fetchWithTimeout(url, {}, CONFIG.REQUEST_TIMEOUT_MS);
    if (!response.ok) {
      throw new Error(`OSRM responded with HTTP ${response.status}`);
    }

    const data = await response.json();
    const route = data.routes?.[0];
    if (!route) {
      throw new Error('OSRM found no driving route between the coordinates.');
    }

    // Leaflet [lat, lon]
    const leafletCoords = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    const legs = route.legs?.[0];
    const steps = (legs?.steps || []).map((step) => ({
      instruction: formatOsrmInstruction(step),
      distance: step.distance,
      duration: step.duration,
      name: step.name || ''
    }));

    return {
      coordinates: leafletCoords,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      steps,
      provider: 'OSRM Driving Engine (Public)',
      isFallback: true,
      fallbackNotice
    };
  } catch (osrmError) {
    console.warn('[Routing] OSRM also unavailable, creating synthetic route:', osrmError.message);
    return createSyntheticRoute(origin, destination, fallbackNotice);
  }
}

/**
 * Format human readable text for OSRM step
 */
function formatOsrmInstruction(step) {
  if (!step.maneuver) return 'Continue straight';
  const type = step.maneuver.type;
  const modifier = step.maneuver.modifier;
  const name = step.name ? ` onto ${step.name}` : '';

  if (type === 'depart') return `Depart towards ${step.name || 'destination'}`;
  if (type === 'arrive') return 'Arrive at destination';
  if (modifier) {
    return `${capitalize(type)} ${modifier}${name}`;
  }
  return `${capitalize(type)}${name}`;
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Generate a synthetic route polyline if all network routing APIs are offline
 */
function createSyntheticRoute(origin, destination, notice) {
  const distance = calculateDistance(origin.lat, origin.lon, destination.lat, destination.lon);
  // Estimate driving distance ~1.3x crow flies, avg city speed 35 km/h
  const estDistanceMeters = distance * 1.35;
  const estDurationSeconds = (estDistanceMeters / 1000) * (3600 / 35);

  // Generate 8-point interpolated path
  const numPoints = 8;
  const coordinates = [];
  for (let i = 0; i <= numPoints; i++) {
    const frac = i / numPoints;
    // slight curve displacement
    const curve = Math.sin(frac * Math.PI) * 0.005;
    const lat = origin.lat + (destination.lat - origin.lat) * frac + curve;
    const lon = origin.lon + (destination.lon - origin.lon) * frac - curve;
    coordinates.push([lat, lon]);
  }

  return {
    coordinates,
    distanceMeters: estDistanceMeters,
    durationSeconds: estDurationSeconds,
    steps: [
      { instruction: 'Depart from origin along main roadway', distance: estDistanceMeters * 0.3, duration: estDurationSeconds * 0.3 },
      { instruction: 'Continue on primary connector avenue', distance: estDistanceMeters * 0.5, duration: estDurationSeconds * 0.5 },
      { instruction: 'Turn onto access road and arrive at destination', distance: estDistanceMeters * 0.2, duration: estDurationSeconds * 0.2 }
    ],
    provider: 'Offline Path Estimator',
    isFallback: true,
    fallbackNotice: `${notice} (Generating estimated route)`
  };
}
