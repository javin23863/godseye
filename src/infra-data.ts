// Critical infrastructure GeoJSON: Gulf region chokepoints, pipelines, ports, refineries, desalination plants.
// All coordinates approximate but realistic; data is static (no network feed).
export interface InfraFeature {
  type: 'Feature'
  geometry: {
    type: 'Point' | 'LineString'
    coordinates: [number, number] | [number, number][]
  }
  properties: {
    name: string
    kind: 'chokepoint' | 'pipeline' | 'port' | 'refinery' | 'desalination'
  }
}

export interface InfraCollection {
  type: 'FeatureCollection'
  features: InfraFeature[]
}

export const INFRA_DATA: InfraCollection = {
  type: 'FeatureCollection',
  features: [
    // -- Chokepoints (strategic strait choke points) ----
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [56.6, 26.6] },
      properties: { name: 'Strait of Hormuz', kind: 'chokepoint' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [43.3, 12.6] },
      properties: { name: 'Bab-el-Mandeb', kind: 'chokepoint' },
    },

    // -- Pipelines (crude oil transit routes) ----
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [50.0, 25.9], // Abqaiq, Saudi Arabia (oil field)
          [50.16, 26.64], // Ras Tanura
          [47.0, 26.0],
          [43.0, 25.0],
          [40.0, 24.5],
          [38.06, 24.09], // Yanbu terminal
        ],
      },
      properties: { name: 'East-West Petroline (Saudi)', kind: 'pipeline' },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [53.6, 23.8], // Habshan (UAE oil field)
          [54.5, 24.3],
          [55.3, 25.0],
          [56.3, 25.1], // Fujairah terminal
        ],
      },
      properties: { name: 'Habshan–Fujairah Pipeline (UAE)', kind: 'pipeline' },
    },

    // -- Ports / Refineries ----
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [38.06, 24.09] },
      properties: { name: 'Yanbu Port', kind: 'port' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [56.33, 25.12] },
      properties: { name: 'Fujairah Refinery', kind: 'refinery' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [50.16, 26.64] },
      properties: { name: 'Ras Tanura Refinery', kind: 'refinery' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [50.32, 29.26] },
      properties: { name: 'Kharg Island', kind: 'refinery' },
    },

    // -- Desalination Plants ----
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [55.03, 25.0] },
      properties: { name: 'Jebel Ali Desalination', kind: 'desalination' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [49.2, 27.1] },
      properties: { name: 'Ras Al Khair Desalination', kind: 'desalination' },
    },
  ],
}
