/**
 * Leaflet Map Controller
 * 
 * Manages CartoDB base tiles (Positron light & Dark Matter dark),
 * origin/destination markers, route polyline, 2km destination catchment radius,
 * and interactive parking marker layers.
 */

import { CONFIG } from './config.js';
import { formatDistance, escapeHTML } from './utils.js';

export class MapManager {
  /**
   * @param {string} containerId - DOM element ID for the map
   */
  constructor(containerId = 'map') {
    this.containerId = containerId;
    this.map = null;
    this.currentTheme = 'dark';

    // Layers & LayerGroups
    this.tileLayer = null;
    this.routeLayer = null;
    this.originMarker = null;
    this.destMarker = null;
    this.radiusCircle = null;
    this.parkingLayerGroup = null;

    // Marker map for quick lookup by parking ID
    this.parkingMarkers = new Map();

    // Callback when parking marker is selected on map
    this.onParkingSelectCallback = null;
  }

  /**
   * Initialize Leaflet Map
   * @param {number} [lat=26.4539]
   * @param {number} [lon=80.3512]
   * @param {number} [zoom=12]
   * @param {string} [initialTheme='dark']
   */
  init(lat = 26.4539, lon = 80.3512, zoom = 12, initialTheme = 'dark') {
    this.currentTheme = initialTheme;
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`Map container #${this.containerId} not found.`);
      return;
    }

    // Initialize Leaflet instance
    this.map = L.map(this.containerId, {
      center: [lat, lon],
      zoom,
      zoomControl: false // custom position
    });

    // Add zoom control to top-right
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // Add scale bar to bottom-right
    L.control.scale({ position: 'bottomright', imperial: false }).addTo(this.map);

    // Apply CartoDB tile layer based on theme
    this.updateTileLayer(this.currentTheme);

    // Initialize layer group for parking pins
    this.parkingLayerGroup = L.layerGroup().addTo(this.map);
  }

  /**
   * Switch CartoDB tiles between light (Positron) and dark (Dark Matter)
   * @param {string} theme - 'light' | 'dark'
   */
  updateTileLayer(theme) {
    if (!this.map) return;
    this.currentTheme = theme;

    if (this.tileLayer) {
      this.map.removeLayer(this.tileLayer);
    }

    const tileConfig = theme === 'dark' ? CONFIG.MAP_TILES.dark : CONFIG.MAP_TILES.light;
    this.tileLayer = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
      subdomains: 'abcd'
    }).addTo(this.map);
  }

  /**
   * Create custom HTML marker icon
   */
  createCustomIcon(type, label = '') {
    let iconHtml = '';
    let className = 'custom-map-pin';

    if (type === 'origin') {
      className += ' origin-pin';
      iconHtml = `
        <div class="pin-badge origin-badge">
          <i class="fa-solid fa-play"></i>
        </div>
      `;
    } else if (type === 'destination') {
      className += ' destination-pin';
      iconHtml = `
        <div class="pin-badge destination-badge">
          <i class="fa-solid fa-flag-checkered"></i>
        </div>
      `;
    } else if (type === 'parking') {
      className += ' parking-pin';
      iconHtml = `
        <div class="pin-badge parking-badge">
          <span>P</span>
        </div>
      `;
    }

    return L.divIcon({
      className,
      html: iconHtml,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -18]
    });
  }

  /**
   * Set Origin Marker
   */
  setOriginMarker(lat, lon, title = 'Origin') {
    if (this.originMarker) {
      this.map.removeLayer(this.originMarker);
    }

    this.originMarker = L.marker([lat, lon], {
      icon: this.createCustomIcon('origin'),
      title
    }).addTo(this.map);

    this.originMarker.bindPopup(`
      <div class="map-popup origin-popup">
        <span class="popup-tag origin-tag"><i class="fa-solid fa-play"></i> Origin</span>
        <h4 class="popup-title">${escapeHTML(title)}</h4>
        <p class="popup-coords">${lat.toFixed(5)}, ${lon.toFixed(5)}</p>
      </div>
    `);
  }

  /**
   * Set Destination Marker and draw 2 km catchment circle
   */
  setDestinationMarker(lat, lon, title = 'Destination') {
    if (this.destMarker) {
      this.map.removeLayer(this.destMarker);
    }
    if (this.radiusCircle) {
      this.map.removeLayer(this.radiusCircle);
    }

    this.destMarker = L.marker([lat, lon], {
      icon: this.createCustomIcon('destination'),
      title
    }).addTo(this.map);

    this.destMarker.bindPopup(`
      <div class="map-popup dest-popup">
        <span class="popup-tag dest-tag"><i class="fa-solid fa-flag-checkered"></i> Destination</span>
        <h4 class="popup-title">${escapeHTML(title)}</h4>
        <p class="popup-coords">${lat.toFixed(5)}, ${lon.toFixed(5)}</p>
      </div>
    `);

    // Draw 2000 m (2 km) catchment circle
    const isDark = this.currentTheme === 'dark';
    this.radiusCircle = L.circle([lat, lon], {
      radius: CONFIG.PARKING_SEARCH_RADIUS_METERS || 2000,
      color: isDark ? '#38bdf8' : '#0284c7',
      fillColor: isDark ? '#0284c7' : '#38bdf8',
      fillOpacity: 0.12,
      weight: 1.5,
      dashArray: '6, 6'
    }).addTo(this.map);

    this.radiusCircle.bindTooltip('2 km Parking Radius', {
      permanent: false,
      direction: 'top',
      className: 'circle-tooltip'
    });
  }

  /**
   * Draw route polyline and fit viewport bounds
   * @param {Array<[number, number]>} coordinates - [[lat, lon], ...]
   */
  drawRoute(coordinates) {
    if (!this.map || !coordinates || coordinates.length === 0) return;

    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
    }

    // Render multi-layer polyline for glowing smart-mobility effect
    const isDark = this.currentTheme === 'dark';
    const glowColor = isDark ? '#0ea5e9' : '#0284c7';

    this.routeLayer = L.polyline(coordinates, {
      color: glowColor,
      weight: 5,
      opacity: 0.9,
      lineJoin: 'round',
      lineCap: 'round'
    }).addTo(this.map);

    // Auto-fit map to route and bounds with padding
    const bounds = L.latLngBounds(coordinates);
    if (this.radiusCircle) {
      bounds.extend(this.radiusCircle.getBounds());
    }
    this.map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
  }

  /**
   * Populate parking markers on map
   * @param {Array<Object>} parkingList 
   */
  renderParkingMarkers(parkingList = []) {
    if (!this.map || !this.parkingLayerGroup) return;

    this.parkingLayerGroup.clearLayers();
    this.parkingMarkers.clear();

    parkingList.forEach((parking) => {
      const marker = L.marker([parking.lat, parking.lon], {
        icon: this.createCustomIcon('parking'),
        title: parking.name
      });

      const popupContent = `
        <div class="map-popup parking-popup">
          <div class="popup-header">
            <span class="popup-tag parking-tag"><i class="fa-solid fa-square-parking"></i> Parking</span>
            <span class="popup-dist">${formatDistance(parking.distanceMeters)} away</span>
          </div>
          <h4 class="popup-title">${escapeHTML(parking.name)}</h4>
          <div class="popup-meta">
            <div><i class="fa-solid fa-layer-group"></i> <strong>Type:</strong> ${escapeHTML(parking.type)}</div>
            ${parking.capacity ? `<div><i class="fa-solid fa-car"></i> <strong>Capacity:</strong> ${parking.capacity} spaces</div>` : ''}
            <div><i class="fa-solid fa-ticket"></i> <strong>Fee:</strong> ${escapeHTML(parking.fee)}</div>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on('click', () => {
        if (typeof this.onParkingSelectCallback === 'function') {
          this.onParkingSelectCallback(parking.id);
        }
      });

      this.parkingMarkers.set(parking.id, marker);
      this.parkingLayerGroup.addLayer(marker);
    });
  }

  /**
   * Focus and open popup for a specific parking spot
   * @param {string|number} parkingId 
   */
  highlightParking(parkingId) {
    const marker = this.parkingMarkers.get(parkingId);
    if (marker && this.map) {
      marker.openPopup();
      this.map.panTo(marker.getLatLng(), { animate: true, duration: 0.5 });
    }
  }

  /**
   * Register selection listener
   */
  setParkingSelectListener(callback) {
    this.onParkingSelectCallback = callback;
  }

  /**
   * Recalculate map container dimensions
   */
  invalidateSize() {
    if (this.map) {
      setTimeout(() => this.map.invalidateSize(), 200);
    }
  }
}
