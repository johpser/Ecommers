const CART_KEY = 'alterego_carrito_v2';

function obtenerCarrito() {
    return JSON.parse(sessionStorage.getItem(CART_KEY)) || [];
}

function guardarCarrito(carrito) {
    sessionStorage.setItem(CART_KEY, JSON.stringify(carrito));
    actualizarContadorCarrito();
}

function agregarAlCarrito(producto, cantidadSolicitada = 1) {
    const stock = Number(producto.stock || 0);
    const cantidad = Math.max(1, Math.floor(Number(cantidadSolicitada || 1)));

    if (stock <= 0) {
        mostrarToastCarrito('Producto no disponible');
        return false;
    }

    const carrito = obtenerCarrito();
    const existe = carrito.find(item => String(item.id) === String(producto.id));
    const cantidadActual = Number(existe?.cantidad || 0);

    if (cantidadActual + cantidad > stock) {
        mostrarToastCarrito(`Solo hay ${stock} unidad${stock === 1 ? '' : 'es'} disponible${stock === 1 ? '' : 's'}`);
        return false;
    }

    if (existe) {
        existe.cantidad += cantidad;
        existe.stock = stock;
    } else {
        carrito.push({
            id: producto.id,
            nombre: producto.nombre,
            marca: producto.marca,
            precio: Number(producto.en_oferta && Number(producto.precio_oferta || 0) > 0 ? producto.precio_oferta : producto.precio),
            precio_normal: Number(producto.precio || 0),
            en_oferta: Boolean(producto.en_oferta),
            imagen: producto.imagen,
            stock,
            cantidad
        });
    }

    guardarCarrito(carrito);
    mostrarToastCarrito(`${cantidad} producto${cantidad === 1 ? '' : 's'} añadido${cantidad === 1 ? '' : 's'} al carrito`);
    return true;
}

function mostrarToastCarrito(texto) {
    let toast = document.getElementById('cartToast');

    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'cartToast';
        toast.className = 'cart-toast';
        document.body.appendChild(toast);
    }

    toast.textContent = texto;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 1700);
}

function eliminarDelCarrito(id) {
    const carritoActualizado = obtenerCarrito().filter(item => item.id !== id);
    guardarCarrito(carritoActualizado);

    if (typeof renderCarrito === 'function') {
        renderCarrito();
    }
}

function cambiarCantidad(id, cambio) {
    const carrito = obtenerCarrito();
    const item = carrito.find(p => p.id === id);

    if (!item) {
        return;
    }

    item.cantidad += cambio;

    if (item.cantidad <= 0) {
        eliminarDelCarrito(id);
        return;
    }

    guardarCarrito(carrito);

    if (typeof renderCarrito === 'function') {
        renderCarrito();
    }
}

function vaciarCarrito() {
    sessionStorage.removeItem(CART_KEY);
    actualizarContadorCarrito();

    if (typeof renderCarrito === 'function') {
        renderCarrito();
    }
}

function calcularTotalCarrito() {
    return obtenerCarrito().reduce((sum, item) => {
        return sum + item.precio * item.cantidad;
    }, 0);
}

function actualizarContadorCarrito() {
    const contador = document.getElementById('cartCount');

    if (!contador) {
        return;
    }

    const total = obtenerCarrito().reduce((sum, item) => {
        return sum + item.cantidad;
    }, 0);

    contador.textContent = total;
}

function formatoSoles(numero) {
    return `S/ ${Number(numero).toFixed(2)}`;
}
