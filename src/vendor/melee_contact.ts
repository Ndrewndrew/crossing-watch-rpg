export type MeleeContactStyle =
  | 'edge'
  | 'split'
  | 'crush'
  | 'pierce'
  | 'cross'
  | 'reap'
  | 'serrated';
export interface MeleeImpactProfile {
  /** Fraction of the actual recipient's displayed height; independent of the weapon arc. */
  height: number;
  style: MeleeContactStyle;
  angle: number;
  span: number;
  width: number;
  force: number;
  contacts: number;
  bleeding: boolean;
}

/** Open contact-plane paths. None draws a ground radius or a closed circle. */
export function meleeContactPoint(
  profile: MeleeImpactProfile,
  u: number,
  beat: number,
  strand: number,
  out: { x: number; y: number; z: number },
): void {
  const t = u - 0.5,
    span = profile.span;
  let x = t * span,
    y = 0,
    z = Math.sin(u * Math.PI) * 0.055;
  if (profile.style === 'split') {
    y = t * span;
    x = Math.sin(u * 19 + strand) * 0.065 * Math.sin(u * Math.PI) + strand * 0.12;
  } else if (profile.style === 'crush') {
    x = (strand % 2 ? -1 : 1) * (0.06 + u * span * 0.48);
    y = Math.sin(strand * 2.3) * u * span * 0.38 + Math.sin(u * 16) * u * 0.05;
    z = u * 0.25;
  } else if (profile.style === 'pierce') {
    x = (strand % 2 ? -1 : 1) * u * span * 0.22;
    y = Math.cos(strand * 2.2) * u * span * 0.22;
    z = t * span * 0.65;
  } else if (profile.style === 'serrated') {
    y = Math.sin(u * 31) * 0.035 * Math.sin(u * Math.PI) + strand * 0.085;
    z += Math.sin(u * 5) * 0.04;
  } else if (profile.style === 'reap') {
    y = Math.sin(u * Math.PI) * span * 0.17 - 0.12;
    x *= beat % 2 ? -1 : 1;
  } else if (profile.style === 'cross') y = t * span * (beat % 2 ? -1 : 1) * 0.45;
  const angle = profile.angle + (profile.style === 'reap' ? beat * 0.28 : 0);
  out.x = x * Math.cos(angle) - y * Math.sin(angle);
  out.y = x * Math.sin(angle) + y * Math.cos(angle);
  out.z = z;
}
