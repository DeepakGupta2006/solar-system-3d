// ---------------------------------------------------------------------------
//  3D Solar System — Three.js
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makers, setAnisotropy, glowTexture, galaxyTexture, starSprite } from './textures.js';

const TAU = Math.PI * 2;
const $ = (id) => document.getElementById(id);
const tick = () => new Promise((r) => setTimeout(r, 16));

// ---------------------------------------------------------------------------
//  Planet data (sizes & distances are stylised so everything stays visible)
// ---------------------------------------------------------------------------
const SUN_RADIUS = 12;

const PLANETS = [
  { name: 'Mercury', maker: 'mercury', r: 1.1, a: 21,  e: 0.20, incl: 7.0, years: 0.24, spinH: 1407, tilt: 0.03, phase: 0.5,
    info: { Diameter: '4,879 km', 'From Sun': '57.9 M km', Year: '88 days', Day: '59 Earth days', Moons: '0', Temp: '−180 to 430 °C' },
    fact: 'The smallest planet and the fastest, racing around the Sun in just 88 days.' },
  { name: 'Venus', maker: 'venus', r: 1.9, a: 30, e: 0.03, incl: 3.4, years: 0.615, spinH: 5832, tilt: 3.09, phase: 2.0,
    atmo: { color: [1.0, 0.78, 0.4], power: 2.6, k: 1.1, scale: 1.05 },
    info: { Diameter: '12,104 km', 'From Sun': '108 M km', Year: '225 days', Day: '243 Earth days', Moons: '0', Temp: '465 °C' },
    fact: 'Hottest planet. It spins backwards, so the Sun rises in the west.' },
  { name: 'Earth', maker: 'earth', r: 2.1, a: 41, e: 0.03, incl: 0, years: 1, spinH: 24, tilt: 0.41, phase: 3.6,
    atmo: { color: [0.3, 0.55, 1.0], power: 2.4, k: 1.7, scale: 1.07 },
    info: { Diameter: '12,742 km', 'From Sun': '149.6 M km', Year: '365.25 days', Day: '24 hours', Moons: '1', Temp: '15 °C avg' },
    fact: 'The only known world with liquid oceans on its surface — and life.' },
  { name: 'Mars', maker: 'mars', r: 1.5, a: 52, e: 0.10, incl: 1.9, years: 1.88, spinH: 24.6, tilt: 0.44, phase: 5.0,
    atmo: { color: [1.0, 0.6, 0.4], power: 3.2, k: 0.55, scale: 1.04 },
    info: { Diameter: '6,779 km', 'From Sun': '227.9 M km', Year: '687 days', Day: '24.6 hours', Moons: '2', Temp: '−65 °C avg' },
    fact: 'Home to Olympus Mons, the tallest volcano in the Solar System.' },
  { name: 'Jupiter', maker: 'jupiter', r: 6.2, a: 92, e: 0.05, incl: 1.3, years: 11.86, spinH: 9.9, tilt: 0.05, phase: 1.0,
    info: { Diameter: '139,820 km', 'From Sun': '778.5 M km', Year: '11.9 years', Day: '9.9 hours', Moons: '95+', Temp: '−110 °C' },
    fact: 'Twice as massive as all other planets combined. The Great Red Spot is a storm wider than Earth.' },
  { name: 'Saturn', maker: 'saturn', r: 5.2, a: 124, e: 0.06, incl: 2.5, years: 29.4, spinH: 10.7, tilt: 0.47, phase: 4.0, rings: [6.8, 11.8],
    info: { Diameter: '116,460 km', 'From Sun': '1,434 M km', Year: '29.4 years', Day: '10.7 hours', Moons: '270+', Temp: '−140 °C' },
    fact: 'Its rings span 280,000 km yet are often only ~10 metres thick.' },
  { name: 'Uranus', maker: 'uranus', r: 3.3, a: 152, e: 0.05, incl: 0.8, years: 84, spinH: 17.2, tilt: 1.71, phase: 2.6,
    atmo: { color: [0.5, 0.9, 1.0], power: 3.0, k: 0.8, scale: 1.04 },
    info: { Diameter: '50,724 km', 'From Sun': '2,871 M km', Year: '84 years', Day: '17.2 hours', Moons: '28', Temp: '−195 °C' },
    fact: 'Rolls around the Sun on its side — its axis is tilted almost 98°.' },
  { name: 'Neptune', maker: 'neptune', r: 3.2, a: 178, e: 0.02, incl: 1.8, years: 164.8, spinH: 16.1, tilt: 0.49, phase: 5.7,
    atmo: { color: [0.3, 0.5, 1.0], power: 3.0, k: 0.9, scale: 1.04 },
    info: { Diameter: '49,244 km', 'From Sun': '4,495 M km', Year: '165 years', Day: '16.1 hours', Moons: '16', Temp: '−200 °C' },
    fact: 'Supersonic winds of over 2,000 km/h make it the windiest planet.' },
];

