const PRODUCTOS_TIENDA_POR_PAGINA = 20;
const PRODUCTOS_TIENDA_POR_PAGINA_MOVIL = 21;
let paginaTienda = 1;

function productosPorPaginaAE() {
    return window.matchMedia('(max-width: 760px)').matches
        ? PRODUCTOS_TIENDA_POR_PAGINA_MOVIL
        : PRODUCTOS_TIENDA_POR_PAGINA;
}

function limitarProductosIndexAE(lista) {
    const productos = Array.isArray(lista) ? lista : [];
    const ancho = window.innerWidth || document.documentElement.clientWidth || 1200;
    let limite = productos.length;

    // Solo devuelve cantidades que completan filas enteras:
    // escritorio: 10 o 5 (5 columnas)
    // tablet: 8 o 4 (4 columnas)
    // celular: 9, 6 o 3 (3 columnas)
    if (ancho <= 700) {
        if (productos.length >= 9) limite = 9;
        else if (productos.length >= 6) limite = 6;
        else if (productos.length >= 3) limite = 3;
    } else if (ancho <= 1100) {
        if (productos.length >= 8) limite = 8;
        else if (productos.length >= 4) limite = 4;
    } else {
        if (productos.length >= 10) limite = 10;
        else if (productos.length >= 5) limite = 5;
    }

    return productos.slice(0, limite);
}


function claveCategoriaAE(valor) {
    return normalizarTexto(valor)
        .replace(/spay/g, 'spray')
        .replace(/acodicionador/g, 'acondicionador')
        .replace(/mascaras?/g, 'mascarilla')
        .replace(/\bproductos?\b/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)
        .map(palabra => palabra.endsWith('es') && palabra.length > 4 ? palabra.slice(0, -2) : (palabra.endsWith('s') && palabra.length > 3 ? palabra.slice(0, -1) : palabra))
        .join(' ');
}

function coincideCategoriaAE(categoriaPanel, categoriaProducto) {
    const a = claveCategoriaAE(categoriaPanel);
    const b = claveCategoriaAE(categoriaProducto);
    if (!a || !b) return false;
    if (a === b || a.includes(b) || b.includes(a)) return true;
    const tokensA = new Set(a.split(' ').filter(Boolean));
    const tokensB = new Set(b.split(' ').filter(Boolean));
    const comunes = [...tokensA].filter(token => tokensB.has(token));
    return comunes.length > 0 && comunes.length >= Math.min(tokensA.size, tokensB.size);
}

function breakpointIndexAE() {
    const ancho = window.innerWidth || document.documentElement.clientWidth || 1200;
    if (ancho <= 700) return 'mobile';
    if (ancho <= 1100) return 'tablet';
    return 'desktop';
}

let breakpointIndexActualAE = breakpointIndexAE();
window.addEventListener('resize', () => {
    const nuevoBreakpoint = breakpointIndexAE();
    if (nuevoBreakpoint !== breakpointIndexActualAE) {
        breakpointIndexActualAE = nuevoBreakpoint;
        window.location.reload();
    }
}, { passive: true });

