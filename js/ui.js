/**
 * UI Renderer & DOM Controller
 * 
 * Manages autocomplete inputs, skeleton loaders, cards (Route, Weather, Parking, AI Advisory),
 * toasts, notifications, and interactive element synchronization.
 */

import { formatDistance, formatDuration, formatTime, calculateArrivalTime, escapeHTML } from './utils.js';
import { getWeatherIconClass } from './api/weather.js';

export class UIController {
  constructor() {
    // Elements cached on init
    this.elements = {};
  }

  /**
   * Bind DOM elements for dashboard
   */
  initDashboardElements() {
    this.elements = {
      sourceInput: document.getElementById('source-input'),
      destInput: document.getElementById('dest-input'),
      sourceSuggestions: document.getElementById('source-suggestions'),
      destSuggestions: document.getElementById('dest-suggestions'),
      sourceSpinner: document.getElementById('source-spinner'),
      destSpinner: document.getElementById('dest-spinner'),
      swapBtn: document.getElementById('btn-swap'),
      locateBtn: document.getElementById('btn-locate'),
      planBtn: document.getElementById('btn-plan'),
      notificationArea: document.getElementById('notification-area'),

      // Cards & Panels
      resultsContainer: document.getElementById('results-container'),
      emptyState: document.getElementById('empty-state'),
      skeletonState: document.getElementById('skeleton-state'),

      routeCard: document.getElementById('route-card'),
      routeDistance: document.getElementById('route-distance'),
      routeDuration: document.getElementById('route-duration'),
      routeDeparture: document.getElementById('route-departure'),
      routeArrival: document.getElementById('route-arrival'),
      routeStepsToggle: document.getElementById('btn-toggle-steps'),
      routeStepsList: document.getElementById('route-steps-list'),
      routeProviderBadge: document.getElementById('route-provider-badge'),

      weatherCard: document.getElementById('weather-card'),
      weatherTemp: document.getElementById('weather-temp'),
      weatherDesc: document.getElementById('weather-desc'),
      weatherIcon: document.getElementById('weather-icon'),
      weatherWind: document.getElementById('weather-wind'),
      weatherHumidity: document.getElementById('weather-humidity'),
      weatherVisibility: document.getElementById('weather-visibility'),
      weatherProviderBadge: document.getElementById('weather-provider-badge'),

      aiCard: document.getElementById('ai-advisory-card'),
      aiScoreVal: document.getElementById('ai-score-value'),
      aiScoreMeter: document.getElementById('ai-score-meter-fill'),
      aiLevelBadge: document.getElementById('ai-level-badge'),
      aiTitle: document.getElementById('ai-title'),
      aiMessage: document.getElementById('ai-message'),
      aiReasonsList: document.getElementById('ai-reasons-list'),
      aiSuggestionsList: document.getElementById('ai-suggestions-list'),
      aiExplainerToggle: document.getElementById('ai-explainer-toggle'),
      aiExplainerBody: document.getElementById('ai-explainer-body'),
      aiBreakdownDetails: document.getElementById('ai-breakdown-details'),

      parkingPanel: document.getElementById('parking-panel'),
      parkingCountBadge: document.getElementById('parking-count-badge'),
      parkingList: document.getElementById('parking-list')
    };

    this.bindStaticListeners();
  }

