// Turns the download buttons into direct, platform-correct asset links.
//
// The page ships with the newest release baked in at build time (src/_data/release.js);
// this script (a) points each button at the right binary for the visitor's OS/arch and
// (b) re-checks the GitHub API so a release pushed after the last site build is picked
// up without a rebuild. Every step degrades to the server-rendered markup on failure.

import { RELEASES_API, RELEASES_URL, archFromRenderer, normalize, pickBuild, pickLatest } from "/assets/release-assets.mjs";

const baked = readBaked();
let current = baked;

function readBaked() {
  const el = document.getElementById("release-data");
  if (!el) return null;
  try {
    return JSON.parse(el.textContent);
  } catch {
    return null;
  }
}

/* ── platform detection ───────────────────────────────── */

function detectOs(ua, platform, uaData) {
  // Android's UA also says "Linux", and iPadOS in desktop mode says "Macintosh";
  // no mobile build exists, so bail out of both rather than offer a bad binary.
  if (uaData?.mobile || /android|iphone|ipod|ipad/.test(ua)) return null;
  if (/mac/.test(platform) || /mac os x|macintosh/.test(ua)) {
    return navigator.maxTouchPoints > 1 ? null : "mac"; // iPad pretending to be a Mac
  }
  if (/win/.test(platform) || /windows/.test(ua)) return "win";
  if (/linux|x11|cros/.test(platform) || /linux/.test(ua)) return "linux";
  return null;
}

/** Reads the WebGL renderer string; "" when the GPU can't be identified. */
function gpuRenderer() {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const dbg = gl?.getExtension("WEBGL_debug_renderer_info");
    return dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "";
  } catch {
    return "";
  }
}

async function detectArch(os, ua, uaData) {
  if (uaData?.getHighEntropyValues) {
    try {
      const { architecture } = await uaData.getHighEntropyValues(["architecture"]);
      if (architecture) return /arm/i.test(architecture) ? "arm64" : "x64";
    } catch {
      /* fall through */
    }
  }
  if (/aarch64|arm64/.test(ua)) return "arm64";
  if (os === "mac") return archFromRenderer(gpuRenderer());
  return "x64";
}

async function detect() {
  const uaData = navigator.userAgentData;
  const ua = navigator.userAgent.toLowerCase();
  const platform = (uaData?.platform || navigator.platform || "").toLowerCase();
  const os = detectOs(ua, platform, uaData);
  return { os, arch: os ? await detectArch(os, ua, uaData) : null };
}

/* ── rendering ────────────────────────────────────────── */

function renderButtons(release, build) {
  for (const el of document.querySelectorAll("[data-dl]")) {
    el.href = build ? build.url : release?.releasesUrl || RELEASES_URL;
    // data-dl="short" (the sticky-header button) keeps its terse label.
    if (el.dataset.dl !== "short") el.textContent = build ? `Download for ${build.label}` : "Download";
    if (build) {
      el.setAttribute("download", build.name); // same-origin hint; GitHub sets Content-Disposition anyway
      el.removeAttribute("target");
      el.removeAttribute("rel");
    }
  }
}

function renderMeta(release, build) {
  if (!release) return;
  // No detected build (mobile, unknown OS): the tag alone, since the adjacent
  // "all platforms" link already says where the rest live.
  const bits = [release.tag];
  if (build) bits.push(build.detail === build.label ? build.detail : `${build.label} · ${build.detail}`);
  const text = bits.filter(Boolean).join(" · ");
  for (const el of document.querySelectorAll("[data-dl-meta]")) el.textContent = text;
  for (const el of document.querySelectorAll("[data-dl-version]")) el.textContent = release.tag;
}

function renderBuilds(release) {
  for (const list of document.querySelectorAll("[data-dl-builds]")) {
    list.replaceChildren(
      ...release.builds.map((b) => {
        const a = document.createElement("a");
        a.className = "dl-build";
        a.dataset.key = b.key;
        a.href = b.url;
        a.setAttribute("download", b.name);
        a.innerHTML =
          `<span class="b-os">${b.label}</span>` +
          `<span class="b-det">${b.detail}</span>` +
          `<span class="b-size">${b.size}</span>`;
        return a;
      }),
    );
  }
}

/** Highlights the visitor's build in the (server-rendered or rebuilt) list. */
function markMatch(build) {
  for (const a of document.querySelectorAll("[data-dl-builds] .dl-build")) {
    a.classList.toggle("is-match", Boolean(build) && a.dataset.key === build.key);
  }
}

function apply(release, build, { rebuildList }) {
  renderButtons(release, build);
  renderMeta(release, build);
  if (rebuildList) renderBuilds(release);
  markMatch(build);
}

/* ── refresh ──────────────────────────────────────────── */

async function fetchLatest() {
  const res = await fetch(RELEASES_API, {
    headers: { accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const latest = pickLatest(await res.json());
  if (!latest) throw new Error("no published releases");
  const release = normalize(latest);
  if (!release.builds.length) throw new Error(`${release.tag} has no recognized assets`);
  return release;
}

const platform = await detect();
if (baked) apply(baked, pickBuild(baked, platform.os, platform.arch), { rebuildList: false });

try {
  const fresh = await fetchLatest();
  if (fresh.tag !== baked?.tag) {
    current = fresh;
    apply(fresh, pickBuild(fresh, platform.os, platform.arch), { rebuildList: true });
  }
} catch {
  // Rate-limited, offline, or blocked: the baked-in release stays in place.
}

export { current as release, platform };
