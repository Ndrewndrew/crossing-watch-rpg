import * as T from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { treeSwayWaveGlsl } from './vendor/tree_sway_wave.ts'

const urls = import.meta.glob<string>('./art/models/*.glb', { eager: true, query: '?url', import: 'default' })

export type Model = 'KnightCharacter' | 'Stag' | 'Bull' | 'Wolf' | 'PineTree_1' | 'PineTree_4'
  | 'BirchTree_2' | 'BirchTree_Dead_2' | 'Rock_5' | 'Rock_Moss_3' | 'Flowers'
  | 'Bush_2' | 'Grass_2' | 'TreeStump' | 'Houses_FirstAge_2_Level2'

export type Artwork = Record<Model, GLTF>

export async function loadArtwork(): Promise<Artwork> {
  const loader = new GLTFLoader()
  const entries = await Promise.all(Object.entries(urls).map(async ([path, url]) => {
    const name = path.slice(path.lastIndexOf('/') + 1, -4)
    return [name, await loader.loadAsync(url)]
  }))
  return Object.fromEntries(entries) as Artwork
}

function normalizingMatrix(source: T.Object3D, height: number) {
  source.updateMatrixWorld(true)
  const bounds = new T.Box3().setFromObject(source)
  const c = bounds.getCenter(new T.Vector3())
  const scale = height / (bounds.max.y - bounds.min.y)
  return new T.Matrix4().makeScale(scale, scale, scale)
    .multiply(new T.Matrix4().makeTranslation(-c.x, -bounds.min.y, -c.z))
}

// Slice the actual model in the same normalized frame used for instancing.
export function obstacleProfile(scene: T.Object3D) {
  const frame = normalizingMatrix(scene,1)
  const radii = Array<number>(6).fill(0)
  scene.traverse(mesh => {
    if (!(mesh instanceof T.Mesh)) return
    const geometry = mesh.geometry as T.BufferGeometry
    const points = geometry.getAttribute('position')
    const transform = frame.clone().multiply(mesh.matrixWorld)
    const vertices = Array.from({length: points.count}, (_,i) => new T.Vector3().fromBufferAttribute(points,i).applyMatrix4(transform))
    const indices = geometry.index?.array
    const count = indices?.length ?? vertices.length
    for (let i=0;i<count;i+=3) {
      for (let edge=0;edge<3;edge++) {
        const j=i+edge, k=i+(edge+1)%3
        const a=vertices[indices ? indices[j] : j], b=vertices[indices ? indices[k] : k]
        const low=a.y<=b.y ? a : b, high=a.y<=b.y ? b : a
        for (let band=0;band<radii.length;band++) {
          const y0=Math.max(low.y,band/radii.length), y1=Math.min(high.y,(band+1)/radii.length)
          if (y1<y0) continue
          for (const y of [y0,y1]) {
            const t=(y-low.y)/(high.y-low.y || 1)
            radii[band]=Math.max(radii[band],Math.hypot(low.x+(high.x-low.x)*t,low.z+(high.z-low.z)*t),high.y===low.y ? Math.hypot(high.x,high.z) : 0)
          }
        }
      }
    }
  })
  return radii
}

export class Actor {
  readonly root = new T.Group()
  readonly body = new T.Group()
  readonly model: T.Object3D
  private readonly mixer: T.AnimationMixer
  private readonly actions = new Map<string, T.AnimationAction>()
  private current?: T.AnimationAction

  constructor(asset: GLTF, height: number, facing: number, colors: Record<string, number> = {}) {
    this.model = clone(asset.scene)
    this.model.applyMatrix4(normalizingMatrix(this.model, height))
    this.body.rotation.y = facing
    this.body.add(this.model)
    this.root.add(this.body)
    this.model.traverse(obj => {
      if (!(obj instanceof T.Mesh)) return
      obj.castShadow = obj.receiveShadow = true
      if (Array.isArray(obj.material)) return
      const color = colors[obj.material.name]
      if (color !== undefined && obj.material instanceof T.MeshStandardMaterial) {
        const material = obj.material.clone()
        material.color.setHex(color)
        material.userData.actorTint = true
        obj.material = material
      }
    })
    this.mixer = new T.AnimationMixer(this.model)
    for (const clip of asset.animations) this.actions.set(clip.name.split('|').at(-1)!, this.mixer.clipAction(clip))
    this.animate('Idle', 0)
  }

