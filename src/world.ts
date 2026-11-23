import { orders, posts } from './orders.ts'
import { touchesFootprint, type CameraObstacle } from './camera_clearance.ts'
import { talentRows, talentStats, thresholds } from './talents.ts'

export type Point = { x: number; z: number }
export type Quest = 'meet' | 'hunt' | 'light' | 'warden' | 'report' | 'pass' | 'watch' | 'anchors' | 'sentinel' | 'clear' | 'orders' | 'dawn'
export type Skill = 'strike' | 'seal' | 'heal' | 'roll'
export type EnemyKind = 'hound' | 'sentry' | 'warden' | 'sentinel'
export type Cast = 'fang' | 'arc' | 'mist' | 'rush' | 'bolt' | 'mend' | 'jab'
export const strikeSpirit = 4
const ritualWaves = { light:[0,8,8,7,8], anchors:[0,10,10,8,9,8] } as const
export const skillLevel: Record<Skill, number> = { strike: 1, seal: 2, heal: 1, roll: 1 }
export const interruptible = (kind: Cast) => kind === 'mist' || kind === 'mend'
export const castShape = (cast: Cast) => cast === 'mend' ? 'aid' : cast === 'mist' || cast === 'jab' ? 'circle' : cast === 'arc' ? 'cone' : 'lane'
export const laneStart = -.17
export const start = { x: 0, z: 28 }
export const mira = { x: -1.8, z: 19.4 }
export const bridgeX = -4.4
export const beacons = [{ x: -14, z: 7 }, { x: 13, z: 2 }, { x: bridgeX - 4.8, z: -7.3 }]
export const wardenSite = { x: bridgeX, z: -35 }
export const passSite = { x: -5, z: -54 }
export const watchSite = { x: 3, z: -71 }
export const sentinelSite = { x: 8, z: -101 }
export const anchorSites = [{ x: -4.5, z: -86 }, { x: 15.5, z: -89 }, { x: -1.9, z: -101 }]
const watchPosts = [{ x: 2.5, z: -80 }, { x: 9, z: -86 }]
export const enemyName: Record<EnemyKind, string> = {
  hound: 'Mist Hound', sentry: 'Ash Caster', warden: 'Shoal Warden', sentinel: 'Ash Sentinel',
}
export const isBoss = (kind: EnemyKind) => kind === 'warden' || kind === 'sentinel'
export const banksideTrees = [[12,14,6.6],[-10,24,5.1],[-22,12,6.4],[8,-26,7.2],[22,-35,8.3],[-16,-25,6.7]] as const
const lairs = [{ x: -10, z: 9 }, { x: 10, z: 7 }, { x: 4.4, z: -4.6 }]
export const actionLength: Record<Skill, number> = { strike: .45, seal: .42, heal: .58, roll: .28 }
export const strikeContact = .19
export const meleeReach = 3.05
export const globalRecharge = .85
export const casts: Record<Cast, { label: string; range: number; width: number; seconds: number; damage: number }> = {
  mend: { label: 'Ash Mend', range: 12, width: 0, seconds: 1.85, damage: 0 },
  jab: { label: 'Quick Strike', range: 3.25, width: 0, seconds: .52, damage: 14 },
  fang: { label: 'Pounce', range: 3.4, width: .69, seconds: .9, damage: 15 },
  arc: { label: 'Antler Sweep', range: 4.7, width: Math.PI * .33, seconds: 1.16, damage: 22 },
  mist: { label: 'Mistcall', range: 8.15, width: 0, seconds: 1.95, damage: 45 },
  bolt: { label: 'Ash Bolt', range: 10.4, width: .83, seconds: 1.18, damage: 14 },
  rush: { label: 'Charge', range: 10.5, width: 1.13, seconds: 1.23, damage: 25 },
}

export function river(x: number) { return -15.4 + Math.sin((x + bridgeX) * .095) * 1.95 }
const calmBank = river(bridgeX)
export const bridge = { min: calmBank - 7.6, max: calmBank + 7.6, halfWidth: 2.18, landing: .36 }
export const bridgeHeight = (z: number) => {
  const u = Math.max(0, Math.min(1, (z - bridge.min) / (bridge.max - bridge.min)))
  return bridge.landing + Math.sin(Math.PI * u) ** 1.35 * .92
}
export const terrainGrid = { width: 136, depth: 208, columns: 136, rows: 208, centerZ: -49 }
export function roadX(z: number) {
  if (z <= passSite.z) return passSite.x + (sentinelSite.x - passSite.x) * Math.min(1, (passSite.z - z) / 47)
  const valley = bridgeX + Math.sin((z + 16) * .052) * 5.5
  const approach = Math.max(0, 1 - (z - passSite.z) / 12)
  return valley + (passSite.x - valley) * approach
}
export function ground(x: number, z: number) {
  const delta = Math.abs(z - river(x))
  const sand = Math.min(1, Math.max(0, (delta - 2.1) / 5))
  const hill = Math.sin(x * .087 + z * .026) * .78 + Math.cos(z * .115) * .58 + Math.sin(x * .15 - z * .091) * .26
  const rim = (Math.max(0, Math.abs(x) - 24) ** 2 + Math.max(0, Math.abs(z) - 42) ** 2) * .008
  const height = -.68 + sand * (.8 + hill * .61 + rim)
  const arena = Math.max(0, Math.min(1, (16 - Math.hypot(x - wardenSite.x, z - wardenSite.z)) / 5))
  const edge = Math.min(Math.abs(z-bridge.min),Math.abs(z-bridge.max))
  const apron = Math.min(1, Math.max(0,(2.8-edge)/1.7)) *
    Math.min(1, Math.max(0,(4.5-Math.abs(x-bridgeX))/1.8))
  const valley = height * (1 - arena) + .23 * arena
  const lowland = valley + (bridge.landing-valley) * apron
  if (z >= -46) return lowland
  const blend = Math.min(1, (-46 - z) / 17)
  const pass = Math.min(18, Math.max(0, Math.abs(x - roadX(z)) - 6) ** 2 * .045)
  const hollow = 1.9 + Math.sin((z + 55) * .12) * .74 + Math.sin(x * .21 - z * .073) * .73
  const clearing = Math.max(0, Math.min(1, (12 - distance({ x, z }, sentinelSite)) / 6))
  const north = (hollow + pass) * (1 - clearing) + 2.05 * clearing
  const ridge = Math.min(1, Math.max(0, (-115 - z) / 9)) * Math.max(0, (Math.cos((z + 146) * .084) - .36)) *
    Math.max(0, 8 + Math.sin(x * .083 + z * .077) * 6 + Math.sin(x * .137 - z * .049) * 4)
  return lowland * (1 - blend) + (north + ridge) * blend
}
export function floor(x: number, z: number) {
  if (Math.abs(x - bridgeX) <= bridge.halfWidth && z >= bridge.min && z <= bridge.max) {
    return bridgeHeight(z)
  }
  // Same diagonal as Three's PlaneGeometry, with +Z along the rows.
  const { width, depth, columns, rows, centerZ } = terrainGrid
  const dx = width / columns, dz = depth / rows
  const u = (x + width / 2) / dx, v = (z - centerZ + depth / 2) / dz
  const i = Math.floor(u), j = Math.floor(v)
  const a = i * dx - width / 2, b = j * dz + centerZ - depth / 2
  const fx = u - i, fz = v - j
  const right = ground(a + dx, b), down = ground(a, b + dz)
  if (fx + fz <= 1) return ground(a, b) * (1 - fx - fz) + right * fx + down * fz
  return ground(a + dx, b + dz) * (fx + fz - 1) + right * (1 - fz) + down * (1 - fx)
}
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z)
const yawTo = (a: Point, b: Point) => Math.atan2(b.x - a.x, b.z - a.z)
export function castContains(origin: Point, intent: Pick<Intent, 'kind' | 'yaw'>, target: Point) {
  const { kind, yaw } = intent
  const { range, width } = casts[kind]
  const dx = target.x - origin.x
  const dz = target.z - origin.z
  const forward = dx * Math.sin(yaw) + dz * Math.cos(yaw)
  const side = Math.abs(dx * Math.cos(yaw) - dz * Math.sin(yaw))
  switch (castShape(kind)) {
    case 'aid': return false
    case 'circle': return Math.hypot(dx, dz) <= range
    case 'cone': return Math.hypot(dx, dz) <= range && forward * Math.sin(width) >= side * Math.cos(width)
    case 'lane': return forward >= laneStart && forward <= range && side <= width
  }
}

