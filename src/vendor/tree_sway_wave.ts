// Adapted from tree_sway.ts. Copyright (c) 2026 Levy Street (MIT).
const NEAR_FULL = 70;
const NEAR_OFF = 130;
const f = (n: number): string => n.toFixed(4);

/**
 * GLSL block computing `swayWave` (signed sway offset base, no height
 * weight yet) from a world-space base position `swayBase` that the CALLER
 * must have declared as a vec2. Callers then displace `transformed` by
 * `swayWave * <heightWeight>`.
 *
 * Also leaves `swayGate` and `swayPhase` in scope for callers that layer a
 * second term (the leaf shimmer below) on the same gate and phase.
 */
export function treeSwayWaveGlsl(): string {
  return `
    float swayGate = 1.0 - smoothstep(${f(NEAR_FULL)}, ${f(NEAR_OFF)}, distance(swayBase, uSwayPlayer));
    float swayPhase = swayBase.x * 0.15 + swayBase.y * 0.17;
    // A slow gust rolling across the grove (travelling along +X+Z, ~27s to
    // cross 100 yards) swells and eases the amplitude between 0.55 and 1.0.
    // Without it every plant leans on a fixed-amplitude metronome, which is
    // what makes cheap sway read as mechanical.
    float gust = 0.775 + 0.225 * sin(uTime * 0.23 - (swayBase.x + swayBase.y) * 0.021);
    float swayWave = (sin(uTime * 0.9 + swayPhase) + 0.5 * sin(uTime * 1.7 + swayPhase * 1.3))
      * swayGate * gust;
  `;
}
