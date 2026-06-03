import {sampleState, type Sample} from './metrics';

export type PathSegmentKind = 'mowing' | 'paused';

export interface PathSegment {
  kind: PathSegmentKind;
  points: Array<{x: number; y: number}>;
}

// Split the time-ordered samples into contiguous polyline segments by mowing
// state, so the driven path can be drawn with mowing and paused stretches in
// different colours. Samples recorded before the `state` field existed have no
// state — those are all treated as 'mowing' so old sessions still render a
// single continuous track. Consecutive samples whose state differs start a new
// segment; the boundary sample is shared so the line stays unbroken.
export function buildPathSegments(samples: Sample[]): PathSegment[] {
  if (samples.length < 2) return [];
  const kindOf = (s: Sample): PathSegmentKind => (sampleState(s) === 'PAUSED' ? 'paused' : 'mowing');

  const segments: PathSegment[] = [];
  let current: PathSegment = {kind: kindOf(samples[0]), points: [{x: samples[0].x, y: samples[0].y}]};
  for (let i = 1; i < samples.length; i++) {
    const k = kindOf(samples[i]);
    if (k !== current.kind) {
      // Share the boundary point with the previous segment so there is no gap,
      // then start the new segment from it.
      current.points.push({x: samples[i].x, y: samples[i].y});
      segments.push(current);
      current = {kind: k, points: [{x: samples[i].x, y: samples[i].y}]};
    } else {
      current.points.push({x: samples[i].x, y: samples[i].y});
    }
  }
  segments.push(current);
  return segments.filter((seg) => seg.points.length >= 2);
}
