// ---------------------------------------------------------------------------
//  Procedural textures — every planet surface is generated in code, so the
//  project needs no image downloads and works completely offline.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

const TAU = Math.PI * 2;
let ANISO = 4;
export function setAnisotropy(n) { ANISO = n; }

// ---------- math helpers ----------
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

function hash3(x, y, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

// 3D value noise (0..1)
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let fx = x - xi, fy = y - yi, fz = z - zi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const c000 = hash3(xi, yi, zi),         c100 = hash3(xi + 1, yi, zi);
  const c010 = hash3(xi, yi + 1, zi),     c110 = hash3(xi + 1, yi + 1, zi);
  const c001 = hash3(xi, yi, zi + 1),     c101 = hash3(xi + 1, yi, zi + 1);
  const c011 = hash3(xi, yi + 1, zi + 1), c111 = hash3(xi + 1, yi + 1, zi + 1);
  const x00 = c000 + (c100 - c000) * fx, x10 = c010 + (c110 - c010) * fx;
  const x01 = c001 + (c101 - c001) * fx, x11 = c011 + (c111 - c011) * fx;
  const y0 = x00 + (x10 - x00) * fy, y1 = x01 + (x11 - x01) * fy;
  return y0 + (y1 - y0) * fz;
}

// fractal brownian motion (0..1)
function fbm(x, y, z, oct = 5) {
  let a = 1, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, y * f, z * f);
    n += a; a *= 0.5; f *= 2.03;
  }
  return s / n;
}

// sum of crater bowls + raised rims. Returns roughly -1 .. +0.4
function craters(x, y, z, density = 0.45) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let acc = 0;
  for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const cx = xi + dx, cy = yi + dy, cz = zi + dz;
    const h = hash3(cx, cy, cz);
    if (h > density) continue;
    const fx = cx + hash3(cx + 17, cy, cz);
    const fy = cy + hash3(cx, cy + 31, cz);
    const fz = cz + hash3(cx, cy, cz + 53);
    const r = 0.12 + 0.36 * hash3(cx + 7, cy + 9, cz + 11) * (h / density);
    const d = Math.hypot(x - fx, y - fy, z - fz) / r;
    if (d < 1) acc -= (1 - d * d) * 0.9;
    else if (d < 1.4) { const q = (d - 1.07) / 0.14; acc += 0.35 * Math.exp(-q * q); }
  }
  return acc;
}

const _c = [0, 0, 0];
function ramp(stops, t) {
  if (t <= stops[0][0]) { _c[0] = stops[0][1]; _c[1] = stops[0][2]; _c[2] = stops[0][3]; return _c; }
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const a = stops[i - 1], b = stops[i], k = (t - a[0]) / (b[0] - a[0]);
      _c[0] = lerp(a[1], b[1], k); _c[1] = lerp(a[2], b[2], k); _c[2] = lerp(a[3], b[3], k);
      return _c;
    }
  }
  const l = stops[stops.length - 1]; _c[0] = l[1]; _c[1] = l[2]; _c[2] = l[3]; return _c;
}

// ---------- canvas painter ----------
// fn(x,y,z,lat,lon,out) is called for every texel, where (x,y,z) is the point on
// the unit sphere. It fills out.r/g/b (0-255), and optionally out.a / out.h / out.e.
function paint(w, h, fn, { bump = false, extra = false } = {}) {
  const make = () => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    return { c, ctx, img: ctx.createImageData(w, h) };
  };
  const col = make(), bmp = bump ? make() : null, ext = extra ? make() : null;
  const o = { r: 0, g: 0, b: 0, a: 255, h: 0, e: 0 };
  let i = 0;
  for (let py = 0; py < h; py++) {
    const lat = (0.5 - (py + 0.5) / h) * Math.PI;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let px = 0; px < w; px++, i += 4) {
      const lon = ((px + 0.5) / w) * TAU;
      o.a = 255;
      fn(cl * Math.cos(lon), sl, cl * Math.sin(lon), lat, lon, o);
      col.img.data[i] = o.r; col.img.data[i + 1] = o.g; col.img.data[i + 2] = o.b; col.img.data[i + 3] = o.a;
      if (bmp) { const v = clamp(128 + o.h * 110, 0, 255); bmp.img.data[i] = bmp.img.data[i + 1] = bmp.img.data[i + 2] = v; bmp.img.data[i + 3] = 255; }
      if (ext) { ext.img.data[i] = ext.img.data[i + 1] = ext.img.data[i + 2] = o.e; ext.img.data[i + 3] = 255; }
    }
  }
  col.ctx.putImageData(col.img, 0, 0);
  const out = { map: toTex(col.c, true) };
  if (bmp) { bmp.ctx.putImageData(bmp.img, 0, 0); out.bump = toTex(bmp.c, false); }
  if (ext) { ext.ctx.putImageData(ext.img, 0, 0); out.extra = toTex(ext.c, false); }
  return out;
}