const SUN_INFO = {
  name: 'Sun',
  info: { Diameter: '1,391,000 km', Type: 'G2V yellow dwarf', Surface: '5,500 °C', Core: '15 million °C', Age: '4.6 billion yr', Mass: '99.86 % of system' },
  fact: 'A glowing ball of hydrogen and helium that fuses 600 million tonnes of hydrogen every second.',
};

// ---------------------------------------------------------------------------
//  Renderer / scene / camera / post-processing
// ---------------------------------------------------------------------------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 5000);
const HOME_POS = new THREE.Vector3(0, 95, 200);
camera.position.copy(HOME_POS);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 3;
controls.maxDistance = 800;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.25;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.65, 0.6, 1.1);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// Lights: the Sun is a point light with no distance fall-off so outer planets stay readable
scene.add(new THREE.AmbientLight(0x3a4a77, 0.32));
const sunLight = new THREE.PointLight(0xfff0dd, 4.6, 0, 0);
scene.add(sunLight);

// ---------------------------------------------------------------------------
//  Shaders
// ---------------------------------------------------------------------------
const VERT_WORLD = /* glsl */`
  varying vec2 vUv; varying vec3 vN; varying vec3 vW;
  void main() {
    vUv = uv;
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const EARTH_FRAG = /* glsl */`
  uniform sampler2D dayMap, nightMap, specMap;
  varying vec2 vUv; varying vec3 vN; varying vec3 vW;
  void main() {
    vec3 N = normalize(vN);
    vec3 L = normalize(-vW);                 // Sun sits at the origin
    vec3 V = normalize(cameraPosition - vW);
    float ndl = dot(N, L);
    vec3 day = texture2D(dayMap, vUv).rgb;
    vec3 lights = texture2D(nightMap, vUv).rgb;
    float spec = texture2D(specMap, vUv).r;
    float dayAmt = smoothstep(-0.12, 0.18, ndl);
    vec3 col = day * (max(ndl, 0.0) * 1.43 + 0.05);
    // warm tint near the terminator
    col += day * vec3(1.0, 0.45, 0.2) * smoothstep(0.0, 0.25, ndl) * (1.0 - smoothstep(0.25, 0.5, ndl)) * 0.25;
    col += lights * (1.0 - dayAmt) * 2.2;
    vec3 H = normalize(L + V);
    col += vec3(1.0, 0.95, 0.85) * pow(max(dot(N, H), 0.0), 90.0) * spec * 1.4 * dayAmt;
    gl_FragColor = vec4(col, 1.0);
  }`;

const ATMO_FRAG = /* glsl */`
  uniform vec3 color; uniform float power; uniform float k;
  varying vec2 vUv; varying vec3 vN; varying vec3 vW;
  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vW);
    vec3 L = normalize(-vW);
    float rim = 1.0 - max(dot(N, V), 0.0);
    float lit = smoothstep(-0.25, 0.55, dot(N, L));
    float a = pow(rim, power) * lit * k;
    gl_FragColor = vec4(color * a, a);
  }`;

const SUN_VERT = /* glsl */`
  varying vec3 vPos; varying vec3 vN; varying vec3 vView;
  void main() {
    vPos = position;
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;

const SUN_FRAG = /* glsl */`
  uniform float time;
  varying vec3 vPos; varying vec3 vN; varying vec3 vView;
  float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x){
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++){ s += a * noise(p); p *= 2.02; a *= 0.5; } return s; }
  void main() {
    vec3 p = normalize(vPos);
    float t = time * 0.06;
    // boiling granulation
    float g1 = fbm(p * 4.0 + vec3(0.0, t, t * 0.5));
    float g2 = fbm(p * 9.0 - vec3(t * 1.4, 0.0, t));
    // large magnetic "plasma rivers"
    float flow = fbm(p * 2.0 + vec3(g1 * 1.2) + vec3(t * 0.4));
    float heat = clamp(g1 * 0.9 + g2 * 0.45 + flow * 0.4 - 0.2, 0.0, 1.3);
    vec3 cold = vec3(0.85, 0.16, 0.02);
    vec3 mid  = vec3(1.00, 0.52, 0.08);
    vec3 hot  = vec3(1.00, 0.88, 0.45);
    vec3 col = mix(cold, mid, smoothstep(0.15, 0.6, heat));
    col = mix(col, hot, smoothstep(0.6, 1.05, heat));
    // sun-spots
    float spots = smoothstep(0.62, 0.74, fbm(p * 3.0 + 7.0 + vec3(t * 0.2)));
    col *= 1.0 - spots * 0.55;
    // limb darkening + brighter rim glow
    float mu = clamp(dot(normalize(vN), normalize(vView)), 0.0, 1.0);
    col *= mix(0.55, 1.15, pow(mu, 0.45));
    col += vec3(1.0, 0.35, 0.05) * pow(1.0 - mu, 3.0) * 0.6;
    gl_FragColor = vec4(col * 1.2, 1.0);
  }`;

// ---------------------------------------------------------------------------
//  World state
// ---------------------------------------------------------------------------
const bodies = [];          // { name, data, pivot, mesh, radius, label, spin, omega, ... }
const pickables = [];
const orbitLines = [];
let belt, sky, stars, sunBody, earthRefs = {};
let simTime = 0, speed = 1, paused = false;
let focus = null, flying = 0, returning = 0;

function makeAtmosphere(radius, a) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius * a.scale, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(...a.color) }, power: { value: a.power }, k: { value: a.k } },
      vertexShader: VERT_WORLD, fragmentShader: ATMO_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    })
  );
}

