let procesandoPedido = false;

const DISTRITOS_ENVIO = [
    { nombre: 'SURCO B (D.V.E)', zona: 'Zona especial', monto: 6 },
    { nombre: 'SURCO (A.V.E)', zona: 'Zona A', monto: 9 },
    { nombre: 'SAN BORJA', zona: 'Zona A', monto: 9 },
    { nombre: 'SAN LUIS', zona: 'Zona A', monto: 9 },
    { nombre: 'LA VICTORIA', zona: 'Zona A', monto: 9 },
    { nombre: 'SURQUILLO', zona: 'Zona A', monto: 9 },
    { nombre: 'MIRAFLORES', zona: 'Zona A', monto: 9 },
    { nombre: 'BARRANCO', zona: 'Zona A', monto: 9 },
    { nombre: 'LINCE', zona: 'Zona A', monto: 9 },
    { nombre: 'JESUS MARIA', zona: 'Zona A', monto: 9 },
    { nombre: 'ATE', zona: 'Zona B', monto: 12 },
    { nombre: 'LA MOLINA', zona: 'Zona B', monto: 12 },
    { nombre: 'SANTA ANITA', zona: 'Zona B', monto: 12 },
    { nombre: 'S.J.M.', zona: 'Zona B', monto: 12 },
    { nombre: 'CHORRILLOS', zona: 'Zona B', monto: 12 },
    { nombre: 'CERCA DE LIMA', zona: 'Zona B', monto: 12 },
    { nombre: 'MAGDALENA', zona: 'Zona B', monto: 12 },
    { nombre: 'PUEBLO LIBRE', zona: 'Zona B', monto: 12 },
    { nombre: 'SAN MIGUEL', zona: 'Zona B', monto: 12 },
    { nombre: 'BREÑA', zona: 'Zona B', monto: 12 },
    { nombre: 'EL AGUSTINO', zona: 'Zona roja', monto: 12 },
    { nombre: 'V.M.T.', zona: 'Zona C', monto: 15 },
    { nombre: 'V.E.S.', zona: 'Zona C', monto: 15 },
    { nombre: 'LA PERLA', zona: 'Zona C', monto: 15 },
    { nombre: 'BELLAVISTA', zona: 'Zona C', monto: 15 },
    { nombre: 'CARMEN LA LEGUA', zona: 'Zona C', monto: 15 },
    { nombre: 'S.J.L.', zona: 'Zona C', monto: 15 },
    { nombre: 'RIMAC', zona: 'Zona C', monto: 15 },
    { nombre: 'INDEPENDENCIA', zona: 'Zona C', monto: 15 },
    { nombre: 'LOS OLIVOS', zona: 'Zona C', monto: 15 },
    { nombre: 'S.M.P.', zona: 'Zona C', monto: 15 },
    { nombre: 'CALLAO', zona: 'Zona C', monto: 15 },
    { nombre: 'LA PUNTA', zona: 'Zona C', monto: 15 },
    { nombre: 'VENTANILLA', zona: 'Zona D', monto: 18 },
    { nombre: 'MI PERU', zona: 'Zona D', monto: 18 },
    { nombre: 'PUENTE PIEDRA', zona: 'Zona D', monto: 18 },
    { nombre: 'CARABAYLLO', zona: 'Zona D', monto: 18 },
    { nombre: 'COMAS', zona: 'Zona D', monto: 18 },
    { nombre: 'L. CHOSICA', zona: 'Zona D', monto: 18 },
    { nombre: 'CHACLACAYO', zona: 'Zona D', monto: 18 },
    { nombre: 'CIENEGUILLA', zona: 'Zona D', monto: 18 },
    { nombre: 'PACHACAMAC', zona: 'Zona D', monto: 18 },
    { nombre: 'LURIN', zona: 'Zona D', monto: 18 },
    { nombre: 'PUNTA HERMOSA', zona: 'Zona E', monto: 21 },
    { nombre: 'PUNTA NEGRA', zona: 'Zona E', monto: 21 },
    { nombre: 'SANTA ROSA', zona: 'Zona E', monto: 21 },
    { nombre: 'SAN BARTOLO', zona: 'Zona E', monto: 21 },
    { nombre: 'ANCON', zona: 'Zona E', monto: 24 },
    { nombre: 'STA MARIA DEL MAR', zona: 'Zona E', monto: 24 },
    { nombre: 'PUCUSANA', zona: 'Zona E', monto: 24 }
];

