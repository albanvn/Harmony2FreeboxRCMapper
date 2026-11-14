/**
 * Harmony2FreeboxRCMapper - Affichage de la version
 *
 * Copyright (c) 2025
 * Licensed under the MIT License
 *
 * Renseigne tous les éléments [data-app-version] (en-tête, pied de page) avec la version
 * renvoyée par GET /api/version, puis les rend visibles.
 */
(async function loadAppVersion() {
  const targets = document.querySelectorAll('[data-app-version]');
  if (targets.length === 0) return;

  try {
    const response = await fetch('/api/version');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (!data.success || typeof data.version !== 'string' || data.version === '') {
      throw new Error('invalid /api/version response');
    }
    targets.forEach((element) => {
      element.textContent = 'v' + data.version;
      element.hidden = false;
    });
  } catch (err) {
    console.error('Error loading version:', err);
  }
})();
