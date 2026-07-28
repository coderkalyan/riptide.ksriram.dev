// Single source of truth for turning a GitHub release payload into per-platform
// download links. Imported at build time by src/_data/release.js and at runtime
// by src/assets/download.js, so the two can never drift.

export const REPO = "coderkalyan/riptide";
export const RELEASES_URL = `https://github.com/${REPO}/releases`;
export const RELEASES_API = `https://api.github.com/repos/${REPO}/releases?per_page=10`;

// Riptide ships alpha builds as GitHub *pre-releases*, which the stable
// /releases/latest/download/<asset> alias deliberately skips (it 404s). So the
// asset URLs have to come from the API rather than a fixed redirect.
export const PLATFORMS = [
  { key: "linux-arm64", os: "linux", arch: "arm64", label: "Linux", detail: "AppImage · arm64", match: /arm64.*\.AppImage$/i },
  { key: "linux-x64", os: "linux", arch: "x64", label: "Linux", detail: "AppImage", match: /\.AppImage$/i },
  { key: "mac-arm64", os: "mac", arch: "arm64", label: "macOS", detail: "Apple silicon", match: /arm64\.dmg$/i },
  { key: "mac-x64", os: "mac", arch: "x64", label: "macOS", detail: "Intel", match: /\.dmg$/i },
  { key: "win-arm64", os: "win", arch: "arm64", label: "Windows", detail: "portable · arm64", match: /arm64.*\.exe$/i },
  { key: "win-x64", os: "win", arch: "x64", label: "Windows", detail: "portable", match: /\.exe$/i },
];

// Display order for the "every build" list.
const ORDER = ["linux-x64", "linux-arm64", "mac-arm64", "mac-x64", "win-x64", "win-arm64"];

export function classify(name) {
  // First match wins, so arch-qualified patterns must precede their bare forms.
  return PLATFORMS.find((p) => p.match.test(name)) ?? null;
}

function formatSize(bytes) {
  if (!bytes) return "";
  return `${Math.round(bytes / 1e6)} MB`;
}

/** Newest published release, pre-releases included; drafts excluded. */
export function pickLatest(releases) {
  const usable = (Array.isArray(releases) ? releases : []).filter((r) => r && !r.draft && r.tag_name);
  if (!usable.length) return null;
  return usable.reduce((best, r) => {
    const at = Date.parse(r.published_at || r.created_at || 0) || 0;
    const bestAt = Date.parse(best.published_at || best.created_at || 0) || 0;
    return at > bestAt ? r : best;
  });
}

/** GitHub release JSON -> the shape the page and the client script consume. */
export function normalize(release) {
  const tag = release.tag_name;
  const downloads = {};

  for (const asset of release.assets ?? []) {
    const platform = classify(asset.name);
    if (!platform || downloads[platform.key]) continue;
    downloads[platform.key] = {
      key: platform.key,
      os: platform.os,
      arch: platform.arch,
      label: platform.label,
      detail: platform.detail,
      name: asset.name,
      size: formatSize(asset.size),
      url: asset.browser_download_url,
    };
  }

  // Every field here is inlined into the page as JSON, so it carries only what
  // the template and the client script actually read.
  return {
    tag,
    prerelease: Boolean(release.prerelease),
    releasesUrl: RELEASES_URL,
    builds: ORDER.map((key) => downloads[key]).filter(Boolean),
  };
}

/**
 * Best download for a detected platform, degrading arch -> same-OS build ->
 * null (caller falls back to the releases page).
 */
export function pickBuild(release, os, arch) {
  if (!release || !os) return null;
  const exact = release.builds.find((b) => b.os === os && b.arch === arch);
  if (exact) return exact;
  return release.builds.find((b) => b.os === os) ?? null;
}

/**
 * Apple silicon vs Intel from a WebGL renderer string, for engines with no
 * navigator.userAgentData (Safari, Firefox). Intel Macs report a discrete or
 * integrated GPU vendor; Apple silicon reports "Apple GPU" / "Apple M…".
 * Anything unreadable defaults to arm64 — the overwhelming majority of Macs
 * still receiving updates, and the build that a wrong guess strands is the
 * rarer one.
 */
export function archFromRenderer(renderer) {
  return /intel|amd|radeon|nvidia|geforce/i.test(String(renderer ?? "")) ? "x64" : "arm64";
}
