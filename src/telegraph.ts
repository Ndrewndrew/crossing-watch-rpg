import { BufferAttribute, Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial } from 'three'
import { castShape, casts, floor, laneStart, type Intent, type Point } from './world.ts'
import { TELEGRAPH_THREAT_COLORS, telegraphFillOf, telegraphLook } from './vendor/telegraph_look_core.ts'

const fragment = /* glsl */ `
  uniform vec2 uMin, uMax;
  uniform float uRange, uWidth, uShape, uLaneStart, uFill;
  uniform float uBase, uFilled, uFront, uRim, uWarn;
  uniform vec3 uThreat;
  varying vec2 vUv;
  void main() {
    vec2 p = mix(uMin, uMax, vUv);
    float radial = length(p);
    float edge = uRange - radial;
    float traveled = radial;
    if (uShape < 0.5) {
      edge = min(min(uWidth - abs(p.x), p.y - uLaneStart), uRange - p.y);
      traveled = p.y;
    } else if (uShape < 1.5) {
      edge = min(edge, p.y * sin(uWidth) - abs(p.x) * cos(uWidth));
    }
    if (edge < -0.10) discard;
    float aa = clamp(fwidth(edge), .018, .075);
    float rim = 1. - smoothstep(.020, .052 + aa, abs(edge));
    float shadow = 1. - smoothstep(.078, .10 + aa, abs(edge));
    float inside = smoothstep(-aa, aa, edge);
    float frontAt = mix(uShape < 0.5 ? uLaneStart : 0., uRange, uFill);
    float traveledFill = 1. - smoothstep(frontAt - .06, frontAt + .06, traveled);
    float front = 1. - smoothstep(.028, .13, abs(traveled - frontAt));
    float hatch = uShape > 1.5 && edge > .18 ? smoothstep(.77, .93, fract((p.x + p.y) * 1.55)) * .085 : 0.;
    float opacity = inside * (uBase + uFilled * traveledFill + front * uFront * .32 + hatch + uWarn * .1);
    vec3 warm = mix(uThreat, vec3(1., .91, .78), front * .8);
    warm = mix(warm, vec3(.027, .016, .013), shadow * .88);
    warm = mix(warm, vec3(1., .91, .74), rim * uRim);
    opacity = max(opacity, max(shadow * .85, rim * uRim));
    gl_FragColor = vec4(warm, opacity);
    #include <colorspace_fragment>
  }
`

export class GroundWarning {
  private readonly geometry = new PlaneGeometry(1, 1, 24, 24)
  private readonly material = new ShaderMaterial({
    uniforms: {
      uMin: { value: [0, 0] }, uMax: { value: [0, 0] }, uRange: { value: 1 }, uWidth: { value: 1 },
      uShape: { value: 0 }, uLaneStart: { value: laneStart }, uFill: { value: 0 },
      uBase: { value: 0 }, uFilled: { value: 0 }, uFront: { value: 0 }, uRim: { value: 0 }, uWarn: { value: 0 },
      uThreat: { value: new Color() },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
    `,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: DoubleSide,
  })
  readonly mesh = new Mesh(this.geometry, this.material)
  private cast?: Intent
  private look = { base: 0, filled: 0, front: 0, rim: 0, warn: 0, detail: 0 }

  constructor() {
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 2
    this.mesh.visible = false
  }

  update(origin: Point, cast: Intent | undefined, clock: number, reducedMotion: boolean) {
    this.mesh.visible = cast !== undefined && cast.kind !== 'mend'
    if (!cast || cast.kind === 'mend') {
      this.cast = undefined
      return
    }
    if (cast !== this.cast) {
      this.cast = cast
      this.place(origin, cast)
    }
    const uniforms = this.material.uniforms
    const fill = telegraphFillOf(cast.time, casts[cast.kind].seconds)
    const look = telegraphLook(fill, clock, false, this.look)
    uniforms.uFill.value = fill
    uniforms.uBase.value = look.base + .09
    uniforms.uFilled.value = look.filled
    uniforms.uFront.value = look.front
    uniforms.uRim.value = look.rim
    uniforms.uWarn.value = reducedMotion ? 0 : look.warn
  }

  private place(origin: Point, cast: Intent) {
    const { range, width } = casts[cast.kind]
    const shape = castShape(cast.kind)
    const extent = shape === 'lane' ? width : range
    const start = shape === 'circle' ? -range : laneStart
    const uniforms = this.material.uniforms
    uniforms.uMin.value = [-extent - .2, start - .2]
    uniforms.uMax.value = [extent + .2, range + .2]
    uniforms.uWidth.value = width
    uniforms.uRange.value = range
    uniforms.uShape.value = shape === 'lane' ? 0 : shape === 'cone' ? 1 : 2
    uniforms.uThreat.value.setHex(TELEGRAPH_THREAT_COLORS[cast.kind === 'mist' ? 'interrupt' : 'danger'])
    const uv = this.geometry.getAttribute('uv')
    const pos = this.geometry.getAttribute('position') as BufferAttribute
    const sin = Math.sin(cast.yaw)
    const cos = Math.cos(cast.yaw)
    for (let i = 0; i < pos.count; i++) {
      const side = (uv.getX(i) * 2 - 1) * (extent + .2)
      const forward = start - .2 + uv.getY(i) * (range - start + .4)
      const x = origin.x + side * cos + forward * sin
      const z = origin.z - side * sin + forward * cos
      pos.setXYZ(i, x, floor(x, z) + .095, z)
    }
    pos.needsUpdate = true
  }

  dispose() {
    this.mesh.removeFromParent()
    this.geometry.dispose()
    this.material.dispose()
  }
}
