document.addEventListener('DOMContentLoaded', () => {
    const btnMenu = document.getElementById('btnMenu');
    const nav = document.getElementById('nav');
    const btnSearch = document.getElementById('btnSearch');
    const searchPanel = document.getElementById('searchPanel');
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');

    // Menú responsive controlado por initAlterEgoMenu() al final del archivo.

    if (btnSearch && searchPanel) {
        btnSearch.addEventListener('click', () => searchPanel.classList.toggle('active'));
    }

    function realizarBusqueda() {
        const q = searchInput?.value.trim();
        if (!q) return;
        const enPaginas = window.location.pathname.includes('/paginas/');
        window.location.href = enPaginas
            ? `./productos.html?buscar=${encodeURIComponent(q)}`
            : `./paginas/productos.html?buscar=${encodeURIComponent(q)}`;
    }

    searchBtn?.addEventListener('click', realizarBusqueda);
    searchInput?.addEventListener('keydown', e => {
        if (e.key === 'Enter') realizarBusqueda();
    });

    prepararPerfilDesplegable();
    cargarHeroSlidesPublicos();
    cargarBannersPublicos();

    if (typeof actualizarContadorCarrito === 'function') actualizarContadorCarrito();
});

function rutasBase() {
    const enPaginas = window.location.pathname.includes('/paginas/');
    return {
        enPaginas,
        login: enPaginas ? './login.html' : './paginas/login.html',
        cuenta: enPaginas ? './mi-cuenta.html' : './paginas/mi-cuenta.html',
        pedidos: enPaginas ? './pedidos.html' : './paginas/pedidos.html'
    };
}

