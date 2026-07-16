document.addEventListener('DOMContentLoaded', renderCarrito);

function renderCarrito() {
    const box = document.getElementById('cartItems');

    if (!box) {
        return;
    }

    const carrito = obtenerCarrito();

    const subtotal = document.getElementById('subtotal');
    const total = document.getElementById('total');

    if (!carrito.length) {
        box.innerHTML = `
            <div class="empty">
                Tu carrito está vacío.
                <br><br>
                <a class="btn btn--primary" href="./productos.html">
                    Ver productos
                </a>
            </div>
        `;

        if (subtotal) {
            subtotal.textContent = 'S/ 0.00';
        }

        if (total) {
            total.textContent = 'S/ 0.00';
        }

        return;
    }

    box.innerHTML = carrito
        .map(item => `
            <div class="cart-item">

                <img
                    src="${item.imagen}"
                    alt="${item.nombre}"
                >

                <div>
                    <h3>${item.nombre}</h3>
                    <p>${item.marca}</p>

                    <div class="qty">

                        <button onclick="cambiarCantidad('${item.id}', -1)">
                            -
                        </button>

                        <strong>
                            ${item.cantidad}
                        </strong>

                        <button onclick="cambiarCantidad('${item.id}', 1)">
                            +
                        </button>

                        <button class="btn-remove-cart" onclick="eliminarDelCarrito('${item.id}')" title="Eliminar producto" aria-label="Eliminar producto">
                            ×
                        </button>

                    </div>
                </div>

                <strong class="cart-item__price">
                    ${formatoSoles(item.precio * item.cantidad)}
                </strong>

            </div>
        `)
        .join('');

    const monto = calcularTotalCarrito();

    if (subtotal) {
        subtotal.textContent = formatoSoles(monto);
    }

    if (total) {
        total.textContent = formatoSoles(monto);
    }

    if (typeof actualizarContadorCarrito === 'function') {
        actualizarContadorCarrito();
    }
}