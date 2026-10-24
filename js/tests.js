/**
 * AI-Based Intelligent Mobility Platform - Unit Test Suite
 * 
 * Verifies the deterministic logic engine across all 4 advisory levels:
 * - Optimal (0 - 24)
 * - Peak Hour Alert (25 - 49)
 * - Caution (50 - 74)
 * - Critical Warning (75 - 100)
 */

import { evaluateTrip, THRESHOLDS } from './ai-engine.js';

// Helper to construct dates at specific day and hour
function createTestDate(dayOfWeek, hour, minute = 0) {
  // Day 0: Sunday, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat
  // We can pick a fixed reference date: Oct 20-26, 2026
  // Oct 20, 2026 is Tuesday (day 2)
  // Oct 24, 2026 is Saturday (day 6)
  // Oct 25, 2026 is Sunday (day 0)
  const d = new Date(2026, 9, 20 + ((dayOfWeek - 2 + 7) % 7), hour, minute, 0);
  return d;
}

export const TEST_SUITE = [
  {
    id: 'TEST-01',
    name: 'Optimal: Short trip on weekday off-peak with clear skies',
    expectedLevel: 'Optimal',
    expectedScoreRange: [0, 24],
    params: {
      durationMin: 18,
      distanceKm: 8.5,
      departureDate: createTestDate(2, 14, 0), // Tuesday 14:00 (Off-peak)
      weather: { weatherId: 800, condition: 'Clear', temp: 24, windSpeed: 3.2, visibility: 10000 }
    }
  },
  {
    id: 'TEST-02',
    name: 'Optimal: Weekend morning leisure trip with clear weather',
    expectedLevel: 'Optimal',
    expectedScoreRange: [0, 24],
    params: {
      durationMin: 22,
      distanceKm: 12.0,
      departureDate: createTestDate(0, 10, 0), // Sunday 10:00 (Weekend pre-peak)
      weather: { weatherId: 801, condition: 'Clouds', temp: 22, windSpeed: 2.5, visibility: 10000 }
    }
  },
  {
    id: 'TEST-03',
    name: 'Peak Hour Alert: Weekday morning peak commute (08:45)',
    expectedLevel: 'Peak Hour Alert',
    expectedScoreRange: [25, 49],
    params: {
      durationMin: 28,
      distanceKm: 14.0,
      departureDate: createTestDate(3, 8, 45), // Wednesday 08:45 (Morning rush)
      weather: { weatherId: 800, condition: 'Clear', temp: 20, windSpeed: 3.0, visibility: 10000 }
    }
  },
  {
    id: 'TEST-04',
    name: 'Peak Hour Alert: Weekday evening peak commute (18:15)',
    expectedLevel: 'Peak Hour Alert',
    expectedScoreRange: [25, 49],
    params: {
      durationMin: 32,
      distanceKm: 15.0,
      departureDate: createTestDate(4, 18, 15), // Thursday 18:15 (Evening rush)
      weather: { weatherId: 802, condition: 'Clouds', temp: 26, windSpeed: 4.1, visibility: 9000 }
    }
  },
  {
    id: 'TEST-05',
    name: 'Caution: Moderate precipitation (rain/drizzle) during weekday off-peak',
    expectedLevel: 'Caution',
    expectedScoreRange: [50, 74],
    params: {
      durationMin: 55, // >45 min (+15)
      distanceKm: 24.0,
      departureDate: createTestDate(1, 14, 30), // Monday 14:30
      weather: { weatherId: 500, condition: 'Rain', description: 'light rain', temp: 19, windSpeed: 16.0, visibility: 4000 } // moderate rain (+18) + high wind (+20) = 53
    }
  },
  {
    id: 'TEST-06',
    name: 'Caution: Morning rush hour with moderate rain and 48 min route',
    expectedLevel: 'Caution',
    expectedScoreRange: [50, 74],
    params: {
      durationMin: 48, // >45 min (+15)
      distanceKm: 22.0,
      departureDate: createTestDate(2, 9, 15), // Tuesday 09:15 morning peak (+30)
      weather: { weatherId: 501, condition: 'Rain', description: 'moderate rain', temp: 21, windSpeed: 5.0, visibility: 5000 } // moderate rain (+18) -> total 63
    }
  },
  {
    id: 'TEST-07',
    name: 'Critical Warning: Weekday evening rush hour + Severe thunderstorm',
    expectedLevel: 'Critical Warning',
    expectedScoreRange: [75, 100],
    params: {
      durationMin: 52, // long duration (+15)
      distanceKm: 28.0,
      departureDate: createTestDate(5, 18, 30), // Friday evening rush (+35)
      weather: { weatherId: 211, condition: 'Thunderstorm', description: 'thunderstorm with heavy rain', temp: 22, windSpeed: 18.0, visibility: 2500 } // severe (+40) + wind (+20) -> score 100
    }
  },
  {
    id: 'TEST-08',
    name: 'Critical Warning: Dense fog (<500m) + morning peak + extended highway journey',
    expectedLevel: 'Critical Warning',
    expectedScoreRange: [75, 100],
    params: {
      durationMin: 95, // extreme duration (+25)
      distanceKm: 65.0, // high distance (+10)
      departureDate: createTestDate(1, 8, 30), // Monday morning peak (+30)
      weather: { weatherId: 741, condition: 'Fog', description: 'dense fog', temp: 12, windSpeed: 4.0, visibility: 350 } // very low visibility (+35) -> score 100
    }
  },
  {
    id: 'TEST-09',
    name: 'Optimal: Short errand (5 mins) with mild weather',
    expectedLevel: 'Optimal',
    expectedScoreRange: [0, 24],
    params: {
      durationMin: 5,
      distanceKm: 2.1,
      departureDate: createTestDate(3, 11, 30), // Wednesday 11:30
      weather: { weatherId: 800, condition: 'Clear', temp: 25, windSpeed: 2.0, visibility: 10000 }
    }
  },
  {
    id: 'TEST-10',
    name: 'Caution: Weekend midday leisure shopping peak + gusty winds + long route',
    expectedLevel: 'Caution',
    expectedScoreRange: [50, 74],
    params: {
      durationMin: 65, // long (+15)
      distanceKm: 32.0,
      departureDate: createTestDate(6, 13, 30), // Saturday 13:30 (Weekend peak +15)
      weather: { weatherId: 300, condition: 'Drizzle', temp: 20, windSpeed: 17.5, visibility: 3000 } // drizzle (+18) + high wind (+20) = total 68
    }
  }
];

/**
 * Execute test suite and return structured results
 */
export function runTestSuite() {
  const results = [];
  let passedCount = 0;

  TEST_SUITE.forEach((tc) => {
    const startTime = performance.now();
    const evaluation = evaluateTrip(tc.params);
    const durationMs = performance.now() - startTime;

    const levelPassed = evaluation.level === tc.expectedLevel;
    const scorePassed = evaluation.score >= tc.expectedScoreRange[0] && evaluation.score <= tc.expectedScoreRange[1];
    const passed = levelPassed && scorePassed;

    if (passed) passedCount++;

    results.push({
      ...tc,
      actualLevel: evaluation.level,
      actualScore: evaluation.score,
      reasonsCount: evaluation.reasons.length,
      suggestionsCount: evaluation.suggestions.length,
      breakdown: evaluation.breakdown,
      passed,
      durationMs: parseFloat(durationMs.toFixed(2))
    });
  });

  return {
    total: TEST_SUITE.length,
    passed: passedCount,
    failed: TEST_SUITE.length - passedCount,
    allPassed: passedCount === TEST_SUITE.length,
    results
  };
}