document.addEventListener('DOMContentLoaded', async () => {
    inicializarFiltrosMovilProductos();

    const featured = document.getElementById('featuredProducts');
    const offers = document.getElementById('offersProducts');
    const grid = document.getElementById('productsGrid');
    const indexOffersGrid = document.getElementById('indexOffersGrid');
    const indexPromoGrid = document.getElementById('indexPromoGrid');

    if (!featured && !offers && !grid && !indexOffersGrid && !indexPromoGrid) {
        return;
    }

    try {

        const productos = (await obtenerProductos()).filter(p => p.visible !== false && p.activo !== false);

        if (featured) {

            renderProductos(
                limitarProductosIndexAE(productos.filter(p => p.destacado)),
                featured
            );

        }

        if (offers) {
            renderProductos(
                limitarProductosIndexAE(productos.filter(p => p.en_oferta)),
                offers
            );
        }

        if (indexOffersGrid && typeof obtenerOfertas === 'function') {
            try {
                renderProductos(limitarProductosIndexAE(await obtenerOfertas()), indexOffersGrid);
            } catch (e) {
                console.error('No se pudieron cargar ofertas:', e);
                indexOffersGrid.innerHTML = '<div class="empty">No hay ofertas activas.</div>';
            }
        }

        if (indexPromoGrid && typeof obtenerPromociones === 'function') {
            try {
                renderProductos(limitarProductosIndexAE(await obtenerPromociones()), indexPromoGrid);
            } catch (e) {
                console.error('No se pudieron cargar promociones:', e);
                indexPromoGrid.innerHTML = '<div class="empty">No hay promociones activas.</div>';
            }
        }

        if (grid) {

            const params = new URLSearchParams(
                window.location.search
            );

            const categoria =
                params.get('categoria');

            const buscar =
                (params.get('buscar') || '')
                    .toLowerCase();

            const marcaInicial =
                params.get('marca') || '';

            const soloDestacados = params.get('destacados') === '1';

            const select =
                document.getElementById('categoryFilter');

            const brandFilter =
                document.getElementById('brandFilter');

            const input =
                document.getElementById('productsSearch');

            await cargarCategoriasTiendaAutomaticas(productos, select);
            const categoryChecksBox = document.querySelector('.shop-category-checks') || document.querySelector('.shop-checks');
            const categoryChecks = document.querySelectorAll('[data-category-check]');
            const brandChecksBox = document.getElementById('brandChecks');
            const orderFilter = document.getElementById('orderFilter');

            if (select && categoria) {
                const option = [...select.options].find(op =>
                    normalizarTexto(op.value) === normalizarTexto(categoria) ||
                    normalizarTexto(op.textContent) === normalizarTexto(categoria) ||
                    normalizarTexto(op.dataset.slug || '') === normalizarTexto(categoria)
                );
                select.value = option ? option.value : categoria;
            }

            if (input && buscar) {
                input.value = buscar;
            }

            if (brandFilter) {
                cargarMarcasAutomaticas(
                    productos,
                    brandFilter,
                    brandChecksBox
                );

                if (marcaInicial) {
                    const marcaCoincidente = [...brandFilter.options].find(op =>
                        normalizarTexto(op.value) === normalizarTexto(marcaInicial)
                    );
                    if (marcaCoincidente) {
                        brandFilter.value = marcaCoincidente.value;
                    }
                }
                sincronizarMarcaChecks(brandChecksBox, brandFilter.value);
            }

            const aplicar = (mantenerPagina = false) => {

                if (!mantenerPagina) paginaTienda = 1;

                let lista = [...productos];

                const cat =
                    select
                        ? select.value
                        : categoria;

                const marca =
                    brandFilter
                        ? brandFilter.value
                        : '';

                const q =
                    input
                        ? input.value.trim().toLowerCase()
                        : buscar;

                if (cat) {
                    const selectedOption = select ? select.options[select.selectedIndex] : null;
                    const categoryId = selectedOption?.dataset?.id || '';
                    lista = lista.filter(p => typeof window.aeCategoriaCoincideProducto === 'function'
                        ? window.aeCategoriaCoincideProducto(cat, p, categoryId)
                        : coincideCategoriaAE(cat, p.categoria));
                }

                if (marca) {
                    lista = lista.filter(
                        p => p.marca === marca
                    );
                }

                if (soloDestacados) {
                    lista = lista.filter(p => Boolean(p.destacado));
                }

                if (q) {
                    lista = lista.filter(p =>
                        `${p.nombre} ${p.marca} ${p.descripcion} ${p.codigo || ''}`
                            .toLowerCase()
                            .includes(q)
                    );
                }

                const orden = orderFilter ? orderFilter.value : '';
                if (orden === 'precio_asc') {
                    lista.sort((a, b) => Number(a.precio || 0) - Number(b.precio || 0));
                } else if (orden === 'precio_desc') {
                    lista.sort((a, b) => Number(b.precio || 0) - Number(a.precio || 0));
                } else if (orden === 'nombre') {
                    lista.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')));
                }

                renderProductosTiendaPaginados(lista, grid);
            };

            if (select) {
                select.addEventListener(
                    'change',
                    aplicar
                );
            }

            if (categoryChecks.length && select) {
                categoryChecks.forEach(check => {
                    const coincide = categoria && (
                        normalizarTexto(check.value) === normalizarTexto(categoria) ||
                        normalizarTexto(check.dataset.slug || '') === normalizarTexto(categoria)
                    );
                    if (coincide) check.checked = true;
                    check.addEventListener('change', () => {
                        categoryChecks.forEach(other => { if (other !== check) other.checked = false; });
                        select.value = check.checked ? check.value : '';
                    });
                });
            }

            if (orderFilter) {
                orderFilter.addEventListener('change', aplicar);
            }

            if (brandFilter) {
                brandFilter.addEventListener('change', () => {
                    sincronizarMarcaChecks(brandChecksBox, brandFilter.value);
                    aplicar();
                });
            }

            if (brandChecksBox && brandFilter) {
                brandChecksBox.addEventListener('change', (event) => {
                    const check = event.target.closest('[data-brand-check]');
                    if (!check) return;
                    brandChecksBox.querySelectorAll('[data-brand-check]').forEach(other => {
                        if (other !== check) other.checked = false;
                    });
                    brandFilter.value = check.checked ? check.value : '';
                });
            }

            if (input) {
                input.addEventListener(
                    'input',
                    aplicar
                );
            }

            const btnAplicarFiltros = document.getElementById('applyShopFilters');
            const btnLimpiarFiltros = document.getElementById('clearShopFilters');

            if (btnAplicarFiltros) {
                btnAplicarFiltros.addEventListener('click', () => {
                    aplicar();
                    cerrarFiltrosResponsiveProductos();
                });
            }

            if (btnLimpiarFiltros) {
                btnLimpiarFiltros.addEventListener('click', () => {
                    if (input) input.value = '';
                    if (select) select.value = '';
                    if (brandFilter) brandFilter.value = '';
                    categoryChecks.forEach(check => { check.checked = false; });
                    if (brandChecksBox) brandChecksBox.querySelectorAll('[data-brand-check]').forEach(check => { check.checked = false; });
                    aplicar();
                    cerrarFiltrosResponsiveProductos();
                });
            }

            aplicar();
        }

    } catch (error) {

        const target = featured || grid || offers || indexOffersGrid || indexPromoGrid;

        if (target) {
            target.innerHTML = `
                <div class="empty">
                    No se pudieron cargar los productos.
                </div>
            `;
        }

        console.error(error);
    }

});


