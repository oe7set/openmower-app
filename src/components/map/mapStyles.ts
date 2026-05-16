export const mapStyles = {
  plain: {
    version: 8 as const,
    name: 'Plain',
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background' as const,
        paint: {
          'background-color': '#121212',
        },
      },
    ],
  },
  satellite: {
    version: 8 as const,
    name: 'Satellite',
    sources: {
      'esri-satellite': {
        type: 'raster' as const,
        tiles: ['https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: 'Powered by Esri',
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: 'satellite-tiles',
        type: 'raster' as const,
        source: 'esri-satellite',
        paint: {
          'raster-fade-duration': 0,
        },
      },
    ],
  },
  osm: {
    version: 8 as const,
    name: 'OpenStreetMap',
    sources: {
      osm: {
        type: 'raster' as const,
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: 'osm-tiles',
        type: 'raster' as const,
        source: 'osm',
        paint: {
          'raster-fade-duration': 0,
        },
      },
    ],
  },
  hybrid: {
    version: 8 as const,
    name: 'Hybrid',
    sources: {
      'esri-satellite': {
        type: 'raster' as const,
        tiles: ['https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: 'Powered by Esri',
        maxzoom: 19,
      },
      'esri-reference': {
        type: 'raster' as const,
        tiles: [
          'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: 'Powered by Esri',
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: 'satellite-tiles',
        type: 'raster' as const,
        source: 'esri-satellite',
        paint: {
          'raster-fade-duration': 0,
        },
      },
      {
        id: 'boundaries-tiles',
        type: 'raster' as const,
        source: 'esri-reference',
        paint: {
          'raster-fade-duration': 0,
        },
      },
    ],
  },
};