  animate(name: string, dt: number, speed = 1, progress?: number, once = false) {
    const action = this.actions.get(name) ?? this.actions.get('Idle')!
    if (action !== this.current) {
      // Stop older blends before handling another clip. It keeps rapid input from leaving an old pose active.
      for (const other of this.actions.values()) if (other !== this.current && other !== action) other.stop()
      this.current?.fadeOut(.12)
      action.reset().setEffectiveWeight(1).setLoop(once ? T.LoopOnce : T.LoopRepeat, Infinity)
      action.clampWhenFinished = once
      action.fadeIn(this.current ? .1 : 0).play()
      this.current = action
    }
    action.paused = progress !== undefined
    action.setEffectiveTimeScale(speed)
    if (progress !== undefined) action.time = Math.min(.999, progress) * action.getClip().duration
    this.mixer.update(dt)
  }

  dispose() {
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.model)
    this.model.traverse(obj => {
      if (obj instanceof T.Mesh && obj.material.userData.actorTint) obj.material.dispose()
    })
  }
}

export type Placement = { x: number; y: number; z: number; h: number; yaw: number; tint?: number }

export class FoliageWind {
  private readonly time = { value: 0 }
  private readonly player = { value: new T.Vector2() }
  private readonly shortBatches: {mesh: T.InstancedMesh; x: number; z: number}[] = []
  constructor(readonly enabled: boolean) {}

  add(material: T.MeshStandardMaterial, lean: number) {
    if (!this.enabled) return
    // Mesh roots sit at local Y=0, so wind bends the canopy around each root.
    const wave = treeSwayWaveGlsl()
    material.onBeforeCompile = shader => {
      shader.uniforms.uTime = this.time
      shader.uniforms.uSwayPlayer = this.player
      shader.vertexShader = 'uniform float uTime; uniform vec2 uSwayPlayer;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 swayBase = instanceMatrix[3].xz;
          ${wave}
          float bend = clamp(transformed.y, 0.0, 1.0);
          transformed.x += swayWave * ${lean.toFixed(4)} * bend * bend;
          transformed.z += swayWave * ${(lean * .47).toFixed(4)} * bend * bend;
        #endif
      `)
    }
    material.customProgramCacheKey = () => 'dozor-wind-' + lean
  }

  trackGroundcover(mesh: T.InstancedMesh) {
    const {x,z} = mesh.boundingSphere!.center
    this.shortBatches.push({mesh,x,z})
  }

  update(time: number, x: number, z: number) {
    this.time.value = time
    this.player.value.set(x, z)
    for (const batch of this.shortBatches) batch.mesh.visible = (x-batch.x)**2 + (z-batch.z)**2 < 43**2
  }
}

export function placeModels(scene: T.Scene, asset: GLTF, items: Placement[], wind?: FoliageWind, lean = 0, shadow = true) {
  if (!items.length) return
  const matrix = normalizingMatrix(asset.scene, 1)
  const pose = new T.Object3D()
  const color = new T.Color()
  const strips = new Map<string, Placement[]>()
  for (const item of items) {
    const strip = shadow ? String(Math.floor(item.z / 26)) : Math.floor(item.x / 20) + ':' + Math.floor(item.z / 20)
    if (!strips.has(strip)) strips.set(strip, [])
    strips.get(strip)!.push(item)
  }
  asset.scene.traverse(obj => {
    if (!(obj instanceof T.Mesh) || !(obj.material instanceof T.MeshStandardMaterial)) return
    const geometry = obj.geometry.clone().applyMatrix4(obj.matrixWorld).applyMatrix4(matrix)
    const material = obj.material.clone()
    if (wind && lean > 0) wind.add(material, lean)
    for (const placements of strips.values()) {
      const batch = new T.InstancedMesh(geometry, material, placements.length)
      batch.castShadow = shadow
      batch.receiveShadow = true
      for (const [i, {x,y,z,h,yaw,tint}] of placements.entries()) {
        pose.position.set(x,y,z)
        pose.rotation.y = yaw
        pose.scale.setScalar(h)
        pose.updateMatrix()
        batch.setMatrixAt(i, pose.matrix)
        batch.setColorAt(i, color.setScalar(tint ?? 1))
      }
      batch.computeBoundingSphere()
      if (!shadow) wind?.trackGroundcover(batch)
      scene.add(batch)
    }
  })
}
