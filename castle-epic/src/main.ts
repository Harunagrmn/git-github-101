import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createNoise2D } from 'simplex-noise'

// Scene setup
const app = document.getElementById('app') as HTMLDivElement
const container = document.createElement('div')
container.className = 'canvas-wrap'
app.appendChild(container)

const overlay = document.createElement('div')
overlay.className = 'fade-in'
app.appendChild(overlay)

const info = document.createElement('div')
info.className = 'info'
info.innerHTML = `
  <div><strong>Dağ Zirvesinde Masalsı Şato</strong></div>
  <div class="hint">Fare ile döndür/zoom. Space: Sinematik pan. C: Top atışı. P: Devriye başlat/durdur.</div>
`
app.appendChild(info)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
container.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0x0b0f1a, 0.04)
scene.background = new THREE.Color(0x0a0e19)

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000)
camera.position.set(-60, 35, 120)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.05
controls.maxPolarAngle = Math.PI * 0.49
controls.minDistance = 20
controls.maxDistance = 260

// Lights
const hemi = new THREE.HemisphereLight(0xbcc9ff, 0x0c0f16, 0.6)
scene.add(hemi)

const dirLight = new THREE.DirectionalLight(0xe8ecff, 1.3)
dirLight.position.set(-60, 110, 60)
dirLight.castShadow = true
const s = 120
dirLight.shadow.camera.left = -s
dirLight.shadow.camera.right = s
dirLight.shadow.camera.top = s
dirLight.shadow.camera.bottom = -s
; (dirLight.shadow.mapSize as THREE.Vector2).set(2048, 2048)
scene.add(dirLight)

// Mountain terrain with simplex noise
const noise2D = createNoise2D(() => 0.5 + Math.random() * 0.5)
function generateHeight(x: number, z: number): number {
  const scale = 0.035
  const n1 = noise2D(x * scale, z * scale)
  const n2 = noise2D(x * scale * 0.5, z * scale * 0.5) * 0.5
  const n3 = noise2D(x * scale * 0.25, z * scale * 0.25) * 0.25
  const h = (n1 + n2 + n3) * 22
  const radial = Math.max(0, 1 - Math.sqrt(x * x + z * z) / 180)
  return h * radial + 20 * radial
}

function buildMountain(): THREE.Mesh {
  const size = 300
  const segments = 200
  const geom = new THREE.PlaneGeometry(size, size, segments, segments)
  geom.rotateX(-Math.PI / 2)
  const pos = geom.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i)
    const vz = pos.getZ(i)
    const y = generateHeight(vx, vz)
    pos.setY(i, y)
  }
  pos.needsUpdate = true
  geom.computeVertexNormals()

  const mat = new THREE.MeshStandardMaterial({
    color: 0x3d475c,
    roughness: 0.95,
    metalness: 0.0,
  })
  const mesh = new THREE.Mesh(geom, mat)
  mesh.receiveShadow = true
  return mesh
}

const mountain = buildMountain()
scene.add(mountain)

// Plateau for castle top
const plateau = new THREE.Mesh(
  new THREE.CylinderGeometry(26, 70, 18, 8, 1),
  new THREE.MeshStandardMaterial({ color: 0x4b556e, roughness: 0.9 })
)
plateau.castShadow = true
plateau.receiveShadow = true
plateau.position.set(0, generateHeight(0, 0) + 14, 0)
scene.add(plateau)

// Castle group
const castle = new THREE.Group()
castle.position.copy(plateau.position)
scene.add(castle)

// Castle walls and towers
function buildTower(radius = 4, height = 22): THREE.Mesh {
  const geom = new THREE.CylinderGeometry(radius, radius * 1.05, height, 16)
  const mat = new THREE.MeshStandardMaterial({ color: 0x9ea7ba, roughness: 0.8 })
  const mesh = new THREE.Mesh(geom, mat)
  mesh.castShadow = true
  mesh.receiveShadow = true
  // Battlements
  const crown = new THREE.Group()
  const brickGeo = new THREE.BoxGeometry(radius * 0.6, 1.6, radius * 0.8)
  const brickMat = new THREE.MeshStandardMaterial({ color: 0xcad1e2, roughness: 0.75 })
  const num = 12
  for (let i = 0; i < num; i++) {
    const b = new THREE.Mesh(brickGeo, brickMat)
    const a = (i / num) * Math.PI * 2
    b.position.set(Math.cos(a) * (radius + 0.6), height * 0.5 + 1, Math.sin(a) * (radius + 0.6))
    b.rotation.y = a
    b.castShadow = true
    crown.add(b)
  }
  mesh.add(crown)
  return mesh
}