function toTex(canvas, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = ANISO;
  return t;
}

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------------------------------------------------------------------------
//  PLANET MAKERS
// ---------------------------------------------------------------------------
export const makers = {
  // ---- Mercury: grey, heavily cratered ----
  mercury() {
    return paint(1024, 512, (x, y, z, lat, lon, o) => {
      const cr = craters(x * 7, y * 7, z * 7, 0.5) * 0.7 + craters(x * 16 + 5, y * 16, z * 16, 0.4) * 0.35;
      const n = fbm(x * 3 + 2, y * 3, z * 3, 5);
      const v = clamp(0.62 + (n - 0.5) * 0.5 + cr * 0.16, 0, 1);
      o.r = 150 * v * 1.25; o.g = 140 * v * 1.25; o.b = 130 * v * 1.25;
      o.h = cr * 0.5 + (n - 0.5) * 0.4;
    }, { bump: true });
  },

  // ---- Venus: thick swirling golden clouds ----
  venus() {
    const S = [[0, 175, 120, 55], [0.35, 214, 160, 80], [0.6, 238, 196, 118], [1, 250, 228, 170]];
    return paint(1024, 512, (x, y, z, lat, lon, o) => {
      const wx = fbm(x * 2 + 4, y * 2, z * 2, 4) - 0.5;
      const wy = fbm(x * 2 + 9, y * 2 + 3, z * 2, 4) - 0.5;
      const n = fbm(x * 2.2 + wx * 2.2, y * 5 + wy * 1.8, z * 2.2 + wx * 2.2, 6);
      const c = ramp(S, n * 1.25 - 0.1);
      o.r = c[0]; o.g = c[1]; o.b = c[2];
    });
  },

  // ---- Earth: day map, night lights, specular map, clouds ----
  earth() {
    const SEA = 0.5;
    const night = document.createElement('canvas'); night.width = 1024; night.height = 512;
    const nctx = night.getContext('2d');
    const nimg = nctx.createImageData(1024, 512);
    let ni = 0, px = 0, py = 0;
    const earth = paint(1024, 512, (x, y, z, lat, lon, o) => {
      let e = fbm(x * 1.5 + 11, y * 1.5 + 5, z * 1.5 + 2, 6);
      e += (fbm(x * 6 + 3, y * 6, z * 6, 3) - 0.5) * 0.12;
      const alat = Math.abs(lat);
      let r, g, b, lights = 0;
      if (e <= SEA) {
        const depth = clamp((SEA - e) / 0.22);
        r = lerp(32, 4, Math.pow(depth, 0.6)); g = lerp(108, 26, Math.pow(depth, 0.6)); b = lerp(165, 74, Math.pow(depth, 0.6));
        o.e = 255; o.h = 0;
      } else {
        const he = clamp((e - SEA) / 0.28);
        const moist = fbm(x * 3 + 40, y * 3, z * 3, 4);
        const aridBelt = ss(0.1, 0.35, alat) * (1 - ss(0.5, 0.75, alat));
        const desert = clamp(aridBelt * (1.25 - moist * 1.5) + (moist < 0.4 ? 0.2 : 0), 0, 1);
        r = lerp(38, 64, moist); g = lerp(92, 118, moist); b = lerp(34, 44, moist);
        r = lerp(r, 196, desert); g = lerp(g, 164, desert); b = lerp(b, 104, desert);
        const hi = ss(0.35, 0.7, he);
        r = lerp(r, 116, hi); g = lerp(g, 100, hi); b = lerp(b, 82, hi);
        const snow = ss(0.78, 0.95, he);
        r = lerp(r, 245, snow); g = lerp(g, 248, snow); b = lerp(b, 252, snow);
        o.e = 25; o.h = he * 0.9;
        if (alat < 1.15 && fbm(x * 15 + 5, y * 15, z * 15, 3) > 0.6 && he < 0.4) lights = (0.5 + desert * -0.2) + moist * 0.6;
      }
      // polar ice
      const ice = ss(1.18, 1.3, alat + (fbm(x * 8, y * 8, z * 8, 3) - 0.5) * 0.18);
      r = lerp(r, 240, ice); g = lerp(g, 246, ice); b = lerp(b, 252, ice);
      if (ice > 0.3) o.e = 40;
      o.r = r; o.g = g; o.b = b;
      // night-side city lights go to a second canvas
      nimg.data[ni] = 255 * lights; nimg.data[ni + 1] = 190 * lights; nimg.data[ni + 2] = 105 * lights; nimg.data[ni + 3] = 255;
      ni += 4;
    }, { extra: true });
    nctx.putImageData(nimg, 0, 0);
    earth.night = toTex(night, true);

    earth.clouds = paint(1024, 512, (x, y, z, lat, lon, o) => {
      const wx = fbm(x * 2 + 70, y * 2, z * 2, 3) - 0.5;
      const c = fbm(x * 2.4 + wx * 1.4, y * 3.4, z * 2.4 + wx * 1.4, 6);
      o.r = o.g = o.b = 255;
      o.a = 255 * ss(0.56, 0.8, c) * 0.9;
    }).map;
    return earth;
  },

  // ---- Moon: grey with dark maria and craters ----
  moon() {
    return paint(1024, 512, (x, y, z, lat, lon, o) => {
      const mare = ss(0.52, 0.6, fbm(x * 1.6 + 30, y * 1.6, z * 1.6, 5));
      const cr = craters(x * 7, y * 7, z * 7, 0.5) * 0.6 + craters(x * 18 + 3, y * 18, z * 18, 0.4) * 0.3;
      let v = lerp(0.82, 0.42, mare) + cr * 0.1 + (fbm(x * 12, y * 12, z * 12, 3) - 0.5) * 0.15;
      v = clamp(v, 0, 1);
      o.r = 200 * v; o.g = 198 * v; o.b = 192 * v;
      o.h = cr * 0.5 - mare * 0.1;
    }, { bump: true });
  },

  // ---- Mars: rusty red, dark regions, polar caps ----
  mars() {
    const S = [[0, 112, 56, 36], [0.5, 178, 92, 52], [1, 222, 148, 98]];
    return paint(1024, 512, (x, y, z, lat, lon, o) => {
      const n = fbm(x * 2.4 + 3, y * 2.4, z * 2.4, 6);
      let c = ramp(S, n * 1.3 - 0.15);
      let r = c[0], g = c[1], b = c[2];
      const dark = ss(0.52, 0.62, fbm(x * 1.5 + 50, y * 1.5, z * 1.5, 5));
      r *= 1 - dark * 0.45; g *= 1 - dark * 0.42; b *= 1 - dark * 0.35;
      const cr = craters(x * 6, y * 6, z * 6, 0.35) * 0.4;
      r *= 1 + cr * 0.15; g *= 1 + cr * 0.15; b *= 1 + cr * 0.15;
      const cap = ss(1.3, 1.42, Math.abs(lat) + (fbm(x * 6, y * 6, z * 6, 3) - 0.5) * 0.12);
      r = lerp(r, 245, cap); g = lerp(g, 245, cap); b = lerp(b, 250, cap);
      o.r = r; o.g = g; o.b = b;
      o.h = (n - 0.5) * 0.8 + cr;
    }, { bump: true });
  },

  // ---- Jupiter: cream/brown bands + Great Red Spot ----
  jupiter() {
    const S = [[0, 128, 84, 58], [0.25, 176, 120, 82], [0.5, 222, 190, 150], [0.75, 240, 226, 198], [1, 200, 150, 108]];
    return paint(2048, 1024, (x, y, z, lat, lon, o) => {
      const warp = fbm(x * 2.2 + 3, y * 1.6, z * 2.2, 4) - 0.5;
      let band = Math.sin(lat * 14 + warp * 4.5) * 0.5 + 0.5;
      band = band * 0.72 + fbm(x * 1.3 + 9, y * 8, z * 1.3, 5) * 0.28;
      const c = ramp(S, band);
      const t = (fbm(x * 9, y * 22, z * 9, 4) - 0.5) * 46;
      let r = c[0] + t, g = c[1] + t * 0.9, b = c[2] + t * 0.8;
      // Great Red Spot
      const dl = wrapAngle(Math.atan2(z, x) - 1.2);
      const dx = (dl * Math.cos(lat)) / 0.3, dy = (lat + 0.36) / 0.13;
      const d = dx * dx + dy * dy;
      if (d < 2) {
        const k = ss(2, 0.7, d);
        const sw = fbm(x * 18, y * 30, z * 18, 3);
        r = lerp(r, 196 + sw * 30, k); g = lerp(g, 84 + sw * 30, k); b = lerp(b, 56 + sw * 20, k);
      }
      o.r = r; o.g = g; o.b = b;
    });
  },

  // ---- Saturn: pale gold bands ----
  saturn() {
    const S = [[0, 178, 148, 98], [0.4, 214, 188, 132], [0.7, 236, 214, 160], [1, 246, 232, 190]];
    return paint(2048, 1024, (x, y, z, lat, lon, o) => {
      const warp = fbm(x * 2 + 8, y * 1.5, z * 2, 3) - 0.5;
      let band = Math.sin(lat * 18 + warp * 3) * 0.5 + 0.5;
      band = band * 0.6 + fbm(x * 1.1, y * 10, z * 1.1, 4) * 0.4;
      const c = ramp(S, band);
      const t = (fbm(x * 8, y * 24, z * 8, 3) - 0.5) * 22;
      o.r = c[0] + t; o.g = c[1] + t; o.b = c[2] + t * 0.8;
    });
  },

  // ---- Uranus: pale cyan ----
  uranus() {
    return paint(1024, 512, (x, y, z, lat, lon, o) => {
      const band = Math.sin(lat * 10) * 0.5 + 0.5;
      const n = fbm(x * 1.2, y * 7, z * 1.2, 4);
      const v = 0.82 + band * 0.08 + (n - 0.5) * 0.12;
      o.r = 140 * v; o.g = 214 * v; o.b = 226 * v;
    });
  },

  // ---- Neptune: deep blue with a dark storm ----
  neptune() {
    return paint(1024, 512, (x, y, z, lat, lon, o) => {
      const warp = fbm(x * 2 + 1, y * 2, z * 2, 3) - 0.5;
      const band = Math.sin(lat * 12 + warp * 3) * 0.5 + 0.5;
      const n = fbm(x * 1.5, y * 9, z * 1.5, 5);
      let r = lerp(30, 62, band * 0.6 + n * 0.4), g = lerp(62, 108, band * 0.6 + n * 0.4), b = lerp(160, 232, band * 0.5 + n * 0.5);
      const cirrus = ss(0.66, 0.8, fbm(x * 3 + 5, y * 16, z * 3, 4));
      r = lerp(r, 210, cirrus * 0.6); g = lerp(g, 225, cirrus * 0.6); b = lerp(b, 255, cirrus * 0.6);
      const dl = wrapAngle(Math.atan2(z, x) - 3.6);
      const d = ((dl * Math.cos(lat)) / 0.32) ** 2 + ((lat + 0.4) / 0.15) ** 2;
      if (d < 1.6) { const k = ss(1.6, 0.5, d) * 0.75; r = lerp(r, 14, k); g = lerp(g, 28, k); b = lerp(b, 96, k); }
      o.r = r; o.g = g; o.b = b;
    });
  },

  // ---- Saturn ring strip (U = inner → outer edge) ----
  ring() {
    const w = 1024, h = 8;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); const img = ctx.createImageData(w, h);
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      let a = 0, shade = 0.8;
      if (u < 0.12) { a = 0.12 + 0.2 * (u / 0.12); shade = 0.55; }          // faint C ring
      else if (u < 0.58) { a = 0.78 + 0.2 * vnoise(u * 90, 1, 1); shade = 0.95; } // B ring
      else if (u < 0.64) { a = 0.04; }                                      // Cassini division
      else if (u < 0.97) { a = 0.55 + 0.3 * vnoise(u * 70, 5, 1); shade = 0.85; } // A ring
      if (u > 0.9 && u < 0.915) a *= 0.2;                                    // Encke gap
      a *= 0.65 + 0.35 * vnoise(u * 260, 2, 3);                              // fine grooves
      for (let y = 0; y < h; y++) {
        const i = (y * w + x) * 4;
        img.data[i] = 226 * shade; img.data[i + 1] = 206 * shade; img.data[i + 2] = 168 * shade;
        img.data[i + 3] = clamp(a) * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return toTex(c, true);
  },

  // ---- Background nebula (equirectangular, wrapped inside a big sphere) ----
  sky() {
    return paint(1024, 512, (x, y, z, lat, lon, o) => {
      const a = fbm(x * 1.3 + 1, y * 1.3, z * 1.3, 6);
      const b = fbm(x * 1.1 + 20, y * 1.1 + 5, z * 1.1, 6);
      const c = fbm(x * 2.2 + 50, y * 2.2, z * 2.2, 5);
      const dust = fbm(x * 3 + 90, y * 3, z * 3, 5);
      const red = ss(0.46, 0.7, a), blue = ss(0.56, 0.78, b), green = ss(0.56, 0.78, c) * 0.55;
      let r = 2 + red * 70 + green * 6;
      let g = 3 + red * 18 + blue * 38 + green * 62;
      let bl = 5 + red * 22 + blue * 60 + green * 30;
      const lane = 1 - ss(0.58, 0.8, dust) * 0.7;
      o.r = r * lane; o.g = g * lane; o.b = bl * lane;
    }).map;
  },
};

