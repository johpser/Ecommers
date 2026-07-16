document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('offersGrid');
  const input = document.getElementById('offersSearch');
  if (!grid) return;
  try {
    const productos = typeof obtenerOfertas === 'function' ? await obtenerOfertas() : (await obtenerProductos()).filter(p => p.en_oferta);
    const pintar = () => {
      const q = normalizarTexto(input?.value || '');
      const lista = q
        ? productos.filter(p => normalizarTexto(`${p.nombre || ''} ${p.marca || ''} ${p.descripcion || ''}`).includes(q))
        : productos;
      renderProductos(lista, grid);
    };
    input?.addEventListener('input', pintar);
    pintar();
  } catch (error) {
    console.error(error);
    grid.innerHTML = '<div class="empty">No se pudieron cargar las ofertas.</div>';
  }
});