function buildWall(length = 18, height = 10, thickness = 2.2): THREE.Mesh {
  const geom = new THREE.BoxGeometry(length, height, thickness)
  const mat = new THREE.MeshStandardMaterial({ color: 0xadb5c9, roughness: 0.88 })
  const mesh = new THREE.Mesh(geom, mat)
  mesh.castShadow = true
  mesh.receiveShadow = true
  // Merlons
  const merlonGeo = new THREE.BoxGeometry(1.5, 2, thickness + 0.4)
  const merlonMat = new THREE.MeshStandardMaterial({ color: 0xd7ddee, roughness: 0.8 })
  for (let i = -length / 2 + 1.5; i <= length / 2 - 1.5; i += 3) {
    const m = new THREE.Mesh(merlonGeo, merlonMat)
    m.position.set(i, height / 2 + 1.2, 0)
    m.castShadow = true
    mesh.add(m)
  }
  return mesh
}

// Layout: square castle with four towers
const towerPositions: THREE.Vector3[] = [
  new THREE.Vector3(-12, 0, -12),
  new THREE.Vector3(12, 0, -12),
  new THREE.Vector3(12, 0, 12),
  new THREE.Vector3(-12, 0, 12),
]

for (const p of towerPositions) {
  const t = buildTower(3.6, 16)
  t.position.copy(p).add(new THREE.Vector3(0, 9, 0))
  castle.add(t)
}

const wallNS = buildWall(24, 10, 2)
wallNS.position.set(0, 9, -12)
castle.add(wallNS)

const wallSS = buildWall(24, 10, 2)
wallSS.position.set(0, 9, 12)
castle.add(wallSS)

const wallWE = buildWall(24, 10, 2)
wallWE.rotation.y = Math.PI / 2
wallWE.position.set(-12, 9, 0)
castle.add(wallWE)

const wallEW = buildWall(24, 10, 2)
wallEW.rotation.y = Math.PI / 2
wallEW.position.set(12, 9, 0)
castle.add(wallEW)

// Gatehouse
const gate = new THREE.Mesh(
  new THREE.BoxGeometry(8, 10, 3),
  new THREE.MeshStandardMaterial({ color: 0xb7bfd1, roughness: 0.85 })
)
gate.position.set(0, 9, 12)
castle.add(gate)

// Patrols: simple capsules walking on walls
const patrolGroup = new THREE.Group()
castle.add(patrolGroup)

function makeSoldier(): THREE.Mesh {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 1.6, 8, 12), new THREE.MeshStandardMaterial({ color: 0x485a7b }))
  body.castShadow = true
  g.add(body)
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), new THREE.MeshStandardMaterial({ color: 0x2f3a52, metalness: 0.2, roughness: 0.6 }))
  helm.position.y = 1.2
  helm.castShadow = true
  g.add(helm)
  const base = new THREE.Group()
  base.add(g)
  ;(base as unknown as THREE.Mesh).castShadow = true
  return base as unknown as THREE.Mesh
}

const patrolCount = 10
const patrols: { mesh: THREE.Object3D, t: number, lane: number }[] = []
for (let i = 0; i < patrolCount; i++) {
  const s = makeSoldier()
  const t = (i / patrolCount) * Math.PI * 2
  s.position.set(Math.cos(t) * 12, 11, Math.sin(t) * 12)
  patrolGroup.add(s)
  patrols.push({ mesh: s, t, lane: i % 2 })
}

let patrolEnabled = true

// Cannons on towers
function makeCannon(): THREE.Group {
  const cannon = new THREE.Group()
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.8, 4, 12),
    new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.6, roughness: 0.3 })
  )
  barrel.rotation.z = Math.PI / 2
  barrel.position.y = 1.6
  barrel.castShadow = true
  cannon.add(barrel)
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.2, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x383d45, roughness: 0.8 })
  )
  base.castShadow = true
  cannon.add(base)
  return cannon
}

const cannons: THREE.Object3D[] = []
for (const p of towerPositions) {
  const c = makeCannon()
  c.position.copy(p).add(new THREE.Vector3(0, 12, 0))
  c.lookAt(c.position.clone().add(new THREE.Vector3(0, 0, -1)))
  castle.add(c)
  cannons.push(c)
}

// Cannonballs
const cannonballs: { mesh: THREE.Mesh, vel: THREE.Vector3, alive: boolean }[] = []
const cannonballGeo = new THREE.SphereGeometry(0.4, 12, 12)
const cannonballMat = new THREE.MeshStandardMaterial({ color: 0x1f232a, metalness: 0.3, roughness: 0.4 })