function obtenerTarifaDistrito(nombre) {
    const distrito = DISTRITOS_ENVIO.find(d => d.nombre === nombre);
    return distrito ? distrito.monto : 0;
}


document.addEventListener('DOMContentLoaded', () => {
    protegerCheckout();
    renderCheckout();
    autocompletarCliente();
    prepararComprobante();
    prepararDistritoEnvio();

    const form = document.getElementById('checkoutForm');

    if (form) {
        form.addEventListener('submit', registrarPedido);
    }
});

function protegerCheckout() {
    if (!estaLogueado()) {
        sessionStorage.setItem('alterego_redirect', 'checkout');
        if (typeof mostrarAppToast === 'function') {
            mostrarAppToast('Debes iniciar sesión o registrarte antes de finalizar tu compra.', 'error');
        }
        setTimeout(() => {
            window.location.href = './login.html?redirect=checkout';
        }, 350);
    }
}

async function autocompletarCliente() {
    const usuarioLocal = typeof getUsuario === 'function' ? getUsuario() : null;
    const form = document.getElementById('checkoutForm');
    if (!form) return;

    let usuario = usuarioLocal || {};

    // Trae el perfil real desde Supabase para que el checkout tenga apellido,
    // documento y dirección actualizados, no solo lo que quedó guardado en sesión.
    if (typeof obtenerPerfilBackend === 'function' && typeof estaLogueado === 'function' && estaLogueado()) {
        try {
            usuario = await obtenerPerfilBackend();
            sessionStorage.setItem('alterego_usuario', JSON.stringify(usuario));
        } catch (error) {
            console.warn('No se pudo cargar perfil completo para checkout:', error.message);
        }
    }

    if (!usuario) return;

    if (form.nombre) form.nombre.value = usuario.nombre || '';
    if (form.apellido) form.apellido.value = usuario.apellido || '';
    if (form.email) form.email.value = usuario.email || usuario.correo || '';
    if (form.telefono) form.telefono.value = usuario.telefono || '';
    if (form.direccion) form.direccion.value = usuario.direccion || '';
}



function prepararDistritoEnvio() {
    const select = document.getElementById('checkoutDistrito');
    if (!select) return;

    const vistos = new Set();
    const distritosUnicos = DISTRITOS_ENVIO.filter(d => {
        if (vistos.has(d.nombre)) return false;
        vistos.add(d.nombre);
        return true;
    });

    select.innerHTML = '<option value="">Distrito de entrega</option>' + distritosUnicos
        .map(d => `<option value="${d.nombre}">${d.nombre}</option>`)
        .join('');

    select.addEventListener('change', renderCheckout);
}

function prepararComprobante() {
    const tipo = document.getElementById('tipoComprobante');
    const wrap = document.getElementById('comprobanteDocumentoWrap');
    const numero = document.getElementById('comprobanteNumero');
    const nombre = document.getElementById('comprobanteNombre');
    if (!tipo || !wrap || !numero) return;

    const actualizar = () => {
        const valor = tipo.value;
        numero.required = false;
        nombre.required = false;

        if (valor === 'factura') {
            wrap.style.display = '';
            numero.placeholder = 'Ingrese su RUC';
            numero.maxLength = 11;
            numero.inputMode = 'numeric';
            numero.required = true;
            nombre.style.display = '';
            nombre.placeholder = 'Razón social';
            nombre.required = true;
        } else if (valor === 'boleta_dni') {
            wrap.style.display = '';
            numero.placeholder = 'Ingrese su DNI';
            numero.maxLength = 8;
            numero.inputMode = 'numeric';
            numero.required = true;
            nombre.style.display = 'none';
            nombre.value = '';
        } else {
            wrap.style.display = 'none';
            nombre.style.display = 'none';
            numero.value = '';
            nombre.value = '';
        }
    };

    tipo.addEventListener('change', actualizar);
    actualizar();
}

