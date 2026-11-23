import * as T from 'three'
import { orders, posts } from './orders.ts'
import { GroundWarning } from './telegraph.ts'
import { CombatEffects, StaffTrail } from './combat_fx.ts'
import { telegraphFillOf } from './vendor/telegraph_look_core.ts'
import { fbm2, hash2 } from './vendor/terrain_noise.ts'
import { Actor, FoliageWind, obstacleProfile, placeModels, type Artwork, type Model, type Placement } from './artwork.ts'
import { shadowTexelWorldSize, snapShadowAnchor } from './vendor/shadow_texel_snap_core.ts'
import turfUrl from './art/turf.webp'
import trailUrl from './art/trail.webp'
import { anchorSites, banksideTrees, beacons, bridge, bridgeHeight, bridgeX, actionLength, strikeContact, casts, distance, floor, ground, isBoss, mira, passSite, river, roadX, sentinelSite, terrainGrid, wardenSite, watchSite, type Enemy, type Point, type Trek } from './world.ts'
import { clearCameraFraction, type CameraObstacle } from './camera_clearance.ts'
import { createCameraBoom, stepCameraBoom } from './vendor/camera_boom_core.ts'

const mat = (color: number, metalness = 0) => new T.MeshStandardMaterial({ color, metalness, roughness: .79 })
const leather = mat(0x684733)
const gold = mat(0xb18a50, .44)
const bark = mat(0x503b28)
const grey = mat(0x63716a)
const shale = mat(0x485b61)
const ember = new T.MeshBasicMaterial({ color: 0xffc17c })
const sphere = new T.SphereGeometry(.5, 16, 10)
const box = new T.BoxGeometry(1, 1, 1)
const taper = new T.CylinderGeometry(.32, .56, 1, 12)
const stone = new T.DodecahedronGeometry(.6, 0)
const blockOutline = new T.Shape([
  new T.Vector2(-.38,-.32), new T.Vector2(.28,-.38), new T.Vector2(.39,-.27),
  new T.Vector2(.38,.32), new T.Vector2(.27,.38), new T.Vector2(-.35,.36),
])
const masonry = new T.ExtrudeGeometry(blockOutline,{
  depth:.76, bevelEnabled:true, bevelSize:.11, bevelThickness:.12, bevelSegments:1, steps:1,
}).translate(0,0,-.38)
const thinRing = new T.RingGeometry(.91, 1, 48)
const plane = new T.PlaneGeometry(1, 1)
const oct = new T.OctahedronGeometry(.55)
const mendThread = new T.CylinderGeometry(.024,.024,1,6)
const mendGlow = new T.MeshBasicMaterial({color:0xe7a7ff})
const up = new T.Vector3(0,1,0)
const staffGlow = new T.MeshBasicMaterial({ color: 0xbbffe3 })