function fireCannon(from: THREE.Object3D, target: THREE.Vector3) {
  const m = new THREE.Mesh(cannonballGeo, cannonballMat)
  m.castShadow = true
  m.position.copy(from.position)
  scene.add(m)
  const dir = target.clone().sub(from.position).normalize()
  const speed = 42
  const vel = dir.multiplyScalar(speed)
  vel.y += 22
  cannonballs.push({ mesh: m, vel, alive: true })
}

function randomMountainPoint(): THREE.Vector3 {
  // pick random xz and project to surface
  const x = THREE.MathUtils.randFloatSpread(280)
  const z = THREE.MathUtils.randFloatSpread(280)
  const y = generateHeight(x, z) + 2
  return new THREE.Vector3(x, y, z)
}

function volley() {
  for (const c of cannons) {
    fireCannon(c, randomMountainPoint())
  }
}

// People and horses moving in courtyard
const courtyard = new THREE.Group()
courtyard.position.set(0, 9.2, 0)
castle.add(courtyard)

function makePerson(color = 0xdadceb): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.9, 8, 12), new THREE.MeshStandardMaterial({ color }))
  body.castShadow = true
  g.add(body)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), new THREE.MeshStandardMaterial({ color: 0xffe0bd }))
  head.position.y = 0.9
  head.castShadow = true
  g.add(head)
  return g
}

function makeHorse(): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 0.6), new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.9 }))
  body.position.y = 0.7
  body.castShadow = true
  g.add(body)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x6b4a2c }))
  head.position.set(1.1, 1.0, 0)
  head.castShadow = true
  g.add(head)
  const legGeo = new THREE.BoxGeometry(0.18, 0.9, 0.18)
  for (let i = 0; i < 4; i++) {
    const leg = new THREE.Mesh(legGeo, new THREE.MeshStandardMaterial({ color: 0x4b3420 }))
    leg.position.set(i < 2 ? -0.6 : 0.6, 0.25, i % 2 === 0 ? -0.2 : 0.2)
    leg.castShadow = true
    g.add(leg)
  }
  return g
}

const movers: { mesh: THREE.Object3D, speed: number, radius: number, angle: number }[] = []
for (let i = 0; i < 12; i++) {
  const person = makePerson(0xd0d6f3)
  person.position.y = 0
  courtyard.add(person)
  movers.push({ mesh: person, speed: 0.3 + Math.random() * 0.3, radius: 4 + Math.random() * 6, angle: Math.random() * Math.PI * 2 })
}
for (let i = 0; i < 4; i++) {
  const horse = makeHorse()
  courtyard.add(horse)
  movers.push({ mesh: horse, speed: 0.25 + Math.random() * 0.2, radius: 6 + Math.random() * 8, angle: Math.random() * Math.PI * 2 })
}

// Cloud layer: billboards gently drifting
const cloudGroup = new THREE.Group()
scene.add(cloudGroup)

function makeCloud(): THREE.Mesh {
  const geom = new THREE.SphereGeometry(1, 8, 8)
  const mat = new THREE.MeshLambertMaterial({ color: 0xf0f6ff, transparent: true, opacity: 0.75 })
  const g = new THREE.Group()
  const puffs: THREE.Mesh[] = []
  for (let i = 0; i < 5; i++) {
    const s = 0.8 + Math.random() * 1.3
    const p = new THREE.Mesh(geom, mat)
    p.scale.set(s * 1.8, s, s * 1.8)
    p.position.set(Math.random() * 3 - 1.5, Math.random() * 0.6, Math.random() * 3 - 1.5)
    puffs.push(p)
    g.add(p)
  }
  const mesh = new THREE.Mesh()
  mesh.add(g)
  ;(mesh as any).puffs = puffs
  return mesh
}

for (let i = 0; i < 40; i++) {
  const c = makeCloud()
  const r = 120 + Math.random() * 120
  const a = Math.random() * Math.PI * 2
  c.position.set(Math.cos(a) * r, 60 + Math.random() * 40, Math.sin(a) * r)
  c.rotation.y = Math.random() * Math.PI * 2
  cloudGroup.add(c)
}

// Snow particles for atmosphere
const snowGeo = new THREE.BufferGeometry()
const snowCount = 1500
const snowPositions = new Float32Array(snowCount * 3)
for (let i = 0; i < snowCount; i++) {
  snowPositions[i * 3 + 0] = THREE.MathUtils.randFloatSpread(400)
  snowPositions[i * 3 + 1] = Math.random() * 180
  snowPositions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(400)
}
snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3))
const snowMat = new THREE.PointsMaterial({ color: 0xe9f2ff, size: 0.6, sizeAttenuation: true, transparent: true, opacity: 0.8 })
const snow = new THREE.Points(snowGeo, snowMat)
scene.add(snow)

