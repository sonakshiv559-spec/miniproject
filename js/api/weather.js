/**
 * Weather API Client
 * 
 * Retrieves current destination weather via OpenWeatherMap API,
 * with automatic zero-key fallback to Open-Meteo if an API key is missing.
 */

import { CONFIG } from '../config.js';
import { fetchWithTimeout } from '../utils.js';

/**
 * Fetch current weather at destination coordinates
 * @param {number} lat 
 * @param {number} lon 
 * @returns {Promise<Object>}
 */
export async function getDestinationWeather(lat, lon) {
  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
    throw new Error('Valid coordinates are required to retrieve destination weather.');
  }

  const hasValidOwmKey = CONFIG.OWM_API_KEY &&
    CONFIG.OWM_API_KEY.trim() !== '' &&
    CONFIG.OWM_API_KEY !== 'YOUR_OWM_API_KEY';

  if (hasValidOwmKey) {
    try {
      return await fetchOpenWeatherMap(lat, lon);
    } catch (owmError) {
      console.warn('[Weather] OWM request failed, falling back to Open-Meteo:', owmError.message);
      return await fetchOpenMeteoWeather(lat, lon, owmError.message);
    }
  } else {
    return await fetchOpenMeteoWeather(lat, lon, 'OpenWeatherMap API key not configured in js/config.js. Using free Open-Meteo service.');
  }
}

/**
 * Call OpenWeatherMap Current Weather Data endpoint
 */
async function fetchOpenWeatherMap(lat, lon) {
  const url = new URL(CONFIG.API_ENDPOINTS.owm);
  url.searchParams.set('lat', lat.toString());
  url.searchParams.set('lon', lon.toString());
  url.searchParams.set('appid', CONFIG.OWM_API_KEY);
  url.searchParams.set('units', 'metric');

  const response = await fetchWithTimeout(url.toString(), {}, CONFIG.REQUEST_TIMEOUT_MS);

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenWeatherMap responded with status ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const weatherItem = data.weather?.[0] || {};

  return {
    temp: Math.round(data.main?.temp ?? 25),
    feelsLike: Math.round(data.main?.feels_like ?? data.main?.temp ?? 25),
    humidity: data.main?.humidity ?? 50,
    windSpeed: data.wind?.speed ?? 3.5, // m/s
    visibility: data.visibility ?? 10000, // meters
    condition: weatherItem.main || 'Clear',
    description: weatherItem.description || 'clear skies',
    icon: weatherItem.icon || '01d',
    weatherId: weatherItem.id || 800,
    provider: 'OpenWeatherMap (Live)',
    isFallback: false
  };
}

/**
 * Fallback to Open-Meteo API (Free, high accuracy, no registration required)
 */
async function fetchOpenMeteoWeather(lat, lon, notice = '') {
  const url = new URL(CONFIG.API_ENDPOINTS.openMeteoFallback);
  url.searchParams.set('latitude', lat.toString());
  url.searchParams.set('longitude', lon.toString());
  url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,visibility');
  url.searchParams.set('timezone', 'auto');

  try {
    const response = await fetchWithTimeout(url.toString(), {}, CONFIG.REQUEST_TIMEOUT_MS);
    if (!response.ok) {
      throw new Error(`Open-Meteo responded with status ${response.status}`);
    }

    const data = await response.json();
    const current = data.current || {};
    const wCode = current.weather_code ?? 0;
    const { condition, description, weatherId } = mapWmoCode(wCode);

    // wind_speed_10m is typically in km/h from Open-Meteo; convert to m/s
    const windSpeedMs = current.wind_speed_10m != null ? current.wind_speed_10m / 3.6 : 3.2;

    return {
      temp: Math.round(current.temperature_2m ?? 24),
      feelsLike: Math.round(current.temperature_2m ?? 24),
      humidity: Math.round(current.relative_humidity_2m ?? 55),
      windSpeed: parseFloat(windSpeedMs.toFixed(1)),
      visibility: current.visibility ?? 10000,
      condition,
      description,
      icon: getWeatherIconClass(weatherId),
      weatherId,
      provider: 'Open-Meteo (Keyless Fallback)',
      isFallback: true,
      fallbackNotice: notice
    };
  } catch (error) {
    console.warn('[Weather] Open-Meteo also failed, providing default seasonal data:', error.message);
    return {
      temp: 26,
      feelsLike: 27,
      humidity: 50,
      windSpeed: 4.0,
      visibility: 8000,
      condition: 'Clear',
      description: 'fair skies',
      icon: '01d',
      weatherId: 800,
      provider: 'Default Atmospheric Model',
      isFallback: true,
      fallbackNotice: 'Weather service offline; estimated baseline values.'
    };
  }
}

/**
 * Map WMO weather interpretation codes (Open-Meteo) to OWM-compatible ids
 */
function mapWmoCode(code) {
  if (code === 0) return { condition: 'Clear', description: 'clear sky', weatherId: 800 };
  if (code === 1 || code === 2) return { condition: 'Clouds', description: 'partly cloudy', weatherId: 801 };
  if (code === 3) return { condition: 'Clouds', description: 'overcast', weatherId: 804 };
  if (code === 45 || code === 48) return { condition: 'Fog', description: 'dense fog', weatherId: 741 };
  if (code >= 51 && code <= 57) return { condition: 'Drizzle', description: 'light drizzle', weatherId: 300 };
  if (code >= 61 && code <= 67) return { condition: 'Rain', description: 'rain showers', weatherId: 501 };
  if (code >= 71 && code <= 77) return { condition: 'Snow', description: 'snowfall', weatherId: 601 };
  if (code >= 80 && code <= 82) return { condition: 'Rain', description: 'heavy rain', weatherId: 502 };
  if (code >= 95) return { condition: 'Thunderstorm', description: 'thunderstorm with rain', weatherId: 211 };
  return { condition: 'Clear', description: 'clear conditions', weatherId: 800 };
}

/**
 * Return FontAwesome icon name for weather conditions
 */
export function getWeatherIconClass(weatherId) {
  if (!weatherId) return 'fa-sun';
  if (weatherId >= 200 && weatherId < 300) return 'fa-bolt';
  if (weatherId >= 300 && weatherId < 500) return 'fa-cloud-rain';
  if (weatherId >= 500 && weatherId < 600) return 'fa-cloud-showers-heavy';
  if (weatherId >= 600 && weatherId < 700) return 'fa-snowflake';
  if (weatherId >= 700 && weatherId < 800) return 'fa-smog';
  if (weatherId === 800) return 'fa-sun';
  return 'fa-cloud';
}
