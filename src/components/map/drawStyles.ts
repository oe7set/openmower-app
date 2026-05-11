// Categorical area-type colours — not directly tied to theme palette so the
// rendering stays identical on light vs dark map styles. The green tracks the
// brand primary hue.
const green = '#1B9D52';
const orange = '#fbb03b';
const white = '#dddddd';
const black = '#000000';
const gray = '#888888';

// prettier-ignore
const type_color = [
  'case',
  ['==', ['get', 'user_type'], 'mow'], green,
  ['==', ['get', 'user_type'], 'nav'], white,
  ['==', ['get', 'user_type'], 'obstacle'], black,
  orange,
];

export const drawStyles = [
  {
    id: 'polygon-fill',
    type: 'fill',
    filter: ['all', ['==', '$type', 'Polygon']],
    paint: {
      'fill-color': type_color,
      'fill-outline-color': type_color,
      'fill-opacity': ['case', ['==', ['get', 'active'], 'true'], 0.8, 0.4],
    },
  },
  // Lines
  // Polygon
  //   Matches Lines AND Polygons
  //   Active state defines color
  {
    id: 'gl-draw-lines',
    type: 'line',
    filter: ['any', ['==', '$type', 'LineString'], ['==', '$type', 'Polygon']],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': [
        'case',
        ['==', ['get', 'active'], 'true'],
        orange,
        ['==', ['get', 'user_active'], false],
        gray,
        green,
      ],
      'line-dasharray': ['case', ['==', ['get', 'user_active'], false], ['literal', [3, 3]], ['literal', [1, 0]]],
      'line-width': 1,
    },
  },
  // Points
  //   Circle with an outline
  //   Active state defines size and color
  {
    id: 'gl-draw-point-outer',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature']],
    paint: {
      'circle-radius': ['case', ['==', ['get', 'active'], 'true'], 7, 5],
      'circle-color': white,
    },
  },
  {
    id: 'gl-draw-point-inner',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature']],
    paint: {
      'circle-radius': ['case', ['==', ['get', 'active'], 'true'], 5, 3],
      'circle-color': ['case', ['==', ['get', 'active'], 'true'], orange, green],
    },
  },
  // Vertex
  //   Visible when editing polygons and lines
  //   Similar behaviour to Points
  //   Active state defines size
  {
    id: 'gl-draw-vertex-outer',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex'], ['!=', 'mode', 'simple_select']],
    paint: {
      'circle-radius': ['case', ['==', ['get', 'active'], 'true'], 7, 5],
      'circle-color': white,
    },
  },
  {
    id: 'gl-draw-vertex-inner',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex'], ['!=', 'mode', 'simple_select']],
    paint: {
      'circle-radius': ['case', ['==', ['get', 'active'], 'true'], 5, 3],
      'circle-color': orange,
    },
  },
  // Midpoint
  //   Visible when editing polygons and lines
  //   Tapping or dragging them adds a new vertex to the feature
  {
    id: 'gl-draw-midpoint',
    type: 'circle',
    filter: ['all', ['==', 'meta', 'midpoint']],
    paint: {
      'circle-radius': 3,
      'circle-color': orange,
    },
  },
];
