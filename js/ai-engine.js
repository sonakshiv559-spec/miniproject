/**
 * AI-Based Intelligent Mobility Platform - Deterministic Logic Engine
 * 
 * Pure, explainable, client-side trip evaluation engine without machine learning or external APIs.
 * Evaluates temporal peak hours, weather conditions, and route characteristics
 * to produce a consolidated 0-100 risk score and categorical travel advisory.
 */

/**
 * Configurable thresholds for trip risk evaluation
 */
export const THRESHOLDS = {
  // Score thresholds mapping to the four required advisory levels
  LEVELS: {
    OPTIMAL: { max: 24, label: 'Optimal', badgeClass: 'badge-optimal', color: '#10b981' },
    PEAK_HOUR: { max: 49, label: 'Peak Hour Alert', badgeClass: 'badge-peak', color: '#f59e0b' },
    CAUTION: { max: 74, label: 'Caution', badgeClass: 'badge-caution', color: '#f97316' },
    CRITICAL: { max: 100, label: 'Critical Warning', badgeClass: 'badge-critical', color: '#ef4444' }
  },

  // Temporal rules
  TEMPORAL: {
    WEEKDAY_MORNING_PEAK: { startHour: 8, startMin: 0, endHour: 10, endMin: 30, penalty: 30 },
    WEEKDAY_EVENING_PEAK: { startHour: 17, startMin: 0, endHour: 20, endMin: 0, penalty: 35 },
    WEEKEND_MIDDAY_PEAK: { startHour: 12, startMin: 0, endHour: 16, endMin: 0, penalty: 15 },
    LATE_NIGHT_HOURS: { startHour: 23, endHour: 5, penalty: 10 }
  },

  // Weather severity rules
  WEATHER: {
    // Severe weather condition codes (OpenWeatherMap ID ranges: 2xx Thunderstorm, 502-504 Heavy rain, 6xx Snow, 741 Fog)
    SEVERE_WEATHER_IDS: [200, 201, 202, 210, 211, 212, 221, 230, 231, 232, 502, 503, 504, 522, 531, 600, 601, 602, 611, 612, 613, 615, 616, 620, 621, 622, 741, 781],
    MODERATE_WEATHER_IDS: [300, 301, 302, 310, 311, 312, 313, 314, 321, 500, 501, 520, 521, 701, 711, 721, 731, 751, 761],
    
    SEVERE_PENALTY: 40,
    MODERATE_PENALTY: 18,
    
    HIGH_WIND_MS: 15,          // > 15 m/s (~54 km/h)
    HIGH_WIND_PENALTY: 20,
    
    LOW_VISIBILITY_METERS: 1000, // < 1000 m fog/mist
    LOW_VISIBILITY_PENALTY: 25,
    
    VERY_LOW_VISIBILITY_METERS: 500,
    VERY_LOW_VISIBILITY_PENALTY: 35
  },

  // Route characteristics
  ROUTE: {
    LONG_DURATION_MIN: 45,
    LONG_DURATION_PENALTY: 15,
    EXTREME_DURATION_MIN: 90,
    EXTREME_DURATION_PENALTY: 25,
    HIGH_DISTANCE_KM: 50,
    HIGH_DISTANCE_PENALTY: 10
  }
};

/**
 * Pure evaluation function for urban trips
 * 
 * @param {Object} params
 * @param {number} params.durationMin - Travel time in minutes
 * @param {number} params.distanceKm - Trip distance in kilometers
 * @param {Date|string} [params.departureDate=new Date()] - Planned departure time
 * @param {Object} [params.weather] - Destination weather data
 * @param {number} [params.weather.temp] - Temperature in Celsius
 * @param {number} [params.weather.weatherId] - OWM Weather condition code
 * @param {string} [params.weather.condition] - Weather condition main string
 * @param {number} [params.weather.windSpeed] - Wind speed in m/s
 * @param {number} [params.weather.visibility] - Visibility in meters
 * 
 * @returns {Object} Evaluation summary { level, score, title, message, reasons, suggestions, breakdown }
 */