export type Intent = { allyId?: string; kind: Cast; time: number; yaw: number }
export type Enemy = Point & { id: string; title?: string; kind: EnemyKind; hp: number; hpMax: number; yaw: number; stagger: number; ready: number; intent?: Intent; casts: number; reaction: number; release: number; followUp?: boolean; mendReady?: number; lunge?: number }
export type Action = { skill: Skill; age: number; target?: Enemy; reverse?: boolean }
const effectDuration = { strike: .43, seal: .49, break: .63, heal: .72, mend: .72, hurt: .47, light: .7, miss: .34, roll: .56 }
export type Feedback = Point & {
  kind: keyof typeof effectDuration; ttl: number; duration: number; message?: string
  yaw: number; height: number; from?: Point
}
export type Control = Point & { skill?: Skill; interact?: boolean; cycle?: boolean; visible?: string[]; select?: string; auto?: boolean; facing?: number }
export type FieldLog = {order:number; job:number; group:number; started:boolean; decoded:boolean}
const freshLog = ():FieldLog => ({order:0,job:0,group:0,started:false,decoded:false})
export function validLog(log:FieldLog) {
  const job=orders[log?.order]?.jobs[log?.job]
  return !!job && Number.isInteger(log.order) && Number.isInteger(log.job) && Number.isInteger(log.group) &&
    log.group>=0 && log.group<=job.groups.length && typeof log.started==='boolean' && typeof log.decoded==='boolean'
}
export type TrekSave = { field?:FieldLog; quest: Quest; lit: boolean[]; huntKills: number; seconds: number; hounds?: string[]; watchKills?: number; anchors?: boolean[]; talents?: string[] }
export const initialSave: TrekSave = { quest: 'meet', lit: [false, false, false], huntKills: 0, seconds: 0 }
export const questName: Record<Quest, string> = {
  orders:'Field orders', dawn:'Dawn over the crossing', meet: 'Speak to Mira', hunt: 'Clear the road', light: 'Light the waybeacons',
  warden: 'Defeat the Shoal Warden', report: 'Return to Mira', pass: 'Find the northern watch',
  watch: 'Clear the logging camp', anchors: 'Dispel three ash shrines', sentinel: 'Defeat the Ash Sentinel', clear: 'The northern watch is restored',
}

const makeEnemy = (id: string, p: Point, kind: EnemyKind): Enemy => {
  const hp = kind === 'sentinel' ? 490 : kind === 'warden' ? 325 : kind === 'sentry' ? 66 : 42
  return { ...p, id, kind, hp, hpMax: hp, yaw: 0, stagger: 0, ready: .8, casts: 0, reaction: 0, release: 0 }
}

function permitsSeparation(from: Point, to: Point, other: Point, kind: EnemyKind) {
  const clearance = isBoss(kind) ? 2.2 : 1.22
  const gap = distance(to, other)
  return gap >= clearance || gap >= distance(from, other)
}

export class Trek {
  quest: Quest
  lit: boolean[]
  huntKills: number
  seconds: number
  readonly hero: Point & { hp: number; spirit: number; yaw: number; invulnerable: number; movement: number }
  readonly cooldowns: Record<Skill, number> = { strike: 0, seal: 0, heal: 0, roll: 0 }
  enemies: Enemy[] = []
  effects: Feedback[] = []
  action?: Action
  selected = ''
  autoAttacking = false
  gcd = 0
  watchKills = 0
  anchors: boolean[]
  readonly talents: string[]
  stats: ReturnType<typeof talentStats>
  ritual?: { index: number; elapsed: number; wave: number; nextAt: number }
  private reinforcement = false
  private reverseStrike = false
  message = ''
  messageTime = 0
  fallen = false
  rolling = 0
  rollDirection = { x: 0, z: -1 }
  checkpoint: TrekSave

  field = freshLog()
  cipherOpen = false
  runeIndex = 0
  private fieldEngaged = false
  get order() { return orders[this.field.order] }
  get job() { return this.order.jobs[this.field.job] }
  get dutySite():Point { return posts[this.job.post] }
  get needsMedic() { return this.quest==='orders' && this.job.kind==='rescue' && this.field.started && !this.field.decoded }
  get cargo() { return this.quest==='orders' && this.job.kind==='haul' && this.field.started }
  get wardActive() { return this.quest==='orders' && this.job.kind==='ward' && this.field.started }
  get fieldTitle() { return this.quest==='orders' ? this.job.name : questName[this.quest] }

