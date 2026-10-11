# ☀️ Thermal Comfort Router
### Walk Smarter. Find More Shade.

**A Sun-Aware Pedestrian Navigation System for Heat-Resilient Urban Travel**

**Team VISTA | Travel-Tech Hackathon**

---

## 📌 Overview

Thermal Comfort Router is an innovative travel-tech application that helps pedestrians discover walking routes with reduced exposure to direct sunlight.

Traditional navigation applications primarily recommend routes based on distance and travel time. However, in cities with extremely hot climates, such as Dubai, the shortest route may not always be the most comfortable option.

Thermal Comfort Router addresses this challenge by analyzing building geometry, estimated shadows, solar position, and pedestrian pathways to recommend routes that prioritize shade while considering walking distance.

The application allows users to compare the **Shortest Route** and the **Shade-Aware Route**, helping them make informed decisions about their journeys.

## 🎯 Problem Statement

Pedestrians in hot urban environments often experience prolonged exposure to direct sunlight while travelling between destinations.

Existing navigation systems generally do not consider how surrounding buildings provide shade at different times of the day.

This creates a need for a navigation solution that considers sunlight exposure alongside conventional routing factors.

## 💡 Proposed Solution

Thermal Comfort Router combines geographic data, solar-position calculations, and graph-based routing algorithms to estimate shaded walking routes.

The application:

- Identifies pedestrian-accessible pathways.
- Uses building footprints and estimated heights to model shadows.
- Calculates estimated sunlight exposure along pedestrian routes.
- Recommends routes based on walking distance and shade preference.
- Compares conventional shortest-distance routes with shade-aware alternatives.
- Allows users to explore route changes at different times of day.

**The initial prototype focuses on Downtown Dubai, near Dubai Mall, Burj Khalifa, and Dubai Opera.**

## ✨ Key Features

### 🗺️ Interactive 3D Map
- Interactive map with 3D building visualization.
- Displays pedestrian pathways and estimated building shadows.
- Allows users to select starting points and destinations.
- Visualizes shortest and shade-aware walking routes.

### ☀️ Time-Based Shadow Visualization
Users can select three departure times:

- 10:00 AM
- 1:00 PM
- 4:00 PM

The application updates the estimated shadow distribution and route recommendations based on the selected time.

### 🌳 Shade-Aware Route Recommendation
- Uses a weighted shortest-path algorithm.
- Considers both walking distance and estimated direct-sun exposure.
- Allows users to adjust shade preference from 0 to 5.

### 🚶 Walking Perspective
- Provides a low-angle 3D perspective along the selected route.
- Allows navigation through route positions using Previous and Next controls.
- Supports switching between shortest and shade-aware routes.

*Walking Perspective is a 3D map visualization, not photographic Google Street View.*

### 📊 Route Comparison
Compares both routes using:

- Total walking distance
- Estimated walking duration
- Estimated distance in direct sunlight
- Sun-exposure percentage
- Additional walking distance
- Estimated reduction in direct-sun exposure

### 🏙️ Skyline Loading Experience
A Dubai-inspired skyline introduction provides a thematic loading experience while geographic data initializes.

### 🎛️ Interactive Controls
- Starting-point and destination selection
- Swap locations
- Demo route
- Departure-time selection
- Shade-preference slider
- Map zoom and reset
- Layer visibility controls
- Route highlighting
- Walking Perspective navigation

## 🛠️ Tech Stack

| Component | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Map Visualization | MapLibre GL JS, react-map-gl |
| Styling | CSS |
| Geographic Data | OpenStreetMap, GeoJSON |
| Geographic Extraction | Python, OSMnx |
| Solar Calculations | SunCalc |
| Geospatial Operations | Turf.js |
| Routing Algorithm | Dijkstra's Algorithm |
| Testing | Vitest |
| Version Control | Git, GitHub |

## 🧠 Working Methodology

### 1. Geographic Data Collection
OpenStreetMap data is used to obtain pedestrian pathways, building footprints, and available building-height information.

### 2. Solar Position Calculation
The sun's position is calculated for the selected departure time using solar geometry.

### 3. Building Shadow Estimation
Approximate shadow polygons are generated using building footprints, heights, and solar position.