export function evaluateTrip({ durationMin = 0, distanceKm = 0, departureDate = new Date(), weather = null }) {
  const date = departureDate instanceof Date ? departureDate : new Date(departureDate);
  const validDate = isNaN(date.getTime()) ? new Date() : date;
  
  let score = 0;
  const reasons = [];
  const suggestions = [];
  const breakdown = {
    temporal: 0,
    weather: 0,
    route: 0
  };

  const dayOfWeek = validDate.getDay(); // 0 is Sunday, 6 is Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const hours = validDate.getHours();
  const minutes = validDate.getMinutes();
  const timeInDecimal = hours + minutes / 60;

  // 1. TEMPORAL ANALYSIS
  if (!isWeekend) {
    // Weekday Morning Peak: 08:00 - 10:30
    const morningStart = THRESHOLDS.TEMPORAL.WEEKDAY_MORNING_PEAK.startHour + THRESHOLDS.TEMPORAL.WEEKDAY_MORNING_PEAK.startMin / 60;
    const morningEnd = THRESHOLDS.TEMPORAL.WEEKDAY_MORNING_PEAK.endHour + THRESHOLDS.TEMPORAL.WEEKDAY_MORNING_PEAK.endMin / 60;
    
    // Weekday Evening Peak: 17:00 - 20:00
    const eveningStart = THRESHOLDS.TEMPORAL.WEEKDAY_EVENING_PEAK.startHour + THRESHOLDS.TEMPORAL.WEEKDAY_EVENING_PEAK.startMin / 60;
    const eveningEnd = THRESHOLDS.TEMPORAL.WEEKDAY_EVENING_PEAK.endHour + THRESHOLDS.TEMPORAL.WEEKDAY_EVENING_PEAK.endMin / 60;

    if (timeInDecimal >= morningStart && timeInDecimal <= morningEnd) {
      const penalty = THRESHOLDS.TEMPORAL.WEEKDAY_MORNING_PEAK.penalty;
      score += penalty;
      breakdown.temporal += penalty;
      reasons.push('Morning commuter peak hour (08:00–10:30) with heightened road congestion.');
      suggestions.push('Consider departing before 07:45 or after 10:30 to avoid peak bottle-necks.');
      suggestions.push('Check local arterial radio or navigation lane guidance.');
    } else if (timeInDecimal >= eveningStart && timeInDecimal <= eveningEnd) {
      const penalty = THRESHOLDS.TEMPORAL.WEEKDAY_EVENING_PEAK.penalty;
      score += penalty;
      breakdown.temporal += penalty;
      reasons.push('Evening rush hour in effect (17:00–20:00) with heavy homeward traffic.');
      suggestions.push('Postpone departure by 45 minutes or shift to public transit corridors.');
      suggestions.push('Allow at least 25% extra buffer time for traffic signals.');
    }
  } else {
    // Weekend Milder Rule: Midday shopping/leisure (12:00 - 16:00)
    const middayStart = THRESHOLDS.TEMPORAL.WEEKDAY_MORNING_PEAK.startHour;
    if (timeInDecimal >= 12 && timeInDecimal <= 16) {
      const penalty = THRESHOLDS.TEMPORAL.WEEKEND_MIDDAY_PEAK.penalty;
      score += penalty;
      breakdown.temporal += penalty;
      reasons.push('Weekend midday retail and recreational transit corridor congestion.');
      suggestions.push('Target parking garages early to avoid destination queue delays.');
    }
  }

  // Late night caution (23:00 - 05:00)
  if (hours >= THRESHOLDS.TEMPORAL.LATE_NIGHT_HOURS.startHour || hours < THRESHOLDS.TEMPORAL.LATE_NIGHT_HOURS.endHour) {
    const penalty = THRESHOLDS.TEMPORAL.LATE_NIGHT_HOURS.penalty;
    score += penalty;
    breakdown.temporal += penalty;
    reasons.push('Late night travel: reduced visibility and irregular commercial transit.');
    suggestions.push('Maintain increased following distance and check headlight alignment.');
  }

  // 2. WEATHER SEVERITY ANALYSIS
  if (weather) {
    const weatherId = Number(weather.weatherId || 800);
    const windSpeed = Number(weather.windSpeed || 0);
    const visibility = Number(weather.visibility != null ? weather.visibility : 10000);
    const condition = String(weather.condition || '').toLowerCase();

    const isExplicitSevere = THRESHOLDS.WEATHER.SEVERE_WEATHER_IDS.includes(weatherId) ||
      condition.includes('thunder') ||
      condition.includes('heavy') ||
      condition.includes('snow') ||
      condition.includes('squall') ||
      condition.includes('tornado');

    const isExplicitModerate = THRESHOLDS.WEATHER.MODERATE_WEATHER_IDS.includes(weatherId) ||
      condition.includes('drizzle') ||
      condition.includes('rain') ||
      condition.includes('mist') ||
      condition.includes('haze');

    // Weather condition penalty
    if (isExplicitSevere) {
      const penalty = THRESHOLDS.WEATHER.SEVERE_PENALTY;
      score += penalty;
      breakdown.weather += penalty;
      reasons.push(`Severe atmospheric event: ${weather.description || weather.condition || 'Severe weather'} at destination.`);
      suggestions.push('Reduce driving speed by at least 20 km/h and turn on dipped headlights.');
      suggestions.push('Verify tire tread depth and windshield wiper integrity before departure.');
    } else if (isExplicitModerate) {
      const penalty = THRESHOLDS.WEATHER.MODERATE_PENALTY;
      score += penalty;
      breakdown.weather += penalty;
      reasons.push(`Precipitation advisory: ${weather.description || weather.condition || 'Damp conditions'} detected.`);
      suggestions.push('Expect wet road surfaces and allow double the normal braking distance.');
    }

    // Visibility checks
    if (visibility < THRESHOLDS.WEATHER.VERY_LOW_VISIBILITY_METERS) {
      const penalty = THRESHOLDS.WEATHER.VERY_LOW_VISIBILITY_PENALTY;
      score += penalty;
      breakdown.weather += penalty;
      reasons.push(`Critical low visibility (< ${visibility} m) due to dense fog/smog.`);
      suggestions.push('Activate front and rear fog lamps; avoid high-beam reflection glare.');
    } else if (visibility < THRESHOLDS.WEATHER.LOW_VISIBILITY_METERS) {
      const penalty = THRESHOLDS.WEATHER.LOW_VISIBILITY_PENALTY;
      score += penalty;
      breakdown.weather += penalty;
      reasons.push(`Reduced road visibility (${visibility} m) approaching destination.`);
      suggestions.push('Keep lane discipline and look out for unlit two-wheelers.');
    }

    // High wind checks
    if (windSpeed > THRESHOLDS.WEATHER.HIGH_WIND_MS) {
      const penalty = THRESHOLDS.WEATHER.HIGH_WIND_PENALTY;
      score += penalty;
      breakdown.weather += penalty;
      reasons.push(`High gusting winds (${windSpeed.toFixed(1)} m/s / ${(windSpeed * 3.6).toFixed(0)} km/h).`);
      suggestions.push('Watch for cross-winds on elevated flyovers and open highway stretches.');
    }
  }

  // 3. ROUTE FACTOR ANALYSIS
  const dur = Number(durationMin) || 0;
  const dist = Number(distanceKm) || 0;

  if (dur > THRESHOLDS.ROUTE.EXTREME_DURATION_MIN) {
    const penalty = THRESHOLDS.ROUTE.EXTREME_DURATION_PENALTY;
    score += penalty;
    breakdown.route += penalty;
    reasons.push(`Prolonged urban journey (${Math.round(dur)} mins) across multiple high-traffic nodes.`);
    suggestions.push('Plan an intermediate 10-minute rest stop to counter driver fatigue.');
  } else if (dur > THRESHOLDS.ROUTE.LONG_DURATION_MIN) {
    const penalty = THRESHOLDS.ROUTE.LONG_DURATION_PENALTY;
    score += penalty;
    breakdown.route += penalty;
    reasons.push(`Moderate-to-long commute duration (${Math.round(dur)} mins) with cumulative exposure.`);
    suggestions.push('Review turn-by-turn guidance before departure.');
  }

  if (dist > THRESHOLDS.ROUTE.HIGH_DISTANCE_KM) {
    const penalty = THRESHOLDS.ROUTE.HIGH_DISTANCE_PENALTY;
    score += penalty;
    breakdown.route += penalty;
    reasons.push(`Inter-district transit span (${dist.toFixed(1)} km).`);
  }

  // Clamp risk score to [0, 100]
  score = Math.min(100, Math.max(0, Math.round(score)));

  // Categorize into the 4 required levels
  let level = THRESHOLDS.LEVELS.OPTIMAL.label;
  let title = 'Optimal Commuting Window';
  let message = 'Conditions are clear with minimal expected traffic friction. Standard commute recommended.';

  if (score >= 75) {
    level = THRESHOLDS.LEVELS.CRITICAL.label;
    title = 'Critical Commuting Warning';
    message = 'Adverse conditions detected combining peak congestion and/or hazardous weather. High delay probability.';
    if (suggestions.length === 0) {
      suggestions.push('Postpone non-essential travel or use rapid mass transit.');
    }
  } else if (score >= 50) {
    level = THRESHOLDS.LEVELS.CAUTION.label;
    title = 'Caution Advised on Route';
    message = 'Noticeable travel resistance identified. Driving requires heightened vigilance and scheduled buffer time.';
    if (suggestions.length === 0) {
      suggestions.push('Allow 20–30 minutes of additional transit buffer.');
    }
  } else if (score >= 25) {
    level = THRESHOLDS.LEVELS.PEAK_HOUR.label;
    title = 'Peak Hour Congestion Alert';
    message = 'High urban traffic volumes detected along standard commuter corridors. Minor delays expected.';
    if (suggestions.length === 0) {
      suggestions.push('Check alternate side-streets or start slightly earlier.');
    }
  } else {
    // Optimal
    if (reasons.length === 0) {
      reasons.push('Off-peak travel window with normal roadway throughput.');
      reasons.push('Favorable destination atmospheric conditions.');
    }
    if (suggestions.length === 0) {
      suggestions.push('Maintain steady cruising speeds for optimal fuel economy.');
      suggestions.push('Enjoy your smooth transit.');
    }
  }

  return {
    score,
    level,
    title,
    message,
    reasons,
    suggestions,
    breakdown
  };
}
