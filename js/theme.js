(function () {
  const STORAGE_KEY = 'alterego_theme_mode';
  const DEFAULT_THEME = 'dark';

  function getStoredTheme() {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : DEFAULT_THEME;
  }

  function applyTheme(theme) {
    const mode = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', mode);
    document.body?.setAttribute('data-theme', mode);
    sessionStorage.setItem(STORAGE_KEY, mode);

    // Cambia el logo según el tema: negro en modo claro, blanco en modo oscuro.
    document.querySelectorAll('.logo img, .admin-brand img, .auth-logo, .footer__logo').forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (!src) return;
      if (!img.dataset.logoDark) {
        const slash = src.lastIndexOf('/');
        const base = slash >= 0 ? src.slice(0, slash + 1) : '';
        img.dataset.logoDark = `${base}blanco.png`;
        img.dataset.logoLight = `${base}negro.png`;
      }
      img.setAttribute('src', mode === 'light' ? img.dataset.logoLight : img.dataset.logoDark);
    });

    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(mode === 'light'));
      btn.setAttribute('title', mode === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
      btn.querySelector('.theme-toggle__label')?.replaceChildren(document.createTextNode(mode === 'light' ? 'Claro' : 'Oscuro'));
    });
  }

  function createThemeToggle(extraClass) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `theme-toggle ${extraClass || ''}`.trim();
    btn.setAttribute('data-theme-toggle', 'true');
    btn.setAttribute('aria-label', 'Cambiar modo claro u oscuro');
    btn.innerHTML = `
      <span class="theme-toggle__icon theme-toggle__sun" aria-hidden="true">☀</span>
      <span class="theme-toggle__label">Tema</span>
      <span class="theme-toggle__icon theme-toggle__moon" aria-hidden="true">☾</span>
    `;
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || getStoredTheme();
      applyTheme(current === 'light' ? 'dark' : 'light');
    });
    return btn;
  }

  function insertThemeToggles() {
    if (!document.querySelector('[data-theme-toggle]')) {
      const publicLogo = document.querySelector('.header .logo');
      const adminBrand = document.querySelector('.admin-topbar .admin-brand');
      const authCard = document.querySelector('.auth-card');

      if (publicLogo && publicLogo.parentNode) {
        publicLogo.insertAdjacentElement('afterend', createThemeToggle('theme-toggle--header'));
      } else if (adminBrand && adminBrand.parentNode) {
        adminBrand.insertAdjacentElement('afterend', createThemeToggle('theme-toggle--admin'));
      } else if (authCard && authCard.parentNode) {
        const wrap = document.createElement('div');
        wrap.className = 'theme-floating-wrap';
        wrap.appendChild(createThemeToggle('theme-toggle--floating'));
        document.body.appendChild(wrap);
      } else {
        const wrap = document.createElement('div');
        wrap.className = 'theme-floating-wrap';
        wrap.appendChild(createThemeToggle('theme-toggle--floating'));
        document.body.appendChild(wrap);
      }
    }
    applyTheme(getStoredTheme());
  }

  applyTheme(getStoredTheme());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', insertThemeToggles);
  } else {
    insertThemeToggles();
  }
})();