async function cargarCategoriasTiendaAutomaticas(productos, select) {
    const contenedor = document.getElementById('categoryChecks') || document.querySelector('.shop-category-checks');
    let categorias = [];

    try {
        if (typeof obtenerCategorias !== 'function') {
            throw new Error('La función obtenerCategorias no está disponible');
        }

        const respuesta = await obtenerCategorias();
        categorias = (Array.isArray(respuesta) ? respuesta : [])
            .filter(c => c && c.activo !== false && String(c.nombre || c.slug || '').trim())
            .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
    } catch (error) {
        console.error('No se pudieron cargar las categorías activas del panel:', error);
        if (select) select.innerHTML = '<option value="">No se pudieron cargar las categorías</option>';
        if (contenedor) contenedor.innerHTML = '<small class="shop-muted">No se pudieron cargar las categorías del panel.</small>';
        return [];
    }

    if (select) {
        select.innerHTML = '<option value="">Todas las categorías</option>' + categorias.map(cat => {
            const nombre = String(cat.nombre || cat.slug || '').trim();
            const slug = String(cat.slug || nombre).trim();
            return `<option value="${escaparHTMLProductos(slug)}" data-id="${escaparHTMLProductos(cat.id || '')}" data-slug="${escaparHTMLProductos(slug)}">${escaparHTMLProductos(nombre)}</option>`;
        }).join('');
    }

    if (contenedor) {
        contenedor.innerHTML = categorias.length
            ? categorias.map(cat => {
                const nombre = String(cat.nombre || cat.slug || '').trim();
                const slug = String(cat.slug || nombre).trim();
                return `<label class="shop-check-item"><input type="checkbox" data-category-check value="${escaparHTMLProductos(slug)}" data-category-id="${escaparHTMLProductos(cat.id || '')}" data-slug="${escaparHTMLProductos(slug)}"><span>${escaparHTMLProductos(nombre)}</span></label>`;
            }).join('')
            : '<small class="shop-muted">No hay categorías activas en el panel.</small>';
    }

    return categorias;
}