// ---------------------------------------------------------------------------
//  Builders
// ---------------------------------------------------------------------------
function buildSky() {
  sky = new THREE.Mesh(
    new THREE.SphereGeometry(2500, 64, 32),
    new THREE.MeshBasicMaterial({ map: makers.sky(), side: THREE.BackSide, depthWrite: false, fog: false })
  );
  sky.renderOrder = -10;
  scene.add(sky);

  // star field (slowly drifts = "astro motion" of the background)
  const N = 7000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * TAU, s = Math.sqrt(1 - u * u), R = 2000;
    pos.set([R * s * Math.cos(th), R * u, R * s * Math.sin(th)], i * 3);
    const temp = Math.random();
    tmp.setHSL(temp < 0.5 ? 0.6 : temp < 0.8 ? 0.12 : 0.02, temp < 0.5 ? 0.5 : 0.7, 0.55 + Math.random() * 0.45);
    const b = 0.35 + Math.pow(Math.random(), 3) * 0.9;
    col.set([tmp.r * b, tmp.g * b, tmp.b * b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  stars = new THREE.Points(g, new THREE.PointsMaterial({
    size: 2.6, sizeAttenuation: false, vertexColors: true, map: starSprite(),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(stars);

  // spiral galaxy in the upper-left, like the reference picture
  const gal = new THREE.Sprite(new THREE.SpriteMaterial({
    map: galaxyTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9,
  }));
  gal.position.set(-1250, 780, -1500);
  gal.scale.setScalar(620);
  gal.material.rotation = 0.35;
  scene.add(gal);
}

function buildSun() {
  const group = new THREE.Group();
  const uniforms = { time: { value: 0 } };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_RADIUS, 96, 64),
    new THREE.ShaderMaterial({ uniforms, vertexShader: SUN_VERT, fragmentShader: SUN_FRAG })
  );
  group.add(mesh);

  const glow = (scale, stops, opacity) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(stops), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity,
    }));
    s.scale.setScalar(scale); group.add(s); return s;
  };
  const g1 = glow(SUN_RADIUS * 3.0, [[0, 'rgba(255,190,90,0)'], [0.3, 'rgba(255,150,40,.0)'], [0.36, 'rgba(255,120,30,.5)'], [0.6, 'rgba(200,50,10,.12)'], [1, 'rgba(0,0,0,0)']], 0.9);
  const g2 = glow(SUN_RADIUS * 7.0, [[0, 'rgba(255,110,40,.5)'], [0.35, 'rgba(190,40,20,.18)'], [1, 'rgba(0,0,0,0)']], 0.8);
  scene.add(group);

  sunBody = { name: 'Sun', data: SUN_INFO, pivot: group, mesh, radius: SUN_RADIUS, uniforms, g1, g2, isSun: true };
  bodies.push(sunBody);
  pickables.push(mesh);
}