  private readonly cells = new Map<string,CameraObstacle[]>()

  constructor(saved: TrekSave = initialSave, obstacles: readonly CameraObstacle[] = []) {
    for (const obstacle of obstacles) {
      const extent=obstacle.radius+.42
      for (let x=Math.floor((obstacle.x-extent)/5);x<=Math.floor((obstacle.x+extent)/5);x++) {
        for (let z=Math.floor((obstacle.z-extent)/5);z<=Math.floor((obstacle.z+extent)/5);z++) {
          const key=x+','+z
          if (!this.cells.has(key)) this.cells.set(key,[])
          this.cells.get(key)!.push(obstacle)
        }
      }
    }
    this.quest = saved.quest === 'clear' && saved.watchKills === undefined ? 'pass' : saved.quest
    if(saved.field && validLog(saved.field)) this.field={...saved.field}
    this.watchKills = saved.watchKills ?? 0
    this.anchors = saved.anchors ? [...saved.anchors] : [false,false,false]
    this.talents = [...(saved.talents ?? [])]
    this.stats = talentStats(this.talents)
    if (this.quest === 'sentinel' && !saved.anchors) this.quest = 'anchors'
    this.lit = [...saved.lit]
    this.huntKills = saved.huntKills
    this.seconds = saved.seconds
    const entry = this.quest === 'warden' ? { x: bridgeX, z: bridge.max + 2 } :
      this.quest === 'watch' || this.quest === 'anchors' || this.quest === 'sentinel' ? watchSite :
      this.quest === 'orders' ? (this.field.started ? this.fieldDestination() : this.dutySite) :
      this.quest === 'clear' || this.quest === 'dawn' ? sentinelSite :
      this.quest === 'meet' ? start : { x: mira.x + 1, z: mira.z + 1.9 }
    this.hero = { ...this.freeSpawn(entry), hp: this.stats.health, spirit: 100, yaw: Math.PI, invulnerable: 0, movement: 0 }
    if (this.quest === 'hunt') this.spawnHounds(saved.hounds)
    if (this.quest === 'warden') this.enemies = [makeEnemy('warden', wardenSite, 'warden')]
    if (this.quest === 'watch') this.spawnWatch(saved.hounds)
    if (this.quest === 'sentinel') this.enemies = [makeEnemy('sentinel', sentinelSite, 'sentinel')]
    this.checkpoint = this.snapshot()
  }

  get chapter() { if (this.quest==='orders' || this.quest==='dawn') return this.field.order+3; return ['pass', 'watch', 'anchors', 'sentinel', 'clear'].includes(this.quest) ? 2 : 1 }
  get zone() { return this.hero.z < passSite.z ? 'Ashwood Clearing' : 'Crossing Valley' }
  get level() { return thresholds.filter(total => this.xp >= total).length }
  get nextXp() { return thresholds[this.level] }
  get xp() {
    const assignments = this.quest === 'dawn' ? orders.reduce((sum,order)=>sum+order.jobs.length,0) :
      this.quest === 'orders' ? orders.slice(0,this.field.order).reduce((sum,order)=>sum+order.jobs.length, this.field.job) : 0
    const crossing = this.quest === 'report' || this.chapter >= 2 ? 130 : 0
    return assignments*24 + this.huntKills*35 + this.lit.filter(Boolean).length*45 + crossing +
      this.watchKills*44 + this.anchors.filter(Boolean).length*65 + (['orders','clear','dawn'].includes(this.quest) ? 180 : 0)
  }
  get upgrade() {
    return this.talents.length < this.level - 1 ? talentRows[this.talents.length] : undefined
  }
  chooseTalent(id: string) {
    if (!this.upgrade?.some(talent => talent.id === id)) return false
    this.talents.push(id)
    const before = this.stats.health
    this.stats = talentStats(this.talents)
    this.hero.hp += this.stats.health - before
    this.checkpoint = this.snapshot()
    return true
  }
  recovery(skill: Skill) {
    switch (skill) {
      case 'strike': return this.stats.strikeCooldown
      case 'seal': return this.stats.sealCooldown
      case 'heal': return this.stats.healCooldown
      case 'roll': return this.stats.rollCooldown
    }
  }
  private get sites() { return this.quest === 'light' ? beacons : anchorSites }
  private get completedSites() { return this.quest === 'light' ? this.lit : this.anchors }
  get waveSchedule() { return this.quest === 'anchors' ? ritualWaves.anchors : ritualWaves.light }
  spiritCost(skill: Skill) { return skill === 'seal' ? 26 : skill === 'heal' ? this.stats.healCost : 0 }
  get opened() { return this.quest === 'warden' || this.quest === 'report' || this.chapter >= 2 }
  get enemiesAlive() { return this.enemies.filter(enemy => enemy.hp > 0) }
  get warden() { return this.enemiesAlive.find(enemy => isBoss(enemy.kind)) }
  get target() { return this.enemiesAlive.find(enemy => enemy.id === this.selected) }

  get autoStatus() {
    if (!this.autoAttacking || !this.target) return ''
    if (distance(this.hero, this.target) > meleeReach) return 'Move closer'
    if (!this.faces(this.target)) return 'Face your target'
    return 'Auto-attack'
  }

  private spawnWatch(remaining?: string[]) {
    const all = watchPosts.map((pos, i) => makeEnemy('watch-' + i, this.freeSpawn(pos), 'hound'))
    this.enemies = remaining ? all.filter(enemy => remaining.includes(enemy.id)) : all.slice(this.watchKills)
  }

  private spawnHounds(remaining?: string[]) {
    const all = lairs.map((pos, i) => makeEnemy('hound-' + i, this.freeSpawn(pos), 'hound'))
    this.enemies = remaining ? all.filter(enemy => remaining.includes(enemy.id)) : all.slice(this.huntKills)
  }

