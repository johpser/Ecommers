document.addEventListener('DOMContentLoaded', async () => {
    const cuentaBox = document.getElementById('cuentaBox');

    if (!cuentaBox) return;

    if (!estaLogueado()) {
        window.location.href = './login.html';
        return;
    }

    try {
        const perfil = await obtenerPerfilBackend();
        renderCuenta(perfil);
    } catch (error) {
        console.error(error);
        cuentaBox.innerHTML = `
            <div class="empty">
                No se pudo cargar tu perfil.
                <br><small>${error.message}</small>
            </div>
        `;
    }
});

function renderCuenta(perfil) {
    const cuentaBox = document.getElementById('cuentaBox');

    cuentaBox.innerHTML = `
        <div class="account-layout">
            <aside class="account-card">
                <div class="account-avatar">👤</div>
                <h2>${escaparHTML([perfil.nombre, perfil.apellido].filter(Boolean).join(' ') || 'Cliente')}</h2>
                <p>${escaparHTML(perfil.email || '')}</p>

                <a class="btn btn--primary" href="./pedidos.html">Ver mis pedidos</a>
                <button class="btn btn--secondary" type="button" id="logoutCliente">Cerrar sesión</button>
            </aside>

            <section class="panel">
                <h2>Configuración de cuenta</h2>
                <p>Actualiza tus datos personales y dirección para tus próximos pedidos.</p>

                <form class="account-form" id="perfilForm">
                    <label>
                        Nombre
                        <input name="nombre" required value="${escaparAttr(perfil.nombre || '')}">
                    </label>

                    <label>
                        Apellido
                        <input name="apellido" required value="${escaparAttr(perfil.apellido || '')}">
                    </label>

                    <label>
                        Correo
                        <input value="${escaparAttr(perfil.email || '')}" disabled>
                    </label>

                    <label>
                        Teléfono
                        <input name="telefono" value="${escaparAttr(perfil.telefono || '')}">
                    </label>

                    <label>
                        Documento
                        <input name="documento" value="${escaparAttr(perfil.documento || '')}">
                    </label>

                    <label class="account-form__full">
                        Dirección
                        <textarea name="direccion" placeholder="Av./Calle, distrito, referencia">${escaparHTML(perfil.direccion || '')}</textarea>
                    </label>

                    <button class="btn btn--primary" type="submit">Guardar cambios</button>
                </form>

                <div class="auth-msg" id="cuentaMsg"></div>
            </section>
        </div>
    `;

    document.getElementById('logoutCliente')?.addEventListener('click', () => {
        cerrarSesion();
        window.location.href = './login.html';
    });

    document.getElementById('perfilForm')?.addEventListener('submit', guardarPerfil);
}

async function guardarPerfil(e) {
    e.preventDefault();

    const msg = document.getElementById('cuentaMsg');
    const boton = e.target.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(e.target).entries());

    try {
        boton.disabled = true;
        boton.textContent = 'Guardando...';

        const respuesta = await actualizarPerfilBackend(data);

        msg.style.display = 'block';
        msg.textContent = respuesta.warning || 'Datos actualizados correctamente.';
    } catch (error) {
        console.error(error);
        msg.style.display = 'block';
        msg.textContent = error.message || 'No se pudieron actualizar tus datos.';
    } finally {
        boton.disabled = false;
        boton.textContent = 'Guardar cambios';
    }
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