function renderCheckout() {
    const items = document.getElementById('checkoutItems');
    const subtotalEl = document.getElementById('checkoutSubtotal');
    const envioEl = document.getElementById('checkoutEnvio');
    const totalEl = document.getElementById('checkoutTotal');
    const distritoSelect = document.getElementById('checkoutDistrito');

    const carrito = obtenerCarrito();
    const subtotal = calcularTotalCarrito();
    const envio = obtenerTarifaDistrito(distritoSelect?.value || '');
    const total = subtotal + envio;

    if (!items) return;

    if (!carrito.length) {
        items.innerHTML = `
            <div class="empty">
                No hay productos en el carrito.
                <br><br>
                <a class="btn btn--primary" href="./productos.html">Ver productos</a>
            </div>
        `;
        if (subtotalEl) subtotalEl.textContent = 'S/ 0.00';
        if (envioEl) envioEl.textContent = 'Selecciona distrito';
        if (totalEl) totalEl.textContent = 'S/ 0.00';
        return;
    }

    items.innerHTML = carrito
        .map(item => `
            <div class="summary-row">
                <span>${item.cantidad} x ${item.nombre}</span>
                <strong>${formatoSoles(item.precio * item.cantidad)}</strong>
            </div>
        `)
        .join('');

    if (subtotalEl) subtotalEl.textContent = formatoSoles(subtotal);
    if (envioEl) envioEl.textContent = envio > 0 ? formatoSoles(envio) : 'Selecciona distrito';
    if (totalEl) totalEl.textContent = formatoSoles(total);
}

async function registrarPedido(e) {
    e.preventDefault();

    if (procesandoPedido) return;

    if (!estaLogueado()) {
        sessionStorage.setItem('alterego_redirect', 'checkout');
        if (typeof mostrarAppToast === 'function') {
            mostrarAppToast('Debes iniciar sesión o registrarte antes de finalizar tu compra.', 'error');
        }
        setTimeout(() => {
            window.location.href = './login.html?redirect=checkout';
        }, 350);
        return;
    }

    const carrito = obtenerCarrito();
    const msg = document.getElementById('checkoutMsg');
    const boton = e.target.querySelector('button[type="submit"]');

    if (!carrito.length) {
        if (msg) {
            msg.style.display = 'block';
            msg.textContent = 'Tu carrito está vacío.';
        } else if (typeof mostrarAppToast === 'function') {
            mostrarAppToast('Tu carrito está vacío.', 'error');
        }
        return;
    }

    const data = Object.fromEntries(new FormData(e.target).entries());
    const montoEnvio = obtenerTarifaDistrito(data.distrito);

    if (!data.distrito || montoEnvio <= 0) {
        if (msg) {
            msg.style.display = 'block';
            msg.textContent = 'Selecciona un distrito válido para calcular el envío.';
        } else if (typeof mostrarAppToast === 'function') {
            mostrarAppToast('Selecciona un distrito válido para calcular el envío.', 'error');
        }
        return;
    }

    const pedido = {
        cliente: {
            nombre: data.nombre,
            apellido: data.apellido,
            email: data.email,
            correo: data.email,
            telefono: data.telefono,
            direccion: data.direccion,
            distrito: data.distrito,
            costo_envio: montoEnvio,
            envio: { distrito: data.distrito, monto: montoEnvio },
            nota: data.nota,
            metodoPago: data.metodoPago,
            tipo_documento: data.tipoComprobante === 'boleta_dni' ? 'DNI' : (data.tipoComprobante === 'factura' ? 'RUC' : ''),
            documento: data.comprobanteNumero || '',
            comprobante: {
                tipo: data.tipoComprobante,
                numero: data.comprobanteNumero || '',
                nombre: data.comprobanteNombre || ''
            }
        },
        productos: carrito,
        subtotal: calcularTotalCarrito(),
        envio: montoEnvio,
        total: calcularTotalCarrito() + montoEnvio,
        metodoPago: data.metodoPago
    };

    try {
        procesandoPedido = true;

        if (boton) {
            boton.disabled = true;
            boton.textContent = 'Registrando pedido...';
        }

        const respuestaBackend = await registrarPedidoBackend(pedido);

        sessionStorage.removeItem(CART_KEY);

        if (typeof actualizarContadorCarrito === 'function') {
            actualizarContadorCarrito();
        }

        if (msg) {
            msg.style.display = 'block';
            msg.textContent = 'Pedido registrado correctamente. Te redirigiremos a Mis pedidos.';
        }

        const pedidoId = respuestaBackend?.pedido?.id || '';
        setTimeout(() => {
            window.location.href = pedidoId ? `./pedidos.html?pedido=${encodeURIComponent(pedidoId)}` : './pedidos.html';
        }, 900);
    } catch (error) {
        console.error(error);

        if (msg) {
            msg.style.display = 'block';
            msg.textContent = error.message || 'No se pudo registrar el pedido.';
        } else if (typeof mostrarAppToast === 'function') {
            mostrarAppToast(error.message || 'No se pudo registrar el pedido.', 'error');
        }

        procesandoPedido = false;

        if (boton) {
            boton.disabled = false;
            boton.textContent = 'Confirmar pedido';
        }
    }
}