  snapshot(): TrekSave {
    const save: TrekSave = { quest: this.quest, lit: [...this.lit], huntKills: this.huntKills, seconds: this.seconds }
    if (this.quest==='orders' || this.quest==='dawn') save.field={...this.field}
    save.talents = [...this.talents]
    if (this.chapter >= 2) {
      save.watchKills = this.watchKills
      save.anchors = [...this.anchors]
    }
    if ((this.quest === 'hunt' || this.quest === 'watch') && this.enemies.length) save.hounds = this.enemiesAlive.map(enemy => enemy.id)
    return save
  }

  get objective(): Point {
    if(this.quest==='orders') {
      const goal=this.closest(this.hero,this.enemiesAlive) ?? (this.field.started ? this.fieldDestination() : this.dutySite)
      const north=this.hero.z<river(this.hero.x), targetNorth=goal.z<river(goal.x)
      if(north!==targetNorth && Math.abs(this.hero.x-bridgeX)>1.6) return {x:bridgeX,z:north ? bridge.min-1 : bridge.max+1}
      if(north!==targetNorth) return {x:bridgeX,z:targetNorth ? bridge.min-1 : bridge.max+1}
      return goal
    }
    if (this.quest === 'hunt') return this.closest(this.hero, this.enemiesAlive) ?? mira
    if (this.quest === 'light' || this.quest === 'anchors') {
      if (this.ritual) return this.closest(this.hero,this.enemiesAlive) ?? this.sites[this.ritual.index]
      return this.closest(this.hero,this.sites.filter((_,i)=>!this.completedSites[i])) ?? mira
    }
    const { x, z } = this.hero
    const bridgeCentered = Math.abs(x - bridgeX) < 1.45
    if (this.quest === 'warden' || this.quest === 'pass') {
      if (z > bridge.max + .3 && !bridgeCentered) return { x: bridgeX, z: bridge.max + 1 }
      if (z > bridge.min - .4) return { x: bridgeX, z: bridge.min - 3.3 }
      if (this.quest === 'warden') return this.warden ?? wardenSite
      return z > passSite.z - 1 ? { x: passSite.x, z: passSite.z - 5 } : watchSite
    }
    if (this.quest === 'watch') return this.closest(this.hero, this.enemiesAlive) ?? watchSite
    if (this.quest === 'sentinel' || this.quest === 'clear') return this.warden ?? sentinelSite
    if (this.quest === 'report') {
      if (z < bridge.min - .3 && !bridgeCentered) return { x: bridgeX, z: bridge.min - 1 }
      if (z < bridge.max + .4) return { x: bridgeX, z: bridge.max + 2.4 }
    }
    return mira
  }

  get hint() {
    if(this.quest==='orders') {
      const {job,field}=this
      if(!field.started) return this.order.story+' Head to '+posts[job.post].name+'.'
      if(this.needsMedic) return 'Cast Heal beside the wounded scout to get them back on their feet.'
      if(job.kind==='cipher' && !field.decoded) return 'Read the inscription and enter the rune sequence.'
      if(this.cargo && !this.enemiesAlive.length) return 'Carry the relic to '+posts[job.end!].name+'. Follow the gold marker.'
      if(!this.enemiesAlive.length) return 'Approach the next gold marker.'
      const wave='Encounter '+(field.group+1)+' / '+job.groups.length+'. '
      return wave+(this.wardActive ? 'Strike from inside the blue ward.' : job.kind==='duel' ? 'Clear the guard and face '+job.name+'.' : 'Watch the caster. Save Seal for a heal or Mistcall.')
    }
    const lights = this.lit.filter(Boolean).length
    if (this.ritual) {
      const {index,wave,nextAt,elapsed} = this.ritual
      if (distance(this.hero,this.sites[index]) > 13) return 'Return to the circle to continue the rite.'
      if (!this.enemiesAlive.length) return 'Next wave in ' + Math.max(1,Math.ceil(nextAt-elapsed)) + ' s.'
      return 'Wave ' + wave + ' of ' + this.waveSchedule.length + '. ' +
        (this.enemiesAlive.some(enemy=>enemy.kind === 'sentry') ? 'The caster heals wounded allies. Interrupt it with Seal.' : 'After a pounce, the hound bites if you stay close.')
    }
    switch (this.quest) {
      case 'meet': return 'The ranger waits by the road.'
      case 'hunt': return 'Mist hounds · ' + this.huntKills + ' / 3. Roll out of the pounce line.'
      case 'light': return 'Beacons · ' + lights + ' / 3. Light a beacon and defend it.'
      case 'warden': return 'Cross the bridge. Use Seal when the Warden begins Mistcall.'
      case 'report': return 'Mira waits on the south bank.'
      case 'pass': return 'Cross the bridge and find the signal brazier beyond the stone pass.'
      case 'watch': return 'Hounds at the watch · ' + this.watchKills + ' / 2. Take them one at a time.'
      case 'anchors': return 'Shrines remaining · ' + this.anchors.filter(lit=>!lit).length + '. Approach a brazier and begin the rite.'
      case 'sentinel': return 'The Sentinel opens with a charge. Sidestep it and save Seal for Mistcall.'
      default: return ''
    }
  }

  get prompt() {
    if(this.quest==='orders') {
      if(!this.field.started && distance(this.hero,this.dutySite)<2.7) {
        if(this.job.kind==='rescue') return 'Check the wounded scout'
        if(this.job.kind==='duel') return 'Challenge the champion'
        if(this.job.kind==='haul') return 'Pick up the relic'
        if(this.job.kind==='cipher') return 'Read the rune stone'
        if(this.job.kind==='ward') return 'Raise the ward'
        return 'Follow the tracks'
      }
      if(this.field.started && this.job.kind==='cipher' && !this.field.decoded && distance(this.hero,this.dutySite)<3) return 'Read the rune stone'
      if(this.cargo && this.field.group===this.job.groups.length && distance(this.hero,this.fieldDestination())<2.7) return 'Deliver the relic'
      return ''
    }
    if (['meet', 'report'].includes(this.quest) && distance(this.hero, mira) < 2.7) return 'Speak to Mira'
    if (!this.ritual && (this.quest === 'light' || this.quest === 'anchors') &&
      this.sites.some((point,i)=>!this.completedSites[i] && distance(this.hero,point)<2.65)) {
      return this.quest === 'light' ? 'Light the waybeacon' : 'Begin the shrine rite'
    }
    if (this.quest === 'pass' && distance(this.hero, watchSite) < 2.7) return 'Light the watchfire'
    return ''
  }

