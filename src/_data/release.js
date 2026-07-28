import { RELEASES_API, RELEASES_URL, normalize, pickLatest } from "../assets/release-assets.mjs";

// Baked into the page so the download buttons work with JS disabled and so the
// version in the copy is correct on first paint. src/assets/download.js re-checks
// the API in the browser, which is what picks up a new release without a rebuild.
//
// Pinned snapshot: last resort only (offline build, GitHub down, API rate limit).
// Keep it in sync with the newest release you'd be embarrassed to ship stale.
const PINNED = {
  tag_name: "v0.1.0-alpha.2",
  prerelease: true,
  published_at: "2026-07-21T23:16:47Z",
  html_url: `${RELEASES_URL}/tag/v0.1.0-alpha.2`,
  assets: [
    { name: "Riptide-0.1.0-alpha.2.AppImage", size: 124321062 },
    { name: "Riptide-0.1.0-alpha.2-arm64.dmg", size: 117858245 },
    { name: "Riptide-0.1.0-alpha.2.dmg", size: 124951363 },
    { name: "riptide-0.1.0-alpha.2-portable.exe", size: 90601297 },
  ].map((a) => ({ ...a, browser_download_url: `${RELEASES_URL}/download/v0.1.0-alpha.2/${a.name}` })),
};

export default async function () {
  const headers = { accept: "application/vnd.github+json", "user-agent": "riptide.ksriram.dev" };
  // Optional: lifts the 60/hr unauthenticated limit on shared CI build IPs.
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;

  try {
    const res = await fetch(RELEASES_API, { headers, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const latest = pickLatest(await res.json());
    if (!latest) throw new Error("no published releases");
    const release = normalize(latest);
    if (!release.builds.length) throw new Error(`${release.tag} has no recognized assets`);
    console.log(`[release] ${release.tag} — ${release.builds.length} builds`);
    return release;
  } catch (err) {
    console.warn(`[release] falling back to pinned ${PINNED.tag_name}: ${err.message}`);
    return normalize(PINNED);
  }
}
