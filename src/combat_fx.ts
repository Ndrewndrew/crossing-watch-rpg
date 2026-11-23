import * as T from 'three'
import { floor, strikeContact, type Action, type Feedback, type Point } from './world.ts'
import { meleeContactPoint, type MeleeImpactProfile } from './vendor/melee_contact.ts'

const particle = new T.OctahedronGeometry(1, 0)
const shaft = new T.CylinderGeometry(1, 1, 1, 6, 1, true)
const halo = new T.RingGeometry(.91, 1, 48)
const angles = [0.23, 1.13, 2.18, 3.21, 4.23, 5.26]
const up = new T.Vector3(0, 1, 0)
const origin = new T.Vector3()
const end = new T.Vector3()
const next = new T.Vector3()
const delta = new T.Vector3()
const contact = { x: 0, y: 0, z: 0 }
const slash: MeleeImpactProfile = {
  height: .56, style: 'edge', angle: -.58, span: 1.32, width: .06, force: 1, contacts: 1, bleeding: false,
}

function material() {
  return new T.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false })
}

type Glint = T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>

function point(mesh: Glint, x: number, y: number, z: number, size: number, stretch = 1) {
  mesh.position.set(x, y, z)
  mesh.scale.set(size, size * stretch, size * .76)
  mesh.visible = true
}

function segment(mesh: Glint, from: T.Vector3, to: T.Vector3, width: number) {
  delta.subVectors(to, from)
  const length = delta.length()
  if (length < .001) { mesh.visible = false; return }
  mesh.position.copy(from).addScaledVector(delta, .5)
  mesh.quaternion.setFromUnitVectors(up, delta.multiplyScalar(1 / length))
  mesh.scale.set(width, length, width)
  mesh.visible = true
}

class Effect {
  readonly group = new T.Group()
  private tint = material()
  private accent = material()
  private ring = new T.Mesh(halo, this.tint)
  private lights = angles.map((_, i) => new T.Mesh(particle, i % 3 ? this.tint : this.accent))
  private beams = angles.map((_, i) => new T.Mesh(shaft, i % 3 ? this.tint : this.accent))

  constructor() {
    this.ring.rotation.x = -Math.PI / 2
    this.group.add(this.ring, ...this.lights, ...this.beams)
    this.group.renderOrder = 3
  }