function buildPlanet(d) {
  const tex = makers[d.maker]();
  const orbitGroup = new THREE.Group();
  orbitGroup.rotation.x = THREE.MathUtils.degToRad(d.incl);
  scene.add(orbitGroup);

  const pivot = new THREE.Group();            // moves along the orbit
  const tilt = new THREE.Group();             // axial tilt
  tilt.rotation.z = d.tilt;
  pivot.add(tilt);
  orbitGroup.add(pivot);

  let material;
  const geo = new THREE.SphereGeometry(d.r, 96, 64);
  if (d.maker === 'earth') {
    material = new THREE.ShaderMaterial({
      uniforms: { dayMap: { value: tex.map }, nightMap: { value: tex.night }, specMap: { value: tex.extra } },
      vertexShader: VERT_WORLD, fragmentShader: EARTH_FRAG,
    });
  } else {
    material = new THREE.MeshStandardMaterial({
      map: tex.map, bumpMap: tex.bump || null, bumpScale: tex.bump ? 2.2 : 0,
      roughness: 0.92, metalness: 0,
    });
  }
  const mesh = new THREE.Mesh(geo, material);
  tilt.add(mesh);
  pickables.push(mesh);

  if (d.atmo) tilt.add(makeAtmosphere(d.r, d.atmo));

  // Earth extras: clouds + Moon
  let clouds = null, moonPivot = null;
  if (d.maker === 'earth') {
    clouds = new THREE.Mesh(
      new THREE.SphereGeometry(d.r * 1.012, 96, 64),
      new THREE.MeshStandardMaterial({ map: tex.clouds, transparent: true, depthWrite: false, roughness: 1 })
    );
    tilt.add(clouds);

    const mt = makers.moon();
    moonPivot = new THREE.Group();
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 64, 48),
      new THREE.MeshStandardMaterial({ map: mt.map, bumpMap: mt.bump, bumpScale: 1.4, roughness: 1 })
    );
    moon.position.set(5.0, 0, 0);               // fixed in the pivot ⇒ tidally locked
    moonPivot.rotation.x = 0.09;
    moonPivot.add(moon);
    pivot.add(moonPivot);
    pickables.push(moon);
    bodies.push({ name: 'Moon', data: { name: 'Moon', info: { Diameter: '3,474 km', 'From Earth': '384,400 km', Orbit: '27.3 days', Gravity: '1/6 of Earth' }, fact: 'Always shows the same face to Earth — it is tidally locked.' },
      pivot: moon, mesh: moon, radius: 0.55, isMoon: true, hidden: false });
  }

  // Saturn rings
  if (d.rings) {
    const [ri, ro] = d.rings;
    const rg = new THREE.RingGeometry(ri, ro, 192, 1);
    const uv = rg.attributes.uv, p = rg.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < uv.count; i++) {
      v.fromBufferAttribute(p, i);
      uv.setXY(i, (v.length() - ri) / (ro - ri), 0.5);
    }
    const ring = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({
      map: makers.ring(), transparent: true, side: THREE.DoubleSide, roughness: 1, depthWrite: false,
    }));
    ring.rotation.x = -Math.PI / 2;
    tilt.add(ring);
  }

  // orbit line (ellipse with the Sun at one focus)
  const b = d.a * Math.sqrt(1 - d.e * d.e);
  const pts = [];
  for (let i = 0; i <= 360; i++) {
    const t = (i / 360) * TAU;
    pts.push(new THREE.Vector3(d.a * Math.cos(t) - d.a * d.e, 0, b * Math.sin(t)));
  }
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0xcfd8ff, transparent: true, opacity: 0.38 })
  );
  orbitGroup.add(line);
  orbitLines.push(line);

  const body = {
    name: d.name, data: d, pivot, mesh, radius: d.r, b, clouds, moonPivot,
    omega: 0.11 * Math.pow(d.years, -0.6),
    spin: Math.max(0.03, (0.5 * 24) / d.spinH),
  };
  bodies.push(body);
  return body;
}