function cargarMarcasAutomaticas(productos, brandFilter, brandChecksBox) {

    const marcas = [
        ...new Set(
            productos
                .map(p => p.marca)
                .filter(Boolean)
        )
    ].sort();

    brandFilter.innerHTML = `
        <option value="">
            Todas las marcas
        </option>
    `;

    marcas.forEach(marca => {

        brandFilter.innerHTML += `
            <option value="${escaparHTMLProductos(marca)}">
                ${escaparHTMLProductos(marca)}
            </option>
        `;

    });

    if (brandChecksBox) {
        brandChecksBox.innerHTML = marcas.length
            ? marcas.map(marca => `
                <label>
                    <input type="checkbox" data-brand-check value="${escaparHTMLProductos(marca)}">
                    <span>${escaparHTMLProductos(marca)}</span>
                </label>
            `).join('')
            : '<small class="shop-muted">No hay marcas disponibles.</small>';
    }

}

function sincronizarMarcaChecks(brandChecksBox, marcaActual) {
    if (!brandChecksBox) return;
    brandChecksBox.querySelectorAll('[data-brand-check]').forEach(check => {
        check.checked = normalizarTexto(check.value) === normalizarTexto(marcaActual);
    });
}

function renderProductos(productos, contenedor) {

    if (!productos.length) {

        contenedor.innerHTML = `
            <div class="empty shop-empty">
                No se encontraron productos.
            </div>
        `;

        actualizarShopCounter(0);
        return;
    }

    actualizarShopCounter(productos.length);

    contenedor.innerHTML = productos
        .map((p, index) => {
            const sinStock = Number(p.stock) <= 0 || p.activo === false;
            const tieneOferta = Boolean(p.en_oferta) && Number(p.precio_oferta || 0) > 0 && Number(p.precio_oferta) < Number(p.precio || 0);
            const precioMostrar = tieneOferta ? Number(p.precio_oferta) : Number(p.precio);
            return `
                <article class="product-card ${sinStock ? 'product-card--empty' : ''} reveal-card js-product-detail" data-product-index="${index}" tabindex="0" role="button" aria-label="Ver detalles de ${escaparHTMLProductos(p.nombre || 'Producto')}">
                    <div class="product-card__img">
                        ${(p.en_promocion || p.promocion || p.promocionado) ? '<span class="offer-badge">Promo</span>' : (tieneOferta ? '<span class="offer-badge">Oferta</span>' : '')}
                        <img src="${escaparHTMLProductos(rutaImagenProductoAE(p.imagen || ''))}" alt="${escaparHTMLProductos(p.nombre || 'Producto')}" loading="lazy" decoding="async" fetchpriority="low">
                    </div>

                    <div class="product-card__body">
                        <span class="product-card__brand">
                            ${escaparHTMLProductos(p.marca || 'Sin marca')}
                        </span>

                        <h3 class="product-card__title">
                            ${escaparHTMLProductos(p.nombre || 'Producto')}
                        </h3>


                        <div class="product-card__status-row product-card__status-row--center">
                            <button class="small-btn js-add-cart product-card__add-btn ${sinStock ? 'product-card__add-btn--empty' : ''}" type="button" data-product-index="${index}" ${sinStock ? 'disabled' : ''} aria-label="${sinStock ? 'Producto no disponible' : 'Añadir producto al carrito'}">
                                ${sinStock ? '' : '<span class="product-card__cart-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L20 8H7"/><circle cx="10" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/></svg></span>'}
                                <span>${sinStock ? 'NO DISPONIBLE' : 'AÑADIR'}</span>
                            </button>
                        </div>

                        <div class="product-card__bottom">
                            <span class="price ${tieneOferta ? 'price--offer' : ''}">
                                ${tieneOferta ? `<small class="old-price">${formatoSoles(p.precio)}</small><span class="current-price">${formatoSoles(precioMostrar)}</span>` : `<span class="current-price">${formatoSoles(p.precio)}</span>`}
                            </span>

                        </div>
                    </div>
                </article>
            `;
        })
        .join('');

    activarAnimacionProductos(contenedor);

    contenedor.querySelectorAll('.js-add-cart').forEach(btn => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            const index = Number(btn.dataset.productIndex);
            const producto = productos[index];
            if (producto && typeof agregarAlCarrito === 'function') {
                const tieneOferta = Boolean(producto.en_oferta) && Number(producto.precio_oferta || 0) > 0 && Number(producto.precio_oferta) < Number(producto.precio || 0);
                const precioMostrar = tieneOferta ? Number(producto.precio_oferta) : Number(producto.precio);
                agregarAlCarrito({ ...producto, precio: precioMostrar, precio_normal: Number(producto.precio || 0) });
            }
        });
    });

    contenedor.querySelectorAll('.js-product-detail').forEach(card => {
        const abrir = () => {
            const index = Number(card.dataset.productIndex);
            const producto = productos[index];
            if (producto) abrirModalProductoAE(producto);
        };
        card.addEventListener('click', (event) => {
            if (event.target.closest('.js-add-cart')) return;
            abrir();
        });
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                abrir();
            }
        });
    });
}