  draw(event: Feedback, hero: Point, anchor: T.Vector3, reduced: boolean) {
    this.group.visible = true
    const t = 1 - event.ttl / event.duration
    const fade = 1 - t
    const motion = reduced ? .24 : t
    const { yaw } = event
    const { x, z } = event.kind === 'heal' ? hero : event
    const y = floor(x, z)
    this.ring.visible = false
    for (const mesh of this.lights) mesh.visible = false
    for (const mesh of this.beams) mesh.visible = false
    this.tint.opacity = Math.min(.92, fade * 1.4)
    this.accent.opacity = Math.min(1, fade * 1.8)

    switch (event.kind) {
      case 'strike':
      case 'hurt': {
        const struck = event.kind === 'strike'
        this.tint.color.setHex(struck ? 0xffc674 : 0xe67459)
        this.accent.color.setHex(0xffecd4)
        this.tint.opacity *= 1 - t * .47
        const cos = Math.cos(yaw)
        const sin = Math.sin(yaw)
        const span = .66 + motion * .35
        for (let i = 0; i <= 4; i++) {
          meleeContactPoint(slash, i / 4, 0, 0, contact)
          next.set(x + (contact.x * cos + contact.z * sin) * span,
            y + event.height + contact.y * span,
            z + (-contact.x * sin + contact.z * cos) * span)
          if (i) segment(this.beams[i - 1], end, next, .038 * fade + .008)
          end.copy(next)
        }
        for (const [i, mesh] of this.lights.entries()) {
          const a = angles[i] + yaw
          const radius = .18 + motion * (i % 2 ? .91 : 1.25)
          point(mesh, x + Math.cos(a) * radius, y + event.height + Math.sin(a) * radius * .69 + motion * .2,
            z + Math.sin(a) * radius, .067 * fade + .014, 1.9)
          mesh.rotation.z = -a
        }
        break
      }
      case 'seal':
      case 'break': {
        const interrupted = event.kind === 'break'
        this.tint.color.setHex(interrupted ? 0x8ff3e5 : 0x68d1ef)
        this.accent.color.setHex(interrupted ? 0xffd88b : 0xc6fff8)
        const from = event.from!
        const followsAnchor = anchor.distanceToSquared(origin.set(from.x, floor(from.x, from.z) + 1.45, from.z)) < 8
        const target = next.set(x, y + event.height, z)
        if (followsAnchor) origin.copy(anchor)
        if (t < .42) {
          const distance = origin.distanceTo(target)
          const wiggle = Math.min(.28, distance * .075)
          const blast = 1 - t / .42
          end.copy(origin)
          for (const [i, mesh] of this.beams.entries()) {
            const u = (i + 1) / this.beams.length
            const slip = Math.sin(u * 21) * Math.sin(Math.PI * u) * wiggle
            const tip = this.lights[0].position.copy(origin).lerp(target, u)
            tip.x += Math.cos(yaw) * slip
            tip.y += slip * .63
            tip.z -= Math.sin(yaw) * slip
            segment(mesh, end, tip, (interrupted ? .064 : .045) * blast + .015)
            end.copy(tip)
          }
        }
        for (const [i, mesh] of this.lights.entries()) {
          const angle = angles[i] + yaw + motion * .95
          const radius = .23 + motion * (interrupted ? 1.75 : 1.18)
          point(mesh, x + Math.cos(angle) * radius, y + event.height + Math.sin(angle) * radius * .74,
            z + Math.sin(angle) * radius, (interrupted ? .13 : .09) * fade + .02, 2.1)
          mesh.rotation.set(.45, yaw, angle)
        }
        if (interrupted) {
          this.ring.visible = true
          this.ring.position.set(x, y + event.height, z)
          this.ring.rotation.set(0, yaw, motion * .45)
          this.ring.scale.setScalar(.54 + motion * .82)
        }
        break
      }
      case 'mend': {
        const caster = event.from!
        origin.set(caster.x,floor(caster.x,caster.z)+1.15,caster.z)
        end.set(x,y+event.height,z)
        this.tint.color.setHex(0xe293ff)
        this.accent.color.setHex(0xffedbb)
        segment(this.beams[0],origin,end,.022 + fade*.026)
        for (const [i,mesh] of this.lights.entries()) {
          next.copy(origin).lerp(end,(motion+i/this.lights.length)%1)
          point(mesh,next.x,next.y,next.z,.065*fade+.02)
        }
        break
      }
      case 'heal':
      case 'light': {
        const heal = event.kind === 'heal'
        this.tint.color.setHex(heal ? 0x79ddb0 : 0xffb96e)
        this.accent.color.setHex(heal ? 0xd8ffbf : 0xffe9b5)
        this.ring.visible = true
        this.ring.position.set(x, y + .07, z)
        this.ring.rotation.set(-Math.PI / 2, 0, 0)
        this.ring.scale.setScalar(.56 + motion * .55)
        for (const [i, mesh] of this.lights.entries()) {
          const age = Math.min(1, motion * 1.24 + (i % 3) * .105)
          const a = angles[i] + age
          const radius = .71 - age * .39
          point(mesh, x + Math.cos(a) * radius, y + (heal ? .25 : 1.6) + age * 1.65,
            z + Math.sin(a) * radius, .07 * fade + .035, 2.3)
          mesh.rotation.set(0, a, .25)
        }
        break
      }
      case 'roll': {
        this.tint.color.setHex(0xb39b7c)
        this.accent.color.setHex(0xe2c89a)
        this.accent.opacity *= .68
        this.tint.opacity *= .65
        const sin = Math.sin(yaw), cos = Math.cos(yaw)
        for (const [i, mesh] of this.lights.entries()) {
          const side = (i % 2 ? 1 : -1) * (.16 + motion * .52)
          const forward = .21 * i - motion * .45
          const px = x + sin * forward + cos * side
          const pz = z + cos * forward - sin * side
          point(mesh, px, floor(px, pz) + .06 + motion * .42, pz, .086 * fade + .023, .6)
          mesh.rotation.z = i + motion
        }
        break
      }
      case 'miss': break
    }
  }
}

