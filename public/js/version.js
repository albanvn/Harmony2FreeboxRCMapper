/**
 * Harmony2FreeboxRCMapper - Affichage de la version et du changelog
 *
 * Copyright (c) 2025
 * Licensed under the MIT License
 *
 * Renseigne tous les éléments [data-app-version] (en-tête, pied de page) avec la version
 * renvoyée par GET /api/version, puis les rend visibles et cliquables : un clic ouvre
 * le changelog (GET /api/changelog) dans une fenêtre modale.
 */
(function () {
  let changelogDialog = null;
  // Requête en cours ou réussie ; remise à null en cas d'échec pour réessayer à la prochaine ouverture.
  let changelogRequest = null;

  function createChangelogDialog() {
    const dialog = document.createElement('dialog');
    dialog.className = 'changelog-dialog';
    dialog.setAttribute('aria-labelledby', 'changelogDialogTitle');

    const header = document.createElement('div');
    header.className = 'changelog-dialog-header';

    const title = document.createElement('h2');
    title.id = 'changelogDialogTitle';
    title.textContent = 'Changelog';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'changelog-dialog-close';
    closeButton.setAttribute('aria-label', 'Fermer');
    closeButton.textContent = '✕';
    closeButton.addEventListener('click', () => dialog.close());

    const body = document.createElement('div');
    body.className = 'changelog-dialog-body';

    header.append(title, closeButton);
    dialog.append(header, body);

    // Un clic sur le fond (hors du contenu) ferme la fenêtre ; Échap est géré nativement.
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });

    document.body.appendChild(dialog);
    return dialog;
  }

  async function loadChangelog(body) {
    body.textContent = 'Chargement…';
    try {
      const response = await fetch('/api/changelog');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (!data.success || typeof data.html !== 'string') {
        throw new Error('invalid /api/changelog response');
      }
      // HTML produit côté serveur à partir de CHANGELOG.md, fichier du projet.
      body.innerHTML = data.html;
    } catch (err) {
      console.error('Error loading changelog:', err);
      body.textContent = 'Impossible de charger le changelog.';
      changelogRequest = null;
    }
  }

  function openChangelog() {
    if (!changelogDialog) {
      changelogDialog = createChangelogDialog();
    }
    if (!changelogDialog.open) {
      changelogDialog.showModal();
    }
    if (!changelogRequest) {
      changelogRequest = loadChangelog(changelogDialog.querySelector('.changelog-dialog-body'));
    }
  }

  function makeChangelogTrigger(element) {
    element.classList.add('changelog-trigger');
    element.setAttribute('role', 'button');
    element.tabIndex = 0;
    element.title = 'Voir le changelog';
    element.addEventListener('click', openChangelog);
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openChangelog();
      }
    });
  }

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
        makeChangelogTrigger(element);
      });
    } catch (err) {
      console.error('Error loading version:', err);
    }
  })();
})();
