// 24 animated wallpapers. Each entry is a GLSL ES 3.00 body appended to PRELUDE.
// Contract: define main(), write fragColor = vec4(finish(col), 1.0);
//
// Colour identity: 22 of the 24 own a hue band, on 22 evenly spaced anchors.
// Which anchor goes to which wallpaper is chosen by structural family (interference
// fields, cell fields, neon curves, raymarched solids...) so the ones that LOOK alike
// are pushed to opposite sides of the wheel. Even spacing alone is not enough: it put
// the two green interference shaders next to each other. Two keep a full-spectrum
// palette because their subject IS the colour split: Moire Rotor (three primaries,
// one per grid) and Newton Basins (one hue per root).

export const PRELUDE = `#version 300 es
precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform float u_oled;
out vec4 fragColor;

#define PI  3.14159265359
#define TAU 6.28318530718

mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

float hash11(float p){ p=fract(p*0.1031); p*=p+33.33; p*=p+p; return fract(p); }
float hash21(vec2 p){ vec3 q=fract(vec3(p.xyx)*0.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
vec2  hash22(vec2 p){ vec3 q=fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973)); q+=dot(q,q.yzx+33.33); return fract((q.xx+q.yz)*q.zy); }

float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p), u=f*f*(3.0-2.0*f);
  return mix(mix(hash21(i),            hash21(i+vec2(1,0)), u.x),
             mix(hash21(i+vec2(0,1)),  hash21(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<6;i++){ s+=a*vnoise(p); p=rot(0.5)*p*2.02; a*=0.5; } return s; }
float fbm3(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<3;i++){ s+=a*vnoise(p); p=rot(0.5)*p*2.07; a*=0.5; } return s; }

vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
vec2 cdiv(vec2 a, vec2 b){ float d=max(dot(b,b),1e-9); return vec2(dot(a,b), a.y*b.x-a.x*b.y)/d; }

vec3 hsv2rgb(vec3 c){
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0/3.0, 1.0/3.0))*6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p-1.0, 0.0, 1.0), c.y);
}
// Band-limited palette: t wanders inside a +-w window around hue h, brightness
// swings across the whole range so structure still reads.
vec3 tone(float t, float h, float w, float s){
  float f = fract(t);
  float v = 0.66 + 0.34*sin(TAU*f + 1.2);
  // a fully saturated hue is dark in luma, so desaturate as brightness rises:
  // the band stays vivid in the mids without the whole image reading as murk.
  float sat = s*(0.92 - 0.30*v);
  return hsv2rgb(vec3(h + w*(f*2.0-1.0), sat, v));
}
// Full-wheel palette, for the two wallpapers whose subject is the colour split.
vec3 wheel(float t, float s, float v){ return hsv2rgb(vec3(fract(t), s, v)); }

// aspect-correct centered coords, short side spans -1..1
vec2 uvn(){ return (gl_FragCoord.xy*2.0 - u_res) / min(u_res.x, u_res.y); }

// OLED pass: crush the near-black floor to true zero (pixels switch off),
// push saturation slightly, and shave peak energy.
vec3 oledify(vec3 c){
  float m = max(max(c.r,c.g),c.b);
  float k = smoothstep(0.030, 0.50, m);
  vec3 sat = clamp(mix(vec3(m), c, 1.18), 0.0, 1.0);
  return sat * pow(k, 1.15) * 0.94;
}
vec3 finish(vec3 c){ c = clamp(c,0.0,1.0); return mix(c, oledify(c), u_oled); }
`;