  private closest<P extends Point>(where: Point, items: P[]): P | undefined {
    return [...items].sort((a, b) => distance(where, a) - distance(where, b))[0]
  }

  private setQuest(quest: Quest) {
    this.quest = quest
    if (quest === 'pass') this.hero.hp = this.stats.health // Rest with Mira between chapters.
    this.checkpoint = this.snapshot()
  }

  private say(message: string, time = 3.2) {
    this.message = message
    this.messageTime = time
  }

  private effect(kind: Feedback['kind'], at: Point, message?: string, height = 1, from?: Point, yaw = this.hero.yaw) {
    const duration = effectDuration[kind]
    this.effects.push({ x: at.x, z: at.z, kind, message, height, from, yaw, ttl: duration, duration })
  }

  blocked(p: Point) {
    if (Math.abs(p.x) > 38 || p.z < -114 || p.z > 37) return true
    if (p.z < passSite.z && (this.chapter === 1 || Math.abs(p.x - roadX(p.z)) > 17)) return true
    const nearby=this.cells.get(Math.floor(p.x/5)+','+Math.floor(p.z/5))
    if (nearby) {
      const foot=floor(p.x,p.z)
      if (nearby.some(o=>foot+.12 < o.top && foot+1.95 > o.base && touchesFootprint(p,o,.42))) return true
    }
    if (banksideTrees.some(([x,z,h]) => Math.hypot(p.x-x,p.z-z)<h*.115)) return true
    if (Math.abs(p.z - river(p.x)) < 3.25) {
      if (!this.opened || Math.abs(p.x - bridgeX) >= 1.83) return true
    }
    return false
  }

  private freeSpawn(p: Point) {
    if (!this.blocked(p)) return p
    for (let radius=.7; radius<=14; radius+=.7) {
      for (let i=0;i<16;i++) {
        const angle=i*Math.PI/8
        const next={x:p.x+radius*Math.cos(angle),z:p.z+radius*Math.sin(angle)}
        if (!this.blocked(next)) return next
      }
    }
    return p
  }

  private move(actor: typeof this.hero | Enemy, dx: number, dz: number) {
    if (this.canStep(actor, { x: actor.x + dx, z: actor.z })) actor.x += dx
    if (this.canStep(actor, { x: actor.x, z: actor.z + dz })) actor.z += dz
  }

  private canStep(actor: typeof this.hero | Enemy, next: Point) {
    if (this.blocked(next)) return false
    if ('kind' in actor) return permitsSeparation(actor, next, this.hero, actor.kind)
    return this.enemies.every(enemy => enemy.hp <= 0 || permitsSeparation(actor, next, enemy, enemy.kind))
  }

  private interact() {
    if (!this.prompt) return
    if (this.quest==='orders') {
      if(this.cargo && this.field.group===this.job.groups.length) { this.finishJob(); return }
      this.field.started=true
      if(this.job.kind==='cipher' && !this.field.decoded) this.cipherOpen=true
      this.checkpoint=this.snapshot()
      return
    }
    if (this.quest === 'meet') {
      this.setQuest('hunt')
      this.spawnHounds()
      this.say('Mira: Clear the road. Then I can open the crossing.', 5)
    } else if (this.quest === 'report') {
      this.setQuest('pass')
      this.say('Mira: Check the northern watch beyond the stone pass.', 5)
    } else if (this.quest === 'pass') {
      this.setQuest('watch')
      this.spawnWatch()
      this.effect('light', watchSite)
      this.say('The watchfire is lit. Two hounds remain in the clearing.')
    } else if (this.quest === 'light' || this.quest === 'anchors') {
      const index = this.sites.findIndex((site,i)=>!this.completedSites[i] && distance(this.hero,site)<2.65)
      if (index < 0) return
      this.enemies = []
      this.ritual = {index,elapsed:0,wave:0,nextAt:0}
      this.effect('light',this.sites[index])
      this.say('Hold the circle and drive them off.',4)
    }
  }

  private fieldDestination(): Point {
    if(this.job.kind!=='haul') {
      if(this.job.kind!=='hunt' || !this.field.started) return this.dutySite
      const angle=this.field.group*1.68
      return this.freeSpawn({x:this.dutySite.x+Math.cos(angle)*5,z:this.dutySite.z+Math.sin(angle)*5})
    }
    const end=posts[this.job.end!], start=this.dutySite
    const north=start.z<river(start.x)
    const route:Point[]=[start]
    if(north!==(end.z<river(end.x))) {
      route.push({x:bridgeX,z:north ? bridge.min-3.5 : bridge.max+3.5},{x:bridgeX,z:north ? bridge.max+3.5 : bridge.min-3.5})
    }
    route.push(end)
    let travel=route.slice(1).reduce((n,p,i)=>n+distance(p,route[i]),0)*Math.min(1,(this.field.group+.5)/this.job.groups.length)
    for(let i=1;i<route.length;i++) {
      const a=route[i-1],b=route[i],length=distance(a,b)
      if(travel<=length) return this.freeSpawn({x:a.x+(b.x-a.x)*travel/length,z:a.z+(b.z-a.z)*travel/length})
      travel-=length
    }
    return end
  }

  enterRune(symbol:string) {
    if(!this.cipherOpen || !this.job.runes) return false
    if(symbol!==this.job.runes[this.runeIndex]) { this.runeIndex=0; return false }
    if(++this.runeIndex===this.job.runes.length) {
      this.cipherOpen=false
      this.field.decoded=true
      this.runeIndex=0
      this.checkpoint=this.snapshot()
      this.say('Seal broken. Its guardians are waking.')
    }
    return true
  }

  get inscription() {
    const clues:Record<string,string>={S:'what warms the fields',R:'what bends on the bank',T:'what lifts the ferry'}
    return [...(this.job.runes ?? '')].map(key=>clues[key]).join(' · ')
  }

