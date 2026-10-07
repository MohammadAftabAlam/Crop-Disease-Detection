// On-device diagnosis with the small MobileNetV3 model (ONNX Runtime Web).
//
// It makes the same decisions as the AI service (ai-service/cropcare_ai/inference/engine.py):
// flip-averaged logits (TTA), temperature-scaled probabilities, the energy gate, and the
// conformal prediction set that decides confident / ambiguous / unknown / rejected.
// Everything it needs (model, runtime, settings) is stored in Cache Storage by prepareOffline(),
// so it works with no network at all.

// Vite serves ONNX Runtime's plain WebAssembly build from node_modules (hashed file name)
import wasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";

const CACHE = "cropcare-offline-model";
const INFO_URL = "/model/cropcare-mobile.json";
const MODEL_URL = "/model/cropcare-mobile.onnx";
const WASM_URL = wasmUrl;
const READY_KEY = "offlineModelVersion";

let sessionPromise = null;

const modelUrl = (info) => `${MODEL_URL}?v=${info.version}`;

// Cache first, then network (works with or without the service worker)
async function cachedFetch(url) {
  if ("caches" in window) {
    const hit = await caches.match(url);
    if (hit) {
      return hit;
    }
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load ${url} (${response.status})`);
  }
  return response;
}

async function loadInfo() {
  try {
    // Fresh settings when online, the cached copy when not
    const response = await fetch(INFO_URL, { cache: "no-cache" });
    if (response.ok) {
      return response.json();
    }
  } catch {
    // offline
  }
  return (await cachedFetch(INFO_URL)).json();
}

export function offlineVersion() {
  try {
    return localStorage.getItem(READY_KEY);
  } catch {
    return null;
  }
}

// Download the model + runtime once into Cache Storage. onProgress(fraction 0..1).
export async function prepareOffline(onProgress = () => {}) {
  const info = await (await fetch(INFO_URL, { cache: "no-cache" })).json();
  const cache = await caches.open(CACHE);
  const urls = [WASM_URL, modelUrl(info)];
  const expected = { [WASM_URL]: 14_500_000, [modelUrl(info)]: 17_000_000 };
  const done = {};

  for (const url of urls) {
    if (await cache.match(url)) {
      done[url] = expected[url];
      continue;
    }
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`Download failed: ${url}`);
    }
    const total = Number(response.headers.get("content-length")) || expected[url];
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done: finished, value } = await reader.read();
      if (finished) break;
      chunks.push(value);
      received += value.length;
      done[url] = Math.min(received, total);
      onProgress(Object.values(done).reduce((a, b) => a + b, 0) / (expected[WASM_URL] + expected[modelUrl(info)]));
    }
    await cache.put(url, new Response(new Blob(chunks), { headers: response.headers }));
  }

  await cache.put(INFO_URL, new Response(JSON.stringify(info), { headers: { "Content-Type": "application/json" } }));
  // Drop older model versions
  for (const request of await cache.keys()) {
    if (request.url.includes("/model/cropcare-mobile.onnx") && !request.url.endsWith(`v=${info.version}`)) {
      await cache.delete(request);
    }
  }
  try {
    localStorage.setItem(READY_KEY, info.version);
  } catch {
    // only the status badge depends on this
  }
  onProgress(1);
  sessionPromise = null;
  return info;
}

export async function removeOffline() {
  await caches.delete(CACHE);
  try {
    localStorage.removeItem(READY_KEY);
  } catch {
    // ignore
  }
  sessionPromise = null;
}

async function getSession() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const info = await loadInfo();
      const ort = await import("onnxruntime-web/wasm");
      ort.env.wasm.numThreads = 1; // threads need cross-origin isolation headers
      ort.env.wasm.wasmBinary = await (await cachedFetch(WASM_URL)).arrayBuffer();
      const model = new Uint8Array(await (await cachedFetch(modelUrl(info))).arrayBuffer());
      const session = await ort.InferenceSession.create(model, { executionProviders: ["wasm"] });
      return { ort, session, info };
    })().catch((error) => {
      sessionPromise = null;
      throw error;
    });
  }
  return sessionPromise;
}

// PIL's antialiased bilinear resize (Image.resize(..., BILINEAR)), which the model was trained with.
// Separable triangle filter whose support grows with the scale factor, rounded to 8 bits between
// the two passes like PIL. The browser's own canvas scaling differs enough to move
// probabilities across the decision thresholds, so it is not used for the resize.
function resizeAxis(src, srcW, srcH, outLen, horizontal) {
  const inLen = horizontal ? srcW : srcH;
  const scale = inLen / outLen;
  const filterScale = Math.max(scale, 1);
  const support = filterScale;
  const outW = horizontal ? outLen : srcW;
  const outH = horizontal ? srcH : outLen;
  const out = new Uint8ClampedArray(outW * outH * 3);

  for (let o = 0; o < outLen; o += 1) {
    const center = (o + 0.5) * scale;
    const lo = Math.max(0, Math.floor(center - support));
    const hi = Math.min(inLen, Math.ceil(center + support));
    const weights = [];
    let total = 0;
    for (let i = lo; i < hi; i += 1) {
      const d = Math.abs((i - center + 0.5) / filterScale);
      const w = d < 1 ? 1 - d : 0;
      weights.push(w);
      total += w;
    }
    const lines = horizontal ? srcH : srcW;
    for (let line = 0; line < lines; line += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = 0; k < weights.length; k += 1) {
        const i = lo + k;
        const p = (horizontal ? line * srcW + i : i * srcW + line) * 3;
        const w = weights[k] / total;
        r += src[p] * w;
        g += src[p + 1] * w;
        b += src[p + 2] * w;
      }
      const q = (horizontal ? line * outW + o : o * outW + line) * 3;
      out[q] = Math.round(r);
      out[q + 1] = Math.round(g);
      out[q + 2] = Math.round(b);
    }
  }
  return out;
}

// Photo -> normalised CHW floats (plain resize to size x size, no crop), plus its mirror image
async function toInput(file, info) {
  const size = info.imageSize;
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { width, height } = bitmap;
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const rgba = context.getImageData(0, 0, width, height).data;

  const rgb = new Uint8ClampedArray(width * height * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
  }
  const wide = resizeAxis(rgb, width, height, size, true);
  const data = resizeAxis(wide, size, height, size, false);

  const plane = size * size;
  const normal = new Float32Array(3 * plane);
  const flipped = new Float32Array(3 * plane);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const p = (y * size + x) * 3;
      const q = y * size + (size - 1 - x);
      for (let c = 0; c < 3; c += 1) {
        const v = (data[p + c] / 255 - info.mean[c]) / info.std[c];
        normal[c * plane + y * size + x] = v;
        flipped[c * plane + q] = v;
      }
    }
  }
  return { normal, flipped };
}

const softmax = (logits, temperature) => {
  const z = logits.map((v) => v / temperature);
  const max = Math.max(...z);
  const e = z.map((v) => Math.exp(v - max));
  const sum = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / sum);
};

// Free energy on raw logits: higher = less like the training photos
const energy = (logits) => {
  const max = Math.max(...logits);
  return -(max + Math.log(logits.reduce((s, v) => s + Math.exp(v - max), 0)));
};

const candidate = (info, index, probs) => ({
  ...info.classes[index],
  confidence: Math.round(probs[index] * 10000) / 100,
});

// Same result shape as the AI service's /predict (minus severity, heatmap, weather)
export async function diagnoseOffline(files, crop = null) {
  const { ort, session, info } = await getSession();
  const size = info.imageSize;
  const plane = 3 * size * size;
  const perPhoto = info.tta ? 2 : 1;

  const inputs = await Promise.all(files.map((file) => toInput(file, info)));
  const batch = new Float32Array(files.length * perPhoto * plane);
  inputs.forEach((input, i) => {
    batch.set(input.normal, i * perPhoto * plane);
    if (info.tta) batch.set(input.flipped, (i * perPhoto + 1) * plane);
  });

  const output = await session.run({ [info.inputName]: new ort.Tensor("float32", batch, [files.length * perPhoto, 3, size, size]) });
  const raw = Array.from(output[session.outputNames[0]].data);
  const classes = info.classes.length;

  const perImage = inputs.map((_, i) => {
    const logits = Array.from({ length: classes }, (__, k) => {
      let sum = 0;
      for (let t = 0; t < perPhoto; t += 1) sum += raw[(i * perPhoto + t) * classes + k];
      return sum / perPhoto;
    });
    const probs = softmax(logits, info.temperature);
    const score = energy(logits);
    const top = probs.indexOf(Math.max(...probs));
    return {
      index: i,
      probs,
      gate: { passed: info.energyThreshold == null || score <= info.energyThreshold, energy: Math.round(score * 1000) / 1000 },
      top: candidate(info, top, probs),
    };
  });

  const passed = perImage.filter((p) => p.gate.passed);
  const base = {
    offline: true,
    model: { architecture: info.model, version: info.version },
    imagesReceived: files.length,
    imagesUsed: passed.length,
    perImage: perImage.map(({ probs, ...rest }) => rest),
    crops: info.crops,
    severity: null,
    explanation: null,
  };

  if (passed.length === 0) {
    return { ...base, status: "rejected", classId: null, crop: null, disease: null, isHealthy: null, confidence: null, candidates: [] };
  }

  // Several photos of one plant: average their probabilities
  let combined = info.classes.map((_, k) => passed.reduce((s, p) => s + p.probs[k], 0) / passed.length);
  if (crop) {
    // The farmer named the crop: only that crop's classes can be the answer (as on the server)
    const kept = combined.map((p, k) => (info.classes[k].crop.toLowerCase() === crop ? p : 0));
    const total = kept.reduce((a, b) => a + b, 0);
    if (total > 0) combined = kept.map((p) => p / total);
  }
  const threshold = 1 - info.qhat;
  const set = combined.map((p, k) => [p, k]).filter(([p]) => p >= threshold).sort((a, b) => b[0] - a[0]).map(([, k]) => k);
  const best = combined.indexOf(Math.max(...combined));

  let status;
  if (set.length === 1) {
    status = combined[set[0]] >= info.minConfidentProbability ? "confident" : "unknown";
  } else if (set.length >= 2 && set.length <= info.maxAmbiguousSet) {
    status = "ambiguous";
  } else {
    status = "unknown";
  }

  const shown = set.length ? set : combined.map((p, k) => [p, k]).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([, k]) => k);
  return {
    ...base,
    selectedCrop: crop,
    status,
    ...info.classes[best],
    confidence: Math.round(combined[best] * 10000) / 100,
    candidates: shown.map((k) => candidate(info, k, combined)),
  };
}
