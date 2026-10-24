/**
 * Main Application Orchestrator
 * 
 * Coordinates UI, Map, APIs, and AI Engine.
 * Supports theme toggling (dark/light), location swapping,
 * geolocation detection, and trip planning execution.
 */

import { CONFIG } from './config.js';
import { debounce } from './utils.js';
import { searchAddress, reverseGeocode } from './api/nominatim.js';
import { getDrivingRoute } from './api/routing.js';
import { getDestinationWeather } from './api/weather.js';
import { getNearbyParking } from './api/overpass.js';
import { evaluateTrip } from './ai-engine.js';
import { MapManager } from './map.js';
import { UIController } from './ui.js';

class App {
  constructor() {
    this.mapManager = null;
    this.ui = new UIController();

    // Active locations
    this.sourceLocation = null;
    this.destLocation = null;

    // Theme state
    this.theme = this.getInitialTheme();
  }

  /**
   * Application bootstrap
   */
  init() {
    this.applyTheme(this.theme);
    this.bindThemeToggle();

    // Initialize map and planner if on planner page
    if (document.getElementById('map')) {
      this.initPlanner();
    }
  }

  /**
   * Determine initial theme
   */
  getInitialTheme() {
    const saved = localStorage.getItem('aimp-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /**
   * Apply theme to DOM and Map
   */
  applyTheme(theme) {
    this.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('aimp-theme', theme);

    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
      themeToggleBtn.innerHTML = theme === 'dark'
        ? '<i class="fa-solid fa-sun" aria-hidden="true"></i>'
        : '<i class="fa-solid fa-moon" aria-hidden="true"></i>';
      themeToggleBtn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
    }

    if (this.mapManager) {
      this.mapManager.updateTileLayer(theme);
    }
  }

  /**
   * Bind theme toggle event
   */
  bindThemeToggle() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const nextTheme = this.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme(nextTheme);
      });
    }

    // Listen to system changes if user hasn't explicitly set a preference
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('aimp-theme')) {
          this.applyTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  }

  /**
   * Initialize Planner Page
   */
  initPlanner() {
    // 1. Initialize Map
    const defaultCoords = CONFIG.DEFAULT_SAMPLE;
    this.mapManager = new MapManager('map');
    this.mapManager.init(defaultCoords.source.lat, defaultCoords.source.lon, 12, this.theme);

    // 2. Initialize UI DOM
    this.ui.initDashboardElements();

    // 3. Connect map marker click to parking panel highlight
    this.mapManager.setParkingSelectListener((parkingId) => {
      this.ui.selectParkingCard(parkingId);
    });

    // 4. Bind Input Autocomplete & Controls
    this.bindSearchInputs();
    this.bindActionButtons();

    // 5. Check if query params or default demo requested
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('demo') === '1') {
      this.loadDemoRoute();
    }
  }

  /**
   * Setup debounced autocomplete for origin & destination
   */
  bindSearchInputs() {
    const { sourceInput, destInput, sourceSuggestions, destSuggestions } = this.ui.elements;

    // Debounced search handlers (500 ms per requirement)
    const handleSourceSearch = debounce(async (query) => {
      if (!query || query.length < 2) {
        this.ui.clearSuggestions(sourceSuggestions);
        return;
      }
      this.ui.setInputSpinner('source', true);
      try {
        const results = await searchAddress(query);
        this.ui.renderSuggestions(sourceSuggestions, results, (item) => {
          this.sourceLocation = { name: item.name, lat: item.lat, lon: item.lon, displayName: item.displayName };
          sourceInput.value = item.displayName;
          this.mapManager.setOriginMarker(item.lat, item.lon, item.displayName);
        });
      } catch (err) {
        this.ui.showNotification(err.message, 'warning');
      } finally {
        this.ui.setInputSpinner('source', false);
      }
    }, CONFIG.NOMINATIM_DEBOUNCE_MS);

    const handleDestSearch = debounce(async (query) => {
      if (!query || query.length < 2) {
        this.ui.clearSuggestions(destSuggestions);
        return;
      }
      this.ui.setInputSpinner('dest', true);
      try {
        const results = await searchAddress(query);
        this.ui.renderSuggestions(destSuggestions, results, (item) => {
          this.destLocation = { name: item.name, lat: item.lat, lon: item.lon, displayName: item.displayName };
          destInput.value = item.displayName;
          this.mapManager.setDestinationMarker(item.lat, item.lon, item.displayName);
        });
      } catch (err) {
        this.ui.showNotification(err.message, 'warning');
      } finally {
        this.ui.setInputSpinner('dest', false);
      }
    }, CONFIG.NOMINATIM_DEBOUNCE_MS);

    if (sourceInput) {
      sourceInput.addEventListener('input', (e) => handleSourceSearch(e.target.value));
      sourceInput.addEventListener('focus', () => {
        if (sourceInput.value.length >= 2) handleSourceSearch(sourceInput.value);
      });
    }

    if (destInput) {
      destInput.addEventListener('input', (e) => handleDestSearch(e.target.value));
      destInput.addEventListener('focus', () => {
        if (destInput.value.length >= 2) handleDestSearch(destInput.value);
      });
    }

    // Dismiss suggestions on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#source-group')) this.ui.clearSuggestions(sourceSuggestions);
      if (!e.target.closest('#dest-group')) this.ui.clearSuggestions(destSuggestions);
    });
  }

  /**
   * Bind buttons (Locate, Swap, Plan Journey, Demo pills)
   */
  bindActionButtons() {
    const { swapBtn, locateBtn, planBtn, sourceInput, destInput } = this.ui.elements;

    // Swap button
    if (swapBtn) {
      swapBtn.addEventListener('click', () => {
        const tempLoc = this.sourceLocation;
        this.sourceLocation = this.destLocation;
        this.destLocation = tempLoc;

        const tempVal = sourceInput.value;
        sourceInput.value = destInput.value;
        destInput.value = tempVal;

        if (this.sourceLocation) {
          this.mapManager.setOriginMarker(this.sourceLocation.lat, this.sourceLocation.lon, this.sourceLocation.name);
        }
        if (this.destLocation) {
          this.mapManager.setDestinationMarker(this.destLocation.lat, this.destLocation.lon, this.destLocation.name);
        }
      });
    }

    // Geolocation "Use my current location"
    if (locateBtn) {
      locateBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
          this.ui.showNotification('Geolocation is not supported by your browser.', 'warning');
          return;
        }

        locateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Locating...';
        locateBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            try {
              const res = await reverseGeocode(latitude, longitude);
              this.sourceLocation = { name: res.name, lat: latitude, lon: longitude, displayName: res.displayName };
              sourceInput.value = res.displayName;
              this.mapManager.setOriginMarker(latitude, longitude, res.displayName);
              this.ui.showNotification('Current location detected.', 'success');
            } catch (err) {
              this.sourceLocation = { name: 'My Current Location', lat: latitude, lon: longitude };
              sourceInput.value = `GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
              this.mapManager.setOriginMarker(latitude, longitude, 'My Current Location');
            } finally {
              locateBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Current';
              locateBtn.disabled = false;
            }
          },
          (err) => {
            locateBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Current';
            locateBtn.disabled = false;
            let msg = 'Unable to acquire location.';
            if (err.code === 1) msg = 'Location access was denied. Please allow location permissions.';
            else if (err.code === 2) msg = 'Position unavailable.';
            else if (err.code === 3) msg = 'Location request timed out.';
            this.ui.showNotification(msg, 'warning');
          },
          { timeout: 10000, enableHighAccuracy: true }
        );
      });
    }

    // Plan journey submit
    if (planBtn) {
      planBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.executeTripPlanning();
      });
    }

    // Quick demo pill buttons
    const demoButtons = document.querySelectorAll('[data-demo-route]');
    demoButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.loadDemoRoute();
      });
    });
  }

  /**
   * Load Default Sample Route: Kanpur Central -> IIT Kanpur
   */
  loadDemoRoute() {
    const demo = CONFIG.DEFAULT_SAMPLE;
    this.sourceLocation = { ...demo.source, displayName: demo.source.name };
    this.destLocation = { ...demo.destination, displayName: demo.destination.name };

    if (this.ui.elements.sourceInput) this.ui.elements.sourceInput.value = demo.source.name;
    if (this.ui.elements.destInput) this.ui.elements.destInput.value = demo.destination.name;

    this.mapManager.setOriginMarker(demo.source.lat, demo.source.lon, demo.source.name);
    this.mapManager.setDestinationMarker(demo.destination.lat, demo.destination.lon, demo.destination.name);

    this.executeTripPlanning();
  }

  /**
   * Execute full trip analysis workflow with graceful degradation
   */
  async executeTripPlanning() {
    if (!this.sourceLocation || !this.destLocation) {
      this.ui.showNotification('Please provide both origin and destination locations.', 'warning');
      return;
    }

    this.ui.setLoadingState(true);

    try {
      // Execute routing, weather, and parking concurrently via Promise.allSettled
      // This guarantees that if weather or parking API is slow/down, route planning never crashes
      const [routeResult, weatherResult, parkingResult] = await Promise.allSettled([
        getDrivingRoute(this.sourceLocation, this.destLocation),
        getDestinationWeather(this.destLocation.lat, this.destLocation.lon),
        getNearbyParking(this.destLocation.lat, this.destLocation.lon)
      ]);

      // 1. Process Route
      if (routeResult.status !== 'fulfilled') {
        throw new Error(routeResult.reason?.message || 'Could not find a driving route between specified locations.');
      }
      const routeData = routeResult.value;

      // 2. Process Weather (Graceful degradation)
      let weatherData = null;
      if (weatherResult.status === 'fulfilled') {
        weatherData = weatherResult.value;
      } else {
        console.warn('Weather service unavailable:', weatherResult.reason);
        this.ui.showNotification('Destination weather service is temporarily unavailable.', 'info');
      }

      // 3. Process Parking (Graceful degradation)
      let parkingList = [];
      if (parkingResult.status === 'fulfilled') {
        parkingList = parkingResult.value;
      } else {
        console.warn('Parking query failed:', parkingResult.reason);
        this.ui.showNotification('Nearby parking query encountered a delay.', 'info');
      }

      // 4. Deterministic AI Travel Advisory
      const departureDate = new Date();
      const advisory = evaluateTrip({
        durationMin: routeData.durationSeconds / 60,
        distanceKm: routeData.distanceMeters / 1000,
        departureDate,
        weather: weatherData
      });

      // 5. Render Map Components
      this.mapManager.drawRoute(routeData.coordinates);
      this.mapManager.renderParkingMarkers(parkingList);

      // 6. Render UI Cards
      this.ui.renderRouteSummary(routeData, departureDate);
      this.ui.renderWeather(weatherData);
      this.ui.renderAIAdvisory(advisory);
      this.ui.renderParkingList(parkingList, (parkingId) => {
        this.mapManager.highlightParking(parkingId);
      });

      // 7. Reveal results & handle notifications
      this.ui.showResults();
      this.mapManager.invalidateSize();

      if (routeData.fallbackNotice) {
        this.ui.showNotification(routeData.fallbackNotice, 'info', 7000);
      }
    } catch (error) {
      console.error('[Trip Planning Error]:', error);
      this.ui.showNotification(error.message || 'An error occurred during trip planning.', 'error', 8000);
    } finally {
      this.ui.setLoadingState(false);
    }
  }
}

// Global bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
