# 🪐 3D Solar System

An interactive, realistic 3D solar system that runs in your browser, built with
**Three.js**. Animated Sun, 8 planets, Saturn's rings, an asteroid belt, a nebula sky,
and a control panel. All textures are generated in code, so there are no image assets.

## ✨ Features

- Shader-animated Sun with glow (bloom)
- Planets orbit and spin with realistic axial tilt
- Earth with clouds, night-side city lights, atmosphere and a Moon
- Saturn's rings, an asteroid belt, shooting stars and a spiral galaxy
- Click a planet to follow it and see its facts
- Speed slider, pause, and toggles for orbits, labels and the belt

## Controls

| Rotate / Zoom / Pan | Drag / Scroll / Right-drag |
| Follow a planet | Click it or use "Fly to" |
| Pause | Space |
| Reset view | Esc |

## 🗂 Structure

```
index.html     page and control panel
style.css      UI styles
main.js        scene, planets, orbits, animation
textures.js    procedural textures
lib/           local Three.js
```

## 📄 License

MIT. Three.js is © its authors (MIT).
