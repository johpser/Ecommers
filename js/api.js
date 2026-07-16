// Backend público de ALTER EGO en Railway.
// Se usa siempre esta URL para evitar que la web publicada intente llamar a localhost.
const API_BACKEND_CONFIGURADO =
    'https://ecommerce-production-a450.up.railway.app/api';

// Elimina cualquier configuración antigua guardada en el navegador.
try {
    sessionStorage.removeItem('ALTEREGO_API_URL');
} catch (error) {
    console.warn('No se pudo limpiar ALTEREGO_API_URL:', error);
}

const API_CONFIG = {
    // La tienda trabaja con el backend/Supabase por defecto.
    // El JSON local solo se activa manualmente con ALTEREGO_DEMO_LOCAL=1.
    usarBackend: true,
    baseLocal: window.location.pathname.includes('/paginas/')
        ? '../data/productos.json'
        : './data/productos.json',
    baseBackend: API_BACKEND_CONFIGURADO.replace(/\/$/, '')
};

async function apiUpload(path, formData) {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_CONFIG.baseBackend}${path}`, {
        method: 'POST',
        headers,
        body: formData,
        cache: 'no-store'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const error = new Error(data.error || 'No se pudo subir el archivo');
        error.status = res.status;
        throw error;
    }
    return data;
}

function getToken() {
    return sessionStorage.getItem('alterego_token') || '';
}

function getUsuario() {
    return JSON.parse(sessionStorage.getItem('alterego_usuario') || 'null');
}

function guardarSesionAuth(data) {
    if (data.token) {
        sessionStorage.setItem('alterego_token', data.token);
    }

    if (data.usuario) {
        sessionStorage.setItem('alterego_usuario', JSON.stringify(data.usuario));
    }
}

function cerrarSesion() {
    sessionStorage.removeItem('alterego_token');
    sessionStorage.removeItem('alterego_usuario');
}

function estaLogueado() {
    return Boolean(getToken());
}

function leerPayloadToken() {
    const token = getToken();

    if (!token || !token.includes('.')) {
        return null;
    }

    try {
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(decodeURIComponent(atob(base64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join('')));
    } catch {
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch {
            return null;
        }
    }
}

function esAdminActual() {
    const usuario = getUsuario();
    const payload = leerPayloadToken();
    return usuario?.role === 'admin' && payload?.role === 'admin';
}

async function apiRequest(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    const token = getToken();

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    // MODO REAL: por defecto la tienda y el panel leen Supabase/backend.
    // Solo se usa productos.json/sessionStorage si desactivas el backend manualmente:
    // API_CONFIG.usarBackend = false, sessionStorage.ALTEREGO_DEMO_LOCAL = '1'
    // o options.allowLocalFallback = true.
    const demoLocal = sessionStorage.getItem('ALTEREGO_DEMO_LOCAL') === '1';
    // El contenido administrable (carrusel y banners) debe venir siempre del backend
    // cuando el modo real está activo. Un fallback automático en sessionStorage hacía
    // que reaparecieran videos y banners antiguos aunque se editaran u ocultaran.
    const permitirFallbackLocal = !API_CONFIG.usarBackend || demoLocal || options.allowLocalFallback === true;

    if (!API_CONFIG.usarBackend || demoLocal) {
        const fallbackDirecto = await respuestaLocalApi(path, options);
        if (fallbackDirecto !== null) return fallbackDirecto;
    }

    try {
        const method = String(options.method || 'GET').toUpperCase();
        const res = await fetch(`${API_CONFIG.baseBackend}${path}`, {
            ...options,
            method,
            headers,
            cache: method === 'GET' ? 'no-store' : options.cache
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            if (permitirFallbackLocal) {
                const fallback = await respuestaLocalApi(path, options);
                if (fallback !== null) return fallback;
            }
            const error = new Error(data.error || 'Error en la solicitud');
            error.status = res.status;
            error.data = data;
            throw error;
        }

        return data;
    } catch (error) {
        if (permitirFallbackLocal) {
            const fallback = await respuestaLocalApi(path, options);
            if (fallback !== null) return fallback;
        }
        throw error;
    }
}


async function respuestaLocalApi(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const LOCAL_PRODUCTS_KEY = 'alterego_productos_local_v1';
    const LOCAL_BANNERS_KEY = 'alterego_banners_local_v1';
    const LOCAL_HERO_KEY = 'alterego_hero_local_v1';
    const LOCAL_CATEGORIES_KEY = 'alterego_categorias_local_v1';
    const DEFAULT_BANNERS = [
        { id: 'banner-promocion', etiqueta: 'Promoción', titulo: 'Productos en promoción', subtitulo: 'Descubre las promociones activas seleccionadas desde el panel administrativo.', imagen: './archivos/american crew.jpg', enlace: './paginas/promocion.html', texto_boton: 'Ver promociones', activo: true, orden: 1 },
        { id: 'banner-destacados', etiqueta: 'Selección profesional', titulo: 'Productos destacados', subtitulo: 'Los productos recomendados y marcados como destacados en el panel.', imagen: './archivos/revlon imagen.jpg', enlace: './paginas/productos.html?destacados=1', texto_boton: 'Ver destacados', activo: true, orden: 2 },
        { id: 'banner-ofertas', etiqueta: 'Precio especial', titulo: 'Ofertas activas', subtitulo: 'Productos con precio de oferta configurados desde el panel administrativo.', imagen: './archivos/hyrdro.png', enlace: './paginas/ofertas.html', texto_boton: 'Ver ofertas', activo: true, orden: 3 }
    ];
    // El carrusel no agrega textos ni botones de respaldo.
    // Todo lo visible debe venir exactamente de lo guardado en el panel.
    const DEFAULT_HERO = [];
    const readLocalCollection = (key, defaults) => {
        const saved = sessionStorage.getItem(key);
        if (saved) {
            try { return JSON.parse(saved); } catch { sessionStorage.removeItem(key); }
        }
        sessionStorage.setItem(key, JSON.stringify(defaults));
        return [...defaults];
    };
    const writeLocalCollection = (key, rows) => {
        sessionStorage.setItem(key, JSON.stringify(rows));
        return rows;
    };
    const readLocalCategories = () => {
        const legacySeedIds = new Set(['cat-acondicionador','cat-shampoo','cat-tratamiento','cat-tinte','cat-peroxido']);
        const rows = readLocalCollection(LOCAL_CATEGORIES_KEY, []);
        const cleaned = rows.filter(item => item && !legacySeedIds.has(String(item.id || '')));
        if (cleaned.length !== rows.length) writeLocalCollection(LOCAL_CATEGORIES_KEY, cleaned);
        return cleaned;
    };
    const readLocalHero = () => {
        const rows = readLocalCollection(LOCAL_HERO_KEY, DEFAULT_HERO);
        return rows.map(item => {
            if (!item) return item;
            const legacy = String(item.id || '') === 'hero-1'
                && String(item.titulo || '').trim() === 'Belleza que se nota'
                && String(item.texto_boton || '').trim() === 'Ver productos';
            if (!legacy) return item;
            return { ...item, etiqueta:'', titulo:'', subtitulo:'', enlace:'', texto_boton:'' };
        }).filter(Boolean);
    };
    const localProducts = async () => {
        const guardados = sessionStorage.getItem(LOCAL_PRODUCTS_KEY);
        if (guardados) {
            try { return JSON.parse(guardados); } catch { sessionStorage.removeItem(LOCAL_PRODUCTS_KEY); }
        }
        const res = await fetch(API_CONFIG.baseLocal);
        const productos = res.ok ? await res.json() : [];
        sessionStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(productos));
        return productos;
    };
    const saveLocalProducts = (productos) => {
        sessionStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(productos));
        return productos;
    };
    if (path === '/admin/login' && method === 'POST') {
        const body = JSON.parse(options.body || '{}');
        const ok = body.email && body.password;
        if (!ok) return null;
        const usuario = { id: 1, nombre: 'Administrador', apellido: 'ALTER EGO', email: body.email, role: 'admin' };
        return { token: window.__aeLocalAuth.tokenLocal(usuario), usuario };
    }
    if (path === '/productos' || path.startsWith('/productos?')) return (await localProducts()).filter(p => p.visible !== false && p.activo !== false);
    if (path === '/ofertas') return (await localProducts()).filter(p => p.visible !== false && p.activo !== false && (p.en_oferta || (Number(p.precio_oferta || 0) > 0 && Number(p.precio_oferta || 0) < Number(p.precio || 0))));
    if (path === '/banners') return readLocalCollection(LOCAL_BANNERS_KEY, DEFAULT_BANNERS).sort((a,b)=>Number(a.orden||0)-Number(b.orden||0));
    if (path === '/hero-slides') return readLocalHero().sort((a,b)=>Number(a.orden||0)-Number(b.orden||0));
    if (path === '/categorias') return readLocalCategories().filter(c => c.activo !== false).sort((a,b)=>Number(a.orden||0)-Number(b.orden||0));
    if (path === '/perfil') return getUsuario() || {};
    if (path === '/admin/productos') return localProducts();
    if (path === '/promociones' || path === '/promocion') {
        const productos = await localProducts();
        let promos = productos.filter(p => p.visible !== false && p.activo !== false && (p.en_promocion || p.promocion || p.promocionado || p.promo));
        if (!promos.length) promos = productos.filter(p => p.visible !== false && p.activo !== false && (p.en_oferta || p.destacado)).slice(0, 8);
        return promos;
    }
    if (path.startsWith('/admin/productos/') && method === 'PUT') {
        const id = decodeURIComponent(path.split('/').pop());
        const body = JSON.parse(options.body || '{}');
        const productos = await localProducts();
        const index = productos.findIndex(p => String(p.id) === String(id));
        if (index < 0) return null;
        productos[index] = { ...productos[index], ...body, id: productos[index].id || id };
        saveLocalProducts(productos);
        return productos[index];
    }
    if (path === '/admin/productos' && method === 'POST') {
        const body = JSON.parse(options.body || '{}');
        const productos = await localProducts();
        const nuevo = { ...body, id: body.id || body.codigoBarras || body.codigo_barras || String(Date.now()) };
        productos.unshift(nuevo);
        saveLocalProducts(productos);
        return nuevo;
    }
    if (path.startsWith('/admin/productos/') && method === 'DELETE') {
        const id = decodeURIComponent(path.split('/').pop());
        const productos = (await localProducts()).filter(p => String(p.id) !== String(id));
        saveLocalProducts(productos);
        return { ok: true };
    }
    if (path === '/admin/resumen') {
        const productos = await localProducts();
        return { ventasHoy:1250, ventasMes:18450, pedidosPendientes:24, pedidosAtendidos:68, productos:productos.length, productosVisibles:productos.length, stockBajo:3, clientes:156 };
    }
    if (path === '/admin/dashboard') {
        const productos = await localProducts();
        return {
            ventasHoy:1250, ventasMes:18450, pedidosPendientes:24, pedidosAtendidos:68,
            ventasPorDia:[
                {fecha:'2026-07-01', ventas:620},{fecha:'2026-07-02', ventas:980},{fecha:'2026-07-03', ventas:740},
                {fecha:'2026-07-04', ventas:1280},{fecha:'2026-07-05', ventas:1140},{fecha:'2026-07-06', ventas:1680},{fecha:'2026-07-07', ventas:1250}
            ],
            productosVendidos: productos.slice(0,20).map((p,i)=>({nombre:p.nombre,cantidad:20-i,total:Number(p.precio||0)*(20-i)})),
            ultimosPedidos:[
                {numero:'AE-2024-00125', total:210, estado:'Hoy 10:30'},
                {numero:'AE-2024-00124', total:180, estado:'Hoy 09:15'},
                {numero:'AE-2024-00123', total:320, estado:'Ayer 18:45'},
                {numero:'AE-2024-00122', total:150, estado:'Ayer 17:00'}
            ]
        };
    }
    if (path === '/pedidos' && method === 'POST') {
        const pedido = JSON.parse(options.body || '{}');
        const key = 'alterego_pedidos';
        const pedidos = JSON.parse(sessionStorage.getItem(key) || '[]');
        const nuevo = { ...pedido, id: pedido.id || pedido.numero || `AE-${Date.now()}`, numero: pedido.numero || `AE-${Date.now()}`, estado: pedido.estado || 'Registrado', fecha: pedido.fecha || new Date().toISOString() };
        pedidos.unshift(nuevo);
        sessionStorage.setItem(key, JSON.stringify(pedidos));
        return nuevo;
    }
    if (path === '/mis-pedidos' || path === '/admin/pedidos') {
        return JSON.parse(sessionStorage.getItem('alterego_pedidos') || sessionStorage.getItem('pedidos_alterego') || '[]');
    }
    if (path.startsWith('/admin/pedidos/') && path.endsWith('/estado') && method === 'PUT') {
        const parts = path.split('/');
        const id = decodeURIComponent(parts[3] || '');
        const body = JSON.parse(options.body || '{}');
        const pedidos = JSON.parse(sessionStorage.getItem('alterego_pedidos') || '[]');
        const idx = pedidos.findIndex(p => String(p.id || p.numero) === String(id));
        if (idx >= 0) pedidos[idx] = { ...pedidos[idx], estado: body.estado || pedidos[idx].estado };
        sessionStorage.setItem('alterego_pedidos', JSON.stringify(pedidos));
        return idx >= 0 ? pedidos[idx] : { ok: true };
    }
    if (path.startsWith('/mis-pedidos/') && path.endsWith('/cancelar')) {
        const id = decodeURIComponent(path.split('/')[2] || '');
        const pedidos = JSON.parse(sessionStorage.getItem('alterego_pedidos') || '[]');
        const idx = pedidos.findIndex(p => String(p.id || p.numero) === String(id));
        if (idx >= 0) pedidos[idx] = { ...pedidos[idx], estado: 'Cancelado' };
        sessionStorage.setItem('alterego_pedidos', JSON.stringify(pedidos));
        return idx >= 0 ? pedidos[idx] : { ok: true };
    }

    if (path === '/admin/categorias' && method === 'GET') return readLocalCategories().sort((a,b)=>Number(a.orden||0)-Number(b.orden||0));
    if (path === '/admin/categorias' && method === 'POST') {
        const body = JSON.parse(options.body || '{}');
        const rows = readLocalCategories();
        const nuevo = { id: body.id || `cat-${Date.now()}`, activo: true, orden: rows.length + 1, ...body };
        rows.push(nuevo); writeLocalCollection(LOCAL_CATEGORIES_KEY, rows); return nuevo;
    }
    if (path.startsWith('/admin/categorias/') && method === 'PUT') {
        const id = decodeURIComponent(path.split('/').pop()); const body = JSON.parse(options.body || '{}');
        const rows = readLocalCategories(); const idx = rows.findIndex(c => String(c.id) === String(id));
        if (idx < 0) return null; rows[idx] = { ...rows[idx], ...body, id: rows[idx].id }; writeLocalCollection(LOCAL_CATEGORIES_KEY, rows); return rows[idx];
    }
    if (path.startsWith('/admin/categorias/') && method === 'DELETE') {
        const id = decodeURIComponent(path.split('/').pop()); const rows = readLocalCategories();
        const idx = rows.findIndex(c => String(c.id) === String(id)); if (idx < 0) return null;
        rows[idx] = { ...rows[idx], activo: false }; writeLocalCollection(LOCAL_CATEGORIES_KEY, rows); return rows[idx];
    }
    if (path === '/admin/banners' && method === 'GET') return readLocalCollection(LOCAL_BANNERS_KEY, DEFAULT_BANNERS).sort((a,b)=>Number(a.orden||0)-Number(b.orden||0));
    if (path === '/admin/banners' && method === 'POST') {
        const body = JSON.parse(options.body || '{}');
        const banners = readLocalCollection(LOCAL_BANNERS_KEY, DEFAULT_BANNERS);
        const nuevo = { id: body.id || `banner-${Date.now()}`, activo: true, orden: banners.length + 1, texto_boton: 'Ver banner', ...body };
        banners.push(nuevo);
        writeLocalCollection(LOCAL_BANNERS_KEY, banners);
        return nuevo;
    }
    if (path.startsWith('/admin/banners/') && method === 'PUT') {
        const id = decodeURIComponent(path.split('/').pop());
        const body = JSON.parse(options.body || '{}');
        const banners = readLocalCollection(LOCAL_BANNERS_KEY, DEFAULT_BANNERS);
        const idx = banners.findIndex(b => String(b.id) === String(id));
        if (idx < 0) return null;
        banners[idx] = { ...banners[idx], ...body, id: banners[idx].id };
        writeLocalCollection(LOCAL_BANNERS_KEY, banners);
        return banners[idx];
    }
    if (path.startsWith('/admin/banners/') && method === 'DELETE') {
        const id = decodeURIComponent(path.split('/').pop());
        const banners = readLocalCollection(LOCAL_BANNERS_KEY, DEFAULT_BANNERS).filter(b => String(b.id) !== String(id));
        writeLocalCollection(LOCAL_BANNERS_KEY, banners);
        return { ok: true };
    }
    if (path === '/admin/hero-slides' && method === 'GET') return readLocalHero().sort((a,b)=>Number(a.orden||0)-Number(b.orden||0));
    if (path === '/admin/hero-slides' && method === 'POST') {
        const body = JSON.parse(options.body || '{}');
        const slides = readLocalHero();
        const nuevo = { id: body.id || `hero-${Date.now()}`, activo: true, orden: slides.length + 1, texto_boton: '', ...body };
        slides.push(nuevo);
        writeLocalCollection(LOCAL_HERO_KEY, slides);
        return nuevo;
    }
    if (path.startsWith('/admin/hero-slides/') && method === 'PUT') {
        const id = decodeURIComponent(path.split('/').pop());
        const body = JSON.parse(options.body || '{}');
        const slides = readLocalHero();
        const idx = slides.findIndex(s => String(s.id) === String(id));
        if (idx < 0) return null;
        slides[idx] = { ...slides[idx], ...body, id: slides[idx].id };
        writeLocalCollection(LOCAL_HERO_KEY, slides);
        return slides[idx];
    }
    if (path.startsWith('/admin/hero-slides/') && method === 'DELETE') {
        const id = decodeURIComponent(path.split('/').pop());
        const slides = readLocalHero().filter(s => String(s.id) !== String(id));
        writeLocalCollection(LOCAL_HERO_KEY, slides);
        return { ok: true };
    }
    if (path.startsWith('/admin/configuracion')) return {store_email:'ventas@alterego.pe', whatsapp:'+51 940 246 084', frontend_url:location.origin, smtp_configurado:false};
    if (path.startsWith('/admin/clientes')) return [];
    if (path.startsWith('/admin/reportes')) return {ventasPorDia:[], ventasPorMes:[], productosVendidos:[], clientesFrecuentes:[]};
    if (path.startsWith('/admin/configuracion')) return {store_email:'ventas@alterego.pe', whatsapp:'+51 940 246 084', frontend_url:location.origin, smtp_configurado:false};
    return null;
}

async function obtenerProductos() {
    async function cargarLocal() {
        const res = await fetch(API_CONFIG.baseLocal);
        if (!res.ok) throw new Error('No se pudo cargar productos.json');
        const productos = await res.json();
        return productos.filter(p => p.visible !== false && p.activo !== false);
    }

    try {
        return await apiRequest('/productos');
    } catch (error) {
        if (!API_CONFIG.usarBackend || sessionStorage.getItem('ALTEREGO_DEMO_LOCAL') === '1') {
            console.warn('Modo demo local activo. Cargando productos.json.', error);
            return cargarLocal();
        }
        throw error;
    }
}

async function obtenerBanners() {
    if (!API_CONFIG.usarBackend) {
        return [];
    }

    try {
        return await apiRequest('/banners');
    } catch {
        return [];
    }
}

async function registrarPedidoBackend(pedido) {
    return apiRequest('/pedidos', {
        method: 'POST',
        body: JSON.stringify(pedido)
    });
}

async function obtenerMisPedidosBackend() {
    return apiRequest('/mis-pedidos');
}

async function loginBackend(email, password) {
    try {
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        guardarSesionAuth(data);
        return data;
    } catch (error) {
        const users = JSON.parse(sessionStorage.getItem('alterego_usuarios_local_v1') || '[]');
        const user = users.find(u => String(u.email).toLowerCase() === String(email).toLowerCase() && u.password === password);
        if (!user) throw error;
        const data = { token: window.__aeLocalAuth.tokenLocal(user), usuario: {...user, password: undefined} };
        guardarSesionAuth(data);
        return data;
    }
}

async function adminLoginBackend(email, password) {
    const data = await apiRequest('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
    guardarSesionAuth(data);
    return data;
}

async function registroBackend(usuario) {
    try {
        const data = await apiRequest('/auth/registro', {
            method: 'POST',
            body: JSON.stringify(usuario)
        });
        guardarSesionAuth(data);
        return data;
    } catch (error) {
        const key = 'alterego_usuarios_local_v1';
        const users = JSON.parse(sessionStorage.getItem(key) || '[]');
        if (users.some(u => String(u.email).toLowerCase() === String(usuario.email).toLowerCase())) {
            throw new Error('Ya existe una cuenta con ese correo.');
        }
        const nuevo = { id: Date.now(), role: 'cliente', ...usuario };
        users.push(nuevo);
        sessionStorage.setItem(key, JSON.stringify(users));
        const data = { token: window.__aeLocalAuth.tokenLocal(nuevo), usuario: {...nuevo, password: undefined} };
        guardarSesionAuth(data);
        return data;
    }
}


async function cancelarPedidoBackend(id) {
    return apiRequest(`/mis-pedidos/${encodeURIComponent(id)}/cancelar`, {
        method: 'PUT'
    });
}

async function obtenerPerfilBackend() {
    try { return await apiRequest('/perfil'); }
    catch { return getUsuario() || {}; }
}

async function actualizarPerfilBackend(perfil) {
    try {
        const data = await apiRequest('/perfil', {
            method: 'PUT',
            body: JSON.stringify(perfil)
        });
        if (data.usuario) sessionStorage.setItem('alterego_usuario', JSON.stringify(data.usuario));
        return data;
    } catch {
        const usuario = { ...(getUsuario() || {}), ...perfil };
        sessionStorage.setItem('alterego_usuario', JSON.stringify(usuario));
        return { usuario };
    }
}

async function obtenerHeroSlides() {
    try {
        return await apiRequest('/hero-slides');
    } catch {
        return [];
    }
}

async function consultarDocumento(tipo, numero) {
    return apiRequest(`/consulta-documento?tipo=${encodeURIComponent(tipo)}&numero=${encodeURIComponent(numero)}`);
}

async function obtenerOfertas() {
    try {
        return await apiRequest('/ofertas');
    } catch (error) {
        if (!API_CONFIG.usarBackend || sessionStorage.getItem('ALTEREGO_DEMO_LOCAL') === '1') {
            const productos = await obtenerProductos();
            return productos.filter(p => p.en_oferta || Number(p.precio_oferta || 0) > 0);
        }
        throw error;
    }
}

async function obtenerPromociones() {
    try {
        return await apiRequest('/promociones');
    } catch (error) {
        if (!API_CONFIG.usarBackend || sessionStorage.getItem('ALTEREGO_DEMO_LOCAL') === '1') {
            const productos = await obtenerProductos();
            const promos = productos.filter(p => p.visible !== false && p.activo !== false && (p.en_promocion || p.promocion || p.promocionado || p.promo));
            return promos.length ? promos : productos.filter(p => p.visible !== false && p.activo !== false && (p.en_oferta || p.destacado)).slice(0, 8);
        }
        throw error;
    }
}


/* Coincidencia de categorías basada en la relación guardada por el panel.
   No contiene nombres de categorías escritos manualmente. */
(function configurarCoincidenciaCategoriasAE(){
    const clave = (valor) => String(valor ?? '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    function coincide(categoriaPanel, producto, categoriaId = '') {
        if (!categoriaPanel || !producto) return false;
        if (categoriaId && String(producto.category_id || '') === String(categoriaId)) return true;
        const seleccion = clave(categoriaPanel);
        return Boolean(seleccion) && [producto.categoria, producto.category_slug, producto.category_name]
            .some(valor => clave(valor) === seleccion);
    }

    window.aeClaveCategoria = clave;
    window.aeCategoriaCoincideProducto = coincide;
})();

async function obtenerCategorias() {
    return apiRequest('/categorias');
}

async function obtenerMarcas() {
    return apiRequest('/marcas');
}


async function forgotPasswordBackend(email) {
    return apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
    });
}

async function resetPasswordBackend(email, token, password, customerId = '') {
    return apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, token, password, customerId })
    });
}


/* Fallback local para demo estática si el backend no está conectado */
(function activarFallbackLocalAlterEgo(){
  const USERS_KEY = 'alterego_usuarios_local_v1';
  function tokenLocal(usuario){
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify({role: usuario.role || 'cliente', email: usuario.email, exp: Math.floor(Date.now()/1000)+86400*30}))));
    return `local.${payload}.demo`;
  }
  window.__aeLocalAuth = {USERS_KEY, tokenLocal};
})();
