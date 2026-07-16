document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('promotionGrid');
  const input = document.getElementById('promotionSearch');
  if (!grid) return;

  const normalizar = (value) => typeof normalizarTexto === 'function'
    ? normalizarTexto(value || '')
    : String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const esPromocion = (p) => p && (
    p.en_promocion === true || p.en_promocion === 'true' || p.en_promocion === 1 ||
    p.promocion === true || p.promocion === 'true' || p.promocionado === true || p.promo === true
  );

  const pintarVacio = (mensaje) => {
    grid.innerHTML = `<div class="empty shop-empty">${mensaje}</div>`;
    if (typeof actualizarShopCounter === 'function') actualizarShopCounter(0);
  };

  try {
    const productosBase = typeof obtenerPromociones === 'function'
      ? await obtenerPromociones()
      : await apiRequest('/promociones');

    const productos = (Array.isArray(productosBase) ? productosBase : [])
      .filter(p => p.visible !== false && p.activo !== false && esPromocion(p));

    const pintar = () => {
      const q = normalizar(input?.value || '');
      const lista = q
        ? productos.filter(p => normalizar(`${p.nombre || ''} ${p.marca || ''} ${p.categoria || ''} ${p.descripcion || ''} ${p.codigoBarras || p.codigo_barras || ''}`).includes(q))
        : productos;
      if (!lista.length) return pintarVacio(q ? 'No encontramos promociones con esa búsqueda.' : 'No hay productos en promoción por ahora.');
      if (typeof renderProductos === 'function') renderProductos(lista, grid);
      else grid.innerHTML = lista.map(p => `<article class="product-card"><h3>${p.nombre || 'Producto'}</h3></article>`).join('');
    };

    input?.addEventListener('input', pintar);
    pintar();
  } catch (error) {
    console.error('Promociones: error cargando desde Supabase/backend', error);
    pintarVacio('No se pudieron cargar las promociones. Revisa que el backend esté encendido y que Supabase tenga la columna en_promocion.');
  }
});