export class CombatEffects {
  private readonly effects: Effect[] = []
  constructor(private readonly scene: T.Scene) {}

  draw(effects: Feedback[], hero: Point, anchor: T.Vector3, reduced: boolean) {
    let count = 0
    for (const event of effects) {
      if (event.kind === 'miss') continue
      let fx = this.effects[count]
      if (!fx) {
        fx = new Effect()
        this.scene.add(fx.group)
        this.effects.push(fx)
      }
      fx.draw(event, hero, anchor, reduced)
      count++
    }
    for (; count < this.effects.length; count++) this.effects[count].group.visible = false
  }
}

const trailSize = 12
type TrailPoint = { tip: T.Vector3; grip: T.Vector3; time: number }

export class StaffTrail {
  private points: TrailPoint[] = []
  private action?: Action
  private readonly position = new T.BufferAttribute(new Float32Array(trailSize * 2 * 3), 3)
  private readonly alpha = new T.BufferAttribute(new Float32Array(trailSize * 2), 1)
  private readonly geometry = new T.BufferGeometry()
  readonly mesh = new T.Mesh(this.geometry, new T.ShaderMaterial({
    vertexShader: `
      attribute float glow; varying float vGlow;
      void main() { vGlow = glow; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
    `,
    fragmentShader: `
      varying float vGlow;
      void main() {
        gl_FragColor = vec4(mix(vec3(1., .33, .08), vec3(1., .92, .64), vGlow), vGlow * .86);
        #include <colorspace_fragment>
      }
    `,
    side: T.DoubleSide, depthWrite: false, transparent: true, toneMapped: false,
  }))

  constructor() {
    const indices = []
    for (let i = 0; i < (trailSize - 1) * 2; i += 2) indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2)
    this.geometry.setIndex(indices)
    this.geometry.setAttribute('position', this.position.setUsage(T.DynamicDrawUsage))
    this.geometry.setAttribute('glow', this.alpha.setUsage(T.DynamicDrawUsage))
    this.mesh.frustumCulled = false
  }

  update(action: Action | undefined, clock: number, rod: T.Object3D, tip: T.Vector3, reduced: boolean) {
    if (action !== this.action) {
      if (action) this.points.length = 0
      this.action = action
    }
    const duration = reduced ? .075 : .18
    while (this.points.length && clock - this.points[0].time > duration) this.points.shift()
    if (action?.skill === 'strike' && action.age > strikeContact * .63 && action.age < .31) {
      const last = this.points.at(-1)
      if (!last || clock - last.time > .015 && last.tip.distanceToSquared(tip) > .0016) {
        const grip = rod.localToWorld(new T.Vector3(0, .11, .034))
        this.points.push({ tip: tip.clone(), grip, time: clock })
        if (this.points.length > trailSize) this.points.shift()
      }
    }
    for (const [i, point] of this.points.entries()) {
      const hot = 1 - (clock - point.time) / duration
      this.position.setXYZ(i * 2, point.tip.x, point.tip.y, point.tip.z)
      end.copy(point.tip).lerp(point.grip, .29 + hot * .43)
      this.position.setXYZ(i * 2 + 1, end.x, end.y, end.z)
      this.alpha.setX(i * 2, hot * (reduced ? .58 : 1))
      this.alpha.setX(i * 2 + 1, hot * .12)
    }
    this.position.needsUpdate = this.alpha.needsUpdate = true
    this.geometry.setDrawRange(0, Math.max(0, this.points.length - 1) * 6)
    this.mesh.visible = this.points.length >= 2
  }

  clear() {
    this.points.length = 0
    this.action = undefined
    this.mesh.visible = false
  }
}