function prepararPerfilDesplegable() {
    const profileLinks = document.querySelectorAll('.profile-link');
    if (!profileLinks.length) return;

    profileLinks.forEach(link => {
        const r = rutasBase();
        const usuario = typeof getUsuario === 'function' ? getUsuario() : null;
        const logueado = typeof estaLogueado === 'function' && estaLogueado();

        link.classList.remove('profile-link--label');
        link.classList.add('profile-icon-link');
        link.innerHTML = `<svg class="ae-ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"></circle><path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6"></path></svg>`;
        link.href = logueado ? '#' : r.login;
        link.title = logueado ? 'Perfil' : 'Iniciar sesión';
        link.setAttribute('aria-label', logueado ? 'Abrir perfil' : 'Iniciar sesión');

        if (!logueado) return;

        link.addEventListener('click', async (e) => {
            e.preventDefault();
            await togglePerfilMenu(link);
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.profile-menu-wrap')) cerrarPerfilMenus();
    });
}

async function togglePerfilMenu(link) {
    let wrap = link.closest('.profile-menu-wrap');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'profile-menu-wrap';
        link.parentNode.insertBefore(wrap, link);
        wrap.appendChild(link);
    }

    let menu = wrap.querySelector('.profile-menu');
    if (menu) {
        menu.classList.toggle('active');
        return;
    }

    menu = document.createElement('div');
    menu.className = 'profile-menu active';
    menu.innerHTML = '<p class="profile-menu__loading">Cargando perfil...</p>';
    wrap.appendChild(menu);

    try {
        const perfil = typeof obtenerPerfilBackend === 'function' ? await obtenerPerfilBackend() : getUsuario();
        renderPerfilMenu(menu, perfil || {});
    } catch (error) {
        menu.innerHTML = `<p class="profile-menu__error">No se pudo cargar tu perfil.<br><small>${escaparAppHTML(error.message || '')}</small></p>`;
    }
}

function renderPerfilMenu(menu, perfil) {
    const nombreCompleto = [perfil.nombre, perfil.apellido].filter(Boolean).join(' ') || 'Cliente';

    menu.innerHTML = `
        <div class="profile-menu__header">
            <strong>${escaparAppHTML(nombreCompleto)}</strong>
            <small>${escaparAppHTML(perfil.email || '')}</small>
        </div>
        <form class="profile-menu__form" id="quickProfileForm">
            <label>Nombre<input name="nombre" required disabled value="${escaparAppAttr(perfil.nombre || '')}"></label>
            <label>Apellido<input name="apellido" required disabled value="${escaparAppAttr(perfil.apellido || '')}"></label>
            <label>Teléfono<input name="telefono" disabled value="${escaparAppAttr(perfil.telefono || '')}"></label>
            <label>Tipo documento
                <select name="tipo_documento" disabled>
                    ${['DNI','CE','PASAPORTE'].map(t => `<option value="${t}" ${String(perfil.tipo_documento || '').toUpperCase() === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
            </label>
            <label>Documento<input name="documento" disabled value="${escaparAppAttr(perfil.documento || '')}"></label>
            <label>Dirección<textarea name="direccion" disabled placeholder="Dirección de entrega">${escaparAppHTML(perfil.direccion || '')}</textarea></label>
            <div class="profile-menu__actions">
                <button class="btn btn--secondary btn--small" type="button" id="quickEditProfile">Editar datos</button>
                <button class="btn btn--primary btn--small" type="submit" id="quickSaveProfile" disabled>Guardar</button>
            </div>
        </form>
        <a class="profile-menu__link" href="${rutasBase().cuenta}">Mi cuenta</a>
        <a class="profile-menu__link" href="${rutasBase().pedidos}">Mis pedidos</a>
        <button class="btn btn--secondary btn--small" type="button" id="quickLogout">Cerrar sesión</button>
        <div class="profile-menu__msg" id="quickProfileMsg"></div>
    `;

    menu.querySelector('#quickLogout')?.addEventListener('click', () => {
        cerrarSesion();
        window.location.href = rutasBase().login;
    });

    menu.querySelector('#quickEditProfile')?.addEventListener('click', () => {
        menu.querySelectorAll('#quickProfileForm input, #quickProfileForm textarea, #quickProfileForm select').forEach(campo => campo.disabled = false);
        menu.querySelector('#quickSaveProfile').disabled = false;
        menu.querySelector('#quickEditProfile').disabled = true;
    });

    menu.querySelector('#quickProfileForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = menu.querySelector('#quickProfileMsg');
        const btn = menu.querySelector('#quickSaveProfile');
        const editBtn = menu.querySelector('#quickEditProfile');
        const data = Object.fromEntries(new FormData(e.target).entries());
        try {
            btn.disabled = true;
            btn.textContent = 'Guardando...';
            const res = await actualizarPerfilBackend(data);
            if (res?.usuario) sessionStorage.setItem('alterego_usuario', JSON.stringify(res.usuario));
            msg.textContent = 'Datos guardados correctamente.';
            msg.className = 'profile-menu__msg ok';
            menu.querySelectorAll('#quickProfileForm input, #quickProfileForm textarea, #quickProfileForm select').forEach(campo => campo.disabled = true);
            editBtn.disabled = false;
        } catch (error) {
            msg.textContent = error.message || 'No se pudo guardar.';
            msg.className = 'profile-menu__msg error';
            btn.disabled = false;
        } finally {
            btn.textContent = 'Guardar';
        }
    });
}

function cerrarPerfilMenus() {
    document.querySelectorAll('.profile-menu.active').forEach(menu => menu.classList.remove('active'));
}

function mostrarAppToast(mensaje, tipo = 'ok') {
    let toast = document.getElementById('appToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'appToast';
        toast.className = 'app-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = mensaje;
    toast.className = `app-toast show ${tipo === 'error' ? 'app-toast--error' : ''}`;
    setTimeout(() => { toast.className = 'app-toast'; }, 3000);
}


function prepararMediaGestionada(contenedor) {
    const media = contenedor?.querySelector('video, img');
    if (!media) return Promise.resolve();

    media.style.opacity = '0';
    media.style.visibility = 'hidden';

    return new Promise(resolve => {
        let terminado = false;
        const mostrar = () => {
            if (terminado) return;
            terminado = true;
            media.style.visibility = 'visible';
            media.style.opacity = '1';
            resolve();
        };
        const fallo = () => {
            if (terminado) return;
            terminado = true;
            media.remove();
            resolve();
        };

        if (media.tagName === 'VIDEO') {
            media.muted = true;
            media.playsInline = true;
            media.addEventListener('loadeddata', mostrar, { once: true });
            media.addEventListener('canplay', mostrar, { once: true });
            media.addEventListener('error', fallo, { once: true });
            if (media.readyState >= 2) mostrar();
            else media.load();
        } else {
            media.addEventListener('load', mostrar, { once: true });
            media.addEventListener('error', fallo, { once: true });
            if (media.complete && media.naturalWidth > 0) mostrar();
        }

        // No deja la interfaz bloqueada indefinidamente por una conexión lenta.
        setTimeout(mostrar, 5000);
    });
}

async function cargarHeroSlidesPublicos() {
    if (typeof obtenerHeroSlides !== 'function') return;
    const hero = document.getElementById('heroCarousel');
    if (!hero || hero.dataset.aeHeroReady === '1') return;
    hero.dataset.aeHeroReady = '1';

    try {
        const slides = (await obtenerHeroSlides()).filter(s => s && s.activo !== false);
        if (!slides.length) {
            // Respaldo visual: evita que el carrusel desaparezca si el backend
            // todavía no devuelve diapositivas o está temporalmente fuera de línea.
            slides.push({
                id: 'hero-fallback-carrete',
                titulo: '', etiqueta: '', subtitulo: '', texto_boton: '', enlace: '',
                video: rutasBase().enPaginas ? '../archivos/carrete.MP4' : './archivos/carrete.MP4',
                activo: true
            });
        }

        let actual = 0;
        let renderToken = 0;
        const pintar = async () => {
            const token = ++renderToken;
            const slide = slides[actual] || slides[0];
            const etiqueta = String(slide.etiqueta ?? '').trim();
            const titulo = String(slide.titulo ?? '').trim();
            const subtitulo = String(slide.subtitulo ?? '').trim();
            const textoBoton = String(slide.texto_boton ?? '').trim();
            const enlaceBoton = String(slide.enlace ?? '').trim();
            const tieneContenido = Boolean(etiqueta || titulo || subtitulo || textoBoton);
            const copy = tieneContenido ? `<div class="hero__text">
                        ${etiqueta ? `<span class="tag">${escaparAppHTML(etiqueta)}</span>` : ''}
                        ${titulo ? `<h1>${escaparAppHTML(titulo)}</h1>` : ''}
                        ${subtitulo ? `<p>${escaparAppHTML(subtitulo)}</p>` : ''}
                        ${textoBoton ? `<div class="hero__buttons"><a class="btn btn--primary" href="${escaparAppAttr(enlaceBoton || (rutasBase().enPaginas ? './productos.html' : './paginas/productos.html'))}">${escaparAppHTML(textoBoton)}</a></div>` : ''}
                    </div>` : '';
            hero.innerHTML = `
                <div class="container hero__grid hero-carousel__slide${tieneContenido ? '' : ' hero-carousel__slide--media-only'}">
                    ${copy}
                    <div class="hero__media">${renderHeroMedia(slide)}</div>
                </div>
                ${slides.length > 1 ? `<div class="hero-carousel__dots">${slides.map((_, i) => `<button type="button" class="${i === actual ? 'active' : ''}" data-hero-dot="${i}" aria-label="Banner ${i + 1}"></button>`).join('')}</div>` : ''}
            `;

            await prepararMediaGestionada(hero);
            if (token !== renderToken) return;
            hero.hidden = false;
            hero.removeAttribute('aria-hidden');

            const video = hero.querySelector('video');
            video?.play().catch(() => {});
            hero.querySelectorAll('[data-hero-dot]').forEach(btn => btn.addEventListener('click', () => {
                actual = Number(btn.dataset.heroDot || 0);
                pintar();
            }));
        };

        await pintar();
        if (slides.length > 1) setInterval(() => {
            actual = (actual + 1) % slides.length;
            pintar();
        }, 8000);
    } catch (error) {
        console.error('No se pudo cargar carrusel desde el backend:', error);
        const fallback = {
            id: 'hero-fallback-carrete-error',
            titulo: '', etiqueta: '', subtitulo: '', texto_boton: '', enlace: '',
            video: rutasBase().enPaginas ? '../archivos/carrete.MP4' : './archivos/carrete.MP4'
        };
        hero.innerHTML = `
            <div class="container hero__grid hero-carousel__slide hero-carousel__slide--media-only">
                <div class="hero__media">${renderHeroMedia(fallback)}</div>
            </div>`;
        await prepararMediaGestionada(hero);
        hero.hidden = false;
        hero.removeAttribute('aria-hidden');
        hero.querySelector('video')?.play().catch(() => {});
    }
}

async function cargarBannersPublicos() {
    if (typeof obtenerBanners !== 'function') return;
    const banner = document.getElementById('promoBanner');
    if (!banner) return;

    banner.classList.remove('ae-premium-hidden-banner');
    banner.style.display = 'none';

    try {
        const banners = (await obtenerBanners()).filter(b => b && b.activo !== false);
        if (!banners.length) return;

        const base = rutasBase().enPaginas ? '../' : './';
        banner.innerHTML = `<div class="container promo-banner-list">
            ${banners.map(promo => `
                <div class="promo-banner__inner reveal-card is-visible">
                    <div>
                        <span class="promo-banner__tag">Promoción activa</span>
                        <h2>${escaparAppHTML(promo.titulo || 'Promoción ALTER EGO')}</h2>
                        <p>${escaparAppHTML(promo.subtitulo || '')}</p>
                        <a class="btn btn--primary" href="${escaparAppAttr(normalizarEnlacePublico(promo.enlace || `${base}paginas/promocion.html`))}">${escaparAppHTML(promo.texto_boton || 'Ver promoción')}</a>
                    </div>
                    ${promo.imagen ? renderBannerMedia(promo) : ''}
                </div>
            `).join('')}
        </div>`;
        banner.style.display = '';
    } catch (error) {
        console.error(error);
        banner.style.display = 'none';
    }
}


function renderBannerMedia(banner) {
    const original = String(banner.imagen || '').trim();
    if (!original) return '';
    let media = normalizarRutaPublica(original);
    const version = encodeURIComponent(String(banner.updated_at || banner.id || Date.now()));
    media += `${media.includes('?') ? '&' : '?'}v=${version}`;
    const titulo = escaparAppAttr(banner.titulo || 'Banner');
    if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(original)) {
        return `<video src="${escaparAppAttr(media)}" autoplay muted loop playsinline preload="auto" aria-label="${titulo}"></video>`;
    }
    return `<img src="${escaparAppAttr(media)}" alt="${titulo}">`;
}

function renderHeroMedia(slide) {
    const original = String(slide.video || slide.imagen || '').trim();
    if (!original) return '';

    let media = normalizarRutaPublica(original);
    // Evita que el navegador siga mostrando una versión anterior del mismo archivo.
    const version = encodeURIComponent(String(slide.updated_at || slide.id || Date.now()));
    media += `${media.includes('?') ? '&' : '?'}v=${version}`;

    const titulo = escaparAppAttr(slide.titulo || 'ALTER EGO');
    if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(original)) {
        return `<video src="${escaparAppAttr(media)}" autoplay muted loop playsinline preload="auto" aria-label="${titulo}"></video>`;
    }
    return `<img src="${escaparAppAttr(media)}" alt="${titulo}">`;
}

function escaparAppHTML(valor) {
    return String(valor ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function escaparAppAttr(valor) {
    return escaparAppHTML(valor).replaceAll('`', '&#096;');
}

function normalizarEnlacePublico(enlace) {
    const base = rutasBase();
    let value = String(enlace || '').trim();
    if (!value) return base.enPaginas ? './promocion.html' : './paginas/promocion.html';
    if (/^(https?:|mailto:|tel:|#)/i.test(value)) return value;
    value = value.replace(/promocion\.html/g, 'promocion.html');
    if (base.enPaginas && value.startsWith('./paginas/')) return './' + value.slice('./paginas/'.length);
    if (!base.enPaginas && value.startsWith('./promocion.html')) return './paginas/promocion.html';
    if (!base.enPaginas && value.startsWith('../paginas/')) return './paginas/' + value.slice('../paginas/'.length);
    return value;
}

function normalizarRutaPublica(ruta) {
    const enPaginas = rutasBase().enPaginas;
    let value = String(ruta || '').trim();
    if (!value) return '';
    if (/^(https?:|data:|blob:)/i.test(value)) return value;
    if (enPaginas && value.startsWith('./archivos/')) return '.' + value;
    if (!enPaginas && value.startsWith('../archivos/')) return '.' + value.slice(2);
    return value;
}

// ALTER EGO: menú hamburguesa único y submenú Productos funcional.
(function () {
  function initAlterEgoMenu() {
    const nav = document.getElementById('nav');
    const btn = document.getElementById('btnMenu');
    if (!nav || !btn || btn.dataset.aeMenuReady === '1') return;
    btn.dataset.aeMenuReady = '1';

    const dropdown = nav.querySelector('.nav-dropdown');
    const toggle = nav.querySelector('.nav-dropdown__toggle');
    const isResponsive = () => window.matchMedia('(max-width: 1100px)').matches;

    function closeMenu() {
      nav.classList.remove('active');
      dropdown?.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    }

    btn.setAttribute('aria-expanded', 'false');

    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const open = !nav.classList.contains('active');
      nav.classList.toggle('active', open);
      btn.setAttribute('aria-expanded', String(open));
      if (!open) dropdown?.classList.remove('is-open');
    });

    toggle?.addEventListener('click', (event) => {
      if (!isResponsive()) return;
      event.preventDefault();
      event.stopPropagation();
      dropdown?.classList.toggle('is-open');
    });

    document.addEventListener('click', (event) => {
      if (!isResponsive()) return;
      if (nav.contains(event.target) || btn.contains(event.target)) return;
      closeMenu();
    });

    window.addEventListener('resize', () => {
      if (!isResponsive()) closeMenu();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAlterEgoMenu);
  } else {
    initAlterEgoMenu();
  }
})();


// AE FINAL: menú hamburguesa responsive sin conflictos.
(function () {
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    const btn = document.getElementById('btnMenu');
    const nav = document.getElementById('nav');
    if (!btn || !nav) return;

    // Reemplaza el botón para eliminar escuchadores antiguos que se pisaban.
    const cleanBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(cleanBtn, btn);

    const dropdown = nav.querySelector('.nav-dropdown');
    const toggle = nav.querySelector('.nav-dropdown__toggle');
    const isResponsive = () => window.matchMedia('(max-width: 1100px)').matches;

    function closeAll() {
      nav.classList.remove('active');
      dropdown && dropdown.classList.remove('is-open');
      cleanBtn.setAttribute('aria-expanded', 'false');
    }

    function openNav() {
      nav.classList.add('active');
      cleanBtn.setAttribute('aria-expanded', 'true');
    }

    cleanBtn.setAttribute('aria-controls', 'nav');
    cleanBtn.setAttribute('aria-expanded', 'false');

    cleanBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (!isResponsive()) return;
      nav.classList.contains('active') ? closeAll() : openNav();
    });

    toggle && toggle.addEventListener('click', function (event) {
      if (!isResponsive()) return;
      event.preventDefault();
      event.stopPropagation();
      openNav();
      dropdown && dropdown.classList.toggle('is-open');
    });

    nav.querySelectorAll('a:not(.nav-dropdown__toggle)').forEach(function (link) {
      link.addEventListener('click', function () {
        if (isResponsive()) closeAll();
      });
    });

    document.addEventListener('click', function (event) {
      if (!isResponsive()) return;
      if (nav.contains(event.target) || cleanBtn.contains(event.target)) return;
      closeAll();
    });

    window.addEventListener('resize', function () {
      if (!isResponsive()) closeAll();
    });
  });
})();

