// Sensor-style visual presets (CAP-04) + effect controls (CAP-05) as Cesium
// post-process stages. FLIR/NVG are stylized looks, not real sensor data (04-ui-spec).
import { PostProcessStage, Viewer } from 'cesium'

export const PRESETS = ['NORMAL', 'CRT', 'NVG', 'FLIR', 'ANIME', 'NOIR'] as const
export type Preset = (typeof PRESETS)[number]

// One fragment shader, branched by u_mode — avoids six near-identical stages.
const FX_SHADER = /* glsl */ `
uniform sampler2D colorTexture;
uniform float u_mode;      // 0 normal, 1 crt, 2 nvg, 3 flir, 4 anime, 5 noir
uniform float u_pixelate;  // 0..1
uniform float u_sharpen;   // 0..1
uniform float u_time;
in vec2 v_textureCoordinates;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 uv = v_textureCoordinates;

  // pixelation (all modes)
  if (u_pixelate > 0.0) {
    float cells = mix(1200.0, 160.0, u_pixelate);
    uv = (floor(uv * cells) + 0.5) / cells;
  }

  vec3 c = texture(colorTexture, uv).rgb;

  // unsharp mask
  if (u_sharpen > 0.0) {
    vec2 px = 1.0 / vec2(textureSize(colorTexture, 0));
    vec3 blur = (
      texture(colorTexture, uv + vec2(px.x, 0.0)).rgb +
      texture(colorTexture, uv - vec2(px.x, 0.0)).rgb +
      texture(colorTexture, uv + vec2(0.0, px.y)).rgb +
      texture(colorTexture, uv - vec2(0.0, px.y)).rgb) * 0.25;
    c += (c - blur) * u_sharpen * 2.0;
  }

  int mode = int(u_mode + 0.5);
  if (mode == 1) { // CRT: scanlines + slight chroma shift + flicker
    float scan = 0.88 + 0.12 * sin(uv.y * 1200.0);
    c *= scan;
    c.r = texture(colorTexture, uv + vec2(0.0008, 0.0)).r;
    c.b = texture(colorTexture, uv - vec2(0.0008, 0.0)).b;
    c *= 0.97 + 0.03 * sin(u_time * 60.0);
    c = mix(c, c * vec3(0.85, 1.0, 1.05), 0.5); // cool phosphor cast
  } else if (mode == 2) { // NVG: green mono + noise + vignette
    float l = luma(c);
    l = clamp(l * 1.8, 0.0, 1.0);
    c = vec3(0.05, l, 0.1);
    c += (hash(uv * u_time) - 0.5) * 0.09;
    float d = distance(uv, vec2(0.5));
    c *= smoothstep(0.75, 0.35, d);
  } else if (mode == 3) { // FLIR: white-hot grayscale, crushed
    float l = pow(luma(c), 0.75);
    c = vec3(l);
    c += (hash(uv * (u_time + 7.0)) - 0.5) * 0.04;
  } else if (mode == 4) { // ANIME: posterize + saturate
    c = floor(c * 6.0) / 6.0;
    float l = luma(c);
    c = mix(vec3(l), c, 1.6);
  } else if (mode == 5) { // NOIR: high-contrast B&W + grain
    float l = luma(c);
    l = smoothstep(0.15, 0.85, l);
    c = vec3(l) + (hash(uv * (u_time + 3.0)) - 0.5) * 0.06;
  }

  out_FragColor = vec4(c, 1.0);
}
`

export class StyleFx {
  preset: Preset = 'NORMAL'
  pixelate = 0
  sharpen = 0
  private stage: PostProcessStage
  private start = performance.now()

  constructor(private viewer: Viewer) {
    this.stage = new PostProcessStage({
      fragmentShader: FX_SHADER,
      uniforms: {
        u_mode: () => PRESETS.indexOf(this.preset),
        u_pixelate: () => this.pixelate,
        u_sharpen: () => this.sharpen,
        u_time: () => (performance.now() - this.start) / 1000,
      },
    })
    viewer.scene.postProcessStages.add(this.stage)
    this.apply()
  }

  setPreset(p: Preset) {
    this.preset = p
    this.apply()
  }

  setBloom(on: boolean) {
    this.viewer.scene.postProcessStages.bloom.enabled = on
  }

  private apply() {
    // animated presets need continuous frames; requestRenderMode is off (default), so nothing to do —
    // stage stays attached and branches per-preset in the shader.
    this.stage.enabled = this.preset !== 'NORMAL' || this.pixelate > 0 || this.sharpen > 0
  }

  /** call after changing pixelate/sharpen sliders */
  refresh() {
    this.apply()
  }
}