function asegurarModalProductoAE() {
    let modal = document.getElementById('productDetailModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'product-detail-modal';
    modal.id = 'productDetailModal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="product-detail-modal__backdrop" data-close-product-modal></div>
      <article class="product-detail-modal__card" role="dialog" aria-modal="true" aria-labelledby="productModalTitle">
        <button class="product-detail-modal__close" type="button" data-close-product-modal aria-label="Cerrar">×</button>
        <div id="productDetailModalContent"></div>
      </article>`;
    document.body.appendChild(modal);
    return modal;
}

function abrirModalProductoAE(producto) {
    const modal = asegurarModalProductoAE();
    const content = modal.querySelector('#productDetailModalContent');
    const stock = Math.max(0, Number(producto.stock || 0));
    const sinStock = stock <= 0 || producto.activo === false;
    const tieneOferta = Boolean(producto.en_oferta) && Number(producto.precio_oferta || 0) > 0 && Number(producto.precio_oferta) < Number(producto.precio || 0);
    const precio = tieneOferta ? Number(producto.precio_oferta) : Number(producto.precio || 0);
    content.innerHTML = `
      <div class="product-detail-modal__grid">
        <div class="product-detail-modal__image"><img src="${escaparHTMLProductos(rutaImagenProductoAE(producto.imagen || ''))}" alt="${escaparHTMLProductos(producto.nombre || 'Producto')}" decoding="async"></div>
        <div class="product-detail-modal__info">
          <span class="product-detail-modal__brand">${escaparHTMLProductos(producto.marca || 'Sin marca')}</span>
          <h2 id="productModalTitle">${escaparHTMLProductos(producto.nombre || 'Producto')}</h2>
          <p>${escaparHTMLProductos(producto.descripcion || 'Producto profesional para salón.')}</p>
          <div class="product-detail-modal__price">${tieneOferta ? `<small>${formatoSoles(producto.precio)}</small>` : ''}<strong>${formatoSoles(precio)}</strong></div>
          ${sinStock ? '' : `<div class="product-modal-quantity" aria-label="Cantidad">
            <button type="button" data-qty-minus aria-label="Reducir cantidad">−</button>
            <input type="number" id="productModalQuantity" min="1" max="${stock}" value="1" inputmode="numeric">
            <button type="button" data-qty-plus aria-label="Aumentar cantidad">+</button>
          </div>`}
          <small class="product-modal-stock">${sinStock ? 'Producto sin stock' : `Stock disponible: ${stock}`}</small>
          <button class="btn btn--primary product-detail-modal__add" type="button" ${sinStock ? 'disabled' : ''}>${sinStock ? 'No disponible' : 'Añadir al carrito'}</button>
          <div class="product-modal-message" id="productModalMessage" aria-live="polite"></div>
        </div>
      </div>`;

    const input = content.querySelector('#productModalQuantity');
    const setQuantity = (value) => {
        if (!input) return;
        input.value = String(Math.min(stock, Math.max(1, Math.floor(Number(value || 1)))));
    };
    content.querySelector('[data-qty-minus]')?.addEventListener('click', () => setQuantity(Number(input.value) - 1));
    content.querySelector('[data-qty-plus]')?.addEventListener('click', () => setQuantity(Number(input.value) + 1));
    input?.addEventListener('change', () => setQuantity(input.value));

    content.querySelector('.product-detail-modal__add')?.addEventListener('click', () => {
      if (typeof agregarAlCarrito !== 'function' || sinStock) return;
      const cantidad = Math.min(stock, Math.max(1, Math.floor(Number(input?.value || 1))));
      const ok = agregarAlCarrito({ ...producto, precio, precio_normal: Number(producto.precio || 0) }, cantidad);
      const message = content.querySelector('#productModalMessage');
      if (message) {
        message.textContent = ok ? `${cantidad} producto${cantidad === 1 ? '' : 's'} añadido${cantidad === 1 ? '' : 's'} al carrito` : 'No se pudo añadir esa cantidad.';
        message.classList.toggle('is-error', !ok);
        message.classList.add('is-visible');
      }
    });
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
}

function cerrarModalProductoAE() {
    const modal = document.getElementById('productDetailModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
}

document.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-product-modal]')) cerrarModalProductoAE();
});
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') cerrarModalProductoAE();
});

function actualizarShopCounter(total) {
    const counter = document.getElementById('shopResultsText');
    if (!counter) return;
    if (!total) {
        counter.innerHTML = 'No se encontraron productos';
        return;
    }
    counter.innerHTML = `Mostrando <span>${total}</span> resultado${total === 1 ? '' : 's'}`;
}

function escaparHTMLProductos(valor) {
    return String(valor ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}


function normalizarTexto(texto) {
    return String(texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function activarAnimacionProductos(contenedor) {
    const cards = contenedor.querySelectorAll('.reveal-card');
    if (!cards.length) return;

    if (!('IntersectionObserver' in window)) {
        cards.forEach(card => card.classList.add('is-visible'));
        return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.14, rootMargin: '0px 0px -40px 0px' });

    cards.forEach((card, index) => {
        card.style.transitionDelay = `${Math.min(index % 8, 7) * 55}ms`;
        observer.observe(card);
    });
}


function inicializarFiltrosMovilProductos() {
    const toggle = document.getElementById('shopFilterToggle');
    const sidebar = document.getElementById('shopSidebar');
    const content = document.getElementById('shopFilterContent');
    if (!toggle || !sidebar || !content || toggle.dataset.ready === '1') return;
    toggle.dataset.ready = '1';
    const cerrarEnMovil = () => {
        if (window.matchMedia('(max-width: 980px)').matches) {
            sidebar.classList.remove('filters-open');
            toggle.setAttribute('aria-expanded', 'false');
        } else {
            sidebar.classList.add('filters-open');
            toggle.setAttribute('aria-expanded', 'true');
        }
    };
    toggle.addEventListener('click', () => {
        const abierto = sidebar.classList.toggle('filters-open');
        toggle.setAttribute('aria-expanded', String(abierto));
    });
    window.addEventListener('resize', cerrarEnMovil);
    cerrarEnMovil();
}

// Corrige rutas de imágenes para que funcionen desde index.html y desde /paginas/
function rutaImagenProductoAE(src) {
    src = String(src || '').trim();
    if (!src) return '';
    if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:')) return src;
    const enPaginas = window.location.pathname.includes('/paginas/');
    if (src.startsWith('../archivos/')) return enPaginas ? src : src.replace('../archivos/', './archivos/');
    if (src.startsWith('./archivos/')) return enPaginas ? src.replace('./archivos/', '../archivos/') : src;
    if (src.startsWith('archivos/')) return enPaginas ? '../' + src : './' + src;
    return src;
}


function renderProductosTiendaPaginados(lista, grid) {
    const total = lista.length;
    const productosPorPagina = productosPorPaginaAE();
    const totalPaginas = Math.max(1, Math.ceil(total / productosPorPagina));
    if (paginaTienda > totalPaginas) paginaTienda = totalPaginas;
    if (paginaTienda < 1) paginaTienda = 1;

    const inicio = (paginaTienda - 1) * productosPorPagina;
    const fin = inicio + productosPorPagina;
    const pagina = lista.slice(inicio, fin);

    renderProductos(pagina, grid);

    const counter = document.getElementById('shopResultsText');
    if (counter) {
        const desde = total ? inicio + 1 : 0;
        const hasta = Math.min(fin, total);
        counter.innerHTML = `Mostrando <strong>${desde}-${hasta}</strong> de <strong>${total}</strong> productos`;
    }

    const nav = document.getElementById('shopPagination');
    if (!nav) return;
    if (totalPaginas <= 1) {
        nav.innerHTML = '';
        return;
    }

    const botones = [];
    botones.push(`<button type="button" class="shop-page-btn" data-page="${paginaTienda - 1}" ${paginaTienda === 1 ? 'disabled' : ''}>←</button>`);

    const desdePag = Math.max(1, paginaTienda - 2);
    const hastaPag = Math.min(totalPaginas, paginaTienda + 2);
    if (desdePag > 1) {
        botones.push(`<button type="button" class="shop-page-btn" data-page="1">1</button>`);
        if (desdePag > 2) botones.push(`<span class="shop-page-dots">...</span>`);
    }
    for (let i = desdePag; i <= hastaPag; i++) {
        botones.push(`<button type="button" class="shop-page-btn ${i === paginaTienda ? 'is-active' : ''}" data-page="${i}">${i}</button>`);
    }
    if (hastaPag < totalPaginas) {
        if (hastaPag < totalPaginas - 1) botones.push(`<span class="shop-page-dots">...</span>`);
        botones.push(`<button type="button" class="shop-page-btn" data-page="${totalPaginas}">${totalPaginas}</button>`);
    }
    botones.push(`<button type="button" class="shop-page-btn" data-page="${paginaTienda + 1}" ${paginaTienda === totalPaginas ? 'disabled' : ''}>→</button>`);
    nav.innerHTML = botones.join('');

    nav.querySelectorAll('button[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            const nueva = Number(btn.dataset.page);
            if (Number.isNaN(nueva) || nueva < 1 || nueva > totalPaginas) return;
            paginaTienda = nueva;
            renderProductosTiendaPaginados(lista, grid);
            document.querySelector('.shop-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

function cerrarFiltrosResponsiveProductos() {
    const sidebar = document.getElementById('shopSidebar');
    const toggle = document.getElementById('shopFilterToggle');
    if (!sidebar || !toggle) return;
    if (window.matchMedia('(max-width: 1080px)').matches) {
        sidebar.classList.remove('filters-open');
        toggle.setAttribute('aria-expanded', 'false');
    }
}

// ALTER EGO: filtros plegables únicos para tablet y celular.
(function () {
    function initShopFilters() {
        const sidebar = document.getElementById('shopSidebar');
        const toggle = document.getElementById('shopFilterToggle');
        if (!sidebar || !toggle || toggle.dataset.aeShopFiltersReady === '1') return;
        toggle.dataset.aeShopFiltersReady = '1';

        const isResponsive = () => window.matchMedia('(max-width: 1100px)').matches;

        function setOpen(open) {
            sidebar.classList.toggle('filters-open', open);
            toggle.setAttribute('aria-expanded', String(open));
        }

        toggle.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(!sidebar.classList.contains('filters-open'));
        });

        document.addEventListener('click', (event) => {
            if (!isResponsive()) return;
            if (sidebar.contains(event.target)) return;
            setOpen(false);
        });

        window.addEventListener('resize', () => {
            setOpen(!isResponsive());
        });

        setOpen(!isResponsive());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initShopFilters);
    } else {
        initShopFilters();
    }
})();

/* ALTER EGO FIX FINAL: filtros plegables sin doble evento */
(function () {
  function initFiltrosFinal() {
    const sidebar = document.getElementById('shopSidebar');
    const oldToggle = document.getElementById('shopFilterToggle');
    if (!sidebar || !oldToggle) return;

    const toggle = oldToggle.cloneNode(true);
    oldToggle.parentNode.replaceChild(toggle, oldToggle);

    const mobile = () => window.matchMedia('(max-width: 1100px)').matches;

    function setOpen(open) {
      sidebar.classList.toggle('filters-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    }

    toggle.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(!sidebar.classList.contains('filters-open'));
    });

    document.addEventListener('click', function (event) {
      if (!mobile()) return;
      if (sidebar.contains(event.target)) return;
      setOpen(false);
    });

    window.addEventListener('resize', function () {
      setOpen(!mobile());
    });

    setOpen(!mobile());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFiltrosFinal);
  } else {
    initFiltrosFinal();
  }
})();