/* ALTER EGO FIX FINAL: hamburguesa y submenú productos funcional en responsive */
(function () {
  function initMenuFinal() {
    const nav = document.getElementById('nav');
    const oldBtn = document.getElementById('btnMenu');
    if (!nav || !oldBtn) return;

    const btn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(btn, oldBtn);

    const dropdown = nav.querySelector('.nav-dropdown');
    const toggle = nav.querySelector('.nav-dropdown__toggle');
    const mobile = () => window.matchMedia('(max-width: 1100px)').matches;

    btn.setAttribute('aria-controls', 'nav');
    btn.setAttribute('aria-expanded', 'false');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');

    function closeAll() {
      nav.classList.remove('active');
      dropdown?.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      toggle?.setAttribute('aria-expanded', 'false');
    }

    btn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (!mobile()) return;
      const open = !nav.classList.contains('active');
      nav.classList.toggle('active', open);
      btn.setAttribute('aria-expanded', String(open));
      if (!open) {
        dropdown?.classList.remove('is-open');
        toggle?.setAttribute('aria-expanded', 'false');
      }
    });

    if (toggle && dropdown) {
      toggle.addEventListener('click', function (event) {
        if (!mobile()) return;
        event.preventDefault();
        event.stopPropagation();
        nav.classList.add('active');
        btn.setAttribute('aria-expanded', 'true');
        const open = !dropdown.classList.contains('is-open');
        dropdown.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', String(open));
      });
    }

    nav.querySelectorAll('.nav-dropdown__menu a, nav > a').forEach(function (link) {
      link.addEventListener('click', function () {
        if (mobile()) closeAll();
      });
    });

    document.addEventListener('click', function (event) {
      if (!mobile()) return;
      if (nav.contains(event.target) || btn.contains(event.target)) return;
      closeAll();
    });

    window.addEventListener('resize', function () {
      if (!mobile()) closeAll();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMenuFinal);
  } else {
    initMenuFinal();
  }
})();