function piece<M extends T.Material>(parent: T.Object3D, geom: T.BufferGeometry, material: M, size: [number, number, number], pos: [number, number, number]) {
  const mesh = new T.Mesh(geom, material)
  mesh.scale.set(...size)
  mesh.position.set(...pos)
  if (material instanceof T.MeshStandardMaterial) mesh.castShadow = mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function patch<M extends T.Material>(parent: T.Object3D, geom: T.BufferGeometry, material: M, size: number, y = .026) {
  const mesh = piece(parent, geom, material, [size, size, 1], [0, y, 0])
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

function branch(parent: T.Object3D, material: T.Material, a: [number, number, number], b: [number, number, number], radius: number) {
  const p = new T.Vector3(...a)
  const q = new T.Vector3(...b)
  const delta = q.clone().sub(p)
  const center = p.addScaledVector(delta, .5)
  const twig = piece(parent, taper, material, [radius, delta.length(), radius], [center.x, center.y, center.z])
  twig.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize())
  return twig
}

function makeStaff() {
  const rod = new T.Group()
  branch(rod, bark, [0,-.35,0], [0,.76,0], .083)
  piece(rod, beltShape, leather, [.083,.265,.083], [0,0,0])
  for (const y of [-.137,.137]) piece(rod, beltShape, bronze, [.09,.022,.09], [0,y,0])
  branch(rod, gold, [0,.47,0], [0,.68,0], .204)
  const crystal = piece(rod, oct, staffGlow, [.22,.38,.22], [0,.68,0])
  crystal.rotation.y = Math.PI * .25
  for (const side of [-1, 1]) {
    branch(rod, gold, [0,.47,0], [side*.13,.68,0], .057)
    branch(rod, gold, [side*.13,.68,0], [side*.067,.85,0], .048)
  }
  return rod
}

const steel = mat(0x556d76,.56)
const pewter = mat(0x92979a,.45)
const padded = mat(0x252b34)
const bronze = mat(0x977047,.45)
const navy = new T.MeshStandardMaterial({color:0x263b51,roughness:.92,side:T.DoubleSide})
const russet = new T.MeshStandardMaterial({color:0x683a32,roughness:.92,side:T.DoubleSide})
const rangerHood = new T.SphereGeometry(.5,22,13,Math.PI/2+.8,Math.PI*2-1.6,.06,Math.PI*.95)
const tunic = new T.CylinderGeometry(.5,.57,1,11)
const beltShape = new T.CylinderGeometry(.5,.52,1,14)

function outfit(actor: Actor, wearer: 'hero' | 'mira' | 'sentry') {
  const cloth = wearer === 'hero' ? navy : russet
  const metal = wearer === 'hero' ? steel : bronze
  const mounted = (bone: string) => {
    const root = new T.Group()
    actor.root.add(root)
    return {root, bone}
  }
  const torso = mounted('Torso')
  piece(torso.root,tunic,padded,[.54,.47,.31],[0,1.056,.025])
  piece(torso.root,sphere,metal,[.51,.47,.315],[0,1.15,.075])
  for (const side of [-1,1]) {
    const pauldron = piece(torso.root,sphere,metal,[.28,.187,.28],[side*.24,1.335,.02])
    pauldron.rotation.z = side*.3
    piece(torso.root,sphere,pewter,[.235,.067,.245],[side*.263,1.354,.027]).rotation.z = side*.28
    piece(torso.root,sphere,gold,[.059,.064,.043],[side*.17,1.331,.156])
  }
  for (let i=0;i<3;i++) piece(torso.root,sphere,metal,
    [.38-i*.026,.087,.257],[0,1.14-i*.072,.08]).rotation.x = .1
  piece(torso.root,box,cloth,[.145,.37,.04],[0,1.117,.233])
  const badge = piece(torso.root,oct,gold,[.091,.109,.043],[0,1.238,.258])
  badge.rotation.z = .18

  const hip = mounted('Hips')
  piece(hip.root,beltShape,leather,[.57,.096,.353],[0,.828,.009])
  piece(hip.root,box,bronze,[.153,.102,.049],[0,.821,.204])
  piece(hip.root,box,leather,[.089,.056,.052],[0,.823,.207])
  piece(hip.root,sphere,leather,[.23,.24,.185],[-.256,.755,-.026])
  piece(hip.root,sphere,gold,[.043,.049,.034],[-.29,.782,.066])

  const head = mounted('Head')
  piece(head.root,rangerHood,cloth,[.57,.64,.57],[0,1.677,.016])
  if (wearer === 'sentry') {
    piece(head.root,sphere,metal,[.455,.52,.28],[0,1.662,.17])
    piece(head.root,box,padded,[.331,.044,.04],[0,1.692,.321])
    piece(head.root,oct,ember,[.054,.039,.026],[0,1.692,.345])
  } else {
    piece(head.root,sphere,cloth,[.45,.174,.387],[0,1.45,.068])
    for (const x of [-.069,.069]) piece(head.root,sphere,padded,[.042,.041,.028],[x,1.649,.242])
  }

  const cloak = new T.Group()
  cloak.position.set(0,1.355,-.139)
  torso.root.add(cloak)
  const fabric = new T.PlaneGeometry(1,1,14,12)
  const p = fabric.getAttribute('position')
  for(let i=0;i<p.count;i++){
    const u = p.getX(i) * 2, v = .5-p.getY(i)
    const length = wearer === 'hero' ? .65 : wearer === 'mira' ? .85 : .48
    p.setXYZ(i,u*(.23+v*.115),-v*length-(1-u*u)*.042*v,
      -.038-v*.115+u*u*.082+Math.sin(u*10)*.014*v)
  }
  fabric.computeVertexNormals()
  piece(cloak,fabric,cloth,[1,1,1],[0,0,0])

  const parts = [torso,hip,head]
  for (const side of [-1,1]) {
    const right = side < 0
    const bracer = mounted(right ? 'LowerArmR' : 'LowerArmL')
    const plate = piece(bracer.root,sphere,metal,[.154,.248,.18],[right?-.37:.336,.771,.003])
    plate.rotation.z = -side*.19
    piece(bracer.root,beltShape,leather,[.161,.077,.169],[right?-.39:.356,.682,-.016])
    const foot = mounted(right ? 'FootR' : 'FootL')
    const x = right ? -.188 : .182
    piece(foot.root,sphere,leather,[.14,.115,.225],[x,.067,.058])
    piece(foot.root,beltShape,padded,[.139,.025,.216],[x,.019,.058])
    parts.push(bracer,foot)
  }
  actor.root.updateMatrixWorld(true)
  for(const {root,bone} of parts) actor.model.getObjectByName(bone)!.attach(root)
  return cloak
}

const seed = (x: number, z: number) => hash2(x, z, 271)
const ashStone = mat(0x4d494a)
const ashArmor = mat(0x81634a)
const ashPine = mat(0x464b42)
const pathX = roadX

function terrain(scene: T.Scene) {
  const { width, depth, columns, rows, centerZ } = terrainGrid
  const geo = new T.PlaneGeometry(width, depth, columns, rows)
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, 0, centerZ)
  const pos = geo.getAttribute('position')
  const colors = []
  const mixes = []
  const grass = new T.Color('#827e44')
  const shade = new T.Color('#405437')
  const dry = new T.Color('#a89b61')
  const dirt = new T.Color('#75543e')
  const sand = new T.Color('#c3ac7b')
  const ash = new T.Color('#665d51')
  const scree = new T.Color('#878a88')
  const color = new T.Color()
  const field = new T.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const patch = fbm2(x * .065, z * .065, 451, 3)
    const variation = fbm2(x * .27, z * .27, 459, 2)
    const wobble = fbm2(x * .32, z * .32, 467, 2) - .5
    const road = 1 - T.MathUtils.smoothstep(Math.abs(x - pathX(z)) + wobble * 1.4, 1.05, 3.15)
    const bank = 1 - T.MathUtils.smoothstep(Math.abs(z - river(x)) + wobble, 3.1, 7.2)
    const north = 1 - T.MathUtils.smoothstep(z, -68, -48)
    const dx = ground(x+.55,z) - ground(x-.55,z)
    const dz = ground(x,z+.55) - ground(x,z-.55)
    const cliff = T.MathUtils.smoothstep(Math.hypot(dx,dz),.57,1.64)
    const wear = Math.max(road, bank, north * .72, cliff)
    pos.setY(i, ground(x, z))
    field.copy(grass).lerp(shade, patch * .78).lerp(dry, Math.max(0, variation - .39) * .72)
    color.copy(field).lerp(dirt, road * .86).lerp(sand, bank * .87)
    field.copy(ash).lerp(scree, variation * .68 + road * .31)
    color.lerp(field, north)
    field.copy(scree).lerp(shale.color, patch * .68).lerp(ash, wobble * wobble)
    color.lerp(field, cliff * .92)
    colors.push(color.r, color.g, color.b)
    mixes.push(wear)
  }
  geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  geo.setAttribute('surfaceWear', new T.Float32BufferAttribute(mixes, 1))
  geo.computeVertexNormals()
  const loader = new T.TextureLoader()
  const textures = [turfUrl, trailUrl].map(url => {
    const texture = loader.load(url)
    texture.wrapS = texture.wrapT = T.RepeatWrapping
    texture.anisotropy = 4
    return texture
  })
  const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: .96 })
  material.onBeforeCompile = shader => {
    shader.uniforms.turfDetail = { value: textures[0] }
    shader.uniforms.roadDetail = { value: textures[1] }
    shader.vertexShader = 'attribute float surfaceWear; varying float vWear; varying vec3 vTerrain, vTerrainNormal;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvTerrain = position; vTerrainNormal = normal; vWear = surfaceWear;')
    shader.fragmentShader = 'uniform sampler2D turfDetail, roadDetail; varying vec3 vTerrain, vTerrainNormal; varying float vWear;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec3 blend = pow(abs(normalize(vTerrainNormal)), vec3(4.0));
      blend /= blend.x + blend.y + blend.z;
      float blades = texture2D(turfDetail, vTerrain.xz * 1.1).r;
      vec3 rockUv = vTerrain * vec3(.73,.37,.73);
      float pebbles = texture2D(roadDetail, rockUv.yz).r * blend.x
        + texture2D(roadDetail, rockUv.xz).r * blend.y
        + texture2D(roadDetail, rockUv.xy).r * blend.z;
      float broad = texture2D(turfDetail, vTerrain.xz * .12 + .37).r;
      diffuseColor.rgb *= .46 + mix(blades, pebbles, vWear) * .93 + broad * .25;
    `)
  }
  const surface = new T.Mesh(geo, material)
  surface.receiveShadow = true
  scene.add(surface)

  const channel = new T.PlaneGeometry(128, 1, 82, 4).rotateX(-Math.PI / 2)
  const a = channel.getAttribute('position')
  for (let i = 0; i < a.count; i++) a.setXYZ(i, a.getX(i), -.26, river(a.getX(i)) + a.getZ(i) * 9.55)
  channel.computeVertexNormals()
  const water = new T.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 w; varying float fogDepth; void main(){ w=position.xz; vec4 p=modelViewMatrix*vec4(position,1.0); fogDepth=-p.z; gl_Position=projectionMatrix*p; }',
    fragmentShader: `
      varying vec2 w; varying float fogDepth; uniform float time;
      void main(){
        float f=pow(max(0.,sin(w.y*13.+sin(w.x*1.75+time)*1.6+time*2.)),11.);
        float s=.5+.5*sin(w.x*.22+w.y*1.9-time*.45);
        vec3 color=mix(vec3(.048,.18,.21),vec3(.23,.39,.37),s*.48)+vec3(.21,.29,.22)*f*.44;
        color=mix(color,vec3(.34,.41,.39),smoothstep(21.,75.,fogDepth));
        gl_FragColor=vec4(color,1.);
        #include <colorspace_fragment>
      }
    `,
  })
  scene.add(new T.Mesh(channel, water))
  return water
}

function panorama(scene: T.Scene) {
  const sky = new T.Mesh(new T.SphereGeometry(112, 26, 16), new T.ShaderMaterial({
    side: T.BackSide,
    depthWrite: false,
    vertexShader: 'varying vec3 ray; void main(){ray=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `
      varying vec3 ray;
      void main(){
        vec3 d=normalize(ray);
        float h=smoothstep(-.1,.65,d.y);
        vec3 col=mix(vec3(.66,.71,.62),vec3(.20,.42,.57),h);
        float sun=max(0.,dot(d,normalize(vec3(-.56,.24,-.78))));
        col += vec3(.5,.23,.084)*pow(sun,15.)+vec3(.48,.31,.14)*smoothstep(.9983,.9993,sun);
        float clouds=pow(max(0.,sin(d.x*14.+sin(d.z*15.)*.9+d.y*46.)*sin(d.x*7.1+d.z*21.)),4.)*smoothstep(.035,.19,d.y)*(1.-smoothstep(.22,.42,d.y));
        col=mix(col,vec3(.76,.82,.76),clouds*.65);
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }
    `,
  }))
  sky.renderOrder = -5
  scene.add(sky)
  return sky
}

function cover(scene: T.Scene, obstacles: CameraObstacle[], art: Artwork, wind: FoliageWind) {
  const plants = new Map<Model, Placement[]>()
  const shrines = [...beacons,watchSite,...anchorSites]
  const radii = new Map<Model,number>()
  function crowdsShrine(model: Model, x: number, z: number, height: number) {
    let radius = radii.get(model)
    if (radius === undefined) {
      const size = new T.Box3().setFromObject(art[model].scene).getSize(new T.Vector3())
      radius = Math.hypot(size.x,size.z) / (2*size.y)
      radii.set(model,radius)
    }
    // Same centered, height-normalized model footprint as placeModels, for any yaw.
    return shrines.some(site=>distance(site,{x,z}) < 2.7 + height*radius)
  }
  const profiles = new Map<Model,number[]>()
  function put(model: Model, x: number, z: number, h: number, yaw: number, sunk = 0, tint = 1) {
    const y = floor(x, z) - sunk
    if (model === 'Houses_FirstAge_2_Level2') {
      const size=new T.Box3().setFromObject(art[model].scene).getSize(new T.Vector3())
      const box={x:size.x*h/(2*size.y),z:size.z*h/(2*size.y),yaw}
      obstacles.push({x,z,base:y,top:y+h,radius:Math.hypot(box.x,box.z),box})
    } else if (model !== 'Grass_2' && model !== 'Flowers') {
      let radii=profiles.get(model)
      if (!radii) { radii=obstacleProfile(art[model].scene); profiles.set(model,radii) }
      radii.forEach((r,i)=>{
        if (r>0) obstacles.push({x,z,base:y+i*h/radii.length,top:y+(i+1)*h/radii.length,radius:h*r})
      })
    }
    if (!plants.has(model)) plants.set(model, [])
    plants.get(model)!.push({ x, y, z, h, yaw, tint })
    return y
  }

  for (let i = 0; i < 285; i++) {
    const z = -124 + seed(i, 17) * 176
    const x = (seed(i, 11) - .5) * 115
    const north = z < -54
    const offset = Math.abs(x - pathX(z))
    if (offset < (north ? 8.5 : 6.6) || Math.abs(z - river(x)) < 6 ||
      z > -9 && z < 25 && Math.abs(x) < 21 || distance({ x, z }, wardenSite) < 13) continue
    const h = 3.1 + seed(i, 43) * 6.6
    const model = north && i % 3 === 0 ? 'BirchTree_Dead_2' :
      i % 5 === 0 ? 'BirchTree_2' : i % 2 === 0 ? 'PineTree_1' : 'PineTree_4'
    if (crowdsShrine(model,x,z,h)) continue
    put(model, x, z, h, seed(i, 2) * 6.28, .23, .62 + seed(i, 86) * .37)
  }
  for (const [i, [x,z,h]] of banksideTrees.entries()) {
    put(i % 2 === 0 ? 'BirchTree_2' : 'PineTree_1', x, z, h * 1.14, i * 1.37, .24)
  }

  for (let i = 0; i < 245; i++) {
    const z = -121 + seed(i, 7) * 170
    const x = (seed(i, 31) - .5) * 92
    const offset = Math.abs(x - pathX(z))
    if (offset < 3.5 || Math.abs(z - river(x)) < 3.2 ||
      distance({x,z}, sentinelSite) < 9 || distance({x,z}, mira) < 3 || distance({x,z}, wardenSite) < 8) continue
    const north = z < -54
    const h = .27 + seed(i, 94) ** 2 * (north && offset > 12 ? 4.5 : 1.85)
    const model = north ? i % 5 === 0 ? 'TreeStump' : 'Rock_5' : i % 4 === 0 ? 'Bush_2' : 'Rock_Moss_3'
    if (crowdsShrine(model,x,z,h)) continue
    put(model, x, z, h, seed(i, 84) * 6.28, h * .29, .58 + seed(i, 81) * .38)
  }
  for (let i = 0; i < 2850; i++) {
    const z = -111 + seed(i, 21) * 157
    const x = (seed(i, 52) - .5) * (z < -55 ? 61 : 85)
    const delta = Math.abs(z - river(x))
    const offset = Math.abs(x - pathX(z))
    if (delta < 3.4 || offset < 1.6 ||
      Math.abs(x-bridgeX) < bridge.halfWidth+.38 && z > bridge.min-.4 && z < bridge.max+.4 || z < -55 && (i % 2 === 0 || distance({x,z}, sentinelSite)<6)) continue
    if (z >= -54 && i % 25 === 0) {
      put('Flowers', x, z, .24 + seed(i, 92) * .24, i * 2.37, .025)
      continue
    }
    const h = .18 + seed(i, 92) * (delta < 7 ? .74 : .42)
    put('Grass_2', x, z, h, seed(i, 93) * 6.28, h * .062, .46 + seed(i, 20) * .49)
  }
  put('Houses_FirstAge_2_Level2', mira.x - 6, mira.z - 1.1, 4.4, 1.15, .24)

  for (const [name, items] of plants) {
    const short = name === 'Grass_2' || name === 'Flowers'
    const tall = name === 'PineTree_1' || name === 'PineTree_4' || name === 'BirchTree_2' || name === 'BirchTree_Dead_2'
    placeModels(scene, art[name], items, wind, short ? .17 : tall ? .024 : name === 'Bush_2' ? .07 : 0, !short)
  }
}

function stonework(scene: T.Scene, obstacles: CameraObstacle[]) {
  const gateway = new T.Group()
  const z = bridge.min - .7
  const x = bridgeX
  const y = floor(x,z)
  gateway.position.set(x,y,z)
  for (const side of [-1, 1]) {
    obstacles.push({x:x+side*3, z, base:y, top:y+3.8, radius:.92})
    piece(gateway, stone, shale, [1.9,1.9,1.8], [side*3.08,.5,0])
    piece(gateway, taper, grey, [1.2,3.06,1.2], [side*2.95,1.66,0])
    piece(gateway, stone, grey, [1.5,1.1,1.45], [side*2.93,3.26,0])
    piece(gateway, oct, ember, [.24,.46,.24], [side*2.87,2.96,.69])
  }
  for (let i = 0; i < 12; i++) {
    const u = Math.PI * i / 11
    const key = piece(gateway, stone, i % 3 ? grey : shale,
      [1.06,1.25,1.32], [Math.cos(u)*2.86,3.1+Math.sin(u)*2.44,0])
    obstacles.push({x:x+key.position.x,z,base:y+key.position.y-.7,top:y+key.position.y+.7,radius:.71})
    key.rotation.z = u
  }
  scene.add(gateway)
  const deck = new T.Group()
  const span = bridge.max - bridge.min
  const count = 34
  const gap = span / count
  const postInterval = 6
  for (let i = 0; i < count; i++) {
    const z = bridge.min + (i + .5) * gap
    const h = bridgeHeight(z)
    const board = piece(deck, box, i % 3 === 0 ? bark : leather,
      [bridge.halfWidth * 2,.16,gap - .014],[bridgeX,h-.081,z])
    board.rotation.x = -Math.atan2(bridgeHeight(z+.1)-bridgeHeight(z-.1),.2)
    if (i % postInterval !== 0 && i !== count - 1) continue
    const next = bridge.min + (Math.min(i + postInterval,count - 1) + .5) * gap
    for (const side of [-1,1]) {
      const x = bridgeX + side * 2.03
      piece(deck,taper,bark,[.19,1.04,.19],[x,h+.44,z])
      piece(deck,sphere,gold,[.2,.135,.2],[x,h+.95,z])
      obstacles.push({x,z,base:h,top:h+1,radius:.18})
      if (next > z) branch(deck,bark,[x,h+.77,z],[x,bridgeHeight(next)+.77,next],.122)
    }
  }
  for (const side of [-1,1]) {
    const x = bridgeX + side * 1.56
    for (let i=0; i<6; i++) {
      const z = bridge.min+i*span/6
      const next = z+span/6
      branch(deck,bark,[x,bridgeHeight(z)-.22,z],[x,bridgeHeight(next)-.22,next],.48)
    }
  }
  for (const z of [bridge.min+.67,bridge.max-.67]) {
    piece(deck,masonry,shale,[4.82,1.33,1.64],[bridgeX,bridgeHeight(z)-.72,z])
    piece(deck,box,grey,[4.59,.18,1.49],[bridgeX,bridgeHeight(z)-.22,z])
  }
  for (const z of [bridge.min+4.1,bridge.max-4.1]) {
    const h = bridgeHeight(z)
    for (const side of [-1,1]) {
      const x = bridgeX + side*1.61
      piece(deck,masonry,grey,[.86,.52,.84],[x,-.69,z])
      piece(deck,box,bark,[.33,h+.67,.36],[x,(h-.95)/2,z])
      branch(deck,bark,[x,h-.66,z],[bridgeX+side*.82,h-.21,z],.22)
    }
    piece(deck,box,leather,[4.23,.26,.52],[bridgeX,h-.29,z])
  }
  scene.add(deck)
  for (const side of [-1,1]) {
    for (let i = 0; i <= count; i++) {
      const z = bridge.min + i * gap
      const h = bridgeHeight(z)
      obstacles.push({x:bridgeX+side*2.03,z,base:h+.63,top:h+.88,radius:.148})
    }
  }
  for (let i = 0; i < 15; i++) {
    const angle = i / 15 * Math.PI * 2
    const x = wardenSite.x + Math.cos(angle) * 9.3
    const z = wardenSite.z + Math.sin(angle) * 8.4
    if (Math.abs(x - wardenSite.x)<2.8 && z>wardenSite.z) continue
    const h = 1.0 + seed(i, 54) * 2.25
    const y = floor(x,z)
    obstacles.push({x, z, base:y, top:y+h*.92, radius:.78})
    const ruin = piece(scene, stone, i%3 ? grey : shale, [1.28,h,1.3], [x,y+h*.38,z])
    ruin.rotation.set(.15 * Math.sin(i), i*.37, -.2*Math.cos(i))
  }
}

function northernRuins(scene: T.Scene, obstacles: CameraObstacle[]) {
  for (const [point, span, height] of [[passSite,4.45,5.2], [sentinelSite,7.6,6.1]] as const) {
    const z = point.z - (point === sentinelSite ? 7 : 0)
    for (const side of [-1, 1]) {
      const x = point.x + span * side, y = floor(x,z)
      for (let row = 0; row < 5; row++) {
        const h = height / 5
        const width = 2.61 - row*.17
        const block = piece(scene, masonry, row % 3 ? shale : grey,
          [width,h*1.12,2.19-row*.15], [x+side*row*.09,y+h*(row+.28),z])
        block.rotation.set(.031 * Math.sin(row), .17 * Math.cos(row) + side * .11, side * .054)
      }
      obstacles.push({x,z,base:y,top:y+height*.95,radius:1.38})
    }
  }
}

function brazier(scene: T.Scene, p: {x:number,z:number}) {
  const root = new T.Group()
  root.position.set(p.x, floor(p.x,p.z), p.z)
  piece(root, stone, grey, [1.31,1.93,1.26], [0,.8,0])
  piece(root, taper, gold, [.74,.31,.74], [0,1.72,0])
  piece(root, torus, gold, [1,1,.84], [0,1.86,0]).rotation.x = Math.PI / 2
  piece(root, sphere, shadeBlue, [.66,.28,.66], [0,1.86,0])
  const flame = piece(root, oct, ember, [.43,.72,.42], [0,2.08,0])
  const little = piece(root, sphere, new T.MeshBasicMaterial({color:0xfff0b1}), [.22,.48,.23], [0,2.06,0])
  scene.add(root)
  return { root, flame, little }
}
const torus = new T.TorusGeometry(.42,.052,7,20)
const shadeBlue = mat(0x375956)

function defenseRing(scene: T.Scene, site: Point, radius = 13, color = 0xbbf6d3) {
  const geometry = new T.RingGeometry(radius-.13,radius,128).rotateX(-Math.PI/2)
  const p = geometry.getAttribute('position')
  for (let i=0;i<p.count;i++) {
    const x=site.x+p.getX(i), z=site.z+p.getZ(i)
    p.setXYZ(i,x,floor(x,z)+.075,z)
  }
  const ring = new T.Mesh(geometry,new T.MeshBasicMaterial({
    color, side:T.DoubleSide, transparent:true, opacity:.69, depthWrite:false,
  }))
  ring.visible=false
  scene.add(ring)
  return ring
}

type Bot = { actor: Actor; tether?: T.Mesh; target: T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>; warning: GroundWarning; x: number; z: number }
export class SceneView {
  readonly scene = new T.Scene()
  readonly camera = new T.PerspectiveCamera(55,1,.1,150)
  readonly renderer: T.WebGLRenderer
  yaw = 0
  pitch = .31
  zoom = 6.8
  private boom = createCameraBoom()
  private cameraFraction = 1
  readonly obstacles: CameraObstacle[] = []
  private readonly eye = new T.Vector3()
  private readonly ray = new T.Raycaster()
  private readonly pointer = new T.Vector2()
  private hero: Actor
  private keeper: Actor
  private readonly staff = makeStaff()
  private readonly cloak: T.Group
  private readonly castArms: T.Object3D[]
  private readonly castBase = [new T.Quaternion(),new T.Quaternion()]
  private castPose = false
  private readonly wind = new FoliageWind(!matchMedia('(prefers-reduced-motion: reduce)').matches)
  private readonly sun = new T.DirectionalLight(0xffddad, 2.8)
  private readonly sunOffset = new T.Vector3(-14, 21, 9)
  private readonly shadowAnchor = new T.Vector3()
  private readonly shadowFocus = new T.Vector3()
  private sky = panorama(this.scene)
  private water = terrain(this.scene)
  private fires = beacons.map(p => brazier(this.scene,p))
  private anchors = anchorSites.map(p => brazier(this.scene,p))
  private defenseRings = [...beacons,...anchorSites].map(p=>defenseRing(this.scene,p))
  private signal = brazier(this.scene,watchSite)
  private bots = new Map<Enemy,Bot>()
  private wardSites = [...new Set(orders.flatMap(order=>order.jobs.filter(job=>job.kind==='ward').map(job=>job.post)))]
    .map(post=>({post,ring:defenseRing(this.scene,posts[post],10,0x78cfff)}))
  private scout: Actor
  private satchel = new T.Group()
  private relic = new T.Group()
  private runeStone = new T.Group()
  private fieldLight = new T.MeshBasicMaterial({color:0xe6b978})
  private flag = new T.Group()
  private wards: T.Group
  private time = 0
  private w = 1
  private h = 1
  private temp = new T.Vector3()
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  private readonly effects = new CombatEffects(this.scene)
  private readonly staffTrail = new StaffTrail()
  private staffTip = new T.Vector3()
  private lastHero?: { x: number; z: number }

  constructor(readonly canvas: HTMLCanvasElement, private readonly artwork: Artwork) {
    this.hero = new Actor(artwork.KnightCharacter, 1.94, 0, { Armor: 0x869eac, Boots: 0x735644 })
    this.keeper = new Actor(artwork.KnightCharacter, 1.94, 0, { Armor: 0x786061, Boots: 0x6d5140 })
    this.cloak = outfit(this.hero,'hero')
    outfit(this.keeper,'mira')
    this.scout = new Actor(artwork.KnightCharacter,1.78,0,{Armor:0x567858,Boots:0x4c372c})
    this.scene.add(this.scout.root,this.relic,this.runeStone)
    this.hero.root.add(this.satchel)
    piece(this.satchel,box,leather,[.36,.32,.19],[0,1.13,-.28])
    piece(this.satchel,box,gold,[.09,.3,.2],[0,1.14,-.28])
    piece(this.relic,box,leather,[.71,.44,.46],[0,.28,0])
    for(const x of [-.23,.23]) piece(this.relic,box,gold,[.08,.46,.48],[x,.28,0])
    piece(this.runeStone,masonry,shale,[.9,1.26,.52],[0,.61,0])
    for(let i=0;i<3;i++) piece(this.runeStone,oct,this.fieldLight,[.14,.25,.13],[(i-1)*.19,.68,.23])
    this.keeper.root.scale.setScalar(.95)
    // The curled fingers move relative to the palm in these clips. Mount at the
    // center of their opening, measured in the palm frame of Idle_swordRight.
    const palm = this.hero.model.getObjectByName('PalmR')!
    const unit = palm.getWorldScale(new T.Vector3()).x
    palm.add(this.staff)
    this.staff.scale.setScalar(1 / unit)
    this.staff.position.set(-.007,.067,-.045).divideScalar(unit)
    this.staff.quaternion.setFromUnitVectors(new T.Vector3(0,1,0), new T.Vector3(-.974,.198,.11).normalize())
    this.hero.animate('Idle_swordRight',.13)
    this.castArms = ['UpperArmR','UpperArmL'].map(name => this.hero.model.getObjectByName(name)!)
    this.renderer = new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'})
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.55))
    this.renderer.toneMapping = T.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.07
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = T.PCFShadowMap
    this.renderer.shadowMap.autoUpdate = true
    this.scene.fog = new T.Fog(0xbcc8bb, 25, 107)
    const shadow = this.sun.shadow
    this.sun.castShadow = true
    const resolution = matchMedia('(pointer: coarse)').matches ? 768 : 1536
    shadow.mapSize.set(resolution,resolution)
    Object.assign(shadow.camera,{left:-20,right:20,top:20,bottom:-20,near:.5,far:65})
    shadow.normalBias = .047
    shadow.bias = -.00018
    shadow.radius = 1.9
    this.scene.add(this.sun,this.sun.target,new T.HemisphereLight(0xb7d7f1,0x8d7653,1.36))
    cover(this.scene,this.obstacles,artwork,this.wind)
    stonework(this.scene,this.obstacles)
    northernRuins(this.scene,this.obstacles)
    for (const {root} of [...this.fires,...this.anchors,this.signal]) {
      const {x,y,z} = root.position
      this.obstacles.push({x,z,base:y,top:y+2.45,radius:.79})
    }
    this.scene.add(this.hero.root, this.keeper.root, this.flag, this.staffTrail.mesh)
    this.keeper.root.position.set(mira.x,floor(mira.x,mira.z),mira.z)
    this.keeper.root.rotation.y = .73
    const fire = brazier(this.scene,{x:mira.x-2.2,z:mira.z-.8})
    const campFire=fire.root.position
    this.obstacles.push({x:campFire.x,z:campFire.z,base:campFire.y,top:campFire.y+2.2,radius:.79})
    fire.flame.scale.set(.35,.57,.35)
    piece(this.flag,oct,ember,[.26,.35,.26],[0,2.67,0])
    patch(this.flag,thinRing,new T.MeshBasicMaterial({ color:0xffdb8c,opacity:.79,transparent:true,depthWrite:false }), .86)
    this.wards = new T.Group()
    this.wards.position.set(bridgeX,floor(bridgeX,bridge.max),bridge.max-.29)
    for (let i=0;i<7;i++) {
      const g = piece(this.wards,plane,new T.MeshBasicMaterial({color:0x9ce6ec,opacity:.23,transparent:true,side:T.DoubleSide,depthWrite:false}),[.14,2.44,1],[i*.63-1.89,1.21,0])
      g.rotation.z = -.11
    }
    this.scene.add(this.wards)
    new ResizeObserver(()=>this.resize()).observe(canvas)
    this.resize()
  }

  reset() {
    this.boom.active = false
    this.cameraFraction = 1
    this.yaw = 0
    this.pitch = .31
    this.zoom = 6.8
    this.lastHero = undefined
    this.staffTrail.clear()
  }

  private resize() {
    this.w = this.canvas.clientWidth
    this.h = this.canvas.clientHeight
    if (!this.w || !this.h) return
    this.camera.aspect = this.w / this.h
    this.camera.fov = this.camera.aspect < .8 ? 67 : 55
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(this.w,this.h,false)
  }

  orbit(dx:number,dy:number) {
    this.yaw -= dx * .0077
    this.pitch = T.MathUtils.clamp(this.pitch - dy * .0045,.07,.71)
  }

  toward(point: {x:number,z:number}, hero: {x:number,z:number}) {
    this.yaw = Math.atan2(hero.x - point.x, hero.z - point.z)
  }

  scroll(delta:number) { this.zoom = T.MathUtils.clamp(this.zoom + delta*.006,3.25,10.6) }
  move(x:number,z:number) { return { x:x*Math.cos(this.yaw)+z*Math.sin(this.yaw), z:-x*Math.sin(this.yaw)+z*Math.cos(this.yaw) } }

  private newBot(enemy: Enemy) {
    const boss = isBoss(enemy.kind)
    const sentry = enemy.kind === 'sentry'
    const model = enemy.kind === 'hound' ? 'Wolf' : sentry ? 'KnightCharacter' : enemy.kind === 'warden' ? 'Stag' : 'Bull'
    const colors: Record<string, number> = model === 'Wolf' ? { Main: 0x48505b, Main_Light: 0xa7aeb8 } :
      model === 'Stag' ? { 'Material.001': 0xa4c7bf, 'Material.003': 0x595a56 } :
      sentry ? { Armor:0x473838,Boots:0x5e4942 } : { Main: 0x443730, Horns: 0xf3c686, Main_Light: 0x9c6150 }
    const actor = new Actor(this.artwork[model], boss ? model === 'Stag' ? 2.9 : 2.39 : sentry ? 1.94 : 1.03, 0, colors)
    if (sentry) outfit(actor,'sentry')
    this.scene.add(actor.root)
    const target = patch(actor.root, thinRing, new T.MeshBasicMaterial({
      color: 0xffd388, transparent: true, opacity: .86, depthWrite: false,
    }), boss ? 1.35 : .71)
    const warning = new GroundWarning()
    this.scene.add(warning.mesh)
    const tether = sentry ? new T.Mesh(mendThread,mendGlow) : undefined
    if (tether) { tether.visible = false; this.scene.add(tether) }
    const entry = { actor, target, warning, tether, x: enemy.x, z: enemy.z }
    this.bots.set(enemy,entry)
    return entry
  }

  draw(game:Trek,dt:number,coverScreen=false) {
    this.time+=dt
    this.water.uniforms.time.value=this.time
    const h=game.hero
    const height=floor(h.x,h.z)
    this.wind.update(this.time,h.x,h.z)
    this.shadowFocus.set(h.x,height,h.z)
    snapShadowAnchor(this.sunOffset,this.shadowFocus,shadowTexelWorldSize(40,this.sun.shadow.mapSize.x),this.shadowAnchor)
    this.sun.target.position.copy(this.shadowAnchor)
    this.sun.position.copy(this.shadowAnchor).add(this.sunOffset)
    const yaw=coverScreen ? -.38 : this.yaw
    const pace=this.reducedMotion ? 4 : 1
    const pivotX=h.x + (coverScreen ? -2.0 : 0)
    const pivotY=height+(coverScreen ? 1.72 : 1.64)
    stepCameraBoom(this.boom,pivotX,pivotY,h.z,dt,pace)
    const d=coverScreen?7.9:this.zoom
    const pitch=coverScreen?.23:this.pitch
    const shoulder = coverScreen ? 0 : this.camera.aspect < .8 ? .56 : 1.1
    const sideX = Math.cos(yaw) * shoulder
    const sideZ = -Math.sin(yaw) * shoulder
    this.eye.set(
      this.boom.x+Math.sin(yaw)*Math.cos(pitch)*d+sideX,
      this.boom.y + Math.sin(pitch)*d,
      this.boom.z+Math.cos(yaw)*Math.cos(pitch)*d+sideZ,
    )
    const origin = {x:pivotX, y:pivotY, z:h.z}
    const clear = clearCameraFraction(origin, this.eye, this.obstacles)
    this.cameraFraction = Math.min(clear, this.cameraFraction + dt * 1.65)
    this.camera.position.set(
      T.MathUtils.lerp(origin.x,this.eye.x,this.cameraFraction),
      T.MathUtils.lerp(origin.y,this.eye.y,this.cameraFraction),
      T.MathUtils.lerp(origin.z,this.eye.z,this.cameraFraction),
    )
    this.camera.lookAt(this.boom.x - Math.sin(yaw)*2.5+sideX,this.boom.y+.46,this.boom.z - Math.cos(yaw)*2.5+sideZ)
    this.sky.position.copy(this.camera.position)
    this.hero.root.position.set(h.x,height,h.z)
    this.hero.root.visible = coverScreen || this.camera.position.distanceToSquared(this.hero.root.position) > 4.7
    this.hero.root.rotation.y=h.yaw
    const moved = this.lastHero ? Math.hypot(h.x - this.lastHero.x, h.z - this.lastHero.z) : 0
    if (this.lastHero) { this.lastHero.x = h.x; this.lastHero.z = h.z }
    else this.lastHero = { x: h.x, z: h.z }
    const stride = dt > 0 ? Math.min(1, moved / (dt * 6.9)) : h.movement
    const action = game.action
    if (this.castPose) {
      this.castArms.forEach((arm,i)=>arm.quaternion.copy(this.castBase[i]))
      this.castPose = false
    }
    if (action) {
      const progress = action.age / actionLength[action.skill]
      if (action.skill === 'roll') this.hero.animate('Roll_sword',dt,1,progress)
      else if (action.skill === 'strike') {
        const contact = strikeContact / actionLength.strike
        const clipContact = action.reverse ? .35 : .445
        const position = progress < contact ? progress / contact * clipContact :
          clipContact + (progress - contact) / (1 - contact) * (1 - clipContact)
        this.hero.animate(action.reverse ? 'Run_swordAttack' : 'swordAttackJump',dt,1,position)
      } else {
        this.hero.animate('Idle_swordRight',dt)
        const raise = Math.sin(Math.PI * progress)
        this.castArms.forEach((arm,i)=>this.castBase[i].copy(arm.quaternion))
        this.castPose = true
        this.castArms[0].rotateX(-raise * .69)
        this.castArms[1].rotateX(-raise * (action.skill === 'heal' ? .85 : .32))
      }
    } else this.hero.animate(stride > .06 ? 'Run_swordRight' : 'Idle_swordRight',dt,.85 + stride*.29)
    this.keeper.animate('Idle',dt)
    this.cloak.rotation.x = this.reducedMotion ? 0 : .28 * stride + Math.sin(this.time*4.1)*(.015+.044*stride)
    this.staff.localToWorld(this.staffTip.set(0,.85,0))
    this.staffTrail.update(action,this.time,this.staff,this.staffTip,this.reducedMotion)
    for (const [i,f] of this.fires.entries()) {
      f.flame.visible=f.little.visible=game.lit[i] || game.quest==='light' && game.ritual?.index===i
      f.flame.rotation.y=this.time*1.7
      f.flame.position.y=2.13+Math.sin(this.time*7+i)*.07
    }
    for (const [i,f] of this.anchors.entries()) {
      f.flame.visible=f.little.visible=!game.anchors[i]
      f.flame.rotation.y=-this.time*1.7
      f.flame.position.y=2.13+Math.sin(this.time*5+i)*.09
    }
    const active = game.ritual ? game.ritual.index + (game.quest==='anchors' ? beacons.length : 0) : -1
    for (const [i,ring] of this.defenseRings.entries()) ring.visible = active === i
    for(const {post,ring} of this.wardSites) ring.visible=game.wardActive && game.job.post===post
    const onDuty=game.quest==='orders'
    this.satchel.visible=game.cargo
    this.relic.visible=onDuty && game.job.kind==='haul' && !game.field.started
    this.runeStone.visible=onDuty && game.job.kind==='cipher' && !game.field.decoded
    this.scout.root.visible=onDuty && game.job.kind==='rescue' && !game.field.decoded
    if(onDuty) {
      const site=game.dutySite
      this.fieldLight.color.setHex(game.order.color)
      for(const prop of [this.relic,this.runeStone]) if(prop.visible) prop.position.set(site.x,floor(site.x,site.z),site.z)
      if(this.scout.root.visible) {
        this.scout.root.position.set(site.x,floor(site.x,site.z)+.28,site.z)
        this.scout.root.rotation.z=-1.25
        this.scout.animate('Idle',dt*.45)
      }
    }
    const lit = game.chapter >= 2 && game.quest !== 'pass'
    this.signal.flame.visible = this.signal.little.visible = lit
    this.signal.flame.rotation.y = this.time * 1.7
    this.wards.visible=!game.opened
    const focus=game.objective
    const fightingWarden = game.warden && distance(h, game.warden) < 12
    this.flag.visible = !coverScreen && game.quest !== 'hunt' && game.quest !== 'watch' && game.quest !== 'clear' && game.quest !== 'dawn' && !fightingWarden && !game.ritual
    this.flag.position.set(focus.x,floor(focus.x,focus.z),focus.z)
    this.flag.children[0].rotation.y=this.time*1.3
    this.flag.children[0].position.y=2.83+Math.sin(this.time*2.86)*.14

    for(const [enemy,bot] of this.bots) if(!game.enemies.includes(enemy)){
      this.scene.remove(bot.actor.root)
      if (bot.tether) this.scene.remove(bot.tether)
      bot.actor.dispose()
      bot.target.material.dispose()
      bot.warning.dispose()
      this.bots.delete(enemy)
    }
    for(const enemy of game.enemies){
      const bot=this.bots.get(enemy)??this.newBot(enemy)
      const alive=enemy.hp>0
      const ey=floor(enemy.x,enemy.z)
      const { actor } = bot
      actor.root.position.set(enemy.x,ey,enemy.z)
      actor.root.rotation.y = enemy.yaw
      const speed = dt > 0 ? Math.hypot(enemy.x-bot.x,enemy.z-bot.z) / dt : 0
      bot.x = enemy.x
      bot.z = enemy.z
      const boss = isBoss(enemy.kind)
      const sentry = enemy.kind === 'sentry'
      const wind = enemy.intent ? telegraphFillOf(enemy.intent.time,casts[enemy.intent.kind].seconds) : 0
      const attack = boss ? 'Attack_Headbutt' : sentry ? 'Run_swordAttack' : 'Attack'
      const headlow = boss ? 'Idle_Headlow' : sentry ? 'Idle_swordRight' : 'Idle_2_HeadLow'
      if (!alive) actor.animate('Death',dt,1,undefined,true)
      else if (enemy.intent) actor.animate(headlow,dt,.74)
      else if (enemy.release > 0) actor.animate(attack,dt,1,1 - enemy.release / .24)
      else if (enemy.reaction > 0) actor.animate('Idle_HitReact_Left',dt,1,1 - enemy.reaction / .2)
      else actor.animate(speed > .15 ? sentry ? 'Walking' : 'Gallop' : 'Idle',dt,speed > .15 ? Math.min(1.68,speed*.38) : 1)
      actor.body.rotation.x = -wind * (sentry ? .058 : .18)
      bot.target.visible=alive&&game.selected===enemy.id
      if (bot.tether) {
        const ally = alive && enemy.intent?.kind === 'mend' && game.enemies.find(other=>other.hp > 0 && other.id === enemy.intent!.allyId)
        bot.tether.visible = !!ally
        if (ally) {
          const start = bot.tether.position.set(enemy.x,ey+1.2,enemy.z)
          const direction = this.temp.set(ally.x,floor(ally.x,ally.z)+(isBoss(ally.kind) ? 1.5 : .7),ally.z).sub(start)
          start.addScaledVector(direction,.5)
          bot.tether.scale.set(1+wind,direction.length(),1+wind)
          bot.tether.quaternion.setFromUnitVectors(up,direction.normalize())
        }
      }
      bot.warning.update(enemy, alive ? enemy.intent : undefined, this.time, this.reducedMotion)
    }
    this.effects.draw(game.effects, h, this.staffTip, this.reducedMotion)
    this.renderer.render(this.scene,this.camera)
  }

  visibleEnemies(game: Trek) {
    return game.enemiesAlive.filter(enemy => {
      const p = this.project(enemy.x, floor(enemy.x,enemy.z) + 1, enemy.z)
      return p.visible && p.x > 0 && p.x < this.w && p.y > 0 && p.y < this.h
    }).map(enemy => enemy.id)
  }

  pick(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect()
    this.pointer.set((clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2)
    this.ray.setFromCamera(this.pointer,this.camera)
    let best = Infinity
    let id = ''
    for (const [enemy,bot] of this.bots) {
      if (enemy.hp <= 0) continue
      const hit = this.ray.intersectObject(bot.actor.body,true)[0]
      if (hit && hit.distance < best && clearCameraFraction(this.ray.ray.origin, hit.point, this.obstacles) > .985) {
        best = hit.distance
        id = enemy.id
      }
    }
    return id
  }

  project(x:number,y:number,z:number) {
    this.temp.set(x,y,z).project(this.camera)
    return {x:(this.temp.x+1)*this.w*.5,y:(1-this.temp.y)*this.h*.5,visible:this.temp.z>-1&&this.temp.z<1}
  }
}
