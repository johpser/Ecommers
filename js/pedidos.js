document.addEventListener('DOMContentLoaded', async () => {
    const ordersBox = document.getElementById('ordersBox');

    if (!ordersBox) return;

    if (!estaLogueado()) {
        ordersBox.innerHTML = `
            <div class="empty">
                Debes iniciar sesión para ver tus pedidos.
                <br><br>
                <a class="btn btn--primary" href="./login.html">Iniciar sesión</a>
            </div>
        `;
        return;
    }

    await cargarMisPedidos();
});

async function cargarMisPedidos() {
    const ordersBox = document.getElementById('ordersBox');
    ordersBox.innerHTML = '<p>Cargando pedidos...</p>';

    try {
        const pedidos = await obtenerMisPedidosBackend();

        if (!pedidos.length) {
            ordersBox.innerHTML = `
                <div class="empty">
                    No tienes pedidos registrados todavía.
                    <br><br>
                    <a class="btn btn--primary" href="./productos.html">Comprar productos</a>
                </div>
            `;
            return;
        }

        ordersBox.innerHTML = `
            <div class="orders-grid">
                ${pedidos.map(renderPedidoCard).join('')}
            </div>
        `;

        ordersBox.querySelectorAll('[data-cancelar-pedido]').forEach(btn => {
            btn.addEventListener('click', () => abrirModalCancelar(btn.dataset.cancelarPedido));
        });
    } catch (error) {
        console.error(error);

        ordersBox.innerHTML = `
            <div class="empty">
                No se pudieron cargar tus pedidos.
                <br>
                <small>${error.message}</small>
            </div>
        `;
    }
}

function renderPedidoCard(pedido) {
    const params = new URLSearchParams(window.location.search);
    const pedidoActual = params.get('pedido');
    const items = pedido.order_items || [];
    const cliente = pedido.cliente || {};
    const estado = pedido.estado || 'Registrado';
    const puedeCancelar = ['Registrado', 'Preparando'].includes(estado);
    const subtotalProductos = items.reduce((acc, item) => acc + Number(item.subtotal || (Number(item.precio || 0) * Number(item.cantidad || 0))), 0);
    const envio = Number(cliente.costo_envio || cliente.envio?.monto || Math.max(0, Number(pedido.total || 0) - subtotalProductos));
    const totalPedido = Number(pedido.total || (subtotalProductos + envio));

    return `
        <article class="order-card order-card--separada ${pedidoActual && String(pedido.id) === pedidoActual ? 'order-card--actual' : ''}">
            <div class="order-card__head">
                <div>
                    <span class="order-label">Pedido</span>
                    <h3>${escaparHTML(pedido.numero || pedido.id)}</h3>
                </div>
                <span class="order-status order-status--${normalizarClase(estado)}">${escaparHTML(estado)}</span>
            </div>

            <div class="order-card__meta">
                <p><strong>Fecha:</strong> ${pedido.created_at ? new Date(pedido.created_at).toLocaleString('es-PE') : '-'}</p>
                <p><strong>Cliente:</strong> ${escaparHTML(cliente.nombre || 'Cliente')}</p>
                <p><strong>Teléfono:</strong> ${escaparHTML(cliente.telefono || '-')}</p>
                <p><strong>Distrito:</strong> ${escaparHTML(cliente.distrito || cliente.envio?.distrito || '-')}</p>
                <p><strong>Pago:</strong> ${escaparHTML(pedido.metodo_pago || cliente.metodoPago || '-')}</p>
            </div>

            <div class="order-items order-items--card">
                ${items.length ? items.map(item => `
                    <div class="summary-row">
                        <span><small>SKU: ${escaparHTML(item.product_id || item.producto_id || '')}</small><br>${Number(item.cantidad || 0)} x ${escaparHTML(item.nombre || item.producto_id || 'Producto')}</span>
                        <strong>S/ ${Number(item.subtotal || 0).toFixed(2)}</strong>
                    </div>
                `).join('') : '<p>No hay detalle de productos.</p>'}
            </div>

            <div class="order-card__totals">
                <span>Subtotal productos: <strong>S/ ${subtotalProductos.toFixed(2)}</strong></span>
                <span>Envío: <strong>S/ ${envio.toFixed(2)}</strong></span>
            </div>

            <div class="order-card__footer">
                <strong class="order-total">Total: S/ ${totalPedido.toFixed(2)}</strong>

                ${puedeCancelar ? `
                    <button class="btn btn--danger btn--sm" type="button" data-cancelar-pedido="${escaparAttr(pedido.id)}">
                        Cancelar pedido
                    </button>
                ` : ''}
            </div>
        </article>
    `;
}

function abrirModalCancelar(id) {
    mostrarConfirmacion({
        titulo: 'Cancelar pedido',
        mensaje: '¿Seguro que deseas cancelar este pedido? El stock de los productos será devuelto automáticamente.',
        textoConfirmar: 'Sí, cancelar',
        onConfirm: async () => {
            await cancelarPedidoBackend(id);
            mostrarNotificacion('Pedido cancelado y stock devuelto correctamente.');
            await cargarMisPedidos();
        }
    });
}

function mostrarConfirmacion({ titulo, mensaje, textoConfirmar, onConfirm }) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop active';
    modal.innerHTML = `
        <div class="modal-card">
            <h3>${escaparHTML(titulo)}</h3>
            <p>${escaparHTML(mensaje)}</p>
            <div class="modal-actions">
                <button class="btn btn--secondary" type="button" data-modal-cerrar>Volver</button>
                <button class="btn btn--danger" type="button" data-modal-confirmar>${escaparHTML(textoConfirmar)}</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('[data-modal-cerrar]').addEventListener('click', () => modal.remove());
    modal.querySelector('[data-modal-confirmar]').addEventListener('click', async () => {
        const btn = modal.querySelector('[data-modal-confirmar]');
        try {
            btn.disabled = true;
            btn.textContent = 'Procesando...';
            await onConfirm();
            modal.remove();
        } catch (error) {
            console.error(error);
            mostrarNotificacion(error.message || 'No se pudo completar la acción.', 'error');
            btn.disabled = false;
            btn.textContent = textoConfirmar;
        }
    });
}

function mostrarNotificacion(mensaje, tipo = 'ok') {
    let toast = document.getElementById('appToast');

    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'appToast';
        toast.className = 'app-toast';
        document.body.appendChild(toast);
    }

    toast.textContent = mensaje;
    toast.className = `app-toast show ${tipo === 'error' ? 'app-toast--error' : ''}`;

    setTimeout(() => {
        toast.className = 'app-toast';
    }, 3000);
}

function normalizarClase(texto) {
    return String(texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-');
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