  /**
   * Bind static UI toggles (e.g., turn-by-turn toggle, explainer toggle)
   */
  bindStaticListeners() {
    if (this.elements.routeStepsToggle && this.elements.routeStepsList) {
      this.elements.routeStepsToggle.addEventListener('click', () => {
        const isHidden = this.elements.routeStepsList.classList.toggle('hidden');
        this.elements.routeStepsToggle.innerHTML = isHidden
          ? '<i class="fa-solid fa-chevron-down"></i> View Turn-by-Turn Steps'
          : '<i class="fa-solid fa-chevron-up"></i> Hide Turn-by-Turn Steps';
      });
    }

    if (this.elements.aiExplainerToggle && this.elements.aiExplainerBody) {
      this.elements.aiExplainerToggle.addEventListener('click', () => {
        const isCollapsed = this.elements.aiExplainerBody.classList.toggle('hidden');
        this.elements.aiExplainerToggle.querySelector('.toggle-icon').style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)';
      });
    }
  }

  /**
   * Render autocomplete dropdown suggestions list
   */
  renderSuggestions(container, suggestions, onSelect) {
    if (!container) return;
    container.innerHTML = '';

    if (!suggestions || suggestions.length === 0) {
      container.classList.add('hidden');
      return;
    }

    suggestions.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'suggestion-item';
      li.setAttribute('role', 'option');
      li.setAttribute('tabindex', '0');
      li.innerHTML = `
        <i class="fa-solid fa-location-dot item-icon"></i>
        <div class="item-content">
          <span class="item-primary">${escapeHTML(item.name)}</span>
          <span class="item-secondary">${escapeHTML(item.displayName)}</span>
        </div>
      `;

      li.addEventListener('click', () => {
        onSelect(item);
        this.clearSuggestions(container);
      });

      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onSelect(item);
          this.clearSuggestions(container);
        }
      });

      container.appendChild(li);
    });

    container.classList.remove('hidden');
  }

  /**
   * Clear autocomplete dropdown
   */
  clearSuggestions(container) {
    if (container) {
      container.innerHTML = '';
      container.classList.add('hidden');
    }
  }

  /**
   * Show/hide input loader spinner
   */
  setInputSpinner(type, show) {
    const spinner = type === 'source' ? this.elements.sourceSpinner : this.elements.destSpinner;
    if (spinner) {
      spinner.classList.toggle('hidden', !show);
    }
  }

  /**
   * Set loading skeleton state
   */
  setLoadingState(loading) {
    if (this.elements.emptyState) {
      this.elements.emptyState.classList.toggle('hidden', loading);
    }
    if (this.elements.skeletonState) {
      this.elements.skeletonState.classList.toggle('hidden', !loading);
    }
    if (this.elements.resultsContainer && loading) {
      this.elements.resultsContainer.classList.add('hidden');
    }
    if (this.elements.planBtn) {
      this.elements.planBtn.disabled = loading;
      this.elements.planBtn.innerHTML = loading
        ? '<i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing Route...'
        : '<i class="fa-solid fa-wand-magic-sparkles"></i> Plan Journey';
    }
  }

  /**
   * Show results container
   */
  showResults() {
    if (this.elements.emptyState) this.elements.emptyState.classList.add('hidden');
    if (this.elements.skeletonState) this.elements.skeletonState.classList.add('hidden');
    if (this.elements.resultsContainer) this.elements.resultsContainer.classList.remove('hidden');
  }

  /**
   * Render Route Summary Card
   */
  renderRouteSummary(routeData, departureDate = new Date()) {
    if (!this.elements.routeCard) return;

    const arrivalDate = calculateArrivalTime(departureDate, routeData.durationSeconds);

    this.elements.routeDistance.textContent = formatDistance(routeData.distanceMeters);
    this.elements.routeDuration.textContent = formatDuration(routeData.durationSeconds);
    this.elements.routeDeparture.textContent = formatTime(departureDate);
    this.elements.routeArrival.textContent = formatTime(arrivalDate);

    // Provider badge
    if (this.elements.routeProviderBadge) {
      this.elements.routeProviderBadge.textContent = routeData.provider;
      this.elements.routeProviderBadge.className = `provider-badge ${routeData.isFallback ? 'provider-fallback' : 'provider-live'}`;
    }

    // Turn by turn steps
    if (this.elements.routeStepsList) {
      this.elements.routeStepsList.innerHTML = '';
      if (routeData.steps && routeData.steps.length > 0) {
        routeData.steps.forEach((step, idx) => {
          const li = document.createElement('li');
          li.className = 'step-item';
          li.innerHTML = `
            <span class="step-num">${idx + 1}</span>
            <div class="step-details">
              <span class="step-instruction">${escapeHTML(step.instruction)}</span>
              <span class="step-meta">${formatDistance(step.distance)} &bull; ${formatDuration(step.duration)}</span>
            </div>
          `;
          this.elements.routeStepsList.appendChild(li);
        });
        this.elements.routeStepsToggle.classList.remove('hidden');
      } else {
        this.elements.routeStepsToggle.classList.add('hidden');
      }
    }
  }

  /**
   * Render Weather Card
   */
  renderWeather(weatherData) {
    if (!this.elements.weatherCard) return;

    if (!weatherData) {
      this.elements.weatherTemp.textContent = '--';
      this.elements.weatherDesc.textContent = 'Weather data unavailable';
      return;
    }

    this.elements.weatherTemp.innerHTML = `${weatherData.temp}&deg;C`;
    this.elements.weatherDesc.textContent = `${weatherData.condition} (${weatherData.description})`;
    this.elements.weatherWind.textContent = `${weatherData.windSpeed} m/s`;
    this.elements.weatherHumidity.textContent = `${weatherData.humidity}%`;
    this.elements.weatherVisibility.textContent = formatDistance(weatherData.visibility);

    // Update icon
    const iconClass = getWeatherIconClass(weatherData.weatherId);
    if (this.elements.weatherIcon) {
      this.elements.weatherIcon.className = `fa-solid ${iconClass} weather-main-icon`;
    }

    if (this.elements.weatherProviderBadge) {
      this.elements.weatherProviderBadge.textContent = weatherData.provider;
      this.elements.weatherProviderBadge.className = `provider-badge ${weatherData.isFallback ? 'provider-fallback' : 'provider-live'}`;
    }
  }

  /**
   * Render AI Advisory Card
   */
  renderAIAdvisory(advisory) {
    if (!this.elements.aiCard || !advisory) return;

    // Reset theme classes
    this.elements.aiCard.className = 'dashboard-card ai-advisory-card';
    const levelSlug = advisory.level.toLowerCase().replace(/\s+/g, '-');
    this.elements.aiCard.classList.add(`level-${levelSlug}`);

    // Level Badge
    this.elements.aiLevelBadge.textContent = advisory.level;
    this.elements.aiLevelBadge.className = `advisory-badge badge-${levelSlug}`;

    // Score & Meter
    this.elements.aiScoreVal.textContent = advisory.score;
    if (this.elements.aiScoreMeter) {
      this.elements.aiScoreMeter.style.width = `${advisory.score}%`;
      // Set meter color based on level
      if (advisory.score >= 75) this.elements.aiScoreMeter.style.backgroundColor = '#ef4444';
      else if (advisory.score >= 50) this.elements.aiScoreMeter.style.backgroundColor = '#f97316';
      else if (advisory.score >= 25) this.elements.aiScoreMeter.style.backgroundColor = '#f59e0b';
      else this.elements.aiScoreMeter.style.backgroundColor = '#10b981';
    }

    this.elements.aiTitle.textContent = advisory.title;
    this.elements.aiMessage.textContent = advisory.message;

    // Reasons List
    this.elements.aiReasonsList.innerHTML = '';
    (advisory.reasons || []).forEach((reason) => {
      const li = document.createElement('li');
      li.innerHTML = `<i class="fa-solid fa-circle-info reason-bullet"></i> <span>${escapeHTML(reason)}</span>`;
      this.elements.aiReasonsList.appendChild(li);
    });

    // Suggestions List
    this.elements.aiSuggestionsList.innerHTML = '';
    (advisory.suggestions || []).forEach((suggestion) => {
      const li = document.createElement('li');
      li.innerHTML = `<i class="fa-solid fa-check-circle suggestion-bullet"></i> <span>${escapeHTML(suggestion)}</span>`;
      this.elements.aiSuggestionsList.appendChild(li);
    });

    // Calculation Breakdown
    if (this.elements.aiBreakdownDetails && advisory.breakdown) {
      this.elements.aiBreakdownDetails.innerHTML = `
        <div class="breakdown-grid">
          <div class="breakdown-item">
            <span class="breakdown-label"><i class="fa-solid fa-clock"></i> Temporal Peak</span>
            <span class="breakdown-value">+${advisory.breakdown.temporal} pts</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label"><i class="fa-solid fa-cloud-sun"></i> Weather Hazard</span>
            <span class="breakdown-value">+${advisory.breakdown.weather} pts</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label"><i class="fa-solid fa-route"></i> Route Factor</span>
            <span class="breakdown-value">+${advisory.breakdown.route} pts</span>
          </div>
          <div class="breakdown-item total">
            <span class="breakdown-label">Total Composite Risk Score</span>
            <span class="breakdown-value score-highlight">${advisory.score} / 100</span>
          </div>
        </div>
      `;
    }
  }

  /**
   * Render Parking Panel List
   */
  renderParkingList(parkingList = [], onSelectParking) {
    if (!this.elements.parkingList) return;
    this.elements.parkingList.innerHTML = '';

    if (this.elements.parkingCountBadge) {
      this.elements.parkingCountBadge.textContent = `${parkingList.length} spots within 2 km`;
    }

    if (!parkingList || parkingList.length === 0) {
      this.elements.parkingList.innerHTML = `
        <div class="empty-parking-notice">
          <i class="fa-solid fa-square-parking"></i>
          <p>No tagged parking facilities found within 2 km of destination.</p>
        </div>
      `;
      return;
    }

    parkingList.forEach((parking) => {
      const card = document.createElement('div');
      card.className = 'parking-item-card';
      card.id = `parking-card-${parking.id}`;
      card.setAttribute('tabindex', '0');

      card.innerHTML = `
        <div class="parking-item-header">
          <span class="parking-name">${escapeHTML(parking.name)}</span>
          <span class="parking-distance-badge"><i class="fa-solid fa-person-walking"></i> ${formatDistance(parking.distanceMeters)}</span>
        </div>
        <div class="parking-item-tags">
          <span class="tag-badge"><i class="fa-solid fa-layer-group"></i> ${escapeHTML(parking.type)}</span>
          <span class="tag-badge ${parking.fee === 'Free' ? 'tag-free' : 'tag-fee'}"><i class="fa-solid fa-ticket"></i> ${escapeHTML(parking.fee)}</span>
          ${parking.capacity ? `<span class="tag-badge"><i class="fa-solid fa-car"></i> ${parking.capacity} spaces</span>` : ''}
        </div>
      `;

      card.addEventListener('click', () => {
        this.selectParkingCard(parking.id);
        if (typeof onSelectParking === 'function') {
          onSelectParking(parking.id);
        }
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          card.click();
        }
      });

      this.elements.parkingList.appendChild(card);
    });
  }

  /**
   * Highlight parking item card when selected or pinned on map
   */
  selectParkingCard(parkingId) {
    const cards = document.querySelectorAll('.parking-item-card');
    cards.forEach((c) => c.classList.remove('active'));

    const selectedCard = document.getElementById(`parking-card-${parkingId}`);
    if (selectedCard) {
      selectedCard.classList.add('active');
      selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /**
   * Display inline notification or toast alert
   */
  showNotification(message, type = 'info', durationMs = 6000) {
    if (!this.elements.notificationArea) return;

    const alert = document.createElement('div');
    alert.className = `alert-banner alert-${type} animate-slide-in`;
    
    let icon = 'fa-info-circle';
    if (type === 'warning') icon = 'fa-triangle-exclamation';
    else if (type === 'error') icon = 'fa-circle-xmark';
    else if (type === 'success') icon = 'fa-circle-check';

    alert.innerHTML = `
      <div class="alert-content">
        <i class="fa-solid ${icon}"></i>
        <span>${escapeHTML(message)}</span>
      </div>
      <button class="alert-close" aria-label="Close notification">&times;</button>
    `;

    alert.querySelector('.alert-close').addEventListener('click', () => alert.remove());

    this.elements.notificationArea.appendChild(alert);

    if (durationMs > 0) {
      setTimeout(() => {
        alert.classList.add('animate-fade-out');
        setTimeout(() => alert.remove(), 400);
      }, durationMs);
    }
  }
}
