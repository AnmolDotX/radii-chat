// Automatically sync the latest release version & download URL directly from GitHub
(function () {
  const REPO = 'AnmolDotX/radii-chat';
  const CACHE_KEY = 'radii_latest_release';
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minute cache to avoid rate limits

  function applyRelease(tag, downloadUrl, sizeMb) {
    const btn = document.getElementById('download-apk-btn');
    const versionSpan = document.getElementById('release-version-tag') || btn?.querySelector('.version-tag');
    const footerLink = document.getElementById('footer-releases-link');

    if (btn && downloadUrl) {
      btn.href = downloadUrl;
    }
    if (versionSpan && tag) {
      const cleanTag = tag.startsWith('v') ? tag : `v${tag}`;
      const displaySize = sizeMb ? ` · ${sizeMb} MB` : ' · 46 MB';
      versionSpan.textContent = `${cleanTag}${displaySize}`;
    }
    if (footerLink && tag) {
      footerLink.href = `https://github.com/${REPO}/releases/tag/${tag}`;
    }
  }

  // 1. Check local session cache first for instantaneous render
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      applyRelease(cached.tag, cached.downloadUrl, cached.sizeMb);
      return;
    }
  } catch (e) {}

  // 2. Fetch latest release dynamically from GitHub API
  fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      const tag = data.tag_name || 'v1.0.2';
      // Specifically target radii-arm64-v8a.apk as requested
      const armAsset = (data.assets || []).find((a) => a.name === 'radii-arm64-v8a.apk');
      const downloadUrl =
        armAsset?.browser_download_url ||
        `https://github.com/${REPO}/releases/download/${tag}/radii-arm64-v8a.apk`;
      const sizeMb = armAsset?.size ? Math.round(armAsset.size / (1024 * 1024)) : 46;

      applyRelease(tag, downloadUrl, sizeMb);

      try {
        sessionStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ tag, downloadUrl, sizeMb, timestamp: Date.now() })
        );
      } catch (e) {}
    })
    .catch((err) => {
      console.warn('Could not fetch latest release dynamically from GitHub:', err);
    });
})();
