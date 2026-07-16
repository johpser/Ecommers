const usuarioAdmin = getUsuario() || {};

if (!getToken() || !esAdminActual()) {
    cerrarSesion();
    window.location.href = './admin-login.html';
}

let productosAdmin = [];
let productosFiltrados = [];
let pedidosAdmin = [];
let pedidosFiltrados = [];
let paginaProductos = 1;
let paginaPedidos = 1;
let firmaPedidosActual = '';
let pedidosAdminInicializados = false;
let intervaloPedidosAdmin = null;
let audioCtxAdmin = null;
const PRODUCTOS_POR_PAGINA = 20;
const PEDIDOS_POR_PAGINA = 20;

document.addEventListener('DOMContentLoaded', () => {
    marcarNavAdminActivo();
    const logout = document.getElementById('logoutAdmin');
    const productForm = document.getElementById('productForm');
    const bannerForm = document.getElementById('bannerForm');
    const heroForm = document.getElementById('heroForm');
    const search = document.getElementById('productSearch');
    const statusFilter = document.getElementById('productStatusFilter');
    const cancelEdit = document.getElementById('cancelProductEdit');
    const nuevoProductoBtn = document.getElementById('nuevoProductoBtn');
    const refreshOrders = document.getElementById('refreshOrders');
    const enableSound = document.getElementById('enableSound');
    const orderSearch = document.getElementById('orderSearch');
    const orderStatusFilter = document.getElementById('orderStatusFilter');
    const orderDateFilter = document.getElementById('orderDateFilter');
    const hideUnavailableProducts = document.getElementById('hideUnavailableProducts');
    const hideInactiveProducts = document.getElementById('hideInactiveProducts');

    logout?.addEventListener('click', () => {
        cerrarSesion();
        window.location.href = './admin-login.html';
    });

    productForm?.addEventListener('submit', guardarProducto);
    bannerForm?.addEventListener('submit', guardarBanner);
    heroForm?.addEventListener('submit', guardarHeroSlide);
    document.getElementById('newHeroBtn')?.addEventListener('click', limpiarHeroForm);
    document.getElementById('newBannerBtn')?.addEventListener('click', limpiarBannerForm);
    document.getElementById('bannerArchivo')?.addEventListener('change', previsualizarArchivoBanner);

    search?.addEventListener('input', () => {
        paginaProductos = 1;
        aplicarFiltrosProductos();
    });

    statusFilter?.addEventListener('change', () => {
        paginaProductos = 1;
        aplicarFiltrosProductos();
    });

    hideUnavailableProducts?.addEventListener('click', ocultarProductosAgotados);
    hideInactiveProducts?.addEventListener('click', ocultarProductosNoDisponibles);

    cancelEdit?.addEventListener('click', limpiarFormularioProducto);

    nuevoProductoBtn?.addEventListener('click', () => {
        limpiarFormularioProducto();
        document.getElementById('productForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    orderSearch?.addEventListener('input', () => { paginaPedidos = 1; aplicarFiltrosPedidos(); });
    orderStatusFilter?.addEventListener('change', () => { paginaPedidos = 1; aplicarFiltrosPedidos(); });
    orderDateFilter?.addEventListener('change', () => { paginaPedidos = 1; aplicarFiltrosPedidos(); });

    refreshOrders?.addEventListener('click', () => cargarPedidosAdmin(false));
    enableSound?.addEventListener('click', () => {
        desbloquearSonidoAdmin();
        reproducirSonidoPedido(true);
        mostrarToast('Sonido de pedidos activado');
        enableSound.textContent = 'Sonido activo';
        enableSound.disabled = true;
    });

    document.getElementById('productsTable')?.addEventListener('click', manejarClickProductos);
    document.getElementById('ordersTable')?.addEventListener('change', manejarCambioPedido);
    document.getElementById('ordersTable')?.addEventListener('click', manejarClickPedidos);
    document.getElementById('bannersTable')?.addEventListener('click', manejarClickBanners);
    document.getElementById('heroTable')?.addEventListener('click', manejarClickHeroSlides);
    document.getElementById('categoryForm')?.addEventListener('submit', guardarCategoria);
    document.getElementById('categoriesTable')?.addEventListener('click', manejarClickCategorias);
    document.getElementById('brandForm')?.addEventListener('submit', guardarMarca);
    document.getElementById('brandsTable')?.addEventListener('click', manejarClickMarcas);
    document.getElementById('brandArchivo')?.addEventListener('change', actualizarPreviewMarcaArchivo);
    document.querySelector('#brandForm [name="imagen"]')?.addEventListener('input', (e) => actualizarPreviewMarca(e.target.value));
    document.getElementById('exportReportCsv')?.addEventListener('click', exportarReporteCsv);

    cargarAdmin();
    iniciarRevisionPedidosNuevos();
});

function marcarNavAdminActivo() {
    const actual = location.pathname.split('/').pop() || 'admin.html';
    document.querySelectorAll('.admin-nav a').forEach(a => {
        if ((a.getAttribute('href') || '').replace('./','') === actual) a.classList.add('active');
    });
}

function manejarErrorAdmin(error) {
    console.error(error);

    if (error?.status === 401 || error?.status === 403) {
        cerrarSesion();
        mostrarToast('Tu sesión de administrador venció. Inicia sesión nuevamente como administrador.', 'error');
        setTimeout(() => {
            window.location.href = './admin-login.html';
        }, 1200);
        return true;
    }

    return false;
}

async function cargarAdmin() {
    try {
        const tareas = [];
        if (document.getElementById('adminStats')) tareas.push(cargarResumen());
        if (document.getElementById('productsTable')) tareas.push(cargarProductosAdmin());
        if (document.getElementById('heroTable')) tareas.push(cargarHeroSlidesAdmin());
        if (document.getElementById('bannersTable')) tareas.push(cargarBannersAdmin());
        if (document.getElementById('ordersTable')) tareas.push(cargarPedidosAdmin());
        if (document.getElementById('dashboardPanel')) tareas.push(cargarDashboardAdmin());
        if (document.getElementById('clientsTable')) tareas.push(cargarClientesAdmin());
        if (document.getElementById('reportsPanel')) tareas.push(cargarReportesAdmin());
        if (document.getElementById('configPanel')) tareas.push(cargarConfigAdmin());
        if (document.getElementById('categoriesTable')) tareas.push(cargarCategoriasAdmin());
        if (document.getElementById('brandsTable')) tareas.push(cargarMarcasAdmin());
        await Promise.all(tareas);
    } catch (error) {
        if (manejarErrorAdmin(error)) return;
        mostrarToast(error.message || 'No se pudo cargar el panel', 'error');
    }
}

function rutaImagenAdmin(src) {
    src = String(src || '').trim();
    if (!src) return '../archivos/producto-default.jpg';
    if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:')) return src;
    if (src.startsWith('../')) return src;
    if (src.startsWith('./')) return '.' + src;
    if (src.startsWith('archivos/')) return '../' + src;
    return '../archivos/' + src;
}

async function cargarResumen() {
    const contenedor = document.getElementById('adminStats');
    if (!contenedor) return;
    const data = await apiRequest('/admin/resumen');

    contenedor.innerHTML = `
        <article class="ae-kpi-card ae-kpi-card--green">
            <div><span>Ventas totales</span><strong>S/ ${Number(data.ventasMes || data.ventasHoy || 0).toFixed(2)}</strong><small>↑ 12.5% vs mes anterior</small></div><i>🛒</i>
        </article>
        <article class="ae-kpi-card ae-kpi-card--purple">
            <div><span>Pedidos</span><strong>${Number((data.pedidosPendientes || data.pendientes || 0) + (data.pedidosAtendidos || 0))}</strong><small>↑ 8.2% vs mes anterior</small></div><i>📦</i>
        </article>
        <article class="ae-kpi-card ae-kpi-card--blue">
            <div><span>Productos</span><strong>${data.productos || 0}</strong><small>↑ 4.3% vs mes anterior</small></div><i>◇</i>
        </article>
        <article class="ae-kpi-card ae-kpi-card--orange">
            <div><span>Clientes</span><strong>${data.clientes || 0}</strong><small>↑ 15.7% vs mes anterior</small></div><i>👥</i>
        </article>
        <article class="ae-kpi-card ae-kpi-card--red">
            <div><span>Stock bajo</span><strong>${data.stockBajo || data.sinStock || 0}</strong><small>↓ 5.1% vs mes anterior</small></div><i>⚠</i>
        </article>
    `;
}

async function cargarProductosAdmin() {
    productosAdmin = await apiRequest('/admin/productos');
    paginaProductos = 1;
    aplicarFiltrosProductos();
}

function aplicarFiltrosProductos() {
    const busqueda = normalizarTexto(document.getElementById('productSearch')?.value || '');
    const estado = document.getElementById('productStatusFilter')?.value || 'todos';

    productosFiltrados = productosAdmin.filter(producto => {
        const textoProducto = normalizarTexto([
            producto.id,
            producto.nombre,
            producto.marca,
            producto.categoria,
            producto.codigo_barras,
            producto.codigoBarras
        ].filter(Boolean).join(' '));

        const coincideBusqueda = !busqueda || textoProducto.includes(busqueda);

        let coincideEstado = true;

        if (estado === 'activos') coincideEstado = producto.activo !== false;
        if (estado === 'inactivos') coincideEstado = producto.activo === false;
        if (estado === 'visibles') coincideEstado = producto.visible !== false;
        if (estado === 'ocultos') coincideEstado = producto.visible === false;
        if (estado === 'sin-stock') coincideEstado = Number(producto.stock || 0) <= 0;
        if (estado === 'promocion') coincideEstado = Boolean(producto.en_promocion || producto.promocion || producto.promocionado || producto.promo);
        if (estado === 'oferta') coincideEstado = Boolean(producto.en_oferta || (Number(producto.precio_oferta || 0) > 0 && Number(producto.precio_oferta || 0) < Number(producto.precio || 0)));
        if (estado === 'destacados') coincideEstado = Boolean(producto.destacado);

        return coincideBusqueda && coincideEstado;
    });

    renderProductosAdmin();
}

function renderProductosAdmin() {
    const table = document.getElementById('productsTable');
    const info = document.getElementById('productsInfo');

    if (!table) return;

    const total = productosFiltrados.length;
    const totalPaginas = Math.max(1, Math.ceil(total / PRODUCTOS_POR_PAGINA));

    if (paginaProductos > totalPaginas) paginaProductos = totalPaginas;

    const inicio = (paginaProductos - 1) * PRODUCTOS_POR_PAGINA;
    const fin = inicio + PRODUCTOS_POR_PAGINA;
    const productosPagina = productosFiltrados.slice(inicio, fin);

    if (info) {
        const desde = total ? inicio + 1 : 0;
        const hasta = Math.min(fin, total);
        info.textContent = `Mostrando ${desde}-${hasta} de ${total} productos`;
    }

    if (!productosPagina.length) {
        table.innerHTML = `
            <tr><th>Productos</th></tr>
            <tr><td>No se encontraron productos.</td></tr>
        `;
        renderPaginacionProductos(totalPaginas);
        return;
    }

    table.innerHTML = `
        <tr>
            <th>Producto</th>
            <th>Categoría</th>
            <th>Precio</th>
            <th>Stock</th>
            <th>Estado</th>
            <th>Visibilidad</th>
            <th>Acciones</th>
        </tr>
        ${productosPagina.map(p => `
            <tr>
                <td class="ae-admin-product-cell" title="${escaparAttr(p.nombre || 'Sin nombre')}">
                    <img src="${escaparAttr(rutaImagenAdmin(p.imagen || ''))}" alt="" loading="lazy" decoding="async">
                    <div><strong>${escaparHTML(p.nombre || 'Sin nombre')}</strong><small>SKU: ${escaparHTML(p.codigo_barras || p.codigoBarras || p.id || '-')}</small></div>
                </td>
                <td>${escaparHTML(p.categoria || 'General')}</td>
                <td>S/ ${Number(p.en_oferta ? (p.precio_oferta || p.precio || 0) : (p.precio || 0)).toFixed(2)}</td>
                <td><span class="ae-stock-dot ${Number(p.stock || 0) <= 0 ? 'is-red' : Number(p.stock || 0) <= 5 ? 'is-orange' : 'is-green'}"></span>${Number(p.stock || 0)}</td>
                <td><span class="status-pill ${p.activo === false || Number(p.stock || 0) <= 0 ? 'status-pill--off' : Number(p.stock || 0) <= 5 ? 'status-pill--warn' : 'status-pill--on'}">${p.activo === false || Number(p.stock || 0) <= 0 ? 'Agotado' : Number(p.stock || 0) <= 5 ? 'Bajo stock' : 'Disponible'}</span></td>
                <td><span class="status-pill ${p.visible === false ? 'status-pill--off' : 'status-pill--on'}">${p.visible === false ? 'Oculto' : 'Visible'}</span></td>
                <td class="admin-actions"><div class="admin-actions-grid">
                    <button class="admin-icon-btn admin-icon-btn--edit" type="button" data-action="edit-product" data-id="${escaparAttr(p.id)}" title="Editar"><span>✎</span></button>
                    <button class="admin-icon-btn admin-icon-btn--stock" type="button" data-action="quick-stock" data-id="${escaparAttr(p.id)}" title="Stock"><span>▣</span></button>
                    ${p.activo === false ? `<button class="admin-icon-btn admin-icon-btn--available" type="button" data-action="activate-product" data-id="${escaparAttr(p.id)}" title="Activar"><span>✓</span></button>` : `<button class="admin-icon-btn admin-icon-btn--delete" type="button" data-action="delete-product" data-id="${escaparAttr(p.id)}" title="Agotar"><span>🗑</span></button>`}
                </div></td>
            </tr>
        `).join('')}
    `;

    renderPaginacionProductos(totalPaginas);
}

function renderPaginacionProductos(totalPaginas) {
    const contenedor = document.getElementById('productsPagination');
    if (!contenedor) return;

    if (totalPaginas <= 1) {
        contenedor.innerHTML = '';
        return;
    }

    const botones = [];

    botones.push(`
        <button type="button" ${paginaProductos === 1 ? 'disabled' : ''} data-page="${paginaProductos - 1}">
            Anterior
        </button>
    `);

    const desde = Math.max(1, paginaProductos - 2);
    const hasta = Math.min(totalPaginas, paginaProductos + 2);

    if (desde > 1) {
        botones.push(`<button type="button" data-page="1">1</button>`);
        if (desde > 2) botones.push(`<span>...</span>`);
    }

    for (let i = desde; i <= hasta; i++) {
        botones.push(`
            <button type="button" class="${i === paginaProductos ? 'active' : ''}" data-page="${i}">
                ${i}
            </button>
        `);
    }

    if (hasta < totalPaginas) {
        if (hasta < totalPaginas - 1) botones.push(`<span>...</span>`);
        botones.push(`<button type="button" data-page="${totalPaginas}">${totalPaginas}</button>`);
    }

    botones.push(`
        <button type="button" ${paginaProductos === totalPaginas ? 'disabled' : ''} data-page="${paginaProductos + 1}">
            Siguiente
        </button>
    `);

    contenedor.innerHTML = botones.join('');

    contenedor.querySelectorAll('button[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            const nuevaPagina = Number(btn.dataset.page);
            if (!Number.isNaN(nuevaPagina)) {
                paginaProductos = nuevaPagina;
                renderProductosAdmin();
                document.getElementById('productosAdmin')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

async function guardarProducto(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(form).entries());

    const editId = data.editId || '';
    const stockAjuste = Number(data.stockAjuste || 0);

    delete data.editId;
    delete data.stockAjuste;

    data.destacado = form.destacado.checked;
    data.en_oferta = Boolean(form.en_oferta?.checked);
    data.en_promocion = Boolean(form.en_promocion?.checked);
    data.precio_oferta = data.precio_oferta === '' ? null : Number(data.precio_oferta || 0);
    data.activo = form.activo.checked;
    data.visible = form.visible ? form.visible.checked : true;
    data.precio = Number(data.precio || 0);
    const categoriaSelect = form.querySelector('[name="categoria"]');
    const categoriaOption = categoriaSelect?.selectedOptions?.[0];
    data.category_id = categoriaOption?.dataset?.id || null;

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = editId ? 'Actualizando...' : 'Guardando...';
        }

        if (editId) {
            const productoActual = productosAdmin.find(p => String(p.id) === String(editId));
            const stockBase = Number(data.stock || productoActual?.stock || 0);

            data.stock = stockBase + stockAjuste;

            await apiRequest(`/admin/productos/${encodeURIComponent(editId)}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });

            mostrarToast('Producto actualizado correctamente');
        } else {
            data.stock = Number(data.stock || 0) + stockAjuste;

            await apiRequest('/admin/productos', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            mostrarToast('Producto creado correctamente');
        }

        limpiarFormularioProducto();
        await cargarProductosAdmin();
        await cargarResumen();
    } catch (error) {
        if (manejarErrorAdmin(error)) return;
        mostrarToast(error.message || 'No se pudo guardar el producto', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = editId ? 'Actualizar producto' : 'Guardar producto';
        }
    }
}

function editarProductoPorId(id) {
    const p = productosAdmin.find(producto => String(producto.id) === String(id));

    if (!p) {
        mostrarToast('No se encontró el producto', 'error');
        return;
    }

    const f = document.getElementById('productForm');

    f.editId.value = p.id;
    f.id.value = p.id || '';
    f.nombre.value = p.nombre || '';
    f.marca.value = p.marca || '';
    f.categoria.value = p.categoria || '';
    f.precio.value = Number(p.precio || 0);
    if (f.precio_oferta) f.precio_oferta.value = p.precio_oferta || '';
    if (f.en_oferta) f.en_oferta.checked = Boolean(p.en_oferta);
    if (f.en_promocion) f.en_promocion.checked = Boolean(p.en_promocion || p.promocion || p.promocionado);
    f.stock.value = p.stock || 0;
    f.stockAjuste.value = '';
    f.imagen.value = p.imagen || '';
    f.descripcion.value = p.descripcion || '';
    f.destacado.checked = Boolean(p.destacado);
    if (f.en_oferta) f.en_oferta.checked = Boolean(p.en_oferta);
    if (f.en_promocion) f.en_promocion.checked = Boolean(p.en_promocion || p.promocion || p.promocionado);
    f.activo.checked = p.activo !== false;
    if (f.visible) f.visible.checked = p.visible !== false;

    f.querySelector('button[type="submit"]').textContent = 'Actualizar producto';
    f.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function limpiarFormularioProducto() {
    const f = document.getElementById('productForm');

    if (!f) return;

    f.reset();
    f.editId.value = '';
    if (f.en_oferta) f.en_oferta.checked = false;
    if (f.en_promocion) f.en_promocion.checked = false;
    if (f.precio_oferta) f.precio_oferta.value = '';
    f.activo.checked = true;
    if (f.visible) f.visible.checked = true;
    f.querySelector('button[type="submit"]').textContent = 'Guardar producto';
}

async function cambiarActivoProducto(id, activo) {
    const producto = productosAdmin.find(p => String(p.id) === String(id));

    if (!producto) return;

    await apiRequest(`/admin/productos/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify({
            ...producto,
            activo
        })
    });

    mostrarToast(activo ? 'Producto activado' : 'Producto desactivado');
    await cargarProductosAdmin();
    await cargarResumen();
}


async function cambiarVisibleProducto(id, visible) {
    const producto = productosAdmin.find(p => String(p.id) === String(id));
    if (!producto) return;
    await apiRequest(`/admin/productos/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify({ ...producto, visible })
    });
    mostrarToast(visible ? 'Producto visible en la tienda' : 'Producto oculto de la tienda');
    await cargarProductosAdmin();
    await cargarResumen();
}


async function ocultarProductosAgotados() {
    const agotadosVisibles = productosAdmin.filter(p => Number(p.stock || 0) <= 0 && p.visible !== false);

    if (!agotadosVisibles.length) {
        mostrarToast('No hay productos agotados visibles para ocultar');
        return;
    }

    const confirmar = confirm(`Se ocultarán ${agotadosVisibles.length} producto(s) agotado(s) de la tienda. ¿Deseas continuar?`);
    if (!confirmar) return;

    const boton = document.getElementById('hideUnavailableProducts');

    try {
        if (boton) {
            boton.disabled = true;
            boton.textContent = 'Ocultando...';
        }

        await apiRequest('/admin/productos/ocultar-agotados', { method: 'PUT' });
        mostrarToast(`${agotadosVisibles.length} producto(s) agotado(s) ocultado(s)`);
        await cargarProductosAdmin();
        await cargarResumen();
    } catch (error) {
        if (manejarErrorAdmin(error)) return;
        mostrarToast(error.message || 'No se pudieron ocultar los productos agotados', 'error');
    } finally {
        if (boton) {
            boton.disabled = false;
            boton.textContent = 'Ocultar agotados';
        }
    }
}

async function ocultarProductosNoDisponibles() {
    const noDisponiblesVisibles = productosAdmin.filter(p => p.activo === false && p.visible !== false);

    if (!noDisponiblesVisibles.length) {
        mostrarToast('No hay productos no disponibles visibles para ocultar');
        return;
    }

    const confirmar = confirm(`Se ocultarán ${noDisponiblesVisibles.length} producto(s) marcado(s) como no disponible(s). ¿Deseas continuar?`);
    if (!confirmar) return;

    const boton = document.getElementById('hideInactiveProducts');

    try {
        if (boton) {
            boton.disabled = true;
            boton.textContent = 'Ocultando...';
        }

        await apiRequest('/admin/productos/ocultar-no-disponibles', { method: 'PUT' });
        mostrarToast(`${noDisponiblesVisibles.length} producto(s) no disponible(s) ocultado(s)`);
        await cargarProductosAdmin();
        await cargarResumen();
    } catch (error) {
        if (manejarErrorAdmin(error)) return;
        mostrarToast(error.message || 'No se pudieron ocultar los productos no disponibles', 'error');
    } finally {
        if (boton) {
            boton.disabled = false;
            boton.textContent = 'Ocultar no disponibles';
        }
    }
}

async function aumentarStockRapido(id) {
    const producto = productosAdmin.find(p => String(p.id) === String(id));

    if (!producto) return;

    abrirModalStock(producto);
}

async function manejarClickProductos(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const { action, id } = btn.dataset;

    try {
        if (action === 'edit-product') editarProductoPorId(id);

        if (action === 'quick-stock') await aumentarStockRapido(id);

        if (action === 'delete-product') {
            await cambiarActivoProducto(id, false);
        }

        if (action === 'activate-product') {
            await cambiarActivoProducto(id, true);
        }

        if (action === 'hide-product') {
            await cambiarVisibleProducto(id, false);
        }

        if (action === 'show-product') {
            await cambiarVisibleProducto(id, true);
        }
    } catch (error) {
        if (manejarErrorAdmin(error)) return;
        mostrarToast(error.message || 'No se pudo completar la acción', 'error');
    }
}

let bannersAdmin = [];
let heroSlidesAdmin = [];


async function cargarHeroSlidesAdmin() {
    const table = document.getElementById('heroTable');
    if (!table) return;
    try {
        heroSlidesAdmin = await apiRequest('/admin/hero-slides');
    } catch (error) {
        if (manejarErrorAdmin(error)) return;
        table.innerHTML = '<tr><th>Carrusel</th></tr><tr><td>No se pudo cargar. Ejecuta supabase-fix.sql para crear hero_slides.</td></tr>';
        return;
    }
    if (!heroSlidesAdmin.length) {
        table.innerHTML = '<tr><th>Carrusel</th></tr><tr><td>No hay diapositivas. Crea la primera con el formulario.</td></tr>';
        return;
    }
    table.innerHTML = `
        <tr><th>Tipo</th><th>Título</th><th>Imagen</th><th>Estado</th><th>Orden</th><th>Acciones</th></tr>
        ${heroSlidesAdmin.map(h => `
            <tr>
                <td><span class="status-pill">${escaparHTML(h.tipo || 'general')}</span></td>
                <td><strong>${escaparHTML(h.titulo || '')}</strong><br><small>${escaparHTML(h.subtitulo || '')}</small></td>
                <td><small>${escaparHTML(h.imagen || '-')}</small></td>
                <td>${h.activo ? 'Visible' : 'Oculto'}</td>
                <td>${h.orden || 1}</td>
                <td class="admin-actions">
                    <button class="btn-mini" type="button" data-action="edit-hero" data-id="${escaparAttr(h.id)}">Editar</button>
                    <button class="btn-mini" type="button" data-action="hide-hero" data-id="${escaparAttr(h.id)}">${h.activo ? 'Ocultar' : 'Mostrar'}</button>
                    <button class="btn-mini btn-mini--danger" type="button" data-action="delete-hero" data-id="${escaparAttr(h.id)}">Eliminar</button>
                </td>
            </tr>
        `).join('')}
    `;
}

async function guardarHeroSlide(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(form).entries());
    data.tipo = String(data.tipo || 'general').trim();
    data.titulo = String(data.titulo || '').trim();
    data.etiqueta = String(data.etiqueta || '').trim();
    data.subtitulo = String(data.subtitulo || '').trim();
    data.etiqueta = String(data.etiqueta || '').trim();
    data.imagen = String(data.imagen || '').trim();
    data.enlace = String(data.enlace || '').trim();
    data.texto_boton = String(data.texto_boton ?? '').trim();
    data.orden = Number(data.orden || 1);
    data.activo = form.activo.checked;
    const id = data.id;
    delete data.id;
    try {
        btn.disabled = true;
        btn.textContent = 'Guardando...';
        if (id) {
            await apiRequest(`/admin/hero-slides/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
            mostrarToast('Carrusel actualizado');
        } else {
            await apiRequest('/admin/hero-slides', { method: 'POST', body: JSON.stringify(data) });
            mostrarToast('Carrusel creado');
        }
        limpiarHeroForm();
        await cargarHeroSlidesAdmin();
    } catch (error) {
        if (manejarErrorAdmin(error)) return;
        mostrarToast(error.message || 'No se pudo guardar el carrusel', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar carrusel';
    }
}

function limpiarHeroForm() {
    const f = document.getElementById('heroForm');
    if (!f) return;
    f.reset();
    f.id.value = '';
    if (f.tipo) f.tipo.value = 'general';
    f.texto_boton.value = '';
    f.orden.value = 1;
    f.activo.checked = true;
    if (f.archivo) f.archivo.value = '';
    actualizarPreviewBanner('');
    const btn = f.querySelector('button[type="submit"]');
    if (btn) btn.textContent = 'Guardar carrusel';
}

function editarHeroSlide(h) {
    const f = document.getElementById('heroForm');
    if (!f) return;
    f.id.value = h.id;
    if (f.tipo) f.tipo.value = h.tipo || 'general';
    f.etiqueta.value = h.etiqueta || '';
    f.titulo.value = h.titulo || '';
    f.subtitulo.value = h.subtitulo || '';
    f.imagen.value = h.imagen || '';
    f.enlace.value = h.enlace || '';
    f.texto_boton.value = h.texto_boton || '';
    f.orden.value = h.orden || 1;
    f.activo.checked = h.activo !== false;
    f.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function eliminarHeroSlide(id) {
    await apiRequest(`/admin/hero-slides/${encodeURIComponent(id)}`, { method: 'DELETE' });
    mostrarToast('Diapositiva eliminada');
    await cargarHeroSlidesAdmin();
}

async function manejarClickHeroSlides(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    try {
        if (action === 'edit-hero') {
            const slide = heroSlidesAdmin.find(item => String(item.id) === String(id));
            if (!slide) throw new Error('No se encontró la diapositiva');
            editarHeroSlide(slide);
        }
        if (action === 'hide-hero') {
            const slide = heroSlidesAdmin.find(item => String(item.id) === String(id));
            if (!slide) throw new Error('No se encontró la diapositiva');
            await apiRequest(`/admin/hero-slides/${encodeURIComponent(id)}`, { method:'PUT', body:JSON.stringify({ ...slide, activo:slide.activo === false }) });
            mostrarToast(slide.activo === false ? 'Carrusel visible' : 'Carrusel oculto');
            await cargarHeroSlidesAdmin();
        }
        if (action === 'delete-hero') await eliminarHeroSlide(id);
    } catch (error) {
        if (manejarErrorAdmin(error)) return;
        mostrarToast(error.message || 'No se pudo completar la acción', 'error');
    }
}


async function garantizarTresBannersAdmin(actuales) {
    const lista = Array.isArray(actuales) ? [...actuales] : [];
    const plantillas = [
        { tipo:'promocion', titulo:'Productos en promoción', subtitulo:'Descubre las promociones activas seleccionadas desde el panel administrativo.', imagen:'./archivos/american crew.jpg', enlace:'./paginas/promocion.html', texto_boton:'Ver promociones', activo:true, orden:1 },
        { tipo:'destacados', titulo:'Productos destacados', subtitulo:'Los productos recomendados y marcados como destacados en el panel.', imagen:'./archivos/revlon imagen.jpg', enlace:'./paginas/productos.html?destacados=1', texto_boton:'Ver destacados', activo:true, orden:2 },
        { tipo:'ofertas', titulo:'Ofertas activas', subtitulo:'Productos con precio de oferta configurados desde el panel administrativo.', imagen:'./archivos/hyrdro.png', enlace:'./paginas/ofertas.html', texto_boton:'Ver ofertas', activo:true, orden:3 }
    ];
    const existe = (tipo) => lista.some(b => {
        const texto = normalizarTexto(`${b.titulo || ''} ${b.enlace || ''} ${b.subtitulo || ''}`);
        return tipo === 'promocion' ? texto.includes('promoc') : tipo === 'destacados' ? texto.includes('destacad') : texto.includes('oferta');
    });
    for (const plantilla of plantillas) {
        if (existe(plantilla.tipo)) continue;
        const payload = { ...plantilla };
        try {
            const creado = await apiRequest('/admin/banners', { method:'POST', body:JSON.stringify(payload) });
            if (creado) lista.push(creado);
        } catch (error) {
            console.warn('No se pudo crear banner base:', plantilla.titulo, error);
        }
    }
    return lista.sort((a,b) => Number(a.orden || 0) - Number(b.orden || 0));
}

async function cargarBannersAdmin() {
    const table = document.getElementById('bannersTable');
    if (!table) return;

    try {
        bannersAdmin = await apiRequest('/admin/banners');
    } catch (error) {
        if (manejarErrorAdmin(error)) return;
        table.innerHTML = `
            <tr><th>Banners</th></tr>
            <tr><td>No se pudieron cargar los banners. Revisa que la tabla <strong>banners</strong> exista en Supabase y ejecuta <strong>supabase-fix.sql</strong>.</td></tr>
        `;
        throw error;
    }

    if (!bannersAdmin.length) {
        table.innerHTML = `
            <tr><th>Banners</th></tr>
            <tr><td>No hay banners registrados. Completa el formulario de arriba y pulsa <strong>Guardar banner</strong>.</td></tr>
        `;
        return;
    }

    table.innerHTML = `
        <tr><th>Banner</th><th>Ubicación</th><th>Imagen</th><th>Activo</th><th>Orden</th><th>Acciones</th></tr>
        ${bannersAdmin.map(b => `
            <tr>
                <td>
                    <strong>${escaparHTML(b.titulo || '')}</strong>
                    <br>
                    <small>${escaparHTML(b.subtitulo || '')}</small>
                </td>
                <td>${escaparHTML(b.tipo || 'promocion')}</td>
                <td><small>${escaparHTML(b.imagen || '-')}</small></td>
                <td>${b.activo ? 'Sí' : 'No'}</td>
                <td>${b.orden || 1}</td>
                <td class="admin-actions">
                    <button class="btn-mini" type="button" data-action="edit-banner" data-id="${escaparAttr(b.id)}">Editar</button>
                    <button class="btn-mini" type="button" data-action="hide-banner" data-id="${escaparAttr(b.id)}">${b.activo ? 'Ocultar' : 'Mostrar'}</button>
                    <button class="btn-mini btn-mini--danger" type="button" data-action="delete-banner" data-id="${escaparAttr(b.id)}">Eliminar</button>
                </td>
            </tr>
        `).join('')}
    `;
}

function esVideoBanner(url = '') {
    return /\.(mp4|webm|ogg)(?:[?#]|$)/i.test(String(url));
}

function actualizarPreviewBanner(url = '', tipo = '') {
    const contenedor = document.getElementById('bannerMediaPreview');
    if (!contenedor) return;
    if (!url) {
        contenedor.hidden = true;
        contenedor.innerHTML = '';
        return;
    }
    const video = tipo.startsWith('video/') || esVideoBanner(url);
    contenedor.hidden = false;
    contenedor.innerHTML = video
        ? `<video src="${escaparAttr(url)}" controls muted playsinline></video>`
        : `<img src="${escaparAttr(url)}" alt="Vista previa del banner">`;
}

function previsualizarArchivoBanner(event) {
    const archivo = event.target.files?.[0];
    if (!archivo) {
        actualizarPreviewBanner(document.getElementById('bannerForm')?.imagen?.value || '');
        return;
    }
    const url = URL.createObjectURL(archivo);
    actualizarPreviewBanner(url, archivo.type || '');
}

async function guardarBanner(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const archivo = formData.get('archivo');
    formData.delete('archivo');
    const data = Object.fromEntries(formData.entries());

    data.tipo = ['promocion','destacados','ofertas'].includes(String(data.tipo || '')) ? String(data.tipo) : 'promocion';
    data.titulo = String(data.titulo || '').trim();
    data.etiqueta = String(data.etiqueta || '').trim();
    data.subtitulo = String(data.subtitulo || '').trim();
    data.imagen = String(data.imagen || '').trim();
    data.enlace = String(data.enlace || '').trim();
    data.texto_boton = String(data.texto_boton || 'Ver promoción').trim();
    data.activo = form.activo.checked;
    data.orden = Number(data.orden || 1);

    if (!data.titulo) {
        mostrarToast('Escribe el título del banner', 'error');
        return;
    }

    const id = data.id;
    delete data.id;

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Guardando...';
        }

        if (archivo instanceof File && archivo.size > 0) {
            const subida = new FormData();
            subida.append('archivo', archivo);
            const resultado = await apiUpload('/admin/media', subida);
            data.imagen = resultado.url;
        }

        if (id) {
            await apiRequest(`/admin/banners/${encodeURIComponent(id)}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            mostrarToast('Banner actualizado');
        } else {
            await apiRequest('/admin/banners', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            mostrarToast('Banner creado');
        }

        limpiarBannerForm();
        if (form.tipo) form.tipo.value = 'promocion';

        await cargarHeroSlidesAdmin();
    await cargarBannersAdmin();
        await cargarResumen();
    } catch (error) {
        if (manejarErrorAdmin(error)) return;
        mostrarToast(error.message || 'No se pudo guardar el banner', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Guardar banner';
        }
    }
}

function limpiarBannerForm() {
    const f = document.getElementById('bannerForm');
    if (!f) return;
    f.reset();
    f.id.value = '';
    if (f.tipo) f.tipo.value = 'promocion';
    if (f.etiqueta) f.etiqueta.value = '';
    f.texto_boton.value = 'Ver promoción';
    f.orden.value = 1;
    f.activo.checked = true;
    if (f.archivo) f.archivo.value = '';
    actualizarPreviewBanner('');
    const btn = f.querySelector('button[type="submit"]');
    if (btn) btn.textContent = 'Guardar banner';
}

function editarBanner(b) {
    const f = document.getElementById('bannerForm');

    f.id.value = b.id;
    if (f.tipo) f.tipo.value = b.tipo || 'promocion';
    if (f.etiqueta) f.etiqueta.value = b.etiqueta || '';
    f.titulo.value = b.titulo || '';
    f.subtitulo.value = b.subtitulo || '';
    f.imagen.value = b.imagen || '';
    f.enlace.value = b.enlace || '';
    f.texto_boton.value = b.texto_boton || b.textoBoton || 'Ver promoción';
    f.orden.value = b.orden || 1;
    f.activo.checked = b.activo !== false;
    if (f.archivo) f.archivo.value = '';
    actualizarPreviewBanner(b.imagen || '');

    f.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function eliminarBanner(id) {
    if (!id) {
        mostrarToast('No se encontró el ID del banner', 'error');
        return;
    }

    await apiRequest(`/admin/banners/${encodeURIComponent(id)}`, { method: 'DELETE' });
    mostrarToast('Banner eliminado');

    await cargarBannersAdmin();
    await cargarResumen();
}

async function manejarClickBanners(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const { action, id } = btn.dataset;

    try {
        if (action === 'edit-banner') {
            const banner = bannersAdmin.find(item => String(item.id) === String(id));
            if (!banner) throw new Error('No se encontró el banner seleccionado');
            editarBanner(banner);
        }
        if (action === 'hide-banner') {
            const banner = bannersAdmin.find(item => String(item.id) === String(id));
            if (!banner) throw new Error('No se encontró el banner seleccionado');
            await apiRequest(`/admin/banners/${encodeURIComponent(id)}`, { method:'PUT', body:JSON.stringify({ ...banner, activo:banner.activo === false }) });
            mostrarToast(banner.activo === false ? 'Banner visible' : 'Banner oculto');
            await cargarBannersAdmin();
        }
        if (action === 'delete-banner') await eliminarBanner(id);
    } catch (error) {
        if (manejarErrorAdmin(error)) return;
        mostrarToast(error.message || 'No se pudo completar la acción', 'error');
    }
}

async function cargarPedidosAdmin(silencioso = true) {
    const table = document.getElementById('ordersTable');
    if (!table) return;

    pedidosAdmin = await apiRequest('/admin/pedidos');
    if (!Array.isArray(pedidosAdmin)) pedidosAdmin = [];
    aplicarParametrosPedidosUrl();
    revisarPedidosNuevos(pedidosAdmin, silencioso);
    aplicarFiltrosPedidos();
}

function aplicarFiltrosPedidos() {
    const busqueda = normalizarTexto(document.getElementById('orderSearch')?.value || '');
    const estado = document.getElementById('orderStatusFilter')?.value || 'todos';
    const fechaFiltro = document.getElementById('orderDateFilter')?.value || '';

    pedidosFiltrados = pedidosAdmin.filter(pedido => {
        const cliente = pedido.cliente || {};
        const textoBusqueda = normalizarTexto([
            pedido.numero,
            pedido.id,
            cliente.nombre,
            cliente.apellido,
            cliente.telefono,
            cliente.documento,
            cliente.tipo_documento,
            cliente.email,
            cliente.correo
        ].filter(Boolean).join(' '));

        const coincideBusqueda = !busqueda || textoBusqueda.includes(busqueda);
        const coincideEstado = estado === 'todos' || String(pedido.estado || '') === estado;
        const coincideFecha = !fechaFiltro || String(pedido.created_at || '').slice(0,10) === fechaFiltro;

        return coincideBusqueda && coincideEstado && coincideFecha;
    });

    renderPedidosAdmin(pedidosFiltrados);
}

function renderPedidosAdmin(pedidos = []) {
    const table = document.getElementById('ordersTable');
    const contador = document.getElementById('ordersCount');
    if (!table) return;

    const total = pedidosAdmin.length;
    const mostrados = pedidos.length;
    const totalPaginas = Math.max(1, Math.ceil(mostrados / PEDIDOS_POR_PAGINA));
    if (paginaPedidos > totalPaginas) paginaPedidos = totalPaginas;
    const inicio = (paginaPedidos - 1) * PEDIDOS_POR_PAGINA;
    const fin = inicio + PEDIDOS_POR_PAGINA;
    const pagina = pedidos.slice(inicio, fin);

    if (contador) {
        contador.textContent = total
            ? `Mostrando ${mostrados ? inicio + 1 : 0}-${Math.min(fin, mostrados)} de ${mostrados} pedidos filtrados · Total: ${total}`
            : 'No hay pedidos registrados.';
    }

    if (!pedidos.length) {
        table.innerHTML = `
            <tr><th>Pedidos</th></tr>
            <tr><td>No se encontraron pedidos con esos filtros.</td></tr>
        `;
        renderPaginacionPedidos(totalPaginas);
        return;
    }

    table.innerHTML = `
        <tr>
            <th>Número</th>
            <th>Cliente</th>
            <th>Productos</th>
            <th>Total</th>
            <th>Estado</th>
            <th>Fecha</th>
            <th>Archivo</th>
        </tr>
        ${pagina.map(p => {
            const items = p.order_items || [];
            const cliente = p.cliente || {};
            const nombreCliente = [cliente.nombre, cliente.apellido].filter(Boolean).join(' ') || 'Cliente';
            const documentoCliente = cliente.documento ? `${cliente.tipo_documento || 'Doc.'}: ${cliente.documento}` : '';

            return `
                <tr>
                    <td><strong>${escaparHTML(p.numero || p.id)}</strong></td>
                    <td>
                        <strong>${escaparHTML(nombreCliente)}</strong>
                        <br>
                        <small>${escaparHTML(cliente.telefono || '')}</small>
                        ${documentoCliente ? `<br><small>${escaparHTML(documentoCliente)}</small>` : ''}
                    </td>
                    <td class="admin-order-products">
                        <small>
                            ${items.length
                                ? items.slice(0,3).map(item => `${Number(item.cantidad || 0)} x ${escaparHTML(item.nombre || item.producto_id || 'Producto')}`).join('<br>') + (items.length > 3 ? `<br>+ ${items.length - 3} producto(s) más` : '')
                                : '-'
                            }
                        </small>
                    </td>
                    <td><strong>S/ ${Number(p.total || 0).toFixed(2)}</strong></td>
                    <td>
                        <select class="admin-select estado-pedido" data-id="${escaparAttr(p.id)}">
                            ${['Registrado','Preparando','Enviado','Entregado','Cancelado'].map(opcionEstado => `
                                <option value="${opcionEstado}" ${p.estado === opcionEstado ? 'selected' : ''}>${opcionEstado}</option>
                            `).join('')}
                        </select>
                    </td>
                    <td>${p.created_at ? new Date(p.created_at).toLocaleString('es-PE') : '-'}</td>
                    <td><button class="btn-mini" type="button" data-action="download-order" data-id="${escaparAttr(p.id)}">Descargar</button></td>
                </tr>
            `;
        }).join('')}
    `;
    renderPaginacionPedidos(totalPaginas);
}

function renderPaginacionPedidos(totalPaginas) {
    const table = document.getElementById('ordersTable');
    if (!table) return;
    let contenedor = document.getElementById('ordersPagination');
    if (!contenedor) {
        contenedor = document.createElement('div');
        contenedor.id = 'ordersPagination';
        contenedor.className = 'admin-pagination';
        table.closest('.admin-table-wrap')?.after(contenedor);
    }
    if (totalPaginas <= 1) { contenedor.innerHTML = ''; return; }
    contenedor.innerHTML = `
        <button class="btn-mini" type="button" ${paginaPedidos <= 1 ? 'disabled' : ''} data-page-pedido="prev">Anterior</button>
        <span>Página ${paginaPedidos} de ${totalPaginas}</span>
        <button class="btn-mini" type="button" ${paginaPedidos >= totalPaginas ? 'disabled' : ''} data-page-pedido="next">Siguiente</button>
    `;
    contenedor.querySelectorAll('[data-page-pedido]').forEach(btn => btn.addEventListener('click', () => {
        if (btn.dataset.pagePedido === 'prev') paginaPedidos = Math.max(1, paginaPedidos - 1);
        if (btn.dataset.pagePedido === 'next') paginaPedidos = Math.min(totalPaginas, paginaPedidos + 1);
        renderPedidosAdmin(pedidosFiltrados);
    }));
}

function aplicarParametrosPedidosUrl() {
    const params = new URLSearchParams(window.location.search);
    const estado = params.get('estado');
    const fecha = params.get('fecha');
    const estadoSelect = document.getElementById('orderStatusFilter');
    const fechaInput = document.getElementById('orderDateFilter');
    if (estado && estadoSelect) estadoSelect.value = estado;
    if (fecha && fechaInput) fechaInput.value = fecha;
}


async function manejarClickPedidos(e) {
    const btn = e.target.closest('button[data-action="download-order"]');
    if (!btn) return;

    try {
        await descargarPedidoAdmin(btn.dataset.id, btn);
    } catch (error) {
        if (manejarErrorAdmin(error)) return;
        mostrarToast(error.message || 'No se pudo descargar el pedido', 'error');
    }
}

async function descargarPedidoAdmin(id, btn) {
    if (!id) return;

    const textoOriginal = btn?.textContent || 'Descargar';

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Descargando...';
    }

    const res = await fetch(`${API_CONFIG.baseBackend}/admin/pedidos/${encodeURIComponent(id)}/descargar`, {
        headers: {
            Authorization: `Bearer ${getToken()}`
        }
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const error = new Error(data.error || 'No se pudo descargar el pedido');
        error.status = res.status;
        throw error;
    }

    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const filename = match?.[1] || `pedido-${id}.html`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    if (btn) {
        btn.disabled = false;
        btn.textContent = textoOriginal;
    }

    mostrarToast('Archivo del pedido descargado');
}


let categoriasAdmin = [];

async function cargarDashboardAdmin() {
    const panel = document.getElementById('dashboardPanel');
    if (!panel) return;
    const data = await apiRequest('/admin/dashboard');
    const ventas = data.ventasPorDia || [];
    const maxVenta = Math.max(1, ...ventas.map(v => Number(v.ventas ?? v.total ?? 0)));
    const linkPedidos = './admin-pedidos.html';

    panel.innerHTML = `
        <section class="admin-section admin-section--wide dashboard-kpi-panel">
            <div class="dashboard-kpi-grid">
                ${kpiDashboard('Ventas del día', `S/ ${Number(data.ventasHoy || 0).toFixed(2)}`, `${linkPedidos}?fecha=${new Date().toISOString().slice(0,10)}`)}
                ${kpiDashboard('Ventas del mes', `S/ ${Number(data.ventasMes || 0).toFixed(2)}`, './admin-reportes.html')}
                ${kpiDashboard('Pedidos pendientes', Number(data.pedidosPendientes || 0), `${linkPedidos}?estado=Registrado`)}
                ${kpiDashboard('Pedidos atendidos', Number(data.pedidosAtendidos || 0), `${linkPedidos}?estado=Entregado`)}
            </div>
        </section>
        <section class="admin-section admin-section--wide">
            <div class="admin-section__head"><div><h2>Gráfico de ventas</h2><p>Haz clic en una barra para ver pedidos de ese día.</p></div></div>
            <div class="sales-chart">${ventas.map(v => {
                const total = Number(v.ventas ?? v.total ?? 0);
                const fecha = v.fecha;
                return `<a href="${linkPedidos}?fecha=${escaparAttr(fecha)}" title="${escaparAttr(fecha)}: S/ ${total.toFixed(2)}"><span style="height:${Math.max(6, (total / maxVenta) * 100)}%"></span><small>${escaparHTML(fecha.slice(5))}</small></a>`;
            }).join('')}</div>
        </section>
        <section class="admin-section">
            <h2>Top 20 productos más vendidos</h2>
            <div class="admin-mini-list admin-mini-list--scroll">${(data.productosVendidos || []).slice(0,20).map(p => `<p><strong>${escaparHTML(p.nombre)}</strong><span>${p.cantidad} und. · S/ ${Number(p.total || 0).toFixed(2)}</span></p>`).join('') || '<p>Sin ventas todavía.</p>'}</div>
        </section>
        <section class="admin-section">
            <h2>Últimos pedidos</h2>
            <div class="admin-mini-list admin-mini-list--scroll">${(data.ultimosPedidos || []).slice(0,20).map(p => `<p><strong>${escaparHTML(p.numero || p.id)}</strong><span>S/ ${Number(p.total || 0).toFixed(2)} · ${escaparHTML(p.estado || '')}</span></p>`).join('') || '<p>Sin pedidos todavía.</p>'}</div>
        </section>
    `;
}

function kpiDashboard(titulo, valor, href) {
    return `<a class="dashboard-kpi-card" href="${escaparAttr(href)}"><span>${escaparHTML(titulo)}</span><strong>${escaparHTML(valor)}</strong><em>Ingresar</em></a>`;
}


async function cargarClientesAdmin() {
    const table = document.getElementById('clientsTable');
    if (!table) return;
    const clientes = await apiRequest('/admin/clientes');
    if (!clientes.length) {
        table.innerHTML = '<tr><th>Clientes</th></tr><tr><td>No hay clientes registrados.</td></tr>';
        return;
    }
    table.innerHTML = `
        <tr><th>Cliente</th><th>Documento</th><th>Contacto</th><th>Dirección</th><th>Compras</th><th>Total gastado</th><th>Última compra</th></tr>
        ${clientes.map(c => `<tr>
            <td><strong>${escaparHTML([c.nombre,c.apellido].filter(Boolean).join(' '))}</strong><br><small>${escaparHTML(c.email || '')}</small></td>
            <td>${escaparHTML(c.tipo_documento || '')} ${escaparHTML(c.documento || '')}</td>
            <td>${escaparHTML(c.telefono || '')}</td>
            <td><small>${escaparHTML(c.direccion || '')}</small></td>
            <td>${Number(c.compras || 0)}</td>
            <td>S/ ${Number(c.total_gastado || 0).toFixed(2)}</td>
            <td>${c.ultima_compra ? new Date(c.ultima_compra).toLocaleString('es-PE') : '-'}</td>
        </tr>`).join('')}
    `;
}

async function cargarReportesAdmin() {
    const panel = document.getElementById('reportsPanel');
    if (!panel) return;

    const params = new URLSearchParams();
    const fecha = document.getElementById('reportDateFilter')?.value || '';
    const mes = document.getElementById('reportMonthFilter')?.value || '';
    if (fecha) {
        params.set('desde', `${fecha}T00:00:00.000Z`);
        params.set('hasta', `${fecha}T23:59:59.999Z`);
    }
    if (mes && !fecha) params.set('mes', mes);

    const data = await apiRequest(`/admin/reportes${params.toString() ? `?${params}` : ''}`);
    panel.innerHTML = `
        <section class="admin-section admin-section--wide report-filter-panel">
            <div class="admin-report-filters">
                <label>Filtrar por día<input id="reportDateFilter" type="date" value="${escaparAttr(fecha)}"></label>
                <label>Filtrar por mes<input id="reportMonthFilter" type="month" value="${escaparAttr(mes)}"></label>
                <button class="btn btn--primary" type="button" id="applyReportFilters">Aplicar</button>
                <button class="btn btn--secondary" type="button" id="clearReportFilters">Limpiar</button>
            </div>
        </section>
        <section class="admin-section"><h2>Ventas por día</h2>${tablaSimple(['Fecha','Total'], (data.ventasPorDia || data.ventasDia || []).slice(-20).map(x => [x.fecha, `S/ ${Number(x.total || 0).toFixed(2)}`]))}</section>
        <section class="admin-section"><h2>Ventas por mes</h2>${tablaSimple(['Mes','Total'], (data.ventasPorMes || data.ventasMes || []).slice(-20).map(x => [x.mes, `S/ ${Number(x.total || 0).toFixed(2)}`]))}</section>
        <section class="admin-section"><h2>Top 20 productos más vendidos</h2>${tablaSimple(['SKU','Producto','Cantidad','Total'], (data.productosVendidos || []).slice(0,20).map(x => [x.sku, x.nombre, x.cantidad, `S/ ${Number(x.total || 0).toFixed(2)}`]))}</section>
        <section class="admin-section"><h2>Clientes frecuentes</h2>${tablaSimple(['Cliente','Compras','Total'], (data.clientesFrecuentes || []).slice(0,20).map(x => [x.cliente, x.compras, `S/ ${Number(x.total || 0).toFixed(2)}`]))}</section>
    `;

    document.getElementById('applyReportFilters')?.addEventListener('click', cargarReportesAdmin);
    document.getElementById('clearReportFilters')?.addEventListener('click', () => {
        document.getElementById('reportDateFilter').value = '';
        document.getElementById('reportMonthFilter').value = '';
        cargarReportesAdmin();
    });
}


function tablaSimple(headers, rows) {
    if (!rows.length) return '<p class="muted">Sin información.</p>';
    return `<div class="admin-table-wrap"><table class="admin-table"><tr>${headers.map(h=>`<th>${escaparHTML(h)}</th>`).join('')}</tr>${rows.map(r=>`<tr>${r.map(c=>`<td>${escaparHTML(c)}</td>`).join('')}</tr>`).join('')}</table></div>`;
}

function exportarReporteCsv() {
    const a = document.createElement('a');
    a.href = `${API_CONFIG.baseBackend}/admin/reportes/excel`;
    a.target = '_blank';
    fetch(a.href, { headers:{ Authorization:`Bearer ${getToken()}` } })
      .then(async res => {
        if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || 'No se pudo exportar');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'reporte-pedidos-alterego.csv';
        document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      })
      .catch(err => mostrarToast(err.message || 'No se pudo exportar', 'error'));
}

async function cargarConfigAdmin() {
    const panel = document.getElementById('configPanel');
    if (!panel) return;
    const c = await apiRequest('/admin/configuracion');
    panel.innerHTML = `
        <section class="admin-section admin-section--wide">
            <h2>Configuración de tienda</h2>
            <div class="config-grid">
                <p><strong>Correo tienda:</strong><span>${escaparHTML(c.store_email || '')}</span></p>
                <p><strong>WhatsApp:</strong><span>${escaparHTML(c.whatsapp || '')}</span></p>
                <p><strong>Frontend URL:</strong><span>${escaparHTML(c.frontend_url || '')}</span></p>
                <p><strong>SMTP usuario:</strong><span>${escaparHTML(c.smtp_user || '')}</span></p>
                <p><strong>Correo configurado:</strong><span>${c.smtp_configurado ? 'Sí' : 'No'}</span></p>
            </div>
            <p class="muted">Estos datos se cambian en el archivo .env del backend o en las variables de Render al publicar.</p>
        </section>
    `;
}

async function cargarCategoriasAdmin() {
    const table = document.getElementById('categoriesTable');
    const productSelect = document.getElementById('productCategorySelect');
    try { categoriasAdmin = await apiRequest('/admin/categorias'); }
    catch (error) {
        if (table) table.innerHTML = '<tr><th>Categorías</th></tr><tr><td>Ejecuta supabase-fix.sql para crear la tabla categories.</td></tr>';
        if (productSelect) productSelect.innerHTML = '<option value="">No se pudieron cargar las categorías</option>';
        return;
    }

    const activas = categoriasAdmin
        .filter(c => c && c.activo !== false)
        .sort((a,b) => Number(a.orden || 0) - Number(b.orden || 0));

    if (productSelect) {
        const actual = productSelect.value;
        productSelect.innerHTML = '<option value="">Selecciona una categoría activa</option>' + activas.map(c => {
            const nombre = String(c.nombre || c.name || c.categoria || c.slug || '').trim();
            return `<option value="${escaparAttr(nombre)}" data-id="${escaparAttr(c.id || '')}" data-slug="${escaparAttr(c.slug || '')}">${escaparHTML(nombre)}</option>`;
        }).join('');
        if ([...productSelect.options].some(op => op.value === actual)) productSelect.value = actual;
    }

    if (!table) return;
    if (!categoriasAdmin.length) {
        table.innerHTML = '<tr><th>Categorías</th></tr><tr><td>No hay categorías.</td></tr>';
        return;
    }
    table.innerHTML = `<tr><th>Categoría</th><th>Imagen</th><th>Slug</th><th>Orden</th><th>Estado</th><th>Acciones</th></tr>${categoriasAdmin.map(c => `<tr><td>${escaparHTML(c.nombre || '')}</td><td>${c.imagen ? `<img src="${escaparAttr(c.imagen)}" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:10px">` : escaparHTML(c.icono || '-')}</td><td>${escaparHTML(c.slug || '')}</td><td>${Number(c.orden || 1)}</td><td>${c.activo === false ? 'Oculta' : 'Activa'}</td><td><button class="btn-mini" data-action="edit-category" data-id="${escaparAttr(c.id)}">Editar</button><button class="btn-mini btn-mini--danger" data-action="hide-category" data-id="${escaparAttr(c.id)}">Ocultar</button></td></tr>`).join('')}`;
}

async function guardarCategoria(e) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form).entries());
    data.nombre = String(data.nombre || '').trim();
    data.slug = String(data.slug || data.nombre || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    data.orden = Number(data.orden || 1);
    data.imagen = String(data.imagen || '').trim();
    data.icono = String(data.icono || '').trim();
    data.activo = form.activo?.checked !== false;
    const id = data.id; delete data.id;
    try {
        if (id) await apiRequest(`/admin/categorias/${encodeURIComponent(id)}`, { method:'PUT', body:JSON.stringify(data) });
        else await apiRequest('/admin/categorias', { method:'POST', body:JSON.stringify(data) });
        form.reset(); if (form.activo) form.activo.checked = true;
        mostrarToast('Categoría guardada');
        await cargarCategoriasAdmin();
    } catch (error) { if (manejarErrorAdmin(error)) return; mostrarToast(error.message || 'No se pudo guardar categoría', 'error'); }
}

async function manejarClickCategorias(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const item = categoriasAdmin.find(c => String(c.id) === String(btn.dataset.id));
    if (!item) return;
    if (btn.dataset.action === 'edit-category') {
        const f = document.getElementById('categoryForm');
        f.id.value = item.id; f.nombre.value = item.nombre || ''; if (f.slug) f.slug.value = item.slug || ''; if (f.orden) f.orden.value = item.orden || 1; if (f.imagen) f.imagen.value = item.imagen || ''; if (f.icono) f.icono.value = item.icono || ''; f.activo.checked = item.activo !== false; f.scrollIntoView({ behavior:'smooth', block:'start' });
    }
    if (btn.dataset.action === 'hide-category') {
        await apiRequest(`/admin/categorias/${encodeURIComponent(item.id)}`, { method:'DELETE' });
        mostrarToast('Categoría oculta');
        await cargarCategoriasAdmin();
    }
}


let marcasAdmin = [];

async function cargarMarcasAdmin() {
    const table = document.getElementById('brandsTable');
    if (!table) return;
    try { marcasAdmin = await apiRequest('/admin/marcas'); }
    catch (error) {
        table.innerHTML = '<tr><th>Marcas</th></tr><tr><td>No se pudieron cargar las marcas. Ejecuta el SQL completo.</td></tr>';
        return;
    }
    if (!marcasAdmin.length) {
        table.innerHTML = '<tr><th>Marcas</th></tr><tr><td>No hay marcas registradas.</td></tr>';
        return;
    }
    table.innerHTML = `<tr><th>Marca</th><th>Imagen</th><th>Slug</th><th>Orden</th><th>Estado</th><th>Acciones</th></tr>${marcasAdmin.map(m => `<tr><td>${escaparHTML(m.nombre || '')}</td><td>${m.imagen ? `<img src="${escaparAttr(m.imagen)}" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:10px">` : '-'}</td><td>${escaparHTML(m.slug || '')}</td><td>${Number(m.orden || 1)}</td><td>${m.activo === false ? 'Oculta' : 'Activa'}</td><td><button class="btn-mini" data-action="edit-brand" data-id="${escaparAttr(m.id)}">Editar</button><button class="btn-mini btn-mini--danger" data-action="hide-brand" data-id="${escaparAttr(m.id)}">${m.activo === false ? 'Mostrar' : 'Ocultar'}</button></td></tr>`).join('')}`;
}

function actualizarPreviewMarca(src) {
    const wrap = document.getElementById('brandPreviewWrap');
    const img = document.getElementById('brandPreview');
    if (!wrap || !img) return;
    const value = String(src || '').trim();
    if (!value) {
        wrap.hidden = true;
        img.removeAttribute('src');
        return;
    }
    img.src = value;
    wrap.hidden = false;
}

function actualizarPreviewMarcaArchivo(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) {
        actualizarPreviewMarca(document.querySelector('#brandForm [name="imagen"]')?.value || '');
        return;
    }
    actualizarPreviewMarca(URL.createObjectURL(archivo));
}

async function guardarMarca(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const archivo = formData.get('archivo');
    formData.delete('archivo');
    const data = Object.fromEntries(formData.entries());
    data.nombre = String(data.nombre || '').trim();
    data.slug = String(data.slug || data.nombre || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
    data.imagen = String(data.imagen || '').trim();
    data.orden = Number(data.orden || 1);
    data.activo = form.activo?.checked !== false;
    const id = data.id; delete data.id;
    try {
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Guardando...'; }
        if (archivo instanceof File && archivo.size > 0) {
            const subida = new FormData();
            subida.append('archivo', archivo);
            const resultado = await apiUpload('/admin/media', subida);
            data.imagen = resultado.url;
        }
        const marcaGuardada = id
            ? await apiRequest(`/admin/marcas/${encodeURIComponent(id)}`, { method:'PUT', body:JSON.stringify(data) })
            : await apiRequest('/admin/marcas', { method:'POST', body:JSON.stringify(data) });
        const imagenGuardada = String(marcaGuardada?.imagen || data.imagen || '').trim();
        if (imagenGuardada) {
            try {
                const cache = JSON.parse(localStorage.getItem('alterego_brand_images_cache_v1') || '{}');
                const keyName = String(marcaGuardada?.nombre || data.nombre || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
                const keySlug = String(marcaGuardada?.slug || data.slug || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
                if (keyName) cache[keyName] = imagenGuardada;
                if (keySlug) cache[keySlug] = imagenGuardada;
                localStorage.setItem('alterego_brand_images_cache_v1', JSON.stringify(cache));
            } catch {}
        }
        form.reset();
        if (form.activo) form.activo.checked = true;
        actualizarPreviewMarca('');
        localStorage.setItem('alterego_brand_image_updated', String(Date.now()));
        mostrarToast('Marca guardada');
        await cargarMarcasAdmin();
    } catch (error) {
        if (manejarErrorAdmin(error)) return;
        mostrarToast(error.message || 'No se pudo guardar la marca', 'error');
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Guardar marca'; }
    }
}

async function manejarClickMarcas(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const item = marcasAdmin.find(m => String(m.id) === String(btn.dataset.id));
    if (!item) return;
    if (btn.dataset.action === 'edit-brand') {
        const f = document.getElementById('brandForm');
        f.id.value=item.id; f.nombre.value=item.nombre||''; f.slug.value=item.slug||''; f.orden.value=item.orden||1; f.imagen.value=item.imagen||''; f.activo.checked=item.activo!==false;
        if (f.archivo) f.archivo.value = '';
        actualizarPreviewMarca(item.imagen || '');
        f.scrollIntoView({behavior:'smooth',block:'start'});
    }
    if (btn.dataset.action === 'hide-brand') {
        await apiRequest(`/admin/marcas/${encodeURIComponent(item.id)}`, { method:'PUT', body:JSON.stringify({ ...item, activo:item.activo === false }) });
        mostrarToast(item.activo === false ? 'Marca visible' : 'Marca oculta');
        await cargarMarcasAdmin();
    }
}

function iniciarRevisionPedidosNuevos() {
    if (!document.getElementById('ordersTable')) return;
    if (intervaloPedidosAdmin) clearInterval(intervaloPedidosAdmin);

    intervaloPedidosAdmin = setInterval(() => {
        cargarPedidosAdmin(true).catch(error => {
            console.error('No se pudo revisar pedidos nuevos:', error);
        });
    }, 20000);
}

function revisarPedidosNuevos(pedidos = [], silencioso = true) {
    const firmaNueva = pedidos
        .slice(0, 10)
        .map(p => `${p.id}-${p.created_at || ''}`)
        .join('|');

    if (!pedidosAdminInicializados) {
        firmaPedidosActual = firmaNueva;
        pedidosAdminInicializados = true;
        return;
    }

    const hayPedidoNuevo = firmaPedidosActual && firmaNueva !== firmaPedidosActual && pedidos[0]?.id;
    firmaPedidosActual = firmaNueva;

    if (hayPedidoNuevo) {
        reproducirSonidoPedido();
        if (silencioso) mostrarToast('Nuevo pedido registrado');
        cargarResumen().catch(() => {});
    }
}

function desbloquearSonidoAdmin() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return null;
        if (!audioCtxAdmin) audioCtxAdmin = new AudioContext();
        if (audioCtxAdmin.state === 'suspended') audioCtxAdmin.resume();
        return audioCtxAdmin;
    } catch {
        return null;
    }
}

function reproducirSonidoPedido() {
    try {
        const ctx = desbloquearSonidoAdmin();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch (error) {
        console.warn('Sonido no disponible:', error);
    }
}

async function manejarCambioPedido(e) {
    const select = e.target.closest('.estado-pedido');
    if (!select) return;

    const id = select.dataset.id;
    const estado = select.value;

    try {
        await apiRequest(`/admin/pedidos/${encodeURIComponent(id)}/estado`, {
            method: 'PUT',
            body: JSON.stringify({ estado })
        });

        mostrarToast('Estado del pedido actualizado');
        await cargarPedidosAdmin();
    } catch (error) {
        if (manejarErrorAdmin(error)) return;
        mostrarToast(error.message || 'No se pudo cambiar el estado', 'error');
    }
}


function abrirModalStock(producto) {
    const modal = document.getElementById('stockModal');
    const nombre = document.getElementById('stockModalProductName');
    const actual = document.getElementById('stockModalActual');
    const input = document.getElementById('stockModalCantidad');
    const confirmar = document.getElementById('stockModalConfirmar');

    if (!modal || !input || !confirmar) {
        mostrarToast('No se encontró el modal de stock', 'error');
        return;
    }

    nombre.textContent = producto.nombre || 'Producto';
    actual.textContent = `Stock actual: ${Number(producto.stock || 0)}`;
    input.value = '';
    confirmar.dataset.id = producto.id;

    modal.classList.add('active');
    input.focus();
}

function cerrarModalStock() {
    document.getElementById('stockModal')?.classList.remove('active');
}

document.addEventListener('click', async e => {
    if (e.target.matches('[data-close-stock-modal]')) {
        cerrarModalStock();
    }

    if (e.target.matches('#stockModalConfirmar')) {
        const btn = e.target;
        const id = btn.dataset.id;
        const producto = productosAdmin.find(p => String(p.id) === String(id));
        const cantidad = Number(document.getElementById('stockModalCantidad')?.value || 0);

        if (!producto || cantidad <= 0) {
            mostrarToast('Ingresa una cantidad válida mayor a 0', 'error');
            return;
        }

        try {
            btn.disabled = true;
            btn.textContent = 'Actualizando...';

            await apiRequest(`/admin/productos/${encodeURIComponent(id)}`, {
                method: 'PUT',
                body: JSON.stringify({
                    ...producto,
                    stock: Number(producto.stock || 0) + cantidad
                })
            });

            cerrarModalStock();
            mostrarToast(`Stock actualizado: +${cantidad}`);
            await cargarProductosAdmin();
            await cargarResumen();
        } catch (error) {
            if (manejarErrorAdmin(error)) return;
            mostrarToast(error.message || 'No se pudo actualizar el stock', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Aumentar stock';
        }
    }
});


function normalizarTexto(texto) {
    return String(texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function escaparHTML(valor) {
    return String(valor ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function escaparAttr(valor) {
    return escaparHTML(valor).replaceAll('`', '&#096;');
}

function mostrarToast(mensaje, tipo = 'ok') {
    const toast = document.getElementById('adminToast');

    if (!toast) return;

    toast.textContent = mensaje;
    toast.className = `admin-toast show ${tipo === 'error' ? 'admin-toast--error' : ''}`;

    setTimeout(() => {
        toast.className = 'admin-toast';
    }, 3200);
}

/* =========================================================
   CORRECCIÓN FINAL: dashboard compacto + acciones masivas
   ========================================================= */
let productosSeleccionadosAE = new Set();

document.addEventListener('DOMContentLoaded', () => {
    const categoryFilter = document.getElementById('productCategoryFilter');
    categoryFilter?.addEventListener('change', () => {
        paginaProductos = 1;
        aplicarFiltrosProductos();
    });

    const table = document.getElementById('productsTable');
    table?.addEventListener('change', manejarSeleccionProductosAE);

    document.getElementById('bulkActionsBar')?.addEventListener('click', manejarAccionMasivaAE);
    document.getElementById('zeroAllStockBtn')?.addEventListener('click', ponerTodoStockCeroAE);
    document.getElementById('exportProductsCsv')?.addEventListener('click', exportarProductosCsvAE);
});

function completarCategoriasAdminAE() {
    const select = document.getElementById('productCategoryFilter');
    if (!select) return;
    const actual = select.value || '';
    const categorias = [...new Set(productosAdmin.map(p => p.categoria).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
    select.innerHTML = '<option value="">Todas las categorías</option>' + categorias.map(cat => `<option value="${escaparAttr(cat)}">${escaparHTML(cat)}</option>`).join('');
    select.value = categorias.includes(actual) ? actual : '';
}

function aplicarFiltrosProductos() {
    const busqueda = normalizarTexto(document.getElementById('productSearch')?.value || '');
    const estado = document.getElementById('productStatusFilter')?.value || 'todos';
    const categoria = normalizarTexto(document.getElementById('productCategoryFilter')?.value || '');

    productosFiltrados = productosAdmin.filter(producto => {
        const textoProducto = normalizarTexto([
            producto.id,
            producto.nombre,
            producto.marca,
            producto.categoria,
            producto.codigo_barras,
            producto.codigoBarras
        ].filter(Boolean).join(' '));

        const coincideBusqueda = !busqueda || textoProducto.includes(busqueda);
        const coincideCategoria = !categoria || normalizarTexto(producto.categoria) === categoria;

        let coincideEstado = true;
        if (estado === 'activos') coincideEstado = producto.activo !== false;
        if (estado === 'inactivos') coincideEstado = producto.activo === false;
        if (estado === 'visibles') coincideEstado = producto.visible !== false;
        if (estado === 'ocultos') coincideEstado = producto.visible === false;
        if (estado === 'sin-stock') coincideEstado = Number(producto.stock || 0) <= 0;
        if (estado === 'promocion') coincideEstado = Boolean(producto.en_promocion || producto.promocion || producto.promocionado || producto.promo);
        if (estado === 'oferta') coincideEstado = Boolean(producto.en_oferta || (Number(producto.precio_oferta || 0) > 0 && Number(producto.precio_oferta || 0) < Number(producto.precio || 0)));
        if (estado === 'destacados') coincideEstado = Boolean(producto.destacado);

        return coincideBusqueda && coincideCategoria && coincideEstado;
    });

    renderProductosAdmin();
}

async function cargarProductosAdmin() {
    productosAdmin = await apiRequest('/admin/productos');
    completarCategoriasAdminAE();
    productosSeleccionadosAE.clear();
    paginaProductos = 1;
    aplicarFiltrosProductos();
}

function renderProductosAdmin() {
    const table = document.getElementById('productsTable');
    const info = document.getElementById('productsInfo');
    if (!table) return;

    const total = productosFiltrados.length;
    const totalPaginas = Math.max(1, Math.ceil(total / PRODUCTOS_POR_PAGINA));
    if (paginaProductos > totalPaginas) paginaProductos = totalPaginas;

    const inicio = (paginaProductos - 1) * PRODUCTOS_POR_PAGINA;
    const fin = inicio + PRODUCTOS_POR_PAGINA;
    const productosPagina = productosFiltrados.slice(inicio, fin);

    if (info) {
        const desde = total ? inicio + 1 : 0;
        const hasta = Math.min(fin, total);
        info.textContent = `Mostrando ${desde} a ${hasta} de ${total} productos`;
    }

    if (!productosPagina.length) {
        table.innerHTML = `
            <tr><th>Producto</th></tr>
            <tr><td>No se encontraron productos.</td></tr>
        `;
        renderPaginacionProductos(totalPaginas);
        actualizarBulkUIAE();
        return;
    }

    const todosPaginaSeleccionados = productosPagina.every(p => productosSeleccionadosAE.has(String(p.id)));

    table.innerHTML = `
        <tr>
            <th><input type="checkbox" id="selectAllProductsAE" ${todosPaginaSeleccionados ? 'checked' : ''} aria-label="Seleccionar todos"></th>
            <th>Producto</th>
            <th>Categoría</th>
            <th>Precio</th>
            <th>Stock</th>
            <th>Estado</th>
            <th>Visibilidad</th>
            <th>Acciones</th>
        </tr>
        ${productosPagina.map(p => {
            const stock = Number(p.stock || 0);
            const sinStock = stock <= 0 || p.activo === false;
            const estadoTexto = sinStock ? 'Agotado' : stock <= 5 ? 'Bajo stock' : 'Disponible';
            const estadoClase = sinStock ? 'status-pill--off' : stock <= 5 ? 'status-pill--warn' : 'status-pill--on';
            const precioBase = Number(p.en_oferta ? (p.precio_oferta || p.precio || 0) : (p.precio || 0)).toFixed(2);
            return `
            <tr>
                <td><input type="checkbox" class="product-check-ae" data-id="${escaparAttr(p.id)}" ${productosSeleccionadosAE.has(String(p.id)) ? 'checked' : ''} aria-label="Seleccionar producto"></td>
                <td class="ae-admin-product-cell" title="${escaparAttr(p.nombre || 'Sin nombre')}">
                    <img src="${escaparAttr(rutaImagenAdmin(p.imagen || ''))}" alt="" loading="lazy" decoding="async">
                    <div><strong>${escaparHTML(p.nombre || 'Sin nombre')}</strong><small>SKU: ${escaparHTML(p.codigo_barras || p.codigoBarras || p.id || '-')}</small></div>
                </td>
                <td>${escaparHTML(p.categoria || 'General')}</td>
                <td>S/ ${precioBase}</td>
                <td><span class="ae-stock-dot ${stock <= 0 ? 'is-red' : stock <= 5 ? 'is-orange' : 'is-green'}"></span>${stock}</td>
                <td><span class="status-pill ${estadoClase}">${estadoTexto}</span>${p.en_promocion || p.promocion || p.promocionado ? ' <span class="status-pill status-pill--promo">Promoción</span>' : (p.en_oferta ? ' <span class="status-pill status-pill--offer">Oferta</span>' : '')}</td>
                <td><span class="status-pill ${p.visible === false ? 'status-pill--off' : 'status-pill--on'}">${p.visible === false ? 'Oculto' : 'Visible'}</span></td>
                <td class="admin-actions"><div class="admin-actions-grid">
                    <button class="admin-icon-btn admin-icon-btn--edit" type="button" data-action="edit-product" data-id="${escaparAttr(p.id)}" title="Editar">✎</button>
                    <button class="admin-icon-btn admin-icon-btn--stock" type="button" data-action="quick-stock" data-id="${escaparAttr(p.id)}" title="Aumentar stock">▣</button>
                    <button class="admin-icon-btn admin-icon-btn--zero" type="button" data-action="zero-stock" data-id="${escaparAttr(p.id)}" title="Poner stock en cero">0</button>
                    ${p.visible === false
                        ? `<button class="admin-icon-btn admin-icon-btn--show" type="button" data-action="show-product" data-id="${escaparAttr(p.id)}" title="Mostrar">👁</button>`
                        : `<button class="admin-icon-btn" type="button" data-action="hide-product" data-id="${escaparAttr(p.id)}" title="Ocultar">◌</button>`}
                    ${p.activo === false
                        ? `<button class="admin-icon-btn admin-icon-btn--available" type="button" data-action="activate-product" data-id="${escaparAttr(p.id)}" title="Activar">✓</button>`
                        : `<button class="admin-icon-btn admin-icon-btn--delete" type="button" data-action="delete-product" data-id="${escaparAttr(p.id)}" title="Desactivar">×</button>`}
                </div></td>
            </tr>`;
        }).join('')}
    `;

    renderPaginacionProductos(totalPaginas);
    actualizarBulkUIAE();
}

function manejarSeleccionProductosAE(e) {
    const selectAll = e.target.closest('#selectAllProductsAE');
    if (selectAll) {
        const inicio = (paginaProductos - 1) * PRODUCTOS_POR_PAGINA;
        const fin = inicio + PRODUCTOS_POR_PAGINA;
        productosFiltrados.slice(inicio, fin).forEach(p => {
            if (selectAll.checked) productosSeleccionadosAE.add(String(p.id));
            else productosSeleccionadosAE.delete(String(p.id));
        });
        renderProductosAdmin();
        return;
    }

    const check = e.target.closest('.product-check-ae');
    if (!check) return;
    if (check.checked) productosSeleccionadosAE.add(String(check.dataset.id));
    else productosSeleccionadosAE.delete(String(check.dataset.id));
    actualizarBulkUIAE();
}

function actualizarBulkUIAE() {
    const cantidad = productosSeleccionadosAE.size;
    const count = document.getElementById('bulkCount');
    if (count) count.textContent = `${cantidad} seleccionado${cantidad === 1 ? '' : 's'}`;
    document.querySelectorAll('#bulkActionsBar button[data-bulk]').forEach(btn => {
        btn.disabled = cantidad === 0;
    });
}

async function manejarAccionMasivaAE(e) {
    const btn = e.target.closest('button[data-bulk]');
    if (!btn || btn.disabled) return;
    const accion = btn.dataset.bulk;
    const ids = [...productosSeleccionadosAE];
    if (!ids.length) return;

    const mensajes = {
        desactivar: 'desactivar los productos seleccionados',
        promocion: 'poner los productos seleccionados en promoción',
        destacado: 'poner los productos seleccionados como destacados',
        cero: 'poner en cero el stock de los productos seleccionados',
        ocultar: 'ocultar los productos seleccionados'
    };

    if (!confirm(`¿Deseas ${mensajes[accion]}?`)) return;

    await modificarProductosPorLoteAE(ids, accion, btn);
}

async function modificarProductosPorLoteAE(ids, accion, boton) {
    try {
        if (boton) boton.disabled = true;
        const productos = ids.map(id => productosAdmin.find(p => String(p.id) === String(id))).filter(Boolean);

        for (const producto of productos) {
            const actualizado = { ...producto };
            if (accion === 'desactivar') actualizado.activo = false;
            if (accion === 'ocultar') actualizado.visible = false;
            if (accion === 'cero') actualizado.stock = 0;
            if (accion === 'destacado') actualizado.destacado = true;
            if (accion === 'promocion') {
                actualizado.en_promocion = true;
                const precio = Number(actualizado.precio || 0);
                if (!Number(actualizado.precio_oferta || 0) || Number(actualizado.precio_oferta || 0) >= precio) {
                    actualizado.precio_oferta = Number((precio * 0.9).toFixed(2));
                }
            }
            await apiRequest(`/admin/productos/${encodeURIComponent(producto.id)}`, {
                method: 'PUT',
                body: JSON.stringify(actualizado)
            });
        }

        mostrarToast(`Acción aplicada a ${productos.length} producto(s)`);
        productosSeleccionadosAE.clear();
        await cargarProductosAdmin();
        await cargarResumen();
    } catch (error) {
        if (manejarErrorAdmin(error)) return;
        mostrarToast(error.message || 'No se pudo aplicar la acción masiva', 'error');
    } finally {
        if (boton) boton.disabled = false;
        actualizarBulkUIAE();
    }
}

async function ponerTodoStockCeroAE() {
    if (!productosAdmin.length) return mostrarToast('No hay productos cargados');
    if (!confirm(`Se pondrá el stock en cero de ${productosAdmin.length} productos. ¿Deseas continuar?`)) return;
    const boton = document.getElementById('zeroAllStockBtn');
    try {
        if (boton) { boton.disabled = true; boton.textContent = 'Procesando...'; }
        for (const producto of productosAdmin) {
            await apiRequest(`/admin/productos/${encodeURIComponent(producto.id)}`, {
                method: 'PUT',
                body: JSON.stringify({ ...producto, stock: 0 })
            });
        }
        mostrarToast('Todo el stock quedó en cero');
        productosSeleccionadosAE.clear();
        await cargarProductosAdmin();
        await cargarResumen();
    } catch (error) {
        if (manejarErrorAdmin(error)) return;
        mostrarToast(error.message || 'No se pudo poner todo el stock en cero', 'error');
    } finally {
        if (boton) { boton.disabled = false; boton.textContent = 'Stock en cero'; }
    }
}

async function ponerStockCeroProductoAE(id) {
    const producto = productosAdmin.find(p => String(p.id) === String(id));
    if (!producto) return;
    await apiRequest(`/admin/productos/${encodeURIComponent(producto.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ ...producto, stock: 0 })
    });
    mostrarToast('Stock del producto en cero');
    await cargarProductosAdmin();
    await cargarResumen();
}

async function manejarClickProductos(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;

    try {
        if (action === 'edit-product') editarProductoPorId(id);
        if (action === 'quick-stock') await aumentarStockRapido(id);
        if (action === 'zero-stock') await ponerStockCeroProductoAE(id);
        if (action === 'delete-product') await cambiarActivoProducto(id, false);
        if (action === 'activate-product') await cambiarActivoProducto(id, true);
        if (action === 'hide-product') await cambiarVisibleProducto(id, false);
        if (action === 'show-product') await cambiarVisibleProducto(id, true);
    } catch (error) {
        if (manejarErrorAdmin(error)) return;
        mostrarToast(error.message || 'No se pudo completar la acción', 'error');
    }
}

function exportarProductosCsvAE() {
    const filas = [['ID','Nombre','Categoría','Marca','Precio','Precio oferta','Stock','Activo','Visible','Destacado','Promoción']];
    productosFiltrados.forEach(p => filas.push([
        p.id || '', p.nombre || '', p.categoria || '', p.marca || '', p.precio || 0,
        p.precio_oferta || '', p.stock || 0, p.activo === false ? 'No' : 'Sí',
        p.visible === false ? 'No' : 'Sí', p.destacado ? 'Sí' : 'No', p.en_oferta ? 'Sí' : 'No', (p.en_promocion || p.promocion || p.promocionado) ? 'Sí' : 'No'
    ]));
    const csv = filas.map(fila => fila.map(valor => `"${String(valor).replaceAll('"','""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'productos-alter-ego.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    mostrarToast('Productos exportados');
}

/* Notificaciones y cuenta del panel */
document.addEventListener('DOMContentLoaded', () => {
    const notifyBtn = document.getElementById('aeNotifyBtn');
    const notifyPanel = document.getElementById('aeNotifyPanel');
    const userBtn = document.getElementById('aeUserBtn');
    const userPanel = document.getElementById('aeUserPanel');
    const userLogout = document.getElementById('aeUserLogout');

    function cerrarPaneles(excepto) {
        if (excepto !== notifyPanel) notifyPanel?.classList.remove('is-open');
        if (excepto !== userPanel) userPanel?.classList.remove('is-open');
    }

    notifyBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        renderNotificacionesAE();
        const abrir = !notifyPanel?.classList.contains('is-open');
        cerrarPaneles(notifyPanel);
        notifyPanel?.classList.toggle('is-open', abrir);
    });

    userBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const abrir = !userPanel?.classList.contains('is-open');
        cerrarPaneles(userPanel);
        userPanel?.classList.toggle('is-open', abrir);
    });

    document.addEventListener('click', () => cerrarPaneles());
    notifyPanel?.addEventListener('click', e => e.stopPropagation());
    userPanel?.addEventListener('click', e => e.stopPropagation());

    userLogout?.addEventListener('click', () => {
        cerrarSesion();
        window.location.href = './admin-login.html';
    });

    setTimeout(renderNotificacionesAE, 900);
    setInterval(renderNotificacionesAE, 15000);
});

function renderNotificacionesAE() {
    const count = document.getElementById('aeNotifyCount');
    const list = document.getElementById('aeNotifyList');
    if (!count || !list) return;

    let pedidos = Array.isArray(pedidosAdmin) ? pedidosAdmin : [];
    if (!pedidos.length) {
        try {
            pedidos = JSON.parse(sessionStorage.getItem('alterego_pedidos') || sessionStorage.getItem('pedidos_alterego') || '[]');
        } catch (_) { pedidos = []; }
    }

    const pendientes = pedidos.filter(p => !p.estado || ['pendiente','nuevo','recibido'].includes(String(p.estado).toLowerCase()));
    count.textContent = String(pendientes.length || 0);

    if (!pendientes.length) {
        list.innerHTML = '<p>No hay pedidos nuevos.</p>';
        return;
    }

    list.innerHTML = pendientes.slice(0, 5).map(p => {
        const cliente = p.cliente?.nombre || p.nombre || p.usuario || 'Cliente';
        const total = Number(p.total || p.monto || 0).toFixed(2);
        const codigo = p.codigo || p.id || 'Pedido';
        return `<div class="ae-notify-item"><strong>${escaparHTML(codigo)} · ${escaparHTML(cliente)}</strong><span>Total S/ ${total} · pendiente</span></div>`;
    }).join('');
}

/* Override final: dashboard solo indicadores/ventas/pedidos, sin productos */
async function cargarDashboardAdmin() {
    const panel = document.getElementById('dashboardPanel');
    const ultimos = document.getElementById('ultimosPedidosDashboard');
    if (!panel && !ultimos) return;
    const data = await apiRequest('/admin/dashboard');
    const ventas = data.ventasPorDia || [];
    const maxVenta = Math.max(1, ...ventas.map(v => Number(v.ventas ?? v.total ?? 0)));
    if (panel) {
        panel.innerHTML = `<div class="sales-chart ae-sales-chart-clean">${ventas.slice(-14).map(v => {
            const total = Number(v.ventas ?? v.total ?? 0);
            const fecha = String(v.fecha || '').slice(5);
            return `<span title="${escaparAttr(fecha)}: S/ ${total.toFixed(2)}"><i style="height:${Math.max(7, (total / maxVenta) * 100)}%"></i><small>${escaparHTML(fecha)}</small></span>`;
        }).join('') || '<p class="muted">Sin ventas todavía.</p>'}</div>`;
    }
    if (ultimos) {
        const pedidos = (data.ultimosPedidos || []).slice(0, 8);
        ultimos.innerHTML = pedidos.length ? `<tr><th>Pedido</th><th>Total</th><th>Estado</th></tr>${pedidos.map(p => `<tr><td>${escaparHTML(p.numero || p.id || '-')}</td><td>S/ ${Number(p.total || 0).toFixed(2)}</td><td>${escaparHTML(p.estado || '-')}</td></tr>`).join('')}` : '<tr><th>Pedidos</th></tr><tr><td>No hay pedidos todavía.</td></tr>';
    }
}

/* =========================================================
   FIX FINAL JOHPSER: dashboard clickeable + tabla productos compacta
   ========================================================= */
function aeSafeNum(v){ return Number(v || 0); }

async function cargarResumen() {
    const contenedor = document.getElementById('adminStats');
    if (!contenedor) return;
    const data = await apiRequest('/admin/resumen');
    const pedidosTotal = Number((data.pedidosPendientes || data.pendientes || 0) + (data.pedidosAtendidos || data.atendidos || 0));
    const kpis = [
        {key:'ventas', cls:'ae-kpi-card--green', label:'Ventas totales', value:`S/ ${aeSafeNum(data.ventasMes || data.ventasHoy).toFixed(2)}`, sub:'Resumen de ventas', icon:'🛒'},
        {key:'pedidos', cls:'ae-kpi-card--purple', label:'Pedidos', value:pedidosTotal || data.pedidos || 0, sub:'Registrados y atendidos', icon:'📦'},
        {key:'productos', cls:'ae-kpi-card--blue', label:'Productos', value:data.productos || 0, sub:'Catálogo activo', icon:'◇'},
        {key:'clientes', cls:'ae-kpi-card--orange', label:'Clientes', value:data.clientes || 0, sub:'Clientes registrados', icon:'👥'},
        {key:'stock', cls:'ae-kpi-card--red', label:'Stock bajo', value:data.stockBajo || data.sinStock || 0, sub:'Revisar inventario', icon:'⚠'}
    ];
    contenedor.innerHTML = kpis.map((k,i) => `
        <article class="ae-kpi-card ${k.cls} ${i===0?'is-active':''}" data-dashboard-kpi="${k.key}">
            <div><span>${k.label}</span><strong>${k.value}</strong><small>${k.sub}</small></div><i>${k.icon}</i>
        </article>`).join('');
    contenedor.querySelectorAll('[data-dashboard-kpi]').forEach(card => {
        card.addEventListener('click', () => {
            contenedor.querySelectorAll('[data-dashboard-kpi]').forEach(c => c.classList.remove('is-active'));
            card.classList.add('is-active');
            renderDashboardResumenAE(card.dataset.dashboardKpi, data);
        });
    });
    renderDashboardResumenAE('ventas', data);
}

function renderDashboardResumenAE(tipo, data){
    const panel = document.getElementById('dashboardPanel');
    if (!panel) return;
    const filas = {
        ventas: [['Ventas del mes', `S/ ${aeSafeNum(data.ventasMes || data.ventasHoy).toFixed(2)}`], ['Ventas hoy', `S/ ${aeSafeNum(data.ventasHoy).toFixed(2)}`], ['Ticket promedio', `S/ ${aeSafeNum(data.ticketPromedio).toFixed(2)}`]],
        pedidos: [['Pendientes', data.pedidosPendientes || data.pendientes || 0], ['Atendidos', data.pedidosAtendidos || data.atendidos || 0], ['Cancelados', data.cancelados || 0]],
        productos: [['Total productos', data.productos || 0], ['Stock bajo', data.stockBajo || 0], ['Sin stock', data.sinStock || 0]],
        clientes: [['Clientes registrados', data.clientes || 0], ['Nuevos este mes', data.clientesMes || 0], ['Compradores', data.compradores || 0]],
        stock: [['Stock bajo', data.stockBajo || 0], ['Sin stock', data.sinStock || 0], ['Ocultos', data.ocultos || 0]]
    };
    const ventas = data.ventasPorDia || [];
    const maxVenta = Math.max(1, ...ventas.map(v => aeSafeNum(v.ventas ?? v.total)));
    const graficoVentas = tipo === 'ventas' ? `<div class="sales-chart ae-sales-chart-clean">${ventas.slice(-10).map(v => {
        const total = aeSafeNum(v.ventas ?? v.total);
        const fecha = String(v.fecha || '').slice(5) || '-';
        return `<span title="${escaparAttr(fecha)}: S/ ${total.toFixed(2)}"><i style="height:${Math.max(7, (total / maxVenta) * 100)}%"></i><small>${escaparHTML(fecha)}</small></span>`;
    }).join('') || '<p class="muted">Sin ventas todavía.</p>'}</div>` : '';
    panel.innerHTML = `${graficoVentas}<div class="dashboard-summary-card">${(filas[tipo] || []).map(([a,b]) => `<div class="summary-row"><strong>${escaparHTML(a)}</strong><span>${escaparHTML(String(b))}</span></div>`).join('')}</div>`;
}

async function cargarDashboardAdmin() {
    const panel = document.getElementById('dashboardPanel');
    const ultimos = document.getElementById('ultimosPedidosDashboard');
    if (!panel && !ultimos) return;
    const data = await apiRequest('/admin/dashboard');
    const ventas = data.ventasPorDia || [];
    const maxVenta = Math.max(1, ...ventas.map(v => aeSafeNum(v.ventas ?? v.total)));
    if (panel) {
        panel.innerHTML = `<div class="sales-chart ae-sales-chart-clean">${ventas.slice(-12).map(v => {
            const total = aeSafeNum(v.ventas ?? v.total);
            const fecha = String(v.fecha || '').slice(5) || '-';
            return `<span title="${escaparAttr(fecha)}: S/ ${total.toFixed(2)}"><i style="height:${Math.max(7, (total / maxVenta) * 100)}%"></i><small>${escaparHTML(fecha)}</small></span>`;
        }).join('') || '<p class="muted">Sin ventas todavía.</p>'}</div>`;
    }
    if (ultimos) {
        const pedidos = (data.ultimosPedidos || []).slice(0, 7);
        ultimos.innerHTML = pedidos.length
            ? `<tr><th>Pedido</th><th>Total</th><th>Estado</th></tr>${pedidos.map(p => `<tr><td title="${escaparAttr(p.numero || p.id || '-')}">${escaparHTML(p.numero || p.id || '-')}</td><td>S/ ${aeSafeNum(p.total).toFixed(2)}</td><td><span class="status-pill ${String(p.estado || '').toLowerCase().includes('cancel') ? 'status-pill--off' : 'status-pill--on'}">${escaparHTML(p.estado || 'Nuevo')}</span></td></tr>`).join('')}`
            : '<tr><th>Pedidos</th></tr><tr><td>No hay pedidos todavía.</td></tr>';
    }
}

function renderProductosAdmin() {
    const table = document.getElementById('productsTable');
    const info = document.getElementById('productsInfo');
    if (!table) return;
    const total = productosFiltrados.length;
    const totalPaginas = Math.max(1, Math.ceil(total / PRODUCTOS_POR_PAGINA));
    if (paginaProductos > totalPaginas) paginaProductos = totalPaginas;
    const inicio = (paginaProductos - 1) * PRODUCTOS_POR_PAGINA;
    const fin = inicio + PRODUCTOS_POR_PAGINA;
    const productosPagina = productosFiltrados.slice(inicio, fin);
    if (info) info.textContent = `Mostrando ${total ? inicio + 1 : 0} a ${Math.min(fin, total)} de ${total} productos`;
    if (!productosPagina.length) {
        table.innerHTML = `<tr><th>Productos</th></tr><tr><td>No se encontraron productos.</td></tr>`;
        renderPaginacionProductos(totalPaginas); actualizarBulkUIAE(); return;
    }
    const todosPaginaSeleccionados = productosPagina.every(p => productosSeleccionadosAE.has(String(p.id)));
    table.innerHTML = `
        <colgroup><col class="col-check"><col class="col-prod"><col class="col-cat"><col class="col-price"><col class="col-stock"><col class="col-state"><col class="col-vis"><col class="col-actions"></colgroup>
        <tr><th><input type="checkbox" id="selectAllProductsAE" ${todosPaginaSeleccionados ? 'checked' : ''} aria-label="Seleccionar todos"></th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Estado</th><th>Visible</th><th>Acciones</th></tr>
        ${productosPagina.map(p => {
            const stock = aeSafeNum(p.stock);
            const sinStock = stock <= 0 || p.activo === false;
            const estadoTexto = sinStock ? 'Agotado' : stock <= 5 ? 'Bajo' : 'Disponible';
            const estadoClase = sinStock ? 'status-pill--off' : stock <= 5 ? 'status-pill--warn' : 'status-pill--on';
            const precioBase = aeSafeNum(p.en_oferta ? (p.precio_oferta || p.precio) : p.precio).toFixed(2);
            return `<tr>
                <td><input type="checkbox" class="product-check-ae" data-id="${escaparAttr(p.id)}" ${productosSeleccionadosAE.has(String(p.id)) ? 'checked' : ''} aria-label="Seleccionar producto"></td>
                <td class="ae-admin-product-cell" title="${escaparAttr(p.nombre || 'Sin nombre')}"><img src="${escaparAttr(rutaImagenAdmin(p.imagen || ''))}" alt="" loading="lazy" decoding="async"><div><strong>${escaparHTML(p.nombre || 'Sin nombre')}</strong><small>SKU: ${escaparHTML(p.codigo_barras || p.codigoBarras || p.id || '-')}</small></div></td>
                <td title="${escaparAttr(p.categoria || 'General')}">${escaparHTML(p.categoria || 'General')}</td><td>S/ ${precioBase}</td><td><span class="ae-stock-dot ${stock <= 0 ? 'is-red' : stock <= 5 ? 'is-orange' : 'is-green'}"></span>${stock}</td>
                <td><span class="status-pill ${estadoClase}">${estadoTexto}</span></td><td><span class="status-pill ${p.visible === false ? 'status-pill--off' : 'status-pill--on'}">${p.visible === false ? 'Oculto' : 'Visible'}</span></td>
                <td class="admin-actions"><div class="admin-actions-grid"><button class="admin-icon-btn admin-icon-btn--edit" type="button" data-action="edit-product" data-id="${escaparAttr(p.id)}" title="Editar">✎</button><button class="admin-icon-btn admin-icon-btn--stock" type="button" data-action="quick-stock" data-id="${escaparAttr(p.id)}" title="Stock">▣</button><button class="admin-icon-btn admin-icon-btn--zero" type="button" data-action="zero-stock" data-id="${escaparAttr(p.id)}" title="Stock cero">0</button>${p.visible === false ? `<button class="admin-icon-btn admin-icon-btn--show" type="button" data-action="show-product" data-id="${escaparAttr(p.id)}" title="Mostrar">👁</button>` : `<button class="admin-icon-btn" type="button" data-action="hide-product" data-id="${escaparAttr(p.id)}" title="Ocultar">◌</button>`}${p.activo === false ? `<button class="admin-icon-btn admin-icon-btn--available" type="button" data-action="activate-product" data-id="${escaparAttr(p.id)}" title="Activar">✓</button>` : `<button class="admin-icon-btn admin-icon-btn--delete" type="button" data-action="delete-product" data-id="${escaparAttr(p.id)}" title="Desactivar">×</button>`}</div></td>
            </tr>`;
        }).join('')}`;
    renderPaginacionProductos(totalPaginas);
    actualizarBulkUIAE();
}


/* =========================================================
   FINAL FUNCIONAL: dashboard tipo boceto + nombres completos
   ========================================================= */
function aeEstadoResumenValores(data){
  const totalPedidos = aeSafeNum((data.pedidosPendientes||data.pendientes||0)+(data.pedidosAtendidos||data.atendidos||0)+(data.enviados||0)+(data.cancelados||0));
  return {
    pendiente: aeSafeNum(data.pedidosPendientes || data.pendientes || Math.round(totalPedidos*.27)),
    preparado: aeSafeNum(data.preparados || Math.round(totalPedidos*.20)),
    enviado: aeSafeNum(data.enviados || Math.round(totalPedidos*.24)),
    entregado: aeSafeNum(data.pedidosAtendidos || data.atendidos || Math.round(totalPedidos*.29))
  };
}
function renderPedidosEstadoAE(data){
  const cont = document.getElementById('pedidosEstadoPanel');
  if(!cont) return;
  const e = aeEstadoResumenValores(data || {});
  cont.innerHTML = `<div class="ae-donut-wrap"><div class="ae-donut"></div><div class="ae-donut-legend">
    <span><i class="ae-dot y"></i>Pendiente ${e.pendiente}</span>
    <span><i class="ae-dot b"></i>Preparado ${e.preparado}</span>
    <span><i class="ae-dot p"></i>Enviado ${e.enviado}</span>
    <span><i class="ae-dot g"></i>Entregado ${e.entregado}</span>
  </div></div>`;
}
function renderDashboardResumenAE(tipo, data){
    const panel = document.getElementById('dashboardPanel');
    if (!panel) return;
    const filas = {
        ventas: [['Ventas del mes', `S/ ${aeSafeNum(data.ventasMes || data.ventasHoy).toFixed(2)}`], ['Ventas hoy', `S/ ${aeSafeNum(data.ventasHoy).toFixed(2)}`], ['Ticket promedio', `S/ ${aeSafeNum(data.ticketPromedio).toFixed(2)}`]],
        pedidos: [['Pendientes', data.pedidosPendientes || data.pendientes || 0], ['Preparados', data.preparados || 0], ['Entregados', data.pedidosAtendidos || data.atendidos || 0]],
        productos: [['Total productos', data.productos || 0], ['Stock bajo', data.stockBajo || 0], ['Sin stock', data.sinStock || 0]],
        clientes: [['Clientes registrados', data.clientes || 0], ['Nuevos este mes', data.clientesMes || 0], ['Compradores', data.compradores || 0]],
        stock: [['Stock bajo', data.stockBajo || 0], ['Sin stock', data.sinStock || 0], ['Ocultos', data.ocultos || 0]]
    };
    const ventas = data.ventasPorDia || [];
    const maxVenta = Math.max(1, ...ventas.map(v => aeSafeNum(v.ventas ?? v.total)));
    const graficoVentas = `<div class="sales-chart ae-sales-chart-clean">${ventas.slice(-7).map(v => {
        const total = aeSafeNum(v.ventas ?? v.total);
        const fecha = String(v.fecha || '').slice(5) || '-';
        return `<span title="${escaparAttr(fecha)}: S/ ${total.toFixed(2)}"><i style="height:${Math.max(7, (total / maxVenta) * 100)}%"></i><small>${escaparHTML(fecha)}</small></span>`;
    }).join('') || '<p class="muted">Sin ventas todavía.</p>'}</div>`;
    const resumen = `<div class="dashboard-summary-card">${(filas[tipo] || filas.ventas).map(([a,b]) => `<div class="summary-row"><strong>${escaparHTML(a)}</strong><span>${escaparHTML(String(b))}</span></div>`).join('')}</div>`;
    panel.innerHTML = tipo === 'ventas' ? graficoVentas : resumen;
}
async function cargarDashboardAdmin() {
    const panel = document.getElementById('dashboardPanel');
    const ultimos = document.getElementById('ultimosPedidosDashboard');
    const estadoPanel = document.getElementById('pedidosEstadoPanel');
    if (!panel && !ultimos && !estadoPanel) return;
    const data = await apiRequest('/admin/dashboard');
    renderDashboardResumenAE('ventas', data);
    renderPedidosEstadoAE(data);
    if (ultimos) {
        const pedidos = (data.ultimosPedidos || []).slice(0, 5);
        ultimos.innerHTML = pedidos.length
            ? `<tr><th>Pedido</th><th>Cliente</th><th>Total</th><th>Estado</th></tr>${pedidos.map(p => `<tr><td title="${escaparAttr(p.numero || p.id || '-')}">${escaparHTML(p.numero || p.id || '-')}</td><td title="${escaparAttr(p.cliente || p.nombre || 'Cliente')}">${escaparHTML(p.cliente || p.nombre || 'Cliente')}</td><td>S/ ${aeSafeNum(p.total).toFixed(2)}</td><td><span class="status-pill ${String(p.estado || '').toLowerCase().includes('cancel') ? 'status-pill--off' : 'status-pill--on'}">${escaparHTML(p.estado || 'Pendiente')}</span></td></tr>`).join('')}`
            : '<tr><th>Pedidos</th></tr><tr><td>No hay pedidos todavía.</td></tr>';
    }
}
function renderProductosAdmin() {
    const table = document.getElementById('productsTable');
    const info = document.getElementById('productsInfo');
    if (!table) return;
    const total = productosFiltrados.length;
    const totalPaginas = Math.max(1, Math.ceil(total / PRODUCTOS_POR_PAGINA));
    if (paginaProductos > totalPaginas) paginaProductos = totalPaginas;
    const inicio = (paginaProductos - 1) * PRODUCTOS_POR_PAGINA;
    const fin = inicio + PRODUCTOS_POR_PAGINA;
    const productosPagina = productosFiltrados.slice(inicio, fin);
    if (info) info.textContent = `Mostrando ${total ? inicio + 1 : 0} a ${Math.min(fin, total)} de ${total} productos`;
    if (!productosPagina.length) { table.innerHTML = `<tr><th>Productos</th></tr><tr><td>No se encontraron productos.</td></tr>`; renderPaginacionProductos(totalPaginas); actualizarBulkUIAE?.(); return; }
    const todosPaginaSeleccionados = productosPagina.every(p => productosSeleccionadosAE.has(String(p.id)));
    table.innerHTML = `<colgroup><col class="col-check"><col class="col-prod"><col class="col-cat"><col class="col-price"><col class="col-stock"><col class="col-state"><col class="col-vis"><col class="col-actions"></colgroup>
      <tr><th><input type="checkbox" id="selectAllProductsAE" ${todosPaginaSeleccionados ? 'checked' : ''} aria-label="Seleccionar todos"></th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Estado</th><th>Visible</th><th>Acciones</th></tr>
      ${productosPagina.map(p => { const stock=aeSafeNum(p.stock); const sinStock=stock<=0||p.activo===false; const estadoTexto=sinStock?'Agotado':stock<=5?'Bajo':'Disponible'; const estadoClase=sinStock?'status-pill--off':stock<=5?'status-pill--warn':'status-pill--on'; const precioBase=aeSafeNum(p.en_oferta?(p.precio_oferta||p.precio):p.precio).toFixed(2); const nombre=p.nombre||'Sin nombre'; return `<tr>
        <td><input type="checkbox" class="product-check-ae" data-id="${escaparAttr(p.id)}" ${productosSeleccionadosAE.has(String(p.id)) ? 'checked' : ''} aria-label="Seleccionar producto"></td>
        <td class="ae-admin-product-cell" title="${escaparAttr(nombre)}"><img src="${escaparAttr(rutaImagenAdmin(p.imagen || ''))}" alt="" loading="lazy" decoding="async"><div><strong>${escaparHTML(nombre)}</strong><small>SKU: ${escaparHTML(p.codigo_barras || p.codigoBarras || p.id || '-')}</small></div></td>
        <td title="${escaparAttr(p.categoria || 'General')}">${escaparHTML(p.categoria || 'General')}</td><td>S/ ${precioBase}</td><td>${stock}</td><td><span class="status-pill ${estadoClase}">${estadoTexto}</span></td><td><span class="status-pill ${p.visible === false ? 'status-pill--off' : 'status-pill--on'}">${p.visible === false ? 'Oculto' : 'Visible'}</span></td>
        <td class="admin-actions"><div class="admin-actions-grid"><button class="admin-icon-btn admin-icon-btn--edit" type="button" data-action="edit-product" data-id="${escaparAttr(p.id)}" title="Editar">✎</button><button class="admin-icon-btn admin-icon-btn--stock" type="button" data-action="quick-stock" data-id="${escaparAttr(p.id)}" title="Stock">▣</button><button class="admin-icon-btn admin-icon-btn--zero" type="button" data-action="zero-stock" data-id="${escaparAttr(p.id)}" title="Stock cero">0</button>${p.visible === false ? `<button class="admin-icon-btn admin-icon-btn--show" type="button" data-action="show-product" data-id="${escaparAttr(p.id)}" title="Mostrar">👁</button>` : `<button class="admin-icon-btn" type="button" data-action="hide-product" data-id="${escaparAttr(p.id)}" title="Ocultar">◌</button>`}${p.activo === false ? `<button class="admin-icon-btn admin-icon-btn--available" type="button" data-action="activate-product" data-id="${escaparAttr(p.id)}" title="Activar">✓</button>` : `<button class="admin-icon-btn admin-icon-btn--delete" type="button" data-action="delete-product" data-id="${escaparAttr(p.id)}" title="Desactivar">×</button>`}</div></td>
      </tr>`; }).join('')}`;
    renderPaginacionProductos(totalPaginas); actualizarBulkUIAE?.();
}

/* =========================================================
   CORRECCION FINAL TABLA PRODUCTOS: foto, SKU y nombre separados
   ========================================================= */
function aeNombreProductoCorto(nombre){
    return String(nombre || 'Sin nombre').replace(/\s+/g, ' ').trim();
}
function renderProductosAdmin() {
    const table = document.getElementById('productsTable');
    const info = document.getElementById('productsInfo');
    if (!table) return;

    const total = productosFiltrados.length;
    const totalPaginas = Math.max(1, Math.ceil(total / PRODUCTOS_POR_PAGINA));
    if (paginaProductos > totalPaginas) paginaProductos = totalPaginas;

    const inicio = (paginaProductos - 1) * PRODUCTOS_POR_PAGINA;
    const fin = inicio + PRODUCTOS_POR_PAGINA;
    const productosPagina = productosFiltrados.slice(inicio, fin);

    if (info) info.textContent = `Mostrando ${total ? inicio + 1 : 0} a ${Math.min(fin, total)} de ${total} productos`;

    if (!productosPagina.length) {
        table.innerHTML = `<tr><th>Productos</th></tr><tr><td>No se encontraron productos.</td></tr>`;
        renderPaginacionProductos(totalPaginas);
        if (typeof actualizarBulkUIAE === 'function') actualizarBulkUIAE();
        return;
    }

    const todosPaginaSeleccionados = productosPagina.every(p => productosSeleccionadosAE.has(String(p.id)));

    table.innerHTML = `
        <colgroup>
            <col class="col-check">
            <col class="col-foto">
            <col class="col-sku">
            <col class="col-nombre">
            <col class="col-cat">
            <col class="col-price">
            <col class="col-stock">
            <col class="col-state">
            <col class="col-vis">
            <col class="col-actions">
        </colgroup>
        <thead>
            <tr>
                <th><input type="checkbox" id="selectAllProductsAE" ${todosPaginaSeleccionados ? 'checked' : ''} aria-label="Seleccionar todos"></th>
                <th>Foto</th>
                <th>SKU</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Estado</th>
                <th>Visible</th>
                <th>Acciones</th>
            </tr>
        </thead>
        <tbody>
        ${productosPagina.map(p => {
            const stock = aeSafeNum(p.stock);
            const sinStock = stock <= 0 || p.activo === false;
            const estadoTexto = sinStock ? 'Agotado' : stock <= 5 ? 'Bajo' : 'Disponible';
            const estadoClase = sinStock ? 'status-pill--off' : stock <= 5 ? 'status-pill--warn' : 'status-pill--on';
            const precioBase = aeSafeNum(p.en_oferta ? (p.precio_oferta || p.precio) : p.precio).toFixed(2);
            const nombre = aeNombreProductoCorto(p.nombre);
            const sku = p.codigo_barras || p.codigoBarras || p.id || '-';
            return `<tr>
                <td class="td-check"><input type="checkbox" class="product-check-ae" data-id="${escaparAttr(p.id)}" ${productosSeleccionadosAE.has(String(p.id)) ? 'checked' : ''} aria-label="Seleccionar producto"></td>
                <td class="td-foto"><img class="ae-product-photo" src="${escaparAttr(rutaImagenAdmin(p.imagen || ''))}" alt="${escaparAttr(nombre)}" loading="lazy" decoding="async"></td>
                <td class="td-sku" title="${escaparAttr(sku)}">${escaparHTML(sku)}</td>
                <td class="td-product-name" title="${escaparAttr(nombre)}"><strong>${escaparHTML(nombre)}</strong></td>
                <td class="td-cat" title="${escaparAttr(p.categoria || 'General')}">${escaparHTML(p.categoria || 'General')}</td>
                <td class="td-price">S/ ${precioBase}</td>
                <td class="td-stock">${stock}</td>
                <td class="td-state"><span class="status-pill ${estadoClase}">${estadoTexto}</span>${(p.en_promocion || p.promocion || p.promocionado) ? ' <span class="status-pill status-pill--promo">Promoción</span>' : (p.en_oferta ? ' <span class="status-pill status-pill--offer">Oferta</span>' : '')}</td>
                <td class="td-vis"><span class="status-pill ${p.visible === false ? 'status-pill--off' : 'status-pill--on'}">${p.visible === false ? 'Oculto' : 'Visible'}</span></td>
                <td class="admin-actions"><div class="admin-actions-grid">
                    <button class="admin-icon-btn admin-icon-btn--edit" type="button" data-action="edit-product" data-id="${escaparAttr(p.id)}" title="Editar">✎</button>
                    <button class="admin-icon-btn admin-icon-btn--stock" type="button" data-action="quick-stock" data-id="${escaparAttr(p.id)}" title="Stock">▣</button>
                    <button class="admin-icon-btn admin-icon-btn--zero" type="button" data-action="zero-stock" data-id="${escaparAttr(p.id)}" title="Stock cero">0</button>
                    ${p.visible === false ? `<button class="admin-icon-btn admin-icon-btn--show" type="button" data-action="show-product" data-id="${escaparAttr(p.id)}" title="Mostrar">👁</button>` : `<button class="admin-icon-btn" type="button" data-action="hide-product" data-id="${escaparAttr(p.id)}" title="Ocultar">◌</button>`}
                    ${p.activo === false ? `<button class="admin-icon-btn admin-icon-btn--available" type="button" data-action="activate-product" data-id="${escaparAttr(p.id)}" title="Activar">✓</button>` : `<button class="admin-icon-btn admin-icon-btn--delete" type="button" data-action="delete-product" data-id="${escaparAttr(p.id)}" title="Desactivar">×</button>`}
                </div></td>
            </tr>`;
        }).join('')}
        </tbody>`;

    renderPaginacionProductos(totalPaginas);
    if (typeof actualizarBulkUIAE === 'function') actualizarBulkUIAE();
}

/* =========================================================
   FIX FINAL GERENTE 2: pedidos legibles, cliente completo y dashboard profesional
   ========================================================= */
function aeClienteNombre(p){
    const c = p?.cliente;
    if (typeof c === 'string') return c || 'Cliente';
    if (c && typeof c === 'object') return [c.nombre, c.apellido].filter(Boolean).join(' ') || c.email || c.correo || c.telefono || 'Cliente';
    return p?.nombre || p?.cliente_nombre || p?.email || 'Cliente';
}
function aeEstadoPedidoNormalizado(estado){
    const e = String(estado || 'Registrado').toLowerCase();
    if (e.includes('prepar')) return 'Preparando';
    if (e.includes('envi')) return 'Enviado';
    if (e.includes('entreg') || e.includes('atendid')) return 'Entregado';
    if (e.includes('cancel')) return 'Cancelado';
    return 'Registrado';
}
function aeContarEstadosPedidos(pedidos){
    const r = {Registrado:0, Preparando:0, Enviado:0, Entregado:0, Cancelado:0};
    (pedidos || []).forEach(p => { const e = aeEstadoPedidoNormalizado(p.estado); r[e] = (r[e] || 0) + 1; });
    return r;
}
async function cargarResumen() {
    const contenedor = document.getElementById('adminStats');
    if (!contenedor) return;
    let data = await apiRequest('/admin/resumen');
    let pedidos = [];
    try { pedidos = await apiRequest('/admin/pedidos'); } catch(_) { pedidos = []; }
    const estados = aeContarEstadosPedidos(pedidos);
    const pedidosTotal = pedidos.length || Number(data.pedidos || data.totalPedidos || Object.values(estados).reduce((a,b)=>a+b,0));
    const kpis = [
        {key:'ventas', cls:'ae-kpi-card--green', label:'Ventas totales', value:`S/ ${aeSafeNum(data.ventasMes || data.ventasHoy).toFixed(2)}`, sub:'Click para gráfico', icon:'🛒'},
        {key:'pedidos', cls:'ae-kpi-card--purple', label:'Pedidos', value:pedidosTotal, sub:'Por estado', icon:'📦'},
        {key:'productos', cls:'ae-kpi-card--blue', label:'Productos', value:data.productos || 0, sub:'Catálogo', icon:'◇'},
        {key:'clientes', cls:'ae-kpi-card--orange', label:'Clientes', value:data.clientes || 0, sub:'Frecuentes', icon:'👥'},
        {key:'stock', cls:'ae-kpi-card--red', label:'Stock bajo', value:data.stockBajo || data.sinStock || 0, sub:'Revisar stock', icon:'⚠'}
    ];
    contenedor.innerHTML = kpis.map((k,i) => `<article class="ae-kpi-card ${k.cls} ${i===0?'is-active':''}" data-dashboard-kpi="${k.key}"><div><span>${k.label}</span><strong>${k.value}</strong><small>${k.sub}</small></div><i>${k.icon}</i></article>`).join('');
    data.__pedidos = pedidos;
    data.__estados = estados;
    contenedor.querySelectorAll('[data-dashboard-kpi]').forEach(card => card.addEventListener('click', () => {
        contenedor.querySelectorAll('[data-dashboard-kpi]').forEach(c => c.classList.remove('is-active'));
        card.classList.add('is-active');
        renderDashboardResumenAE(card.dataset.dashboardKpi, data);
    }));
    renderDashboardResumenAE('ventas', data);
    renderPedidosEstadoAE(data);
    actualizarContadoresPedidosAE(pedidos);
}
function renderPedidosEstadoAE(data){
  const cont = document.getElementById('pedidosEstadoPanel');
  if(!cont) return;
  const e = data.__estados || aeContarEstadosPedidos(data.__pedidos || []);
  cont.innerHTML = `<div class="ae-order-state-grid">
    ${Object.entries(e).map(([k,v])=>`<a href="./admin-pedidos.html?estado=${encodeURIComponent(k)}" class="ae-order-state"><strong>${v}</strong><span>${k}</span></a>`).join('')}
  </div>`;
}
function renderDashboardResumenAE(tipo, data){
    const panel = document.getElementById('dashboardPanel');
    if (!panel) return;
    const ventas = data.ventasPorDia || [];
    const maxVenta = Math.max(1, ...ventas.map(v => aeSafeNum(v.ventas ?? v.total)));
    const estados = data.__estados || {};
    const filas = {
        ventas: [['Ventas del mes', `S/ ${aeSafeNum(data.ventasMes || data.ventasHoy).toFixed(2)}`], ['Ventas hoy', `S/ ${aeSafeNum(data.ventasHoy).toFixed(2)}`], ['Ticket promedio', `S/ ${aeSafeNum(data.ticketPromedio).toFixed(2)}`]],
        pedidos: Object.entries(estados).map(([a,b])=>[a,b]),
        productos: [['Total productos', data.productos || 0], ['Stock bajo', data.stockBajo || 0], ['Sin stock', data.sinStock || 0]],
        clientes: [['Clientes registrados', data.clientes || 0], ['Nuevos este mes', data.clientesMes || 0], ['Compradores', data.compradores || 0]],
        stock: [['Stock bajo', data.stockBajo || 0], ['Sin stock', data.sinStock || 0], ['Ocultos', data.ocultos || 0]]
    };
    const grafico = `<div class="sales-chart ae-sales-chart-clean">${ventas.slice(-14).map(v => { const total=aeSafeNum(v.ventas ?? v.total); const fecha=String(v.fecha || '').slice(5)||'-'; return `<span title="${escaparAttr(fecha)}: S/ ${total.toFixed(2)}"><i style="height:${Math.max(8,(total/maxVenta)*100)}%"></i><small>${escaparHTML(fecha)}</small></span>`; }).join('') || '<p class="muted">Sin ventas todavía.</p>'}</div>`;
    const resumen = `<div class="dashboard-summary-card">${(filas[tipo] || filas.ventas).map(([a,b]) => `<div class="summary-row"><strong>${escaparHTML(a)}</strong><span>${escaparHTML(String(b))}</span></div>`).join('')}</div>`;
    panel.innerHTML = tipo === 'ventas' ? grafico + resumen : resumen;
}
async function cargarDashboardAdmin() {
    const panel = document.getElementById('dashboardPanel');
    const ultimos = document.getElementById('ultimosPedidosDashboard');
    const estadoPanel = document.getElementById('pedidosEstadoPanel');
    if (!panel && !ultimos && !estadoPanel) return;
    const data = await apiRequest('/admin/dashboard');
    let pedidos = data.ultimosPedidos || [];
    try { pedidos = await apiRequest('/admin/pedidos'); } catch(_) {}
    data.__pedidos = pedidos;
    data.__estados = aeContarEstadosPedidos(pedidos);
    renderDashboardResumenAE('ventas', data);
    renderPedidosEstadoAE(data);
    actualizarContadoresPedidosAE(pedidos);
    if (ultimos) {
        const ult = (pedidos || []).slice(0, 5);
        ultimos.innerHTML = ult.length
            ? `<tr><th>Pedido</th><th>Cliente</th><th>Total</th><th>Estado</th></tr>${ult.map(p => `<tr><td title="${escaparAttr(p.numero || p.id || '-')}">${escaparHTML(p.numero || p.id || '-')}</td><td title="${escaparAttr(aeClienteNombre(p))}">${escaparHTML(aeClienteNombre(p))}</td><td>S/ ${aeSafeNum(p.total).toFixed(2)}</td><td><span class="status-pill ${aeEstadoPedidoNormalizado(p.estado)==='Cancelado' ? 'status-pill--off' : 'status-pill--on'}">${escaparHTML(aeEstadoPedidoNormalizado(p.estado))}</span></td></tr>`).join('')}`
            : '<tr><th>Pedidos</th></tr><tr><td>No hay pedidos todavía.</td></tr>';
    }
}
function actualizarContadoresPedidosAE(pedidos){
    const count = Array.isArray(pedidos) ? pedidos.filter(p => ['Registrado','Preparando'].includes(aeEstadoPedidoNormalizado(p.estado))).length : 0;
    document.querySelectorAll('#sidebarPedidosCount,#aeNotifyCount').forEach(el => { if(el) el.textContent = String(count); });
}
function renderNotificacionesAE() {
    const count = document.getElementById('aeNotifyCount');
    const list = document.getElementById('aeNotifyList');
    if (!count || !list) return;
    let pedidos = Array.isArray(pedidosAdmin) && pedidosAdmin.length ? pedidosAdmin : [];
    if (!pedidos.length) { try { pedidos = JSON.parse(sessionStorage.getItem('alterego_pedidos') || sessionStorage.getItem('pedidos_alterego') || '[]'); } catch (_) { pedidos = []; } }
    const pendientes = pedidos.filter(p => ['Registrado','Preparando'].includes(aeEstadoPedidoNormalizado(p.estado)));
    count.textContent = String(pendientes.length || 0);
    if (!pendientes.length) { list.innerHTML = '<p>No hay pedidos nuevos.</p>'; return; }
    list.innerHTML = pendientes.slice(0, 5).map(p => `<div class="ae-notify-item"><strong>${escaparHTML(p.numero || p.codigo || p.id || 'Pedido')} · ${escaparHTML(aeClienteNombre(p))}</strong><span>S/ ${aeSafeNum(p.total || p.monto).toFixed(2)} · ${escaparHTML(aeEstadoPedidoNormalizado(p.estado))}</span></div>`).join('');
}


/* =========================================================
   CORRECCION DEFINITIVA JOHPSER - FUNCIONES ADMIN
   - Sonido activo por defecto en todas las páginas del panel.
   - Notificaciones revisan pedidos aunque no estés en Pedidos.
   - Tabla de productos legible, filas blancas, acciones completas.
   ========================================================= */
const AE_SOUND_KEY_FINAL = 'ae_admin_sound_enabled_final';
let aePedidosPollFinal = null;
let aeUltimaFirmaPedidosFinal = '';
let aePrimerChequeoPedidosFinal = true;

function aeIconSvg(name){
    const icons = {
      edit:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="m13.5 8.5 2 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      stock:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5 12 3l8 4.5-8 4.5-8-4.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M4 7.5v9l8 4.5 8-4.5v-9" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 12v9" stroke="currentColor" stroke-width="2"/></svg>',
      zero:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="2"/><path d="m7 17 10-10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      eye:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>',
      hide:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10.5 6.2c.5-.1 1-.2 1.5-.2 6 0 9.5 6 9.5 6a16 16 0 0 1-2.3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6.5 7.8A16.3 16.3 0 0 0 2.5 12s3.5 6 9.5 6c1.5 0 2.8-.4 4-.9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      ok:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      x:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>'
    };
    return icons[name] || name;
}

function aeSoundIsOnFinal(){
    const saved = sessionStorage.getItem(AE_SOUND_KEY_FINAL);
    return saved !== '0' && saved !== 'off';
}
function aeSetSoundFinal(on){
    sessionStorage.setItem(AE_SOUND_KEY_FINAL, on ? '1' : '0');
    document.querySelectorAll('#aeSoundSwitchFinal').forEach(btn=>{
        btn.classList.toggle('is-off', !on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.title = on ? 'Sonido activo' : 'Sonido desactivado';
        btn.innerHTML = `<span>${on ? '🔊' : '🔇'}</span><i></i>`;
    });
}
function aeInjectSoundSwitchFinal(){
    const topIcons = document.querySelector('.ae-top-icons');
    if (!topIcons || document.getElementById('aeSoundSwitchFinal')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'aeSoundSwitchFinal';
    btn.className = 'ae-sound-switch';
    btn.setAttribute('aria-label', 'Activar o desactivar sonido de pedidos');
    topIcons.insertBefore(btn, topIcons.firstChild);
    aeSetSoundFinal(aeSoundIsOnFinal());
    btn.addEventListener('click', () => {
        const nuevo = !aeSoundIsOnFinal();
        aeSetSoundFinal(nuevo);
        if (nuevo) {
            desbloquearSonidoAdmin();
            reproducirSonidoPedido();
            mostrarToast('Sonido de pedidos activado');
        } else {
            mostrarToast('Sonido de pedidos desactivado');
        }
    });
    const old = document.getElementById('enableSound');
    if (old) {
        old.outerHTML = '<button class="btn btn--secondary" type="button" id="enableSoundLabel">Sonido activo arriba</button>';
    }
}

function reproducirSonidoPedido(prueba=false){
    if (!prueba && !aeSoundIsOnFinal()) return;
    try {
        const ctx = desbloquearSonidoAdmin();
        if (!ctx) return;
        const now = ctx.currentTime;
        [880, 1175].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.001, now + i * 0.14);
            gain.gain.exponentialRampToValueAtTime(0.20, now + i * 0.14 + 0.025);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.22);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.14);
            osc.stop(now + i * 0.14 + 0.24);
        });
    } catch (error) { console.warn('Sonido no disponible:', error); }
}

async function aeFetchPedidosGlobalFinal(){
    try {
        const pedidos = await apiRequest('/admin/pedidos');
        pedidosAdmin = Array.isArray(pedidos) ? pedidos : [];
        actualizarContadoresPedidosAE(pedidosAdmin);
        renderNotificacionesAE();
        const firma = pedidosAdmin.slice(0,10).map(p => `${p.id || p.numero}-${p.created_at || p.fecha || ''}-${p.estado || ''}`).join('|');
        if (aePrimerChequeoPedidosFinal) {
            aePrimerChequeoPedidosFinal = false;
            aeUltimaFirmaPedidosFinal = firma;
            return pedidosAdmin;
        }
        if (aeUltimaFirmaPedidosFinal && firma && firma !== aeUltimaFirmaPedidosFinal) {
            const primero = pedidosAdmin[0];
            const texto = primero ? `Nuevo movimiento de pedido: ${primero.numero || primero.id || ''}` : 'Nuevo pedido registrado';
            mostrarToast(texto);
            reproducirSonidoPedido(false);
        }
        aeUltimaFirmaPedidosFinal = firma;
        return pedidosAdmin;
    } catch (error) {
        console.warn('No se pudieron consultar pedidos para notificaciones:', error);
        return [];
    }
}

function iniciarRevisionPedidosNuevos(){
    if (aePedidosPollFinal) clearInterval(aePedidosPollFinal);
    aeFetchPedidosGlobalFinal();
    aePedidosPollFinal = setInterval(aeFetchPedidosGlobalFinal, 20000);
}

function renderNotificacionesAE() {
    const count = document.getElementById('aeNotifyCount');
    const list = document.getElementById('aeNotifyList');
    if (!count || !list) return;
    let pedidos = Array.isArray(pedidosAdmin) ? pedidosAdmin : [];
    if (!pedidos.length) { try { pedidos = JSON.parse(sessionStorage.getItem('alterego_pedidos') || sessionStorage.getItem('pedidos_alterego') || '[]'); } catch (_) { pedidos = []; } }
    const pendientes = pedidos.filter(p => ['Registrado','Preparando'].includes(aeEstadoPedidoNormalizado(p.estado)));
    count.textContent = String(pendientes.length || 0);
    const side = document.getElementById('sidebarPedidosCount');
    if (side) side.textContent = String(pendientes.length || 0);
    if (!pendientes.length) { list.innerHTML = '<p>No hay pedidos nuevos.</p>'; return; }
    list.innerHTML = pendientes.slice(0, 6).map(p => `<div class="ae-notify-item"><strong>${escaparHTML(p.numero || p.codigo || p.id || 'Pedido')}</strong><span>${escaparHTML(aeClienteNombre(p))} · S/ ${aeSafeNum(p.total || p.monto).toFixed(2)} · ${escaparHTML(aeEstadoPedidoNormalizado(p.estado))}</span></div>`).join('');
}

function renderProductosAdmin() {
    const table = document.getElementById('productsTable');
    const info = document.getElementById('productsInfo');
    if (!table) return;
    const total = productosFiltrados.length;
    const totalPaginas = Math.max(1, Math.ceil(total / PRODUCTOS_POR_PAGINA));
    if (paginaProductos > totalPaginas) paginaProductos = totalPaginas;
    const inicio = (paginaProductos - 1) * PRODUCTOS_POR_PAGINA;
    const fin = inicio + PRODUCTOS_POR_PAGINA;
    const productosPagina = productosFiltrados.slice(inicio, fin);
    if (info) info.textContent = `Mostrando ${total ? inicio + 1 : 0} a ${Math.min(fin, total)} de ${total} productos`;
    if (!productosPagina.length) {
        table.innerHTML = `<thead><tr><th>Productos</th></tr></thead><tbody><tr><td>No se encontraron productos.</td></tr></tbody>`;
        renderPaginacionProductos(totalPaginas);
        if (typeof actualizarBulkUIAE === 'function') actualizarBulkUIAE();
        return;
    }
    const todosPaginaSeleccionados = productosPagina.every(p => productosSeleccionadosAE.has(String(p.id)));
    table.innerHTML = `
        <colgroup><col class="col-check"><col class="col-foto"><col class="col-sku"><col class="col-nombre"><col class="col-cat"><col class="col-price"><col class="col-stock"><col class="col-state"><col class="col-vis"><col class="col-actions"></colgroup>
        <thead><tr><th><input type="checkbox" id="selectAllProductsAE" ${todosPaginaSeleccionados ? 'checked' : ''} aria-label="Seleccionar todos"></th><th>Foto</th><th>SKU</th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Estado</th><th>Visible</th><th>Acciones</th></tr></thead>
        <tbody>${productosPagina.map(p => {
            const stock = aeSafeNum(p.stock);
            const sinStock = stock <= 0 || p.activo === false;
            const estadoTexto = sinStock ? 'Agotado' : stock <= 5 ? 'Bajo' : 'Disponible';
            const estadoClase = sinStock ? 'status-pill--off' : stock <= 5 ? 'status-pill--warn' : 'status-pill--on';
            const precioBase = aeSafeNum(p.en_oferta ? (p.precio_oferta || p.precio) : p.precio).toFixed(2);
            const nombre = aeNombreProductoCorto(p.nombre);
            const sku = p.codigo_barras || p.codigoBarras || p.id || '-';
            return `<tr>
                <td class="td-check"><input type="checkbox" class="product-check-ae" data-id="${escaparAttr(p.id)}" ${productosSeleccionadosAE.has(String(p.id)) ? 'checked' : ''} aria-label="Seleccionar producto"></td>
                <td class="td-foto"><img class="ae-product-photo" src="${escaparAttr(rutaImagenAdmin(p.imagen || ''))}" alt="${escaparAttr(nombre)}" loading="lazy" decoding="async"></td>
                <td class="td-sku" title="${escaparAttr(sku)}">${escaparHTML(sku)}</td>
                <td class="td-product-name" title="${escaparAttr(nombre)}"><strong>${escaparHTML(nombre)}</strong></td>
                <td class="td-cat" title="${escaparAttr(p.categoria || 'General')}">${escaparHTML(p.categoria || 'General')}</td>
                <td class="td-price">S/ ${precioBase}</td>
                <td class="td-stock">${stock}</td>
                <td class="td-state"><span class="status-pill ${estadoClase}">${estadoTexto}</span>${(p.en_promocion || p.promocion || p.promocionado) ? ' <span class="status-pill status-pill--promo">Promo</span>' : (p.en_oferta ? ' <span class="status-pill status-pill--offer">Oferta</span>' : '')}</td>
                <td class="td-vis"><span class="status-pill ${p.visible === false ? 'status-pill--off' : 'status-pill--on'}">${p.visible === false ? 'Oculto' : 'Visible'}</span></td>
                <td class="admin-actions"><div class="admin-actions-grid">
                    <button class="admin-icon-btn admin-icon-btn--edit" type="button" data-action="edit-product" data-id="${escaparAttr(p.id)}" title="Editar producto">${aeIconSvg('edit')}</button>
                    <button class="admin-icon-btn admin-icon-btn--stock" type="button" data-action="quick-stock" data-id="${escaparAttr(p.id)}" title="Subir stock">${aeIconSvg('stock')}</button>
                    <button class="admin-icon-btn admin-icon-btn--zero" type="button" data-action="zero-stock" data-id="${escaparAttr(p.id)}" title="Poner stock en cero">${aeIconSvg('zero')}</button>
                    ${p.visible === false ? `<button class="admin-icon-btn admin-icon-btn--show" type="button" data-action="show-product" data-id="${escaparAttr(p.id)}" title="Mostrar en tienda">${aeIconSvg('eye')}</button>` : `<button class="admin-icon-btn admin-icon-btn--hide" type="button" data-action="hide-product" data-id="${escaparAttr(p.id)}" title="Ocultar de tienda">${aeIconSvg('hide')}</button>`}
                    ${p.activo === false ? `<button class="admin-icon-btn admin-icon-btn--available" type="button" data-action="activate-product" data-id="${escaparAttr(p.id)}" title="Activar producto">${aeIconSvg('ok')}</button>` : `<button class="admin-icon-btn admin-icon-btn--delete" type="button" data-action="delete-product" data-id="${escaparAttr(p.id)}" title="Desactivar producto">${aeIconSvg('x')}</button>`}
                </div></td>
            </tr>`;
        }).join('')}</tbody>`;
    renderPaginacionProductos(totalPaginas);
    if (typeof actualizarBulkUIAE === 'function') actualizarBulkUIAE();
}

function renderPedidosAdmin(pedidos = []) {
    const table = document.getElementById('ordersTable');
    const contador = document.getElementById('ordersCount');
    if (!table) return;
    const total = pedidosAdmin.length;
    const mostrados = pedidos.length;
    const totalPaginas = Math.max(1, Math.ceil(mostrados / PEDIDOS_POR_PAGINA));
    if (paginaPedidos > totalPaginas) paginaPedidos = totalPaginas;
    const inicio = (paginaPedidos - 1) * PEDIDOS_POR_PAGINA;
    const fin = inicio + PEDIDOS_POR_PAGINA;
    const pagina = pedidos.slice(inicio, fin);
    if (contador) contador.textContent = total ? `Mostrando ${mostrados ? inicio + 1 : 0}-${Math.min(fin, mostrados)} de ${mostrados} pedidos filtrados · Total: ${total}` : 'No hay pedidos registrados.';
    if (!pedidos.length) {
        table.innerHTML = `<thead><tr><th>Pedidos</th></tr></thead><tbody><tr><td>No se encontraron pedidos con esos filtros.</td></tr></tbody>`;
        renderPaginacionPedidos(totalPaginas);
        return;
    }
    table.innerHTML = `<thead><tr><th>Número</th><th>Cliente</th><th>Productos</th><th>Total</th><th>Estado</th><th>Fecha</th><th>Archivo</th></tr></thead><tbody>${pagina.map(p => {
        const items = p.order_items || p.items || [];
        const cliente = p.cliente || {};
        const nombreCliente = aeClienteNombre(p);
        const documentoCliente = cliente?.documento ? `${cliente.tipo_documento || 'Doc.'}: ${cliente.documento}` : (p.documento || '');
        return `<tr><td><strong>${escaparHTML(p.numero || p.id || '-')}</strong></td><td><strong>${escaparHTML(nombreCliente)}</strong>${cliente.telefono ? `<br><small>${escaparHTML(cliente.telefono)}</small>` : ''}${documentoCliente ? `<br><small>${escaparHTML(documentoCliente)}</small>` : ''}</td><td class="admin-order-products"><small>${items.length ? items.slice(0,3).map(item => `${Number(item.cantidad || 0)} x ${escaparHTML(item.nombre || item.producto_id || 'Producto')}`).join('<br>') + (items.length > 3 ? `<br>+ ${items.length - 3} producto(s) más` : '') : '-'}</small></td><td><strong>S/ ${aeSafeNum(p.total).toFixed(2)}</strong></td><td><select class="admin-select estado-pedido" data-id="${escaparAttr(p.id)}">${['Registrado','Preparando','Enviado','Entregado','Cancelado'].map(op => `<option value="${op}" ${aeEstadoPedidoNormalizado(p.estado) === op ? 'selected' : ''}>${op}</option>`).join('')}</select></td><td>${p.created_at || p.fecha ? new Date(p.created_at || p.fecha).toLocaleString('es-PE') : '-'}</td><td><button class="btn-mini" type="button" data-action="download-order" data-id="${escaparAttr(p.id)}">Descargar</button></td></tr>`;
    }).join('')}</tbody>`;
    renderPaginacionPedidos(totalPaginas);
}

document.addEventListener('DOMContentLoaded', () => {
    aeInjectSoundSwitchFinal();
    document.getElementById('enableSoundLabel')?.addEventListener('click', () => document.getElementById('aeSoundSwitchFinal')?.click());
    iniciarRevisionPedidosNuevos();
});
