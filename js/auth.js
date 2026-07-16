document.addEventListener('DOMContentLoaded', () => {
    const login = document.getElementById('loginForm');
    const reg = document.getElementById('registerForm');
    const forgot = document.getElementById('forgotPasswordForm');
    const reset = document.getElementById('resetPasswordForm');

    if (login) {
        login.addEventListener('submit', iniciarSesion);
    }

    if (reg) {
        reg.addEventListener('submit', registrarUsuario);
    }

    if (forgot) {
        forgot.addEventListener('submit', solicitarRecuperacion);
    }

    if (reset) {
        reset.addEventListener('submit', restablecerPassword);
    }
});

async function registrarUsuario(e) {
    e.preventDefault();

    const msg = document.getElementById('authMsg');
    const boton = e.target.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(e.target).entries());

    if (data.password !== data.confirmPassword) {
        mostrarMsg(msg, 'Las contraseñas no coinciden.');
        return;
    }

    try {
        if (boton) {
            boton.disabled = true;
            boton.textContent = 'Creando cuenta...';
        }

        await registroBackend({
            nombre: data.nombre,
            apellido: data.apellido || '',
            email: data.email,
            telefono: data.telefono,
            tipo_documento: data.tipo_documento || '',
            documento: data.documento || '',
            password: data.password
        });

        mostrarMsg(msg, 'Cuenta creada correctamente.');

        setTimeout(() => {
            window.location.href = './checkout.html';
        }, 700);
    } catch (error) {
        mostrarMsg(msg, error.message || 'No se pudo crear la cuenta.');

        if (boton) {
            boton.disabled = false;
            boton.textContent = 'Crear Cuenta';
        }
    }
}

async function iniciarSesion(e) {
    e.preventDefault();

    const msg = document.getElementById('authMsg');
    const boton = e.target.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(e.target).entries());

    try {
        if (boton) {
            boton.disabled = true;
            boton.textContent = 'Ingresando...';
        }

        const respuesta = await loginBackend(data.email, data.password);

        mostrarMsg(msg, 'Sesión iniciada correctamente.');

        setTimeout(() => {
            const params = new URLSearchParams(window.location.search);
            const redirect = params.get('redirect') || sessionStorage.getItem('alterego_redirect') || 'cuenta';
            sessionStorage.removeItem('alterego_redirect');

            if (redirect === 'checkout') {
                window.location.href = './checkout.html';
            } else {
                window.location.href = './mi-cuenta.html';
            }
        }, 700);
    } catch (error) {
        mostrarMsg(msg, error.message || 'Correo o contraseña incorrectos.');

        if (boton) {
            boton.disabled = false;
            boton.textContent = 'Ingresar';
        }
    }
}

function mostrarMsg(el, text) {
    if (!el) {
        return;
    }

    el.style.display = 'block';
    el.textContent = text;
}


async function solicitarRecuperacion(e) {
    e.preventDefault();
    const msg = document.getElementById('authMsg');
    const boton = e.target.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
        if (boton) { boton.disabled = true; boton.textContent = 'Enviando...'; }
        const res = await forgotPasswordBackend(data.email);
        if (res.resetUrl) {
            mostrarMsg(msg, `${res.mensaje}

Enlace temporal para pruebas: ${res.resetUrl}`);
        } else {
            mostrarMsg(msg, res.mensaje || 'Revisa tu correo para continuar.');
        }
    } catch (error) {
        mostrarMsg(msg, error.message || 'No se pudo enviar el enlace.');
        if (boton) { boton.disabled = false; boton.textContent = 'Enviar enlace'; }
    }
}

async function restablecerPassword(e) {
    e.preventDefault();
    const msg = document.getElementById('authMsg');
    const boton = e.target.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(e.target).entries());
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email') || '';
    const token = params.get('token') || '';
    const customerId = params.get('id') || params.get('customerId') || '';
    if (data.password !== data.confirmPassword) {
        mostrarMsg(msg, 'Las contraseñas no coinciden.');
        return;
    }
    try {
        if (boton) { boton.disabled = true; boton.textContent = 'Guardando...'; }
        const res = await resetPasswordBackend(email, token, data.password, customerId);
        mostrarMsg(msg, res.mensaje || 'Contraseña actualizada.');
        setTimeout(() => { window.location.href = './login.html'; }, 1200);
    } catch (error) {
        mostrarMsg(msg, error.message || 'No se pudo actualizar la contraseña.');
        if (boton) { boton.disabled = false; boton.textContent = 'Guardar contraseña'; }
    }
}