function buildBelt() {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {        // lumpy rocks
    v.fromBufferAttribute(p, i);
    const k = 0.7 + 0.5 * Math.abs(Math.sin(v.x * 7.1 + v.y * 5.3 + v.z * 3.7));
    p.setXYZ(i, v.x * k, v.y * k * 0.8, v.z * k);
  }
  geo.computeVertexNormals();
  const N = 3200;
  belt = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), pos = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const ang = Math.random() * TAU;
    const rad = 58 + (Math.random() + Math.random() + Math.random()) / 3 * 18;
    pos.set(Math.cos(ang) * rad, (Math.random() - 0.5) * 3.4, Math.sin(ang) * rad);
    e.set(Math.random() * TAU, Math.random() * TAU, Math.random() * TAU); q.setFromEuler(e);
    const sc = 0.06 + Math.pow(Math.random(), 4) * 0.3;
    s.set(sc, sc, sc);
    m.compose(pos, q, s); belt.setMatrixAt(i, m);
    const g = 0.16 + Math.random() * 0.22;
    c.setRGB(g * 1.05, g * 0.95, g * 0.85); belt.setColorAt(i, c);
  }
  scene.add(belt);
}

// ---------------------------------------------------------------------------
//  Shooting stars
// ---------------------------------------------------------------------------
const shooters = [];
let nextShooter = 3;
function spawnShooter() {
  const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.15, Math.random() - 0.5).normalize();
  const head = dir.clone().multiplyScalar(1500).add(camera.position);
  const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  const vel = side.multiplyScalar((Math.random() < 0.5 ? 1 : -1) * (900 + Math.random() * 500)).add(new THREE.Vector3(0, -250 - Math.random() * 300, 0));
  const geo = new THREE.BufferGeometry().setFromPoints([head.clone(), head.clone()]);
  const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(3, 3, 4), transparent: true, opacity: 1, depthWrite: false });
  const line = new THREE.Line(geo, mat);
  line.frustumCulled = false;
  scene.add(line);
  shooters.push({ line, head, vel, life: 0 });
}
function updateShooters(dt) {
  nextShooter -= dt;
  if (nextShooter <= 0) { spawnShooter(); nextShooter = 3 + Math.random() * 7; }
  for (let i = shooters.length - 1; i >= 0; i--) {
    const s = shooters[i];
    s.life += dt;
    s.head.addScaledVector(s.vel, dt);
    const tail = s.head.clone().addScaledVector(s.vel, -0.14);
    const a = s.line.geometry.attributes.position;
    a.setXYZ(0, s.head.x, s.head.y, s.head.z); a.setXYZ(1, tail.x, tail.y, tail.z); a.needsUpdate = true;
    s.line.material.opacity = Math.max(0, 1 - s.life / 1.1);
    if (s.life > 1.1) { scene.remove(s.line); s.line.geometry.dispose(); s.line.material.dispose(); shooters.splice(i, 1); }
  }
}