// ---------------------------------------------------------------------------
//  Small canvas sprites
// ---------------------------------------------------------------------------
export function glowTexture(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([t, col]) => g.addColorStop(t, col));
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function galaxyTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.translate(S / 2, S / 2);
  ctx.globalCompositeOperation = 'lighter';
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 9000; i++) {
    const arm = i % 2;
    const t = Math.pow(rnd(), 0.7) * 3.2;
    const ang = t * 2.4 + arm * Math.PI + (rnd() - 0.5) * 0.55;
    const rad = 14 + t * 62;
    const px = Math.cos(ang) * rad * 1.0, py = Math.sin(ang) * rad * 0.42;
    const a = Math.cos(0.5) , s = Math.sin(0.5);
    const x = px * a - py * s, y = px * s + py * a;
    const k = 1 - t / 3.4;
    ctx.fillStyle = `rgba(${150 + 90 * k | 0},${170 + 60 * k | 0},255,${0.05 + 0.1 * k})`;
    ctx.beginPath(); ctx.arc(x, y, 0.8 + rnd() * 1.6, 0, TAU); ctx.fill();
  }
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
  g.addColorStop(0, 'rgba(255,245,220,1)'); g.addColorStop(0.15, 'rgba(255,210,150,.7)');
  g.addColorStop(0.5, 'rgba(200,150,120,.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(-S / 2, -S / 2, S, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function starSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
