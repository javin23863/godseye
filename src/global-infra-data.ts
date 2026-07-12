// Curated WORLDWIDE critical infrastructure (beyond the Gulf-only CRITICAL INFRA layer):
// strategic maritime chokepoints, major transnational oil/gas pipelines, and strategic ports.
// Coordinates approximate but realistic; static data (no network feed). Reuses the InfraFeature
// shape/kind union from infra-data.ts so the styling convention (amber transit / red choke /
// orange strategic) carries over unchanged.
import type { InfraCollection } from './infra-data'

export const GLOBAL_INFRA: InfraCollection = {
  type: 'FeatureCollection',
  features: [
    // -- Strategic maritime chokepoints (straits + canals) --------------------
    { type: 'Feature', geometry: { type: 'Point', coordinates: [100.4, 2.5] }, properties: { name: 'Strait of Malacca', kind: 'chokepoint' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [32.35, 30.6] }, properties: { name: 'Suez Canal', kind: 'chokepoint' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-79.68, 9.08] }, properties: { name: 'Panama Canal', kind: 'chokepoint' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [56.6, 26.6] }, properties: { name: 'Strait of Hormuz', kind: 'chokepoint' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [43.3, 12.6] }, properties: { name: 'Bab-el-Mandeb', kind: 'chokepoint' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [29.02, 41.1] }, properties: { name: 'Bosphorus Strait', kind: 'chokepoint' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [26.4, 40.2] }, properties: { name: 'Dardanelles', kind: 'chokepoint' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-5.6, 35.95] }, properties: { name: 'Strait of Gibraltar', kind: 'chokepoint' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [1.4, 51.0] }, properties: { name: 'Strait of Dover', kind: 'chokepoint' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [11.0, 55.3] }, properties: { name: 'Danish Straits (Great Belt)', kind: 'chokepoint' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [105.9, -6.0] }, properties: { name: 'Sunda Strait', kind: 'chokepoint' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [115.7, -8.7] }, properties: { name: 'Lombok Strait', kind: 'chokepoint' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [119.5, 24.5] }, properties: { name: 'Taiwan Strait', kind: 'chokepoint' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-169.0, 65.6] }, properties: { name: 'Bering Strait', kind: 'chokepoint' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [18.47, -34.35] }, properties: { name: 'Cape of Good Hope', kind: 'chokepoint' } },

    // -- Major transnational oil/gas pipelines --------------------------------
    {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[27.7, 60.7], [20.0, 58.0], [15.0, 55.5], [13.4, 54.15]] },
      properties: { name: 'Nord Stream (RU→DE)', kind: 'pipeline' },
    },
    {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[49.0, 53.0], [40.0, 52.3], [30.0, 52.0], [23.7, 52.1], [14.3, 53.0]] },
      properties: { name: 'Druzhba Pipeline (RU→EU)', kind: 'pipeline' },
    },
    {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[80.0, 40.0], [95.0, 41.0], [105.0, 38.0], [112.0, 35.0], [121.47, 31.23]] },
      properties: { name: 'West–East Gas Pipeline (China)', kind: 'pipeline' },
    },
    {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[122.0, 56.0], [127.5, 50.3], [125.3, 43.9]] },
      properties: { name: 'Power of Siberia (RU→CN)', kind: 'pipeline' },
    },
    {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[-148.6, 70.2], [-149.0, 66.0], [-146.35, 61.08]] },
      properties: { name: 'Trans-Alaska Pipeline', kind: 'pipeline' },
    },
    {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[-110.7, 52.9], [-104.0, 49.0], [-97.0, 45.0], [-95.6, 40.0]] },
      properties: { name: 'Keystone Pipeline (CA→US)', kind: 'pipeline' },
    },
    {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[49.85, 40.4], [44.8, 41.7], [39.7, 40.0], [35.8, 36.9]] },
      properties: { name: 'Baku–Tbilisi–Ceyhan', kind: 'pipeline' },
    },
    {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[3.3, 32.9], [1.0, 34.0], [-1.35, 35.3], [-2.46, 36.84]] },
      properties: { name: 'Maghreb–Europe Gasline', kind: 'pipeline' },
    },

    // -- Strategic ports ------------------------------------------------------
    { type: 'Feature', geometry: { type: 'Point', coordinates: [121.5, 31.23] }, properties: { name: 'Port of Shanghai', kind: 'port' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [103.85, 1.26] }, properties: { name: 'Port of Singapore', kind: 'port' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [122.1, 29.95] }, properties: { name: 'Ningbo-Zhoushan', kind: 'port' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [4.4, 51.95] }, properties: { name: 'Port of Rotterdam', kind: 'port' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [4.4, 51.28] }, properties: { name: 'Port of Antwerp', kind: 'port' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [9.95, 53.54] }, properties: { name: 'Port of Hamburg', kind: 'port' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-118.25, 33.75] }, properties: { name: 'Los Angeles / Long Beach', kind: 'port' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-74.05, 40.67] }, properties: { name: 'New York / New Jersey', kind: 'port' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-46.3, -23.98] }, properties: { name: 'Port of Santos', kind: 'port' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [31.03, -29.87] }, properties: { name: 'Port of Durban', kind: 'port' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [23.62, 37.94] }, properties: { name: 'Port of Piraeus', kind: 'port' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [43.05, 11.6] }, properties: { name: 'Djibouti (Doraleh)', kind: 'port' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [62.32, 25.12] }, properties: { name: 'Gwadar Port', kind: 'port' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [81.12, 6.12] }, properties: { name: 'Hambantota Port', kind: 'port' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [79.85, 6.94] }, properties: { name: 'Port of Colombo', kind: 'port' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [131.9, 43.1] }, properties: { name: 'Vladivostok', kind: 'port' } },
  ],
}