// ---------------------------------------------------------------------------
//  UI
// ---------------------------------------------------------------------------
const labelsEl = $('labels');
const infoEl = $('info');
const btnWrap = $('planet-buttons');
const _v = new THREE.Vector3();

function buildUI() {
  [sunBody, ...bodies.filter((b) => !b.isSun && !b.isMoon)].forEach((b) => {
    const el = document.createElement('div');
    el.className = 'label'; el.textContent = b.name; labelsEl.appendChild(el); b.label = el;
    const btn = document.createElement('button');
    btn.textContent = b.name; btn.onclick = () => selectBody(b);
    btnWrap.appendChild(btn); b.btn = btn;
  });
  const moon = bodies.find((b) => b.isMoon);
  if (moon) {
    const el = document.createElement('div');
    el.className = 'label'; el.textContent = 'Moon'; el.style.fontSize = '10px'; el.style.opacity = '.7';
    labelsEl.appendChild(el); moon.label = el;
  }

  $('speed').oninput = (e) => { speed = parseFloat(e.target.value); $('speed-val').textContent = speed.toFixed(1) + '×'; };
  $('t-orbits').onchange = (e) => orbitLines.forEach((l) => (l.visible = e.target.checked));
  $('t-labels').onchange = (e) => (labelsEl.style.display = e.target.checked ? '' : 'none');
  $('t-belt').onchange = (e) => (belt.visible = e.target.checked);
  $('t-rotate').onchange = (e) => (controls.autoRotate = e.target.checked);
  $('pause').onclick = togglePause;
  $('reset').onclick = resetView;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); togglePause(); }
    if (e.code === 'Escape') resetView();
  });
}

function togglePause() {
  paused = !paused;
  $('pause').textContent = paused ? '▶ Play' : '❚❚ Pause';
}

function showInfo(b) {
  const d = b.data;
  infoEl.innerHTML = `<h3>${b.name}</h3><div>${d.fact}</div><dl>` +
    Object.entries(d.info).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  infoEl.classList.remove('hidden');
}

function selectBody(b) {
  focus = b; flying = 2.2; returning = 0;
  bodies.forEach((x) => x.btn && x.btn.classList.toggle('active', x === b));
  showInfo(b);
  controls.minDistance = b.radius * 1.8;
}

function resetView() {
  focus = null; flying = 0; returning = 2.5;
  bodies.forEach((x) => x.btn && x.btn.classList.remove('active'));
  infoEl.classList.add('hidden');
  controls.minDistance = 3;
}

// click-to-select (ignore drags)
let downX = 0, downY = 0;
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
canvas.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
canvas.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects(pickables, false)[0];
  if (hit) {
    const b = bodies.find((x) => x.mesh === hit.object);
    if (b) selectBody(b);
  }
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------------------
//  Animation loop
// ---------------------------------------------------------------------------
let lastT = performance.now();
const _t = new THREE.Vector3();

