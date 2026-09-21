# livewall

24 animated desktop wallpapers, each one a piece of mathematics rendered as a
WebGL2 fragment shader. Truchet tilings, a quasicrystal, the gyroid minimal
surface, the Menger sponge, Newton basins, the modular group acting on the
hyperbolic disk, phyllotaxis at the golden angle.

Static hosting, no build step, no dependencies. Open `index.html`.

## Using it

Cycles every 60 seconds in shuffled order, with no repeat until all 24 have
shown.

| key | does |
|---|---|
| `←` `→` `space` | previous / next wallpaper |
| `G` | gallery, click a tile to jump to it |
| `I` | show or hide the description card |
| `O` | OLED mode |
| `C` | pause or resume the 60s cycle |
| `F` | fullscreen |

The chrome fades out after 3.5 seconds of no input. Choices persist in
localStorage.

## OLED mode

On by default. It crushes the near-black floor to true zero so those pixels
switch off rather than glow, pushes saturation slightly, and shaves peak
energy. The canvas also shifts a few pixels on every swap, so a static bright
region never sits on the same pixels for long.

## Colour

Twenty-two of the twenty-four own a narrow hue band. The anchors are evenly
spaced around the wheel, but which wallpaper gets which anchor is decided by
structural family (interference fields, cell fields, neon curves, raymarched
solids), so the ones that look alike are pushed to opposite sides of the
wheel. Even spacing alone was not enough: it put the two green interference
shaders next to each other. Two keep a full-spectrum palette because their
subject is the colour split itself: Moire Rotor gives each of its three grids
a primary, and Newton Basins gives each root its own hue.

## Checks

```
python3 -m http.server 8793 --bind 127.0.0.1 --directory .   # in another shell
python3 bench.py     # compiles all 24, asserts brightness/motion floors and similarity
python3 shots.py     # renders a PNG per wallpaper plus a contact sheet
```

`bench.py` fails if any shader does not compile, if one is mostly black or
barely moves, or if any pair scores above 0.85 on a layout + edge-orientation +
hue fingerprint. Both drive headless Chrome over CDP.

## Adding one

Append to `WALLPAPERS` in `shaders.js`: a `name`, a `tag`, a `desc`, and a
`src` string holding a GLSL ES 3.00 `main()` that writes
`fragColor = vec4(finish(col), 1.0)`. `PRELUDE` above it supplies `u_res`,
`u_time`, `u_oled`, noise, complex arithmetic, palettes and `uvn()`. Run
`bench.py` after.