// Ground near camera for depth
const nearGround = new THREE.Mesh(
  new THREE.CircleGeometry(140, 64),
  new THREE.MeshStandardMaterial({ color: 0x2b3347, roughness: 0.98 })
)
nearGround.rotation.x = -Math.PI / 2
nearGround.position.set(0, 0.2, 120)
nearGround.receiveShadow = true
scene.add(nearGround)

// Cinematic pan animation
let cinematic = true
let cinematicTime = 0

function toggleCinematic() {
  cinematic = !cinematic
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') toggleCinematic()
  if (e.code === 'KeyC') volley()
  if (e.code === 'KeyP') patrolEnabled = !patrolEnabled
})

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// Helpers

// Main loop
const clock = new THREE.Clock()
function animate() {
  const dt = Math.min(0.033, clock.getDelta())

  // Cinematic camera orbit and push-in
  if (cinematic) {
    cinematicTime += dt
    const radius = 150 - Math.min(60, cinematicTime * 12)
    const angle = cinematicTime * 0.15
    const y = 40 + Math.sin(cinematicTime * 0.25) * 8
    const lookAt = castle.position.clone().add(new THREE.Vector3(0, 8, 0))
    camera.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
    camera.lookAt(lookAt)
    controls.target.copy(lookAt)
  }

  controls.update()

  // Patrols around the walls (circular path)
  if (patrolEnabled) {
    for (const p of patrols) {
      p.t += dt * (0.25 + p.lane * 0.05)
      const r = 12 + (p.lane ? 0.6 : -0.6)
      p.mesh.position.set(Math.cos(p.t) * r, 11, Math.sin(p.t) * r)
      ;(p.mesh as THREE.Object3D).rotation.y = -p.t + Math.PI / 2
    }
  }

  // Cannonball integration with gravity
  for (const c of cannonballs) {
    if (!c.alive) continue
    c.vel.y -= 9.8 * dt
    c.mesh.position.addScaledVector(c.vel, dt)
    // Hit ground
    const groundY = generateHeight(c.mesh.position.x, c.mesh.position.z) + 0.3
    if (c.mesh.position.y <= groundY) {
      c.mesh.position.y = groundY
      c.alive = false
      // simple puff: spread snow nearby
      for (let i = 0; i < 30; i++) {
        const idx = Math.floor(Math.random() * snowCount)
        const base = idx * 3
        snowPositions[base + 0] = c.mesh.position.x + THREE.MathUtils.randFloatSpread(6)
        snowPositions[base + 1] = groundY + Math.random() * 6
        snowPositions[base + 2] = c.mesh.position.z + THREE.MathUtils.randFloatSpread(6)
      }
      ;(snow.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    }
  }

  // Clear dead cannonballs occasionally
  for (let i = cannonballs.length - 1; i >= 0; i--) {
    if (!cannonballs[i].alive && Math.random() < 0.03) {
      scene.remove(cannonballs[i].mesh)
      cannonballs.splice(i, 1)
    }
  }

  // Courtyard movers
  for (const m of movers) {
    m.angle += dt * m.speed
    const x = Math.cos(m.angle) * m.radius
    const z = Math.sin(m.angle) * m.radius
    m.mesh.position.set(x, 0.05, z)
    ;(m.mesh as THREE.Object3D).rotation.y = -m.angle
  }

  // Clouds drift
  cloudGroup.children.forEach((c, i) => {
    c.position.x += Math.sin(clock.elapsedTime * 0.05 + i) * 0.005
    c.position.z += Math.cos(clock.elapsedTime * 0.04 + i) * 0.006
    c.rotation.y += 0.0008
  })

  // Snowfall
  for (let i = 0; i < snowCount; i++) {
    const base = i * 3
    snowPositions[base + 1] -= 12 * dt
    if (snowPositions[base + 1] < 0) {
      snowPositions[base + 0] = THREE.MathUtils.randFloatSpread(400)
      snowPositions[base + 1] = 160 + Math.random() * 40
      snowPositions[base + 2] = THREE.MathUtils.randFloatSpread(400)
    }
  }
  ;(snow.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true

  // Gentle overlay fade
  overlay.style.opacity = String(Math.max(0, 1.2 - clock.elapsedTime * 0.35))

  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}

// Kickoff volley and animation
setTimeout(() => volley(), 2400)
requestAnimationFrame(animate)