  private fieldTick() {
    const f=this.field, job=this.job
    if(!f.started || this.needsMedic || (job.kind==='cipher' && !f.decoded)) return
    if(this.fieldEngaged) {
      if(this.enemiesAlive.length) return
      this.fieldEngaged=false
      f.group++
      this.enemies=[]
      this.hero.hp=Math.min(this.stats.health,this.hero.hp+12)
      this.hero.spirit=Math.min(100,this.hero.spirit+10)
      this.checkpoint=this.snapshot()
    }
    if(f.group===job.groups.length) { if(!this.cargo) this.finishJob(); return }
    const point=this.fieldDestination()
    if(distance(this.hero,point)>6) return
    const kinds:Record<string,EnemyKind>={H:'hound',C:'sentry',W:'warden',B:'sentinel'}
    const pack=job.groups[f.group]
    for(const [i,letter] of [...pack].entries()) {
      const angle=f.group*1.79 + f.order*.55 + i*2.8
      const spawn=this.freeSpawn({x:point.x+Math.cos(angle)*4.4,z:point.z+Math.sin(angle)*4.4})
      const enemy=makeEnemy('order-'+f.order+'-'+f.job+'-'+f.group+'-'+i,spawn,kinds[letter])
      const champion=job.kind==='duel' && f.group===job.groups.length-1 && i===pack.length-1
      const base=letter==='H' ? 95 : letter==='C' ? 135 : letter==='W' ? 285 : 405
      enemy.hp=enemy.hpMax=champion ? 560+f.order*25 : base+f.order*4
      if(champion) enemy.title=job.name
      enemy.ready=.9+i*.5
      this.enemies.push(enemy)
    }
    this.fieldEngaged=true
  }

  private finishJob() {
    const f=this.field
    this.effect('light',this.hero)
    this.hero.hp=this.stats.health
    this.hero.spirit=100
    if(f.job+1<this.order.jobs.length) f.job++
    else if(f.order+1<orders.length) { f.order++; f.job=0 }
    else { this.setQuest('dawn'); return }
    f.group=0; f.started=false; f.decoded=false
    this.runeIndex=0
    this.checkpoint=this.snapshot()
    this.say('Checkpoint reached · '+this.job.name,4)
  }

  private ritualTick(dt: number) {
    const ritual = this.ritual
    if (!ritual) return
    const site = this.sites[ritual.index]
    if (distance(this.hero,site) > 13) return
    ritual.elapsed += dt
    const northern = this.quest === 'anchors'
    const waves = this.waveSchedule
    if (!this.enemiesAlive.length) ritual.nextAt = Math.min(ritual.nextAt,ritual.elapsed+5)
    if (ritual.wave < waves.length && ritual.elapsed >= ritual.nextAt) {
      const angle = ritual.index*1.8 + ritual.wave*2.07
      const offset = 6.5+ritual.wave*.45
      let spawn = {x:site.x+Math.cos(angle)*offset,z:site.z+Math.sin(angle)*offset}
      if (this.blocked(spawn)) spawn = {x:site.x,z:site.z+(northern ? 4.6 : 5.7)}
      const casterWave = ritual.wave === 1 || northern && (ritual.wave === 3 || ritual.wave === 5)
      const kind = casterWave ? 'sentry' : 'hound'
      this.enemies.push(makeEnemy(`ritual-${ritual.index}-${ritual.wave}`,this.freeSpawn(spawn),kind))
      if ((ritual.wave === 3 && (northern || this.lit.some(Boolean))) || (northern && ritual.wave === 1)) {
        const flank = {x:site.x-Math.cos(angle)*5.4,z:site.z-Math.sin(angle)*5.4}
        this.enemies.push(makeEnemy('flank-'+ritual.index+'-'+ritual.wave,this.freeSpawn(flank),kind === 'sentry' ? 'hound' : 'sentry'))
      }
      ritual.wave++
      ritual.nextAt = ritual.elapsed + (waves[ritual.wave] ?? 0)
    }
    if (ritual.wave < waves.length || this.enemiesAlive.length) return
    this.completedSites[ritual.index] = true
    this.ritual = undefined
    this.hero.hp = Math.min(this.stats.health,this.hero.hp + 4)
    this.hero.spirit = Math.min(100,this.hero.spirit + 12)
    this.enemies = []
    this.effect('light',site)
    if (!this.completedSites.every(Boolean)) {
      this.checkpoint = this.snapshot()
      this.say(northern ? 'Shrine dispelled · +65 XP' : 'Beacon secured · +45 XP')
    } else if (northern) {
      this.enemies = [makeEnemy('sentinel',sentinelSite,'sentinel')]
      this.setQuest('sentinel')
      this.say('The shrines are cold. The Ash Sentinel waits by the ruins.')
    } else {
      this.enemies = [makeEnemy('warden',wardenSite,'warden')]
      this.setQuest('warden')
      this.say('All beacons are lit. The bridge is open.')
    }
  }

  private chooseTarget(visible?: string[]) {
    const ordered = this.enemiesAlive.filter(enemy => distance(this.hero, enemy) < 27)
      .sort((a, b) => Number(visible?.includes(b.id) ?? false) - Number(visible?.includes(a.id) ?? false)
        || distance(this.hero, a) - distance(this.hero, b))
    const current = ordered.findIndex(enemy => enemy.id === this.selected)
    this.select(ordered[(current + 1) % ordered.length]?.id ?? '')
  }

  private select(id: string) {
    const enemy = this.enemiesAlive.find(candidate => candidate.id === id && distance(this.hero, candidate) < 27)
    const selected = enemy?.id ?? ''
    if (selected !== this.selected && this.action?.skill === 'strike' && this.action.age < strikeContact) this.action = undefined
    this.selected = selected
    if (!enemy) this.autoAttacking = false
  }

  private faces(target: Point) {
    const angle = yawTo(this.hero, target) - this.hero.yaw
    return Math.cos(angle) >= .35
  }

  private toggleAuto(visible?: string[]) {
    if (this.autoAttacking) { this.autoAttacking = false; return }
    if (!this.target) this.chooseTarget(visible)
    if (!this.target) { this.say('Select an enemy'); return }
    this.autoAttacking = true
    if (this.hero.movement === 0) this.hero.yaw = yawTo(this.hero, this.target)
  }