export const WALLPAPERS = [
{
  name: "Truchet Weave",
  tag: "tiling",
  desc: "Truchet tiles: one square, two quarter-arcs, a coin flip per cell. Each tile is trivially symmetric and the grid still never repeats, because the randomness lives in the orientation rather than the pattern. Arc width breathes on a diagonal wave.",
  src: `
#define H 0.545
#define W 0.055
#define S 0.85
void main(){
  vec2 uv = uvn()*4.0 + vec2(u_time*0.07, u_time*0.045);
  vec2 id = floor(uv);
  vec2 f  = fract(uv) - 0.5;
  if(hash21(id) > 0.5) f.x = -f.x;
  float d = min(abs(length(f-0.5)-0.5), abs(length(f+0.5)-0.5));
  float w = 0.19 + 0.085*sin(u_time*1.1 + (id.x-id.y)*0.7);
  float core = smoothstep(w, w-0.04, d);
  float halo = smoothstep(w+0.34, w, d);
  float k = 0.11*(id.x - id.y) + u_time*0.05;
  vec3 c  = tone(k,       H, W, S);
  vec3 bg = tone(k + 0.5, H, W, S);
  vec3 col = bg*0.18 + c*core + c*halo*0.30;
  fragColor = vec4(finish(col), 1.0);
}`
},
{
  name: "Quasicrystal",
  tag: "aperiodic",
  desc: "Seven plane waves summed at equal angles around the circle. Seven is not a crystallographic symmetry, so the interference pattern has local five- and seven-fold order and never tiles the plane. Rotating the wave bundle slides the whole structure through itself.",
  src: `
#define H 0.591
#define W 0.055
#define S 0.80
void main(){
  vec2 p = uvn()*7.5;
  float s = 0.0;
  for(int i=0;i<7;i++){
    float a = float(i)*PI/7.0 + u_time*0.035;
    s += cos(dot(p, vec2(cos(a),sin(a)))*3.0 + u_time*0.55);
  }
  s /= 7.0;
  vec3 col = tone(s*0.75 + u_time*0.04, H, W, S);
  col *= 0.30 + 1.30*abs(s);
  col += hsv2rgb(vec3(H+W, 0.35, 1.0))*pow(abs(s), 6.0)*0.65;
  fragColor = vec4(finish(col), 1.0);
}`
},
{
  name: "Voronoi Drift",
  tag: "cells",
  desc: "Every pixel finds its nearest and second-nearest seed point. The gap between those two distances is zero exactly on a cell boundary, which draws the edges without ever computing them. Seeds orbit on sine paths so cells trade territory continuously.",
  src: `
#define H 0.773
#define W 0.060
#define S 0.78
void main(){
  vec2 p = uvn()*4.5;
  vec2 ip = floor(p), fp = fract(p);
  float d1 = 9.0, d2 = 9.0; vec2 cid = vec2(0.0);
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
    vec2 g = vec2(float(x),float(y));
    vec2 o = hash22(ip+g);
    o = 0.5 + 0.5*sin(u_time*0.55 + TAU*o);
    float d = length(g + o - fp);
    if(d < d1){ d2 = d1; d1 = d; cid = ip+g; } else if(d < d2){ d2 = d; }
  }
  float edge = smoothstep(0.0, 0.055, d2-d1);
  vec3 col = tone(hash21(cid) + u_time*0.03, H, W, S);
  col *= 0.12 + 0.60*edge;
  col += (1.0-edge)*hsv2rgb(vec3(H, 0.12, 1.0))*0.85;
  fragColor = vec4(finish(col), 1.0);
}`
},
{
  name: "Hex Bloom",
  tag: "tiling",
  desc: "The hexagonal tiling, chosen because it is the densest way to cover a plane with equal cells. Each cell is found by testing two offset square lattices and keeping the closer centre. Rings pulse outward on a delay set by distance from the origin.",
  src: `
#define H 0.318
#define W 0.055
#define S 0.80
vec4 hexcoord(vec2 p){
  vec2 s = vec2(1.0, 1.7320508), h = s*0.5;
  vec2 a = mod(p, s) - h;
  vec2 b = mod(p - h, s) - h;
  vec2 gv = dot(a,a) < dot(b,b) ? a : b;
  return vec4(gv, p - gv);
}
float hexdist(vec2 p){ p = abs(p); return max(dot(p, normalize(vec2(1.0,1.732))), p.x); }
void main(){
  vec2 p = uvn()*4.2;
  p *= rot(u_time*0.02);
  vec4 hc = hexcoord(p);
  float id = hash21(hc.zw*1.7);
  float r  = length(hc.zw);
  float pulse = sin(u_time*1.3 - r*0.85 + id*TAU)*0.5 + 0.5;
  float e = hexdist(hc.xy);
  float k = id*0.8 + u_time*0.05 + r*0.05;
  vec3 c  = tone(k,       H, W, S);
  vec3 c2 = tone(k + 0.4, H, W, S);
  float plate = smoothstep(0.500, 0.470, e);
  float rim   = smoothstep(0.500, 0.478, e) - smoothstep(0.462, 0.440, e);
  float ring  = smoothstep(0.035, 0.0, abs(e - (0.14 + 0.24*pulse)));
  vec3 col = mix(c2, c, pulse)*plate*(0.22 + 0.60*pulse);
  col += c*ring*1.15;
  col += hsv2rgb(vec3(H, 0.10, 1.0))*rim*0.50;
  fragColor = vec4(finish(col), 1.0);
}`
},
{
  name: "Nebula Warp",
  tag: "noise",
  desc: "Fractal noise used as its own coordinate system, twice. The field is sampled, the result offsets a second sample, and that result offsets a third. Two rounds of this domain warping turn smooth noise into filament and sheet structure that looks like gas.",
  src: `
#define H 0.227
#define W 0.075
#define S 0.68
void main(){
  vec2 p = uvn()*1.7;
  float t = u_time*0.05;
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 4.0*q + vec2(1.7, 9.2) + 0.16*t),
                fbm(p + 4.0*q + vec2(8.3, 2.8) - 0.13*t));
  float f = fbm(p + 4.0*r);
  vec3 col = tone(f*1.5 + length(r)*0.35 + t, H, W, S);
  col = mix(col, hsv2rgb(vec3(H-W*1.6, 0.55, 1.0)), clamp(dot(r,r)*0.70, 0.0, 1.0));
  col = mix(col, hsv2rgb(vec3(H+W*1.6, 0.80, 1.0)), clamp(q.y*q.y*1.4, 0.0, 1.0)*0.60);
  col *= 0.06 + 2.20*f*f;
  fragColor = vec4(finish(col), 1.0);
}`
},
{
  name: "Apollonian Gasket",
  tag: "fractal 3d",
  desc: "Space is folded into the unit cube and then inverted through a sphere, seven times. Kali's variation on the Apollonian packing: every inversion drags a copy of the structure inward, so spheres nest into the gaps between spheres without limit. Raymarched.",
  src: `
#define H 0.864
#define W 0.050
#define S 0.90
float mapA(vec3 p, out float trap){
  float s = 1.55; trap = 1e9;
  for(int i=0;i<7;i++){
    p = -1.0 + 2.0*fract(0.5 + 0.5*p);
    float k = 1.32/dot(p,p);
    p *= k; s *= k;
    trap = min(trap, dot(p,p));
  }
  return 0.25*abs(p.y)/s;
}
void main(){
  vec2 uv = uvn();
  float t = u_time*0.08;
  vec3 ro = vec3(1.1*cos(t), 0.35 + 0.22*sin(t*0.7), 1.1*sin(t));
  vec3 ww = normalize(-ro), uu = normalize(cross(vec3(0,1,0), ww)), vv = cross(ww,uu);
  vec3 rd = normalize(uv.x*uu + uv.y*vv + 1.5*ww);
  float d = 0.0, trap = 0.0, tr = 0.0, glow = 0.0; bool hit = false;
  for(int i=0;i<80;i++){
    float h = mapA(ro + rd*d, tr);
    glow += 0.010/(0.020 + tr*3.0);
    if(h < 0.0015*d){ hit = true; trap = tr; break; }
    d += h*0.85;
    if(d > 6.0) break;
  }
  vec3 col = tone(u_time*0.04 + uv.y*0.2, H, W, S)*0.12;
  if(hit){
    vec3 c = tone(trap*2.4 + u_time*0.05, H, W, S);
    col = c*(0.40 + 0.95*exp(-d*0.50));
    col += hsv2rgb(vec3(H+W, 0.25, 1.0))*pow(clamp(1.0-trap*1.6,0.0,1.0), 4.0)*0.6;
  }
  col += tone(u_time*0.05 + 0.3, H, W, S)*clamp(glow, 0.0, 1.4)*0.30;
  fragColor = vec4(finish(col), 1.0);
}`
},
{
  name: "Kaleido Mandala",
  tag: "symmetry",
  desc: "The plane is wrapped into one twelfth of a turn and mirrored, which forces twelve-fold dihedral symmetry on whatever is drawn inside. Fractal noise fills the wedge, so the pattern is irregular and perfectly symmetric at the same time.",
  src: `
#define H 0.955
#define W 0.055
#define S 0.80
void main(){
  vec2 p = uvn()*0.82;
  float a = atan(p.y, p.x), r = length(p);
  float N = 12.0;
  a = abs(mod(a, TAU/N) - PI/N);
  vec2 q = vec2(cos(a), sin(a))*r;
  float t = u_time*0.12;
  float f = fbm(q*3.4 + vec2(t, -t));
  float rings = sin(r*22.0 - u_time*1.6 + f*5.0);
  vec3 col = tone(f*1.2 + r*0.75 + u_time*0.035, H, W, S);
  col *= 0.16 + 1.25*abs(rings)*(0.35 + 0.85*f);
  col += hsv2rgb(vec3(H-W, 0.18, 1.0))*pow(max(rings,0.0), 9.0)*0.55;
  col += tone(f*1.4 + u_time*0.04 + 0.4, H, W, S)*f*f*0.30;
  fragColor = vec4(finish(col), 1.0);
}`
},
{
  name: "Julia Drift",
  tag: "fractal",
  desc: "z squared plus c, iterated per pixel. The constant c walks a slow ellipse near the boundary of the Mandelbrot set, which is where the Julia set is most unstable, so the shape tears apart and reassembles. Points that never escape are shaded by how close their orbit came to the origin.",
  src: `
#define H 0.409
#define W 0.055
#define S 0.78
void main(){
  vec2 p = uvn()*1.35;
  p *= rot(u_time*0.025);
  vec2 c = 0.7885*vec2(cos(u_time*0.12), sin(u_time*0.10));
  vec2 z = p; float i = 0.0, trap = 1e9, trap2 = 1e9;
  for(int k=0;k<100;k++){
    z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
    trap  = min(trap,  abs(z.x*z.y));
    trap2 = min(trap2, length(z));
    if(dot(z,z) > 64.0) break;
    i += 1.0;
  }
  float esc = i/100.0;
  float sm = max(i - log2(max(log2(length(z)), 1.0)), 0.0)/100.0;
  vec3 outside = tone(sm*2.6 + u_time*0.05, H, W, S)*(0.20 + 0.85*(1.0-sm));
  vec3 inside  = tone(trap2*1.6 + u_time*0.06 + 0.5, H, W, S)*(0.20 + 0.65*exp(-trap*5.0));
  vec3 col = mix(outside, inside, step(0.99, esc));
  col += hsv2rgb(vec3(H+W, 0.45, 1.0))*exp(-trap*9.0)*0.70;
  fragColor = vec4(finish(col), 1.0);
}`
},
{
  name: "Moire Rotor",
  tag: "interference",
  desc: "Three square grids at slightly different scales, counter-rotating. Where two grids nearly align, the small mismatch accumulates into wide beat patterns far larger than either grid. Each grid owns one primary, so the beats show up as colour where two of them overlap.",
  src: `
float grid(vec2 p, float w){ vec2 g = abs(fract(p) - 0.5); return smoothstep(w, w*0.35, min(g.x,g.y)); }
void main(){
  vec2 p = uvn()*3.6;                    // coarser: readable cells, no fine shimmer
  float t = u_time*0.09;
  float a = grid(p*rot(t),                0.14);
  float b = grid(p*rot(-t*1.17+0.4)*1.07, 0.14);
  float c = grid(p*rot(t*0.61+1.1)*0.93,  0.14);
  // the beat between the grids gates how bright the lines get, so the frame has
  // quiet regions instead of uniform mesh
  float beat = 0.35 + 0.65*(0.5 + 0.5*sin(dot(p, vec2(0.55,0.38)) + t*2.0));
  vec3 col = vec3(0.98,0.20,0.62)*a + vec3(0.15,0.85,1.0)*b + vec3(1.0,0.80,0.15)*c;
  col *= 0.42*beat;
  col += (vec3(0.6,1.0,0.5)*(a*b) + vec3(1.0,0.5,1.0)*(b*c) + vec3(0.5,0.8,1.0)*(a*c))*0.55;
  col += wheel(t + length(p)*0.07, 0.62, 1.0)*0.20;
  fragColor = vec4(finish(col), 1.0);
}`
},
{
  name: "Phyllotaxis",
  tag: "growth",
  desc: "Each dot sits one golden angle, 137.5 degrees, further around than the last, at a radius proportional to the square root of its index. That angle is the worst-approximable irrational fraction of a turn, which is exactly why no two dots ever line up. Sunflowers do this.",
  src: `
#define H 0.273
#define W 0.055
#define S 0.80
void main(){
  vec2 p = uvn();
  float t = u_time*0.10;
  const float GA = 2.39996323, N = 300.0, R = 0.98;   // sparse enough to see the spirals
  float rp = length(p);
  // radius grows with sqrt(index), so index grows with radius squared: search a
  // window around that guess instead of all N seeds.
  // ponytail: fixed +-60 window, widen if the spiral count ever outgrows it.
  float guess = clamp((rp/R)*(rp/R)*N, 0.0, N);
  float d = 1e9, idx = 0.0;
  for(int k=-60;k<=60;k++){
    float fi = guess + float(k);
    if(fi < 0.0 || fi > N) continue;
    float r = sqrt(fi/N)*R;
    float a = fi*GA + t + r*0.7;
    // dot radius well under the seed spacing, so gaps stay open and the 13/21
    // spiral arms read instead of merging into one bright slab
    float dd = length(p - vec2(cos(a),sin(a))*r) - (0.013 + 0.026*r);
    if(dd < d){ d = dd; idx = fi; }
  }
  float k = idx/N*2.4 + u_time*0.05;
  vec3 c  = tone(k,       H, W, S);
  vec3 c2 = tone(k + 0.5, H, W, S);
  // Outside the head there are no seeds, so instead of a dim gradient the surround
  // gets the parastichy lines themselves: 21 and 34 log-spiral arms, the Fibonacci
  // pair the golden angle actually produces, continuing the head's spirals outward.
  float th = atan(p.y, p.x), lr = log(max(rp, 1e-3));
  float arm21 = sin(21.0*th - 21.0*0.2812*lr + t*3.0);
  float arm34 = sin(34.0*th + 34.0*0.2812*lr - t*2.0);
  float arms = max(pow(max(arm21,0.0), 3.0), pow(max(arm34,0.0), 3.0)*0.8);
  float outside = smoothstep(R*0.96, R*1.16, rp);
  vec3 col = tone(rp*0.9 + u_time*0.04, H, W, S)*(0.19 + 0.24*arms*outside);
  col += c2*arms*outside*smoothstep(2.1, 0.9, rp)*0.24;
  col += c*smoothstep(0.010,-0.014,d)*1.30*(1.0 - outside);   // crisp dot edge
  col += c2*exp(-max(d,0.0)*30.0)*0.42*(1.0 - outside);       // tight halo, gaps stay dark
  fragColor = vec4(finish(col), 1.0);
}`
},
{
  name: "Lissajous Ribbons",
  tag: "curves",
  desc: "Three Lissajous figures, each the path of a point whose x and y oscillate at different whole-number ratios. The ratio decides the knot; the phase offset decides how it is threaded. Drifting the phase makes the closed curve appear to rotate in a third dimension it does not have.",
  src: `
#define H 0.091
#define W 0.050
#define S 0.90
void main(){
  vec2 p = uvn();
  float t = u_time*0.22;
  vec3 col = tone(t*0.3 + length(p)*0.4, H, W, S)*0.09;
  for(int k=0;k<3;k++){
    float fk = float(k);
    // integer frequency ratios, so each curve closes instead of drifting apart
    float a = 3.0 + fk, b = 2.0 + fk*2.0;
    float amp = 1.08 - fk*0.10;
    // 200 samples with segment-distance between them: at 56 point-samples the gaps
    // were wider than the stroke and the curve broke up into separate dots.
    float d = 1e9;
    vec2 prev = vec2(sin(t + fk*1.3), sin(t*0.73));
    for(int i=1;i<=200;i++){
      float u = float(i)/200.0*TAU;
      vec2 q = vec2(sin(a*u + t + fk*1.3), sin(b*u + t*0.73))*amp;
      vec2 e = q - prev, g = p - prev;
      float h = clamp(dot(g,e)/max(dot(e,e),1e-6), 0.0, 1.0);
      d = min(d, length(g - e*h));
      prev = q;
    }
    vec3 c = tone(fk*0.30 + u_time*0.04, H, W, S);
    col += c*smoothstep(0.016, 0.004, d)*1.25;
    col += c*exp(-d*7.0)*0.40;
  }
  fragColor = vec4(finish(col), 1.0);
}`
},
{
  name: "Modular Tessellation",
  tag: "hyperbolic",
  desc: "The disk is mapped to the hyperbolic upper half-plane, then folded by the modular group: shift by one, invert through the unit circle, repeat. Each fold is drawn as an edge, so every tile you see is the same fundamental triangle carried to a new place. They look like they shrink toward the rim because in hyperbolic terms they do not.",
  src: `
#define H 0.182
#define W 0.055
#define S 0.80
void main(){
  // stay inside the disk: scale the frame well under the rim, then slide along a
  // geodesic with the hyperbolic translation z -> (z+a)/(1+a z). The viewport never
  // reaches the boundary, so the tiling covers every pixel.
  vec2 zz = uvn()*0.42;
  vec2 a  = vec2(0.52*sin(u_time*0.045), 0.30*cos(u_time*0.037));
  vec2 z  = cdiv(zz + a, vec2(1.0,0.0) + cmul(a, zz));
  vec3 col = vec3(0.0);
  {
    // Cayley transform: unit disk to upper half-plane
    vec2 q = cdiv(vec2(1.0+z.x, z.y), vec2(1.0-z.x, -z.y));
    vec2 w = vec2(-q.y, q.x);
    w.x += u_time*0.04;
    float k = 0.0;
    // scale tracks how much the folds shrank this neighbourhood, so edge width
    // can shrink with it and stay one pixel wide all the way to the rim
    float sc = 1.0;
    for(int i=0;i<30;i++){
      float sh = floor(w.x + 0.5);
      w.x -= sh;
      float d2 = dot(w,w);
      if(d2 < 1.0){ w = -w/d2; sc /= d2; k += 1.0; } else break;
    }
    // distance to the three walls of the fundamental domain
    float eW = min(0.5 - abs(w.x), length(w) - 1.0);
    float px = 3.4/(min(u_res.x,u_res.y)*0.21) * max(w.y, 0.02);
    float edge = smoothstep(px*2.2, px*0.5, eW);
    float interior = smoothstep(0.0, 0.30, eW);

    vec3 c  = tone(k*0.11 + u_time*0.03,        H, W, S);
    vec3 c2 = tone(k*0.11 + u_time*0.03 + 0.45, H, W, S);
    col  = mix(c2, c, fract(k*0.5))*(0.40 + 0.62*interior);
    col += hsv2rgb(vec3(H, 0.10, 1.0))*edge*1.00;
  }
  fragColor = vec4(finish(col), 1.0);
}`
},
{
  name: "Chladni Plate",
  tag: "standing waves",
  desc: "The nodal lines of a vibrating square plate, where cos(n pi x)cos(m pi y) minus its transpose equals zero. Sand poured on a real plate bounces off the moving areas and settles exactly here. The mode numbers slide continuously, which no physical plate would do.",
  src: `
#define H 0.136
#define W 0.055
#define S 0.72
void main(){
  vec2 q = gl_FragCoord.xy / u_res;
  float t = u_time*0.07;
  float n = 3.5 + 2.5*sin(t), m = 5.5 + 3.0*cos(t*0.77);
  float s  = cos(n*PI*q.x)*cos(m*PI*q.y) - cos(m*PI*q.x)*cos(n*PI*q.y);
  float s2 = cos((n+4.0)*PI*q.x)*cos((m+4.0)*PI*q.y) - cos((m+4.0)*PI*q.x)*cos((n+4.0)*PI*q.y);
  float nodal = smoothstep(0.085, 0.0, abs(s));
  vec3 col = tone(s*0.55 + 0.5 + u_time*0.03, H, W, S)*(0.15 + 1.15*abs(s));
  col += tone(s2*0.4 + u_time*0.04 + 0.4, H, W, S)*abs(s2)*abs(s)*0.35;
  col = mix(col, hsv2rgb(vec3(H, 0.08, 1.0)), nodal*0.95);
  fragColor = vec4(finish(col), 1.0);
}`
},
{
  name: "Gyroid Field",
  tag: "minimal surface",
  desc: "The gyroid, a triply periodic minimal surface with no straight lines and no planes of symmetry, approximated by sin(x)cos(y) + sin(y)cos(z) + sin(z)cos(x) = 0. Butterfly wings grow this structure to make colour without pigment. Raymarched through a slow rotation.",
  src: `
#define H 0.455
#define W 0.050
#define S 0.85
// The gyroid fills all space, so a camera translating through it ends up INSIDE
// the shell and the march terminates on the first step: a flat wash. Clipping it
// to a sphere makes it a bounded object the camera can orbit from outside.
float mapG(vec3 p){
  vec3 s = sin(p*1.5), c = cos(p.yzx*1.5);
  float shell = (abs(dot(s,c)) - 0.42)*0.32;
  return max(shell, length(p) - 5.4);   // bounded ball, ~5 cells across
}
void main(){
  vec2 uv = uvn();
  float t = u_time*0.10;
  vec3 ro = vec3(0.0, 0.0, -9.2);        // far enough back to see many cells
  vec3 rd = normalize(vec3(uv, 1.65));
  mat2 R = rot(t*0.6);   ro.xz *= R;  rd.xz *= R;
  mat2 R2 = rot(t*0.37); ro.yz *= R2; rd.yz *= R2;
  float d = 3.2; bool hit = false; vec3 pos = ro;   // skip empty space to the ball
  for(int i=0;i<110;i++){
    pos = ro + rd*d;
    float h = mapG(pos);
    if(h < 0.0022*d){ hit = true; break; }
    d += h*0.80;                          // crude DE, understep to avoid overshoot
    if(d > 16.0) break;
  }
  vec3 col = tone(uv.y*0.3 + t + length(uv)*0.4, H, W, S)*(0.30 - 0.08*length(uv));
  if(hit){
    vec2 e = vec2(0.004, 0.0);
    vec3 n = normalize(vec3(mapG(pos+e.xyy)-mapG(pos-e.xyy),
                            mapG(pos+e.yxy)-mapG(pos-e.yxy),
                            mapG(pos+e.yyx)-mapG(pos-e.yyx)));
    vec3 c = tone(dot(pos, vec3(0.11)) + u_time*0.04, H, W, S);
    float dif = clamp(dot(n, normalize(vec3(0.6,0.8,-0.5)))*0.5+0.5, 0.0, 1.0);
    float fres = pow(1.0 - abs(dot(n, rd)), 3.0);
    col = c*(0.34 + 1.10*dif*dif) + hsv2rgb(vec3(H+W, 0.30, 1.0))*fres*0.85;
    col *= exp(-max(d-5.0,0.0)*0.075);
  }
  fragColor = vec4(finish(col), 1.0);
}`
},
{
  name: "Menger Lattice",
  tag: "fractal 3d",
  desc: "A cube with its middle third removed in all three axes, then the same cut applied to each of the twenty remaining cubes, four levels down. The limit object has zero volume and infinite surface area. Distance is estimated by folding space into one cell per level.",
  src: `
#define H 0.682
#define W 0.060
#define S 0.78
float sdBox(vec3 p, vec3 b){ vec3 q = abs(p)-b; return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0); }
float mapM(vec3 p){
  float d = sdBox(p, vec3(1.0));
  float s = 1.0;
  for(int m=0;m<4;m++){
    vec3 a = mod(p*s, 2.0) - 1.0;
    s *= 3.0;
    vec3 r = abs(1.0 - 3.0*abs(a));
    float c = (min(max(r.x,r.y), min(max(r.y,r.z), max(r.z,r.x))) - 1.0)/s;
    d = max(d, c);
  }
  return d;
}
void main(){
  vec2 uv = uvn();
  float t = u_time*0.11;
  vec3 ro = vec3(2.6*cos(t), 1.5*sin(t*0.63), 2.6*sin(t));
  vec3 ww = normalize(-ro), uu = normalize(cross(vec3(0,1,0), ww)), vv = cross(ww,uu);
  vec3 rd = normalize(uv.x*uu + uv.y*vv + 1.7*ww);
  float d = 0.0; bool hit = false; vec3 pos = ro;
  for(int i=0;i<80;i++){
    pos = ro + rd*d;
    float h = mapM(pos);
    if(h < 0.0015*d){ hit = true; break; }
    d += h;
    if(d > 9.0) break;
  }
  // lit backdrop so the lattice reads as an object in a room, not a hole in the dark
  vec3 sky = mix(tone(t*0.5, H, W, S), tone(t*0.5 + 0.45, H, W, S), uv.y*0.5+0.5);
  vec3 col = sky*(0.62 - 0.18*length(uv));
  if(hit){
    vec2 e = vec2(0.002, 0.0);
    vec3 n = normalize(vec3(mapM(pos+e.xyy)-mapM(pos-e.xyy),
                            mapM(pos+e.yxy)-mapM(pos-e.yxy),
                            mapM(pos+e.yyx)-mapM(pos-e.yyx)));
    vec3 c = tone(dot(abs(pos), vec3(0.45)) + u_time*0.05, H, W, S);
    float dif = clamp(dot(n, normalize(vec3(0.5,0.9,-0.4))), 0.0, 1.0);
    float bak = clamp(dot(n, normalize(vec3(-0.6,-0.3,0.5))), 0.0, 1.0);
    col = c*(0.52 + 1.00*dif) + tone(t + 0.5, H, W, S)*bak*0.40;
    col += hsv2rgb(vec3(H, 0.15, 1.0))*pow(1.0-abs(dot(n,rd)), 4.0)*0.60;
    col = mix(sky*0.55, col, exp(-d*0.09));   // haze toward the sky, not toward black
  }
  fragColor = vec4(finish(col), 1.0);
}`
},
{
  name: "Newton Basins",
  tag: "fractal",
  desc: "Newton's method solving z cubed equals one. Each pixel is a starting guess, coloured by which of the three roots it converges to. The three basins meet nowhere along a simple curve: every boundary point touches all three at once, a Wada lake in the complex plane.",
  src: `
void main(){
  vec2 z = uvn()*1.55;
  z *= rot(u_time*0.045);
  float relax = 1.0 + 0.42*sin(u_time*0.30);
  float i = 0.0;
  for(int k=0;k<42;k++){
    vec2 z2 = cmul(z,z), z3 = cmul(z2,z);
    vec2 num = z3 - vec2(1.0,0.0);
    if(dot(num,num) < 1e-8) break;
    z -= relax*cdiv(num, 3.0*z2);
    i += 1.0;
  }
  float a = atan(z.y, z.x);
  // one hue per root, so the three basins separate by colour
  // Flat basins are the failure mode here: every point in a basin shares a root,
  // so hue alone gives three slabs of colour. Iteration count varies smoothly
  // inside each basin, so it supplies the interior shading and contour bands.
  float speed = i/42.0;
  float band  = 0.5 + 0.5*sin(speed*42.0*0.55 - u_time*0.9);
  vec3 col = wheel(a/TAU + u_time*0.05, 0.62, 0.52)*(0.42 + 0.85*speed);
  col *= 0.72 + 0.45*band;
  col += wheel(a/TAU + u_time*0.05 + 0.5, 0.45, 1.0)*pow(band, 6.0)*0.18*speed;
  col += vec3(1.0,0.97,0.94)*pow(speed, 3.0)*0.50;
  fragColor = vec4(finish(col), 1.0);
}`
},
{
  name: "Curl Flow",
  tag: "vector field",
  desc: "Every pixel is carried twenty steps along a divergence-free velocity field built from crossed sine waves. Divergence-free means nothing bunches up or thins out, so the streaks stay evenly dense while the field shears them into sheets.",
  src: `
#define H 0.636
#define W 0.065
#define S 0.72
vec2 flow(vec2 p, float t){
  return vec2( sin(p.y*1.7 + t) + 0.55*sin(p.y*3.1 - t*0.7),
               cos(p.x*1.9 - t*0.8) + 0.55*cos(p.x*3.3 + t*0.5) );
}
void main(){
  vec2 p = uvn()*1.6;
  float t = u_time*0.35;
  vec2 q = p;
  for(int i=0;i<20;i++) q += flow(q, t)*0.016;
  float d = length(q - p);
  float f = fbm3(q*2.6 + 3.1);
  vec3 col = tone(f*1.6 + d*3.2 + u_time*0.04, H, W, S);
  col *= 0.30 + 0.85*f;
  col += hsv2rgb(vec3(H+W*1.5, 0.45, 1.0))*smoothstep(0.34, 0.60, d)*0.45;
  fragColor = vec4(finish(col), 1.0);
}`
},
{
  name: "Circle Inversion",
  tag: "conformal",
  desc: "Fold, translate, rotate, then invert through the unit circle: repeat eleven times. Inversion sends the outside of a circle to the inside and preserves angles everywhere, so the copies packed into the centre are distorted in scale but never in shape.",
  src: `
#define H 0.727
#define W 0.055
#define S 0.85
void main(){
  vec2 p = uvn()*1.25;
  float t = u_time*0.08;
  float s = 1.0, trap = 1e9, trapR = 1e9, glow = 0.0;
  for(int i=0;i<11;i++){
    p = abs(p);
    if(p.x < p.y) p = p.yx;
    p -= vec2(0.46 + 0.07*sin(t), 0.0);
    p *= rot(0.26 + 0.13*cos(t*0.8));
    float k = 1.0/max(dot(p,p), 0.035);
    p *= k; s *= k;
    trap  = min(trap,  abs(p.y));
    trapR = min(trapR, length(p));
    glow += 0.055/(0.06 + abs(p.y)*1.6);
  }
  float d = abs(p.x)/s;
  vec3 c  = tone(trap*0.9 + u_time*0.05,        H, W, S);
  vec3 c2 = tone(trapR*0.7 + u_time*0.04 + 0.5, H, W, S);
  vec3 col = c*smoothstep(0.014, 0.0, d)*1.2;
  col += c*exp(-d*35.0)*0.55;
  col += c2*clamp(glow, 0.0, 1.6)*0.30;
  col += hsv2rgb(vec3(H+W, 0.35, 1.0))*exp(-trap*4.0)*0.35;
  fragColor = vec4(finish(col), 1.0);
}`
},
{
  name: "Sierpinski Fold",
  tag: "fractal",
  desc: "The triangle is generated backwards: instead of removing middles, each pixel is repeatedly scaled away from whichever of three vertices is nearest. How many folds a point survives before it flies off says which part of the gasket it belongs to, and that count is the shading.",
  src: `
#define H 0.045
#define W 0.050
#define S 0.85
void main(){
  vec2 p = uvn()*1.5;
  p *= rot(u_time*0.035);
  p.y += 0.12*sin(u_time*0.25);
  vec2 v0 = vec2(0.0, 1.0), v1 = vec2(-0.866, -0.5), v2 = vec2(0.866, -0.5);
  float s = 1.0, sel = 0.0, esc = 9.0, glow = 0.0;
  for(int i=0;i<9;i++){
    vec2 c = v0; float d = length(p-v0);
    float d1 = length(p-v1); if(d1 < d){ d = d1; c = v1; sel += 1.0; }
    float d2 = length(p-v2); if(d2 < d){ d = d2; c = v2; sel += 2.0; }
    p = 2.0*p - c; s *= 2.0;
    glow += 0.09/(0.25 + dot(p,p));
    if(length(p) > 24.0 && esc > 8.5) esc = float(i);
  }
  float dist = length(p)/s;
  vec3 c1 = tone(sel*0.035 + u_time*0.05,       H, W, S);
  vec3 c2 = tone(esc*0.16 + u_time*0.04 + 0.45, H, W, S);
  vec3 col = c2*(0.16 + 0.58*(esc/9.0));
  col += c1*smoothstep(0.030, 0.0, dist)*1.15;
  col += c1*exp(-dist*12.0)*0.50;
  col += hsv2rgb(vec3(H-W, 0.55, 1.0))*clamp(glow, 0.0, 1.2)*0.16;
  fragColor = vec4(finish(col), 1.0);
}`
},
{
  name: "Superformula Bloom",
  tag: "curves",
  desc: "Gielis's superformula, one equation whose exponents bend a circle into starfish, flowers and rounded polygons. Five nested contours run with different symmetry counts, and the exponents drift, so the petals count up and down as it animates.",
  src: `
#define H 0.818
#define W 0.055
#define S 0.85
float superr(float a, float m, float n1, float n2, float n3){
  float t1 = pow(abs(cos(m*a*0.25)), n2);
  float t2 = pow(abs(sin(m*a*0.25)), n3);
  return pow(max(t1+t2, 1e-4), -1.0/n1);
}
void main(){
  vec2 p = uvn()*0.92;
  float a = atan(p.y, p.x), r = length(p);
  vec3 col = tone(r*0.7 + u_time*0.04, H, W, S)*0.10;
  for(int k=0;k<5;k++){
    float fk = float(k);
    float t = u_time*0.18 + fk*0.6;
    // abs(cos(m*a/4)) closes over a full turn only for even integer m. A continuous
    // m leaves the curve open and it tears on the -x axis where atan2 wraps, so
    // step through even m and cross-fade between two closed contours instead.
    float ph  = u_time*0.055 + fk*0.7;
    float seg = floor(ph), w = smoothstep(0.0, 1.0, fract(ph));
    float m0 = 4.0 + 2.0*mod(seg,       4.0);
    float m1 = 4.0 + 2.0*mod(seg + 1.0, 4.0);
    float n1 = 0.35 + 0.22*sin(t*0.4);
    float R = mix(superr(a + t*0.22, m0, n1, 1.7, 1.7),
                  superr(a + t*0.22, m1, n1, 1.7, 1.7), w) * (0.42 + fk*0.22);
    float d = abs(r - R);
    vec3 c  = tone(fk*0.20 + u_time*0.05,       H, W, S);
    vec3 cb = tone(fk*0.20 + u_time*0.05 + 0.4, H, W, S);
    col += cb*smoothstep(R, R*0.20, r)*0.22;
    col += c*smoothstep(0.016, 0.0, d)*1.15;
    col += c*exp(-d*7.0)*0.42;
  }
  fragColor = vec4(finish(col), 1.0);
}`
},
{
  name: "Wave Interference",
  tag: "waves",
  desc: "Six point sources on the plane, each emitting a circular wave that falls off with distance. Their sum is everything wave optics is built on: crests reinforce along hyperbolas and cancel between them, and moving a source drags the whole fringe pattern with it.",
  src: `
#define H 0.364
#define W 0.055
#define S 0.78
void main(){
  vec2 p = uvn()*3.0;
  float t = u_time;
  float s = 0.0;
  for(int i=0;i<6;i++){
    float fi = float(i);
    vec2 c = 2.3*vec2(cos(fi*2.1 + t*0.14), sin(fi*1.7 + t*0.11));
    float d = length(p-c);
    s += sin(d*7.0 - t*2.2 + fi) / (0.55 + d*0.42);
  }
  s /= 4.0;
  vec3 col = tone(s*0.45 + 0.5 + u_time*0.02, H, W, S);
  col *= 0.16 + 1.20*abs(s);
  col += hsv2rgb(vec3(H-W, 0.25, 1.0))*pow(max(s,0.0), 5.0)*0.55;
  col += tone(s*0.3 + u_time*0.03 + 0.4, H, W, S)*0.10;
  fragColor = vec4(finish(col), 1.0);
}`
},
{
  name: "Mobius Grid",
  tag: "conformal",
  desc: "A Mobius transformation, (az+b)/(cz+d), applied to a log-polar checkerboard. These maps send circles to circles and lines to circles and preserve every angle, so the squares stay square locally while the whole grid is dragged between two fixed points.",
  src: `
#define H 0.909
#define W 0.055
#define S 0.78
void main(){
  vec2 z = uvn()*1.15;
  float t = u_time*0.13;
  vec2 A = vec2(cos(t), 0.30*sin(t));
  vec2 B = vec2(0.36*sin(t*0.7), 0.36*cos(t*0.5));
  vec2 C = vec2(0.26*cos(t*0.9), -0.26*sin(t*0.6));
  vec2 D = vec2(1.0, 0.0);
  vec2 w = cdiv(cmul(A,z) + B, cmul(C,z) + D);
  float lr = log(max(length(w), 1e-5)), ang = atan(w.y, w.x);
  vec2 g = vec2(ang*4.0/PI, lr*2.2 + t);
  vec2 gg = abs(fract(g) - 0.5);
  float line = smoothstep(0.075, 0.020, min(gg.x, gg.y));
  float chk = mod(floor(g.x) + floor(g.y), 2.0);
  vec3 c1 = tone(lr*0.25 + t,        H, W, S);
  vec3 c2 = tone(lr*0.25 + t + 0.45, H, W, S);
  vec3 col = mix(c1, c2, chk)*0.68;
  col = mix(col, hsv2rgb(vec3(H, 0.08, 1.0)), line*0.85);
  col *= 0.30 + 0.80*exp(-abs(lr)*0.35);
  fragColor = vec4(finish(col), 1.0);
}`
},
{
  name: "Crystal Shards",
  tag: "cells",
  desc: "Three Worley noise layers stacked at different scales, but distance is measured with a skewed diamond metric instead of a circle. Changing the metric changes the cell shape, so the cells come out as faceted shards rather than rounded blobs.",
  src: `
#define H 0.000
#define W 0.055
#define S 0.85
void main(){
  vec2 p = uvn()*2.6;
  p *= rot(u_time*0.02);
  vec3 col = vec3(0.0);
  for(int L=0;L<3;L++){
    float fl = float(L);
    vec2 q = p*(1.0 + fl*0.95) + fl*7.3;
    vec2 ip = floor(q), fp = fract(q);
    float d = 9.0; vec2 cell = vec2(0.0);
    for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
      vec2 g = vec2(float(x), float(y));
      vec2 o = hash22(ip+g);
      o = 0.5 + 0.5*sin(u_time*0.30 + TAU*o);
      vec2 r = g + o - fp;
      float dd = max(abs(r.x)*0.85 + abs(r.y)*0.55, abs(r.y)*0.95);
      if(dd < d){ d = dd; cell = ip+g; }
    }
    vec3 c = tone(hash21(cell + fl*13.7) + u_time*0.04, H, W, S);
    col += c*smoothstep(0.70, 0.0, d)*(0.80/(1.0+fl*0.7));
    col += c*smoothstep(0.06, 0.0, abs(d-0.30))*0.40;
  }
  fragColor = vec4(finish(col), 1.0);
}`
},
{
  name: "Rose Harmonics",
  tag: "polar",
  desc: "Rose curves, r equals cos of k theta. When k is a whole number the curve closes after one turn; when it is a ratio it keeps going and lays new petals in the gaps. Six of them run at different ratios, which is why the figure never quite settles.",
  src: `
#define H 0.500
#define W 0.050
#define S 0.90
void main(){
  vec2 p = uvn()*0.66;
  float a = atan(p.y, p.x), r = length(p);
  vec3 col = tone(r*0.8 + u_time*0.05, H, W, S)*0.11;
  for(int k=0;k<6;k++){
    float fk = float(k);
    float t = u_time*0.18;
    // abs(cos(k*a)) closes over a full turn only when k is a half-integer; a
    // continuous k tore the petals open on the -x axis where atan2 wraps.
    float ph  = u_time*0.05 + fk*0.8;
    float seg = floor(ph), w = smoothstep(0.0, 1.0, fract(ph));
    float k0 = 1.0 + 0.5*mod(seg,       5.0);
    float k1 = 1.0 + 0.5*mod(seg + 1.0, 5.0);
    float ang = a + t*0.35 + fk;
    float R = 0.95*mix(abs(cos(k0*ang)), abs(cos(k1*ang)), w)
            * (0.55 + 0.42*sin(t*0.5 + fk));
    float d = abs(r - R);
    vec3 c  = tone(fk*0.18 + u_time*0.06,       H, W, S);
    vec3 cb = tone(fk*0.18 + u_time*0.06 + 0.4, H, W, S);
    col += cb*smoothstep(R, R*0.15, r)*0.26;
    col += c*smoothstep(0.016, 0.0, d)*1.10;
    col += c*exp(-d*7.0)*0.40;
  }
  fragColor = vec4(finish(col), 1.0);
}`
}
];