### 4. Sun-Exposure Analysis
Pedestrian paths are sampled to estimate which portions are exposed to direct sunlight and which portions fall within calculated building shadows.

### 5. Route Optimization
Dijkstra's algorithm calculates two routes:

**Shortest Route:** Minimizes total walking distance.

**Shade-Aware Route:** Minimizes a weighted combination of walking distance and direct-sun exposure.

The shade-aware route uses the following cost function:

`Cost = Distance × (1 + α × Sun Exposure Fraction)`

Where:

- **Distance:** Length of the pedestrian edge.
- **α:** User-selected shade preference (0–5).
- **Sun Exposure Fraction:** Estimated fraction of the edge exposed to direct sunlight (0–1).

### 6. Route Comparison
The application calculates and displays the differences between the two routes, allowing users to evaluate the trade-off between walking distance and estimated sunlight exposure.

## 🏗️ System Architecture

**User Input**

↓ Starting Point, Destination, Time, Shade Preference

**Frontend — React + MapLibre**

↓

**Geospatial Computation Engine**

- Pedestrian Network
- Solar Position and Shadow Data
- Edge Sun-Exposure Data
- Dijkstra Routing

↓

**Route Metrics Calculation**

↓

**Interactive Map and Route Comparison**

The primary routing computation runs locally in the browser using preprocessed geographic datasets. A separate production backend server or database is not required.

## 📁 Project Structure

```text
Thermal-Comfort-Router/
├── public/
│   └── data/
│       ├── buildings.geojson
│       ├── graph.json
│       ├── shadows-1000.geojson
│       ├── shadows-1300.geojson
│       ├── shadows-1600.geojson
│       ├── exposure-1000.json
│       ├── exposure-1300.json
│       └── exposure-1600.json
│
├── scripts/
│   ├── export_osm.py
│   └── precompute.mjs
│
├── src/
│   ├── components/
│   ├── engine/
│   ├── integration/
│   ├── styles/
│   ├── App.tsx
│   ├── main.tsx
│   └── types.ts
│
├── tests/
├── package.json
├── index.html
└── README.md
```

## 🚀 Installation and Setup

### Prerequisites

- Node.js
- npm
- Python (for geographic data preprocessing)
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR-USERNAME/Thermal-Comfort-Router.git
```

### 2. Navigate to the Project

```bash
cd Thermal-Comfort-Router
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Application

```bash
npm run dev
```

Open the local URL displayed in the terminal, usually:

`http://localhost:5173`

## 🌍 Geographic Data Preparation

To download and prepare OpenStreetMap geographic data, run:

```bash
python -m pip install "osmnx>=2,<3"
python scripts/export_osm.py
npm run precompute
python scripts/validate_data.py
```

To run automated tests:

```bash
npm test
```

**Dataset status:** The initially bundled development dataset contains synthetic test geography. The synthetic routes are illustrative and must not be represented as verified Dubai pedestrian routes. Real OpenStreetMap extraction and validation are required before claiming real-world routing accuracy.

## ⚠️ Limitations

- The prototype covers a limited geographic region.
- Building heights may be estimated when actual height information is unavailable.
- Shadow calculations are approximations based on available building geometry.
- The current implementation supports three predefined departure times.
- Route recommendations depend on the accuracy and completeness of the geographic data.
- The system estimates building-generated shade, not actual temperature, humidity, personal thermal comfort, or medical heat risk.
- Walking Perspective does not provide photographic street imagery.

## 🔮 Future Enhancements

- Real-time weather-data integration
- Continuous departure-time selection
- Tree-canopy and natural shade estimation
- Larger geographic coverage
- Accessibility-aware pedestrian routing
- Mobile navigation support
- Additional environmental factors affecting pedestrian comfort

## 👩‍💻 Team VISTA

| Team Member |
|---|
| **Nahana Fathima** |
| **Fathima P Ajvad** |

**Project:** Thermal Comfort Router

**Category:** Travel Technology / Smart Mobility

**Team:** VISTA

---

### ☀️ Walk Smarter. Find More Shade.

*Making pedestrian navigation more aware of the urban environment, one route at a time.*