  private damage(enemy: Enemy, amount: number, kind: 'strike' | 'seal' | 'break') {
    if(this.wardActive && distance(this.hero,this.dutySite)>10) { this.say('Return to the blue ward to deal damage.'); return }
    enemy.hp = Math.max(0, enemy.hp - amount)
    enemy.reaction = .2
    const from = kind === 'strike' ? undefined : { x: this.hero.x, z: this.hero.z }
    this.effect(kind, enemy, '−' + amount, isBoss(enemy.kind) ? 1.45 : .72, from)
    if (enemy.hp > 0) {
      if (this.quest!=='orders' && isBoss(enemy.kind) && !this.reinforcement && enemy.hp <= enemy.hpMax*.49) {
        this.reinforcement = true
        for (const side of [-1,1]) {
          const p = {x:enemy.x+side*5.9,z:enemy.z-3.2}
          const spawn = this.blocked(p) ? {x:enemy.x,z:enemy.z+side*4.3} : p
          this.enemies.push(makeEnemy('reinforcement-'+side,this.freeSpawn(spawn),side < 0 ? 'hound' : 'sentry'))
        }
        this.say('Two more foes have joined the fight.',3.5)
      }
      return
    }
    if (this.selected === enemy.id) this.select('')
    if (this.quest==='orders') return
    if (enemy.kind === 'warden') {
      this.setQuest('report')
      this.enemies = []
      this.say('Warden defeated · +130 XP', 5)
      return
    }
    if (enemy.kind === 'sentinel') {
      this.setQuest('clear')
      this.enemies = []
      this.say('Ash Sentinel defeated · +180 XP', 5)
      return
    }
    if (this.ritual || this.quest === 'warden' || this.quest === 'sentinel') {
      return
    }
    if (this.quest === 'watch') {
      this.watchKills++
      if (this.watchKills === watchPosts.length) {
        this.enemies = []
        this.setQuest('anchors')
        this.say('The hounds are gone. Dispel the mist at the three shrines.')
      } else this.checkpoint = this.snapshot()
      return
    }
    this.huntKills++
    if (this.huntKills === 3) {
      this.setQuest('light')
      this.say('The road is clear. Light the three waybeacons.')
    } else {
      this.checkpoint = this.snapshot()
      this.say(this.huntKills === 2 ? 'Level 2 · Seal unlocked' : '+35 XP', 3)
    }
  }

  private castSkill(skill: Skill, control: Control) {
    if (this.level < skillLevel[skill] || this.cooldowns[skill] > 0 || this.rolling > 0) return

    if ((skill === 'heal' || skill === 'seal') && this.gcd > 0) return

    const cost = this.spiritCost(skill)
    if (this.hero.spirit < cost) { this.say('Not enough Spirit · requires '+cost); return }
    if (skill === 'roll') {
      const moving = Math.hypot(control.x, control.z) > .12
      const angle = moving ? Math.atan2(control.x, control.z) : control.facing ?? this.hero.yaw
      this.rollDirection = { x: Math.sin(angle), z: Math.cos(angle) }
      this.hero.yaw = angle
      this.rolling = actionLength.roll
      this.hero.invulnerable = this.stats.dodge
      this.effect('roll', this.hero)
    } else if (skill === 'heal') {
      this.hero.spirit -= cost
      if(this.needsMedic && distance(this.hero,this.dutySite)<3.4) {
        this.field.decoded=true
        this.effect('heal',this.dutySite,'Scout revived',1)
        this.say('The scout is up. Cover their retreat.')
        this.checkpoint=this.snapshot()
      }
      const healed = Math.min(this.stats.heal, this.stats.health - Math.round(this.hero.hp))
      this.hero.hp = Math.min(this.stats.health, this.hero.hp + healed)
      this.effect('heal', this.hero, healed > 0 ? '+' + healed : undefined, 1.65)
    } else {
      const ranged = skill === 'seal'
      const range = ranged ? this.stats.sealReach : meleeReach
      const chosen = this.target
      const aim = chosen ? distance(this.hero, chosen) <= range ? chosen : undefined
        : this.closest(this.hero, this.enemiesAlive.filter(enemy => distance(this.hero, enemy) <= range))
      if (aim) {
        this.hero.yaw = yawTo(this.hero, aim)
        this.selected = aim.id
      }
      if (!ranged) {
        this.beginSwing(aim)
        return
      }
      if (!aim) {
        this.say(chosen ? 'Target out of range' : 'No target within Seal range')
        return
      }
      if (this.action?.skill === 'strike' && this.action.age < strikeContact) this.action = undefined
      this.autoAttacking = true
      this.hero.spirit -= cost
      const cast = aim.intent?.kind
      const interrupted = cast !== undefined && interruptible(cast)
      if (interrupted) {
        aim.intent = undefined
        aim.stagger = 2.15
        this.hero.spirit = Math.min(100,this.hero.spirit+this.stats.breakRefund)
      } else if (!aim.intent) aim.stagger = .56
      this.damage(aim, (interrupted ? 34 : 24) + this.stats.sealBonus, interrupted ? 'break' : 'seal')
      if (interrupted) this.say(cast === 'mend' ? 'Healing interrupted' : 'Mistcall interrupted')
    }
    if (skill === 'heal' || skill === 'seal') this.gcd = globalRecharge
    this.cooldowns[skill] = this.recovery(skill)
    this.action = { skill, age: 0 }
  }

  private beginSwing(target?: Enemy) {
    this.reverseStrike = !this.reverseStrike
    this.action = { skill: 'strike', age: 0, target, reverse: this.reverseStrike }
    this.cooldowns.strike = target ? this.recovery('strike') : actionLength.strike
  }

  private advanceAction(dt: number) {
    const action = this.action
    if (!action) return
    const before = action.age
    action.age += dt
    if (action.skill === 'strike' && before < strikeContact && action.age >= strikeContact) {
      const enemy = action.target
      if (enemy && enemy.hp > 0 && distance(this.hero, enemy) <= meleeReach && this.faces(enemy)) {
        this.hero.yaw = yawTo(this.hero, enemy)
        const splash = this.stats.cleave > 0 ? this.closest(enemy,this.enemiesAlive.filter(other=>other!==enemy && distance(enemy,other)<=3.6)) : undefined
        this.hero.spirit = Math.min(100,this.hero.spirit+strikeSpirit)
        this.damage(enemy, this.stats.melee, 'strike')
        if (splash && this.enemies.includes(splash)) this.damage(splash,this.stats.cleave,'strike')
      } else {
        this.effect('miss', this.hero, 'Miss', 1.55)
      }
    }
    if (action.age >= actionLength[action.skill]) this.action = undefined
  }