function updateCamera(dt) {
  if (focus) {
    focus.mesh.getWorldPosition(_t);
    if (flying > 0) {
      const k = 1 - Math.exp(-4 * dt);
      controls.target.lerp(_t, k);
      const off = camera.position.clone().sub(controls.target);
      const want = focus.radius * (focus.isSun ? 3.2 : 5.5) + 2;
      const len = THREE.MathUtils.lerp(off.length(), want, 1 - Math.exp(-3 * dt));
      camera.position.copy(controls.target).addScaledVector(off.normalize(), len);
      flying -= dt;
    } else {
      const delta = _t.clone().sub(controls.target);
      camera.position.add(delta);
      controls.target.copy(_t);
    }
  } else if (returning > 0) {
    const k = 1 - Math.exp(-3 * dt);
    controls.target.lerp(_t.set(0, 0, 0), k);
    camera.position.lerp(HOME_POS, k);
    returning -= dt;
  }
}

function frame() {
  const nowT = performance.now(); const rawDt = Math.min((nowT - lastT) / 1000, 0.05); lastT = nowT;
  const dt = paused ? 0 : rawDt * speed;
  simTime += dt;

  // Sun
  sunBody.uniforms.time.value = simTime;
  sunBody.mesh.rotation.y += dt * 0.03;
  const pulse = 1 + Math.sin(simTime * 1.3) * 0.015;
  sunBody.g1.scale.setScalar(SUN_RADIUS * 3.0 * pulse);
  sunBody.g2.scale.setScalar(SUN_RADIUS * 7.0 * (2 - pulse));

  // Planets: revolve around the Sun + spin on their tilted axes
  for (const b of bodies) {
    if (b.isSun || b.isMoon) continue;
    const d = b.data;
    const ang = d.phase + b.omega * simTime;
    b.pivot.position.set(d.a * Math.cos(ang) - d.a * d.e, 0, b.b * Math.sin(ang));
    b.mesh.rotation.y += b.spin * dt;
    if (b.clouds) b.clouds.rotation.y += (b.spin * 1.08) * dt;
    if (b.moonPivot) b.moonPivot.rotation.y += 0.55 * dt;
  }

  if (belt) belt.rotation.y += dt * 0.004;
  stars.rotation.y += rawDt * 0.0025;     // slow drift of the sky
  stars.rotation.x += rawDt * 0.0004;

  updateShooters(rawDt);
  updateCamera(rawDt);
  controls.update();
  sky.position.copy(camera.position);
  stars.position.copy(camera.position);

  // labels
  if (labelsEl.style.display !== 'none') {
    const w = innerWidth, h = innerHeight;
    for (const b of bodies) {
      if (!b.label) continue;
      b.mesh.getWorldPosition(_v);
      const dist = camera.position.distanceTo(_v);
      const px = (b.radius / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist)) * (h / 2);
      _v.project(camera);
      const vis = _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1 && !(b.isMoon && dist > 70);
      b.label.style.display = vis ? '' : 'none';
      if (vis) b.label.style.transform = `translate(-50%, 0) translate(${(_v.x * 0.5 + 0.5) * w}px, ${(-_v.y * 0.5 + 0.5) * h + px + 4}px)`;
      if (vis) b.label.style.left = '0', b.label.style.top = '0';
    }
  }

  composer.render();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
//  Boot
// ---------------------------------------------------------------------------
async function main() {
  const say = (t) => ($('loader-text').textContent = t);
  try {
    say('Painting the nebula…'); await tick();
    buildSky();
    say('Igniting the Sun…'); await tick();
    buildSun();
    for (const d of PLANETS) {
      say(`Forming ${d.name}…`); await tick();
      buildPlanet(d);
    }
    say('Scattering asteroids…'); await tick();
    buildBelt();
    buildUI();
    // initial placement so the first frame is already correct
    frame();
    $('loader').classList.add('done');
  } catch (err) {
    console.error(err);
    say('Error: ' + err.message + ' — open the browser console (F12) for details.');
    document.querySelector('.spinner').style.display = 'none';
  }
}
main();
