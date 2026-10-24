# AI-Based Intelligent Mobility Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-ES6%2B%20Modules-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Leaflet](https://img.shields.io/badge/Leaflet-v1.9.4-brightgreen.svg)](https://leafletjs.com/)
[![Tests](https://img.shields.io/badge/Tests-10%2F10%20Passing-success.svg)](tests.html)

A software-only, zero-cost, serverless, client-side web application that empowers urban commuters to plan smart, safe, and efficient trips. The platform combines real-time driving route geometry, live destination weather, nearby parking discovery within a 2 km destination radius, and a transparent, deterministic AI travel advisory engine.

There is **NO backend, NO database, NO user login, and NO tracking**. Everything runs directly in the browser sandbox.

---

## 🔗 Live Demo

- **Live URL**: [https://sonakshiv559-spec.github.io/miniproject/](https://sonakshiv559-spec.github.io/miniproject/) *(Deployable via GitHub Pages)*
- **Local URL**: `http://localhost:8000`

> ⚠️ **Important Security Notice on Client-Side Keys**: Because this application is 100% client-side with no secret backend server, any API keys embedded in client-side code or static deployments are visible to users. For hosted deployments, always use **restricted free-tier keys** (e.g. restrict OpenRouteService and OpenWeatherMap by HTTP referrers/allowed domains and set strict rate quotas). Alternatively, the application's built-in **Keyless Fallback Mode** (OSRM + Open-Meteo) automatically provides live routing and weather out of the box without exposing private tokens.

---

## 🌟 Key Features

1. **Smart Route Planner**
   - Address search with debounced autocomplete powered by OpenStreetMap Nominatim (respects max 1 req/sec policy).
   - "Use My Current Location" via the HTML5 Geolocation API with reverse geocoding.
   - Quick origin/destination swap button.
   - Full route summary: driving distance (km), estimated travel time (min/hr), departure & arrival estimates, and turn-by-turn navigation steps.

2. **Interactive Map (Leaflet.js & CartoDB)**
   - High-performance vector styling with CartoDB Positron (light mode) and Dark Matter (dark mode).
   - Dynamic route polyline with auto-fitting bounds.
   - Custom map pins for origin, destination, and parking spots.
   - Interactive 2,000 m (2 km) destination parking catchment zone.

3. **Live Destination Weather**
   - Destination atmospheric conditions: temperature, condition, wind speed, visibility, and relative humidity.
   - Integrated with OpenWeatherMap API with automated zero-key fallback to Open-Meteo.

4. **Nearby Parking Discovery (Overpass API)**
   - Real-time OpenStreetMap Overpass query for `amenity=parking` within 2 km of destination.
   - Classifies parking type (surface, multi-storey, underground), capacity, and fee tags.
   - Sorted by proximity to destination; bi-directional hover and click highlight on the map.

5. **Deterministic Client-Side AI Advisory Engine**
   - 100% explainable, zero-ML rule engine that evaluates temporal peak hours, weather hazards, and route factors into a 0–100 risk score.
   - Maps to 4 clear advisory levels:
     - 🟢 **Optimal** (0–24)
     - 🟡 **Peak Hour Alert** (25–49)
     - 🟠 **Caution** (50–74)
     - 🔴 **Critical Warning** (75–100)
   - Outputs contextual reasons, actionable suggestions, and an expandable transparent calculation breakdown.

6. **Modern Smart-City UX & Multi-Page Layout**
   - Multi-page responsive architecture (`index.html`, `planner.html`, `about.html`, `tests.html`).
   - Cohesive smart-city theme with dark/light mode toggle synchronized with map tiles.
   - Mobile-first responsive layout (split panels on desktop, bottom-sheet flow on mobile).
   - Loading skeletons, accessible ARIA attributes, and zero tracking or cookies.

---

## 🛠️ Tech Stack

- **Markup & Styling**: HTML5, Modern CSS3 (Variables, Flexbox, CSS Grid, Glassmorphism).
- **Core Scripting**: Vanilla JavaScript (ES6+ Modules, async/await, fetch). No frontend frameworks, no build step.
- **Mapping Engine**: Leaflet.js v1.9.4 with CartoDB Positron and Dark Matter tiles.
- **Iconography**: Font Awesome 6.4.0.
- **APIs**:
  - OpenStreetMap Nominatim (geocoding & reverse geocoding)
  - OpenRouteService (driving-car profile routing) + OSRM fallback
  - OpenWeatherMap (current destination weather) + Open-Meteo fallback
  - OpenStreetMap Overpass API (`amenity=parking` 2 km radius query)
- **Local Server**: Native Node.js HTTP server (`server.js`) or Python 3 (`python -m http.server`).

---

## 📁 Folder Structure

```
/ (root)
├── index.html              # Landing page with hero, features & CTA
├── planner.html            # Main dashboard (map, inputs, cards)
├── about.html              # Project overview, objectives & SVG architecture
├── tests.html              # AI engine test suite runner
├── server.js               # Zero-dependency local static HTTP server
├── package.json            # Node scripts ("npm start", "npm test")
├── LICENSE                 # MIT License
├── README.md               # Documentation & setup guide
├── .gitignore              # Ignores config.js and local caches
├── css/
│   ├── variables.css       # Design tokens, color palette, dark/light themes
│   ├── base.css            # CSS reset, typography, layout fundamentals
│   ├── components.css      # Reusable UI components (cards, badges, modals, skeletons)
│   └── pages.css           # Page-specific layouts (landing hero, split planner)
└── js/
    ├── config.js           # API keys and runtime parameters (git-ignored)
    ├── config.example.js   # Template config file
    ├── ai-engine.js        # Deterministic trip advisory engine
    ├── map.js              # Leaflet map manager & tile layer switcher
    ├── ui.js               # DOM rendering, cards, parking list & autocomplete
    ├── main.js             # Main orchestrator & controller
    ├── utils.js            # Formatters, rate-limiting, Haversine distance, debounce
    ├── tests.js            # Unit test suite covering all 4 risk levels
    └── api/
        ├── nominatim.js    # Forward & reverse geocoding (cached & rate-limited)
        ├── routing.js      # OpenRouteService & OSRM routing client
        ├── weather.js      # OpenWeatherMap & Open-Meteo client
        └── overpass.js     # OSM Overpass 2km parking radius query
```

---

## 🚀 Running Locally

### Prerequisites
The app requires modern browsers and a static HTTP server (ES6 modules require the `http://` or `https://` protocol due to CORS restrictions on `file://`).

### Option 1: Node.js (Recommended)
```bash
npm start
# Or: node server.js
```
Then visit [http://localhost:8000](http://localhost:8000).

### Option 2: Python 3
```bash
python -m http.server 8000
```
Then visit [http://localhost:8000](http://localhost:8000).

### Option 3: npx http-server
```bash
npx http-server -p 8000
```

---

## 🔑 API Keys Setup

1. Copy the template file `js/config.example.js` to `js/config.js`:
   ```bash
   cp js/config.example.js js/config.js
   ```

2. Open `js/config.js` and add your free keys:
   ```javascript
   export const CONFIG = {
     ORS_API_KEY: 'YOUR_ORS_API_KEY', // OpenRouteService
     OWM_API_KEY: 'YOUR_OWM_API_KEY', // OpenWeatherMap
     // ...
   };
   ```

### Obtaining Free API Keys:
- **OpenRouteService (ORS)**: Sign up for a free token at [openrouteservice.org/dev/#/signup](https://openrouteservice.org/dev/#/signup).
- **OpenWeatherMap (OWM)**: Sign up and get a free key at [openweathermap.org/api](https://openweathermap.org/api).
- **Nominatim & Overpass**: No API keys required. Handled directly with in-memory caching and rate-limiting.

> **💡 Zero-Config Fallback**: If keys are left as `YOUR_ORS_API_KEY` and `YOUR_OWM_API_KEY`, the platform automatically uses OSRM for driving routes and Open-Meteo for destination weather, ensuring the app works immediately out of the box!

---

## 🧠 AI Advisory Engine Logic Table

| Factor | Condition | Risk Points Added | Advisory Message Example |
|---|---|---|---|
| **Peak Hours (Weekday)** | 08:00–10:30 (Morning Peak) | +30 | "Morning rush hour detected with elevated urban congestion." |
| **Peak Hours (Weekday)** | 17:00–20:00 (Evening Peak) | +35 | "Evening commuter peak in progress." |
| **Peak Hours (Weekend)** | 12:00–16:00 (Midday Weekend) | +15 | "Weekend shopping and leisure traffic in progress." |
| **Severe Weather** | Thunderstorm / Heavy Rain / Snow | +35 to +45 | "Severe weather at destination; expect slick roads & delays." |
| **Low Visibility** | Fog / Mist / Visibility < 1,000 m | +25 | "Low visibility (< 1 km) reported at destination." |
| **High Wind** | Wind speed > 15 m/s (~54 km/h) | +20 | "High wind gusts detected; exercise caution on bridges." |
| **Moderate Weather** | Light rain / Drizzle | +15 | "Light rain or damp roadways at destination." |
| **Route Duration** | > 45 minutes | +15 | "Long commute duration increases risk of delays." |
| **Route Duration** | > 90 minutes | +25 | "Extended transit time across urban sectors." |

### Score Mapping
- 🟢 **Optimal** (0–24): Favorable driving conditions.
- 🟡 **Peak Hour Alert** (25–49): Commuter corridor congestion; buffer time recommended.
- 🟠 **Caution** (50–74): Weather hazards or extended journey friction; defensive driving advised.
- 🔴 **Critical Warning** (75–100): Hazardous weather and peak bottlenecks; postpone non-essential trips.

---

## 🧪 Running Unit Tests

Run via the command line:
```bash
npm test
```
Or open [http://localhost:8000/tests.html](http://localhost:8000/tests.html) in your browser to run the visual test suite.

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).