  private enemyTick(enemy: Enemy, dt: number) {
    enemy.reaction = Math.max(0, enemy.reaction - dt)
    if (enemy.hp <= 0 || this.fallen) {
      enemy.release = 0
      return
    }
    enemy.stagger = Math.max(0, enemy.stagger - dt)
    if (enemy.mendReady) enemy.mendReady = Math.max(0,enemy.mendReady-dt)
    enemy.ready = Math.max(0, enemy.ready - dt)
    if (enemy.stagger > 0) return
    if (enemy.release > 0) {
      const elapsed = Math.min(dt, enemy.release)
      const travel = (enemy.lunge ?? 0) * elapsed / .24
      if (travel > 0) this.move(enemy, Math.sin(enemy.yaw) * travel, Math.cos(enemy.yaw) * travel)
      enemy.release -= elapsed
      return
    }
    const hero = this.hero
    const gap = distance(hero, enemy)
    if (enemy.intent) {
      enemy.intent.time -= dt
      if (enemy.intent.time > 0) return
      const { kind, yaw } = enemy.intent
      const spec = casts[kind]
      const dx = hero.x - enemy.x
      const dz = hero.z - enemy.z
      const ahead = dx * Math.sin(yaw) + dz * Math.cos(yaw)
      if (kind === 'mend') {
        const ally = this.enemiesAlive.find(other=>other.id === enemy.intent!.allyId)
        if (ally && distance(enemy,ally) <= spec.range) {
          const restored = Math.min(38,ally.hpMax-ally.hp)
          ally.hp += restored
          if (restored) this.effect('mend',ally,'+'+restored,1.35,enemy)
        }
      } else if (castContains(enemy, enemy.intent, hero) && hero.invulnerable <= 0) {
        const damage = Math.round(spec.damage*(1-this.stats.armor))
        hero.hp = Math.max(0, hero.hp - damage)
        hero.invulnerable = .38
        this.effect('hurt', hero, '−' + damage)
        this.fallen = hero.hp === 0
      }
      enemy.lunge = kind === 'rush' ? Math.min(4, Math.max(0, ahead - 1)) : kind === 'fang' ? .47 : 0
      enemy.intent = undefined
      enemy.release = .24
      enemy.followUp = kind === 'fang' || kind === 'arc' || kind === 'rush'
      enemy.ready = enemy.followUp ? .32 : kind === 'bolt' ? 2.3 : enemy.hp < enemy.hpMax*.49 && isBoss(enemy.kind) ? .95 : 1.4
      return
    }
    const boss = isBoss(enemy.kind)
    const sentry = enemy.kind === 'sentry'
    if (gap > (boss ? 15 : sentry ? 13 : 9.8)) return
    enemy.yaw = yawTo(enemy, hero)
    if (gap > (boss ? (enemy.followUp ? 2.7 : 4.35) : sentry ? 7.2 : 2.65)) {
      const speed = boss ? 2.7 : sentry ? 3.15 : 3.55
      this.move(enemy, Math.sin(enemy.yaw) * dt * speed, Math.cos(enemy.yaw) * dt * speed)
    }
    if (enemy.ready > 0) return
    if (enemy.followUp) {
      enemy.followUp = false
      if (gap <= casts.jab.range) {
        enemy.intent = {kind:'jab',time:casts.jab.seconds,yaw:enemy.yaw}
        return
      }
      enemy.ready = .65
      return
    }
    if (sentry && !enemy.mendReady) {
      const ally = this.enemiesAlive.find(other=>other !== enemy && other.hpMax-other.hp >= 18 && distance(enemy,other) <= casts.mend.range)
      if (ally) {
        enemy.intent = {kind:'mend',time:casts.mend.seconds,yaw:yawTo(enemy,ally),allyId:ally.id}
        enemy.mendReady = 7.5
        return
      }
    }
    const sequence: Cast[] = enemy.kind === 'sentinel' ? ['rush', 'arc', 'mist', 'arc'] : ['arc', 'mist', 'rush']
    const kind = boss ? sequence[enemy.casts % sequence.length] : sentry ? 'bolt' : 'fang'
    if (gap > casts[kind].range * .88) return
    enemy.intent = { kind, time: casts[kind].seconds, yaw: enemy.yaw }
    enemy.casts++
  }

  step(elapsed: number, control: Control) {
    if (this.fallen || this.quest === 'clear' || this.quest==='dawn' || this.cipherOpen) return
    const dt = Math.min(.05, elapsed)
    this.seconds += dt
    this.messageTime = Math.max(0, this.messageTime - dt)
    const hero = this.hero
    const fighting = !!this.ritual || this.enemies.some(enemy=>enemy.hp > 0 && distance(hero,enemy) < 15)
    hero.spirit = Math.min(100,hero.spirit + (this.stats.spirit + (fighting ? 0 : 5)) * dt)
    hero.invulnerable = Math.max(0, hero.invulnerable - dt)
    this.rolling = Math.max(0, this.rolling - dt)
    this.gcd = Math.max(0, this.gcd - dt)
    for (const skill of Object.keys(this.cooldowns) as Skill[]) this.cooldowns[skill] = Math.max(0, this.cooldowns[skill] - dt)
    for (const effect of this.effects) effect.ttl -= dt
    this.effects = this.effects.filter(effect => effect.ttl > 0)
    if (control.cycle) this.chooseTarget(control.visible)
    if (control.select !== undefined) this.select(control.select)
    if (control.auto) this.toggleAuto(control.visible)
    if (control.interact) this.interact()
    if (control.skill) this.castSkill(control.skill, control)
    const len = Math.hypot(control.x, control.z)
    const pace = this.rolling > 0 ? 15.8 : this.cargo ? 5.3 : 6.9
    const direction = this.rolling > 0 ? this.rollDirection : { x: control.x / Math.max(1, len), z: control.z / Math.max(1, len) }
    const moving = Math.hypot(direction.x, direction.z) > .01
    hero.movement = moving ? 1 : 0
    if (moving) {
      if (!this.action || this.rolling > 0) hero.yaw = Math.atan2(direction.x, direction.z)
      this.move(hero, direction.x * dt * pace, direction.z * dt * pace)
    }
    this.advanceAction(dt)
    if (!this.action && this.cooldowns.strike === 0 && this.autoStatus === 'Auto-attack') this.beginSwing(this.target)
    for (const enemy of this.enemies) this.enemyTick(enemy, dt)
    if (!this.fallen) { this.ritualTick(dt); if(this.quest==='orders') this.fieldTick() }
  }
}
