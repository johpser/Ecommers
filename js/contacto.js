document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contactForm');
  const msg = document.getElementById('contactMsg');
  if (!form || !msg) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(form).entries());
    msg.textContent = '';
    msg.className = 'contact-form-msg';
    button.disabled = true;
    button.textContent = 'Enviando...';
    try {
      const response = await apiRequest('/contacto', { method: 'POST', body: JSON.stringify(data) });
      msg.textContent = response.mensaje || 'Mensaje enviado correctamente.';
      msg.className = 'contact-form-msg ok';
      form.reset();
    } catch (error) {
      msg.textContent = error.message || 'No se pudo enviar el mensaje.';
      msg.className = 'contact-form-msg error';
    } finally {
      button.disabled = false;
      button.textContent = 'Enviar mensaje';
    }
  });
});