/* =====================================================================
   AE FIX DEFINITIVO - menú Productos centrado + franja bajo carrusel
   ===================================================================== */
(function () {
  const CATEGORY_ICONS = ['▦','✦'];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  const norm = (v) => String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const categoryKey = (v) => norm(v)
    .replace(/spay/g, 'spray')
    .replace(/acodicionador/g, 'acondicionador')
    .replace(/mascaras?/g, 'mascarilla')
    .replace(/\bproductos?\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map(word => word.endsWith('es') && word.length > 4 ? word.slice(0, -2) : (word.endsWith('s') && word.length > 3 ? word.slice(0, -1) : word))
    .join(' ');
  const categoryMatches = (category, productCategory) => {
    const a = categoryKey(category);
    const b = categoryKey(productCategory);
    if (!a || !b) return false;
    if (a === b || a.includes(b) || b.includes(a)) return true;
    const at = new Set(a.split(' ').filter(Boolean));
    const bt = new Set(b.split(' ').filter(Boolean));
    const common = [...at].filter(token => bt.has(token));
    return common.length > 0 && common.length >= Math.min(at.size, bt.size);
  };
  const inPages = () => location.pathname.includes('/paginas/');
  const productsUrl = () => inPages() ? './productos.html' : './paginas/productos.html';

  function getSavedBrandImage(name, slug) {
    try {
      const saved = JSON.parse(localStorage.getItem('alterego_brand_images_cache_v1') || '{}');
      return saved[norm(name)] || saved[norm(slug)] || '';
    } catch {
      return '';
    }
  }

  function getBrandItems(products, apiBrands) {
    const active = (apiBrands || [])
      .filter(item => item && item.activo !== false && Number(item.product_count ?? 1) > 0)
      .sort((a,b) => Number(a.orden || 0) - Number(b.orden || 0));
    if (active.length) {
      return active.map(item => ({
        label: String(item.nombre || item.slug || '').trim(),
        href: `${productsUrl()}?marca=${encodeURIComponent(item.nombre || item.slug || '')}`,
        icon: '✦',
        image: item.imagen || getSavedBrandImage(item.nombre, item.slug) || '',
        imageVersion: item.updated_at || item.created_at || Date.now()
      })).filter(item => item.label);
    }
    return [...new Set((products || []).map(p => String(p.marca || '').trim()).filter(Boolean))]
      .sort((a,b) => a.localeCompare(b, 'es'))
      .map(name => {
        const sample = (products || []).find(p => norm(p.marca) === norm(name)) || {};
        return { label:name, href:`${productsUrl()}?marca=${encodeURIComponent(name)}`, icon:'✦', image:sample.marca_imagen || getSavedBrandImage(name, '') || '', imageVersion: sample.updated_at || Date.now() };
      });
  }

  function cardHTML(item, compact = false) {
    if (compact) return `<a class="ae-dropdown-button" href="${item.href}">${esc(item.label)}</a>`;
    const images = (item.images || []).map(normalizarRutaPublica).filter(Boolean);
    let image = normalizarRutaPublica(item.image || images[0] || '');
    if (image && !/^(data:|blob:)/i.test(image)) {
      const separator = image.includes('?') ? '&' : '?';
      const version = item.imageVersion || '1';
      image = `${image}${separator}v=${encodeURIComponent(String(version))}`;
    }
    const rotatingData = images.length > 1
      ? ` data-ae-category-images="${esc(JSON.stringify(images))}" data-ae-image-index="0"`
      : '';
    const media = image
      ? `<span class="ae-strip-card__icon ae-strip-card__icon--image"><img src="${esc(image)}" alt="${esc(item.label)}" loading="lazy" decoding="async" fetchpriority="low"${rotatingData}></span>`
      : `<span class="ae-strip-card__icon">${esc(item.icon || '✦')}</span>`;
    return `<a class="ae-strip-card" href="${item.href}">${media}<strong>${esc(item.label)}</strong></a>`;
  }

  function categoryProductImages(products, category, limit = 12) {
    const seen = new Set();
    return (products || [])
      .filter(product => !category || categoryMatches(category, product.categoria || product.category_name || product.category_slug || ''))
      .map(product => normalizarRutaPublica(product.imagen || product.image || ''))
      .filter(src => {
        if (!src || /producto-default/i.test(src) || seen.has(src)) return false;
        seen.add(src);
        return true;
      })
      .slice(0, limit);
  }

  function startCategoryImageRotation(container) {
    if (!container) return;
    if (container.__aeCategoryRotation) clearInterval(container.__aeCategoryRotation);
    const images = [...container.querySelectorAll('img[data-ae-category-images]')];
    if (!images.length) return;

    // Cambia una sola tarjeta por turno. Así se evitan muchas descargas
    // simultáneas que pueden provocar ERR_NETWORK_IO_SUSPENDED en Chrome.
    let turn = 0;
    container.__aeCategoryRotation = setInterval(() => {
      if (document.hidden || !document.body.contains(container)) return;
      const img = images[turn % images.length];
      turn += 1;
      if (!img) return;

      let list = [];
      try { list = JSON.parse(img.dataset.aeCategoryImages || '[]'); } catch { list = []; }
      if (list.length < 2) return;

      const current = Number(img.dataset.aeImageIndex || 0);
      const next = (current + 1) % list.length;
      img.classList.add('is-changing');
      img.src = list[next];
      img.dataset.aeImageIndex = String(next);
      window.setTimeout(() => img.classList.remove('is-changing'), 180);
    }, 4200);
  }

  function enableDragScroll(row) {
    if (!row || row.dataset.aeDragReady === '1') return;
    row.dataset.aeDragReady = '1';

    let active = false;
    let dragging = false;
    let startX = 0;
    let startScroll = 0;
    let suppressClickUntil = 0;
    const DRAG_THRESHOLD = 7;

    row.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      active = true;
      dragging = false;
      startX = event.clientX;
      startScroll = row.scrollLeft;
      // No se activa el estado de arrastre todavía. Así un clic normal
      // conserva el enlace de la categoría o marca.
    });

    row.addEventListener('pointermove', (event) => {
      if (!active) return;
      const distance = event.clientX - startX;

      if (!dragging && Math.abs(distance) >= DRAG_THRESHOLD) {
        dragging = true;
        row.classList.add('is-dragging');
        row.setPointerCapture?.(event.pointerId);
      }

      if (!dragging) return;
      row.scrollLeft = startScroll - distance;
      event.preventDefault();
    });

    const stop = (event) => {
      if (!active) return;
      active = false;

      if (dragging) {
        suppressClickUntil = Date.now() + 350;
        dragging = false;
        row.classList.remove('is-dragging');
        try { row.releasePointerCapture?.(event.pointerId); } catch {}
      }
    };

    row.addEventListener('pointerup', stop);
    row.addEventListener('pointercancel', stop);
    row.addEventListener('pointerleave', (event) => {
      if (active && dragging && event.pointerType === 'mouse') stop(event);
    });

    row.addEventListener('click', (event) => {
      if (Date.now() >= suppressClickUntil) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);
  }

  function buildRows(products, apiCategories, apiBrands) {
    const activeProducts = (products || []).filter(p => p && p.visible !== false && p.activo !== false);
    const assignedMap = new Map();
    activeProducts.forEach((product) => {
      const raw = String(product.categoria || '').trim();
      if (!raw) return;
      const key = norm(raw);
      if (!assignedMap.has(key)) assignedMap.set(key, raw);
    });

    const panelMap = new Map();
    (apiCategories || []).filter(c => c && c.activo !== false).forEach((item, index) => {
      const nombre = String(item.nombre || item.name || item.categoria || item.slug || '').trim();
      if (!nombre) return;
      panelMap.set(norm(nombre), { ...item, nombre, slug: item.slug || nombre, orden: Number(item.orden || index + 1) });
    });

    // Las categorías se llaman directamente desde las categorías activas del panel,
    // igual que las marcas se llaman desde los productos. No se escriben manualmente.
    const source = [...panelMap.values()]
      .sort((a,b) => Number(a.orden || 0) - Number(b.orden || 0));

    const allProductImages = categoryProductImages(activeProducts, '', 16);
    const categories = [
      { label: 'Todas', href: productsUrl(), icon: CATEGORY_ICONS[0], images: allProductImages, image: allProductImages[0] || '' },
      ...source.map((item, index) => {
        const label = item.nombre || item.name || item.categoria || item.slug || 'Categoría';
        const slug = item.slug || label;
        const productImages = categoryProductImages(activeProducts, label, 12);
        const configuredImage = normalizarRutaPublica(item.imagen || item.image || '');
        const images = [...new Set([configuredImage, ...productImages].filter(Boolean))];
        return { label, href: `${productsUrl()}?categoria=${encodeURIComponent(slug)}`, icon: item.icono || item.icon || '✦', image: images[0] || '', images };
      })
    ];
    const brands = getBrandItems(activeProducts, apiBrands);
    return {
      categories,
      brands,
      quickLinks: [
        { label: 'Todos los productos', href: productsUrl() },
        { label: 'Promociones', href: inPages() ? './promocion.html' : './paginas/promocion.html' },
        { label: 'Ofertas', href: inPages() ? './ofertas.html' : './paginas/ofertas.html' },
        { label: 'Destacados', href: `${productsUrl()}?destacados=1` }
      ]
    };
  }

  async function paintMenuAndStrip() {
    let products = [];
    let apiCategories = [];
    let apiBrands = [];
    try {
      if (typeof obtenerProductos === 'function') products = await obtenerProductos();
      if (typeof obtenerCategorias === 'function') apiCategories = await obtenerCategorias();
      if (typeof obtenerMarcas === 'function') apiBrands = await obtenerMarcas();
    } catch (e) {
      console.warn('No se pudieron cargar productos para el menú.', e);
    }

    const { categories, brands, quickLinks } = buildRows(products, apiCategories, apiBrands);
    const menu = document.getElementById('navProductsMenu') || document.querySelector('.nav-dropdown__menu.ae-products-mega') || document.querySelector('.nav-dropdown .nav-dropdown__menu');
    if (menu) {
      menu.classList.add('ae-products-mega');
      const menuCategories = categories.filter(item => norm(item.label) !== 'todas');
      menu.innerHTML = `
        <div class="ae-menu-quick-links">
          ${quickLinks.map(link => `<a class="ae-dropdown-button" href="${link.href}">${esc(link.label)}</a>`).join('')}
        </div>
        ${menuCategories.length ? `<section class="ae-menu-group">
          <h3>Tipos de producto</h3>
          <div class="ae-menu-row ae-menu-row--categories">${menuCategories.map(item => cardHTML(item, true)).join('')}</div>
        </section>` : ''}
        ${brands.length ? `<section class="ae-menu-group">
          <h3>Marcas</h3>
          <div class="ae-menu-row ae-menu-row--brands">${brands.map(item => cardHTML(item, true)).join('')}</div>
        </section>` : ''}
      `;
    }

    const strip = document.getElementById('homeCategoryBrandStrip');
    if (strip) {
      strip.innerHTML = `
        <div class="ae-home-strip__row ae-home-strip__row--categories">${categories.map(item => cardHTML(item)).join('')}</div>
        <div class="ae-home-strip__row ae-home-strip__row--brands">${brands.map(item => cardHTML(item)).join('')}</div>
      `;
      startCategoryImageRotation(strip.querySelector('.ae-home-strip__row--categories'));
      strip.querySelectorAll('.ae-home-strip__row').forEach(enableDragScroll);
    }
  }

  async function paintHomeBanners() {
    const targets = {
      promocion: document.getElementById('homePromoBanner'),
      destacados: document.getElementById('homeFeaturedBanner'),
      ofertas: document.getElementById('homeOffersBanner')
    };
    const sections = Object.values(targets).filter(Boolean);
    if (!sections.length || typeof obtenerBanners !== 'function') return;

    sections.forEach(section => {
      section.hidden = true;
      section.setAttribute('aria-hidden', 'true');
      section.innerHTML = '';
    });

    try {
      const banners = (await obtenerBanners())
        .filter(b => b && b.activo !== false)
        .sort((a,b) => Number(a.orden || 0) - Number(b.orden || 0));

      await Promise.all(Object.entries(targets).map(async ([kind, section]) => {
        if (!section) return;
        const b = banners.find(item => norm(item.tipo || '') === norm(kind));
        if (!b) return;

        const etiqueta = String(b.etiqueta ?? '').trim();
        const descripcion = String(b.subtitulo ?? '').trim();
        const textoBoton = String(b.texto_boton ?? '').trim() || 'Ver productos';
        const copy = `<div class="home-showcase__copy">
          ${etiqueta ? `<span>${esc(etiqueta)}</span>` : ''}
          <h2>${esc(b.titulo || '')}</h2>
          ${descripcion ? `<p>${esc(descripcion)}</p>` : ''}
          <div class="home-showcase__actions"><a class="btn btn--primary" href="${esc(b.enlace || '#')}">${esc(textoBoton)}</a></div>
        </div>`;
        const media = b.imagen ? renderBannerMedia(b) : '';

        section.innerHTML = `<div class="container home-showcase__inner">
          ${kind === 'destacados' ? `${media}${copy}` : `${copy}${media}`}
        </div>`;

        await prepararMediaGestionada(section);
        section.hidden = false;
        section.removeAttribute('aria-hidden');
        section.querySelector('video')?.play().catch(() => {});
      }));
    } catch (e) {
      sections.forEach(section => {
        section.hidden = true;
        section.setAttribute('aria-hidden', 'true');
        section.innerHTML = '';
      });
      console.warn('No se pudieron cargar los banners.', e);
    }
  }

  function initMenuBehaviour() {
    const nav = document.getElementById('nav');
    const btnMenu = document.getElementById('btnMenu');
    const dropdown = nav?.querySelector('.nav-dropdown');
    const toggleOld = dropdown?.querySelector('.nav-dropdown__toggle');
    if (!nav || !btnMenu || !dropdown || !toggleOld) return;

    const mobile = () => window.matchMedia('(max-width: 1100px)').matches;

    const btn = btnMenu.cloneNode(true);
    btnMenu.parentNode.replaceChild(btn, btnMenu);
    const toggle = toggleOld.cloneNode(true);
    toggleOld.parentNode.replaceChild(toggle, toggleOld);

    function openNav() {
      if (mobile()) nav.classList.add('active');
    }
    function closeAll() {
      nav.classList.remove('active');
      dropdown.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-expanded', 'false');
    }
    function toggleDropdown(force) {
      const open = typeof force === 'boolean' ? force : !dropdown.classList.contains('is-open');
      dropdown.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-expanded', String(open));
    }

    btn.setAttribute('aria-controls', 'nav');
    btn.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-expanded', 'false');

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!mobile()) return;
      const open = !nav.classList.contains('active');
      nav.classList.toggle('active', open);
      btn.setAttribute('aria-expanded', String(open));
      if (!open) toggleDropdown(false);
    });

    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openNav();
      toggleDropdown();
    });

    document.addEventListener('click', (e) => {
      const inside = dropdown.contains(e.target) || toggle.contains(e.target) || nav.contains(e.target) || btn.contains(e.target);
      if (!inside) closeAll();
      if (!mobile() && !dropdown.contains(e.target) && !toggle.contains(e.target)) toggleDropdown(false);
    });

    nav.querySelectorAll('a').forEach((link) => {
      if (link.classList.contains('nav-dropdown__toggle')) return;
      link.addEventListener('click', () => closeAll());
    });

    window.addEventListener('resize', () => {
      if (!mobile()) nav.classList.remove('active');
      toggleDropdown(false);
    });
  }

  let refreshTimer = 0;
  const refreshManagedRows = () => {
    clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => paintMenuAndStrip().catch(console.warn), 120);
  };

  async function init() {
    await paintMenuAndStrip();
    await paintHomeBanners();
    initMenuBehaviour();
    window.addEventListener('storage', (event) => {
      if (event.key === 'alterego_brand_image_updated') refreshManagedRows();
    });
    window.addEventListener('focus', refreshManagedRows);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshManagedRows();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* Navegación: marca visualmente la página actual sin convertir los enlaces en botones. */
(function marcarNavegacionActual() {
  function normalizarRuta(valor) {
    const ruta = String(valor || '').split('?')[0].split('#')[0];
    return ruta.replace(/\\/g, '/').replace(/\/+$/, '') || '/';
  }

  function iniciar() {
    const nav = document.getElementById('nav');
    if (!nav) return;

    const actual = normalizarRuta(window.location.pathname);
    const esInicio = /\/index\.html$/.test(actual) || actual === '/';
    const esProductos = /\/(productos|promocion|ofertas)\.html$/.test(actual);
    const esPedidos = /\/pedidos\.html$/.test(actual);

    nav.querySelectorAll(':scope > a, .nav-dropdown__toggle').forEach((enlace) => {
      enlace.classList.remove('is-current');
      enlace.removeAttribute('aria-current');
    });

    const inicio = nav.querySelector(':scope > a:first-child');
    const productos = nav.querySelector('.nav-dropdown__toggle');
    const pedidos = Array.from(nav.querySelectorAll(':scope > a')).find((a) => /pedidos/i.test(a.textContent));
    const activo = esInicio ? inicio : (esProductos ? productos : (esPedidos ? pedidos : null));

    if (activo) {
      activo.classList.add('is-current');
      activo.setAttribute('aria-current', 'page');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
})();

