import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || '*';
const JWT_SECRET = process.env.JWT_SECRET || 'cambia-esta-clave';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@alterego.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '124578';
const WHATSAPP_TIENDA = process.env.WHATSAPP_TIENDA || '51940246084';
const STORE_EMAIL_RAW = process.env.STORE_EMAIL || '';
const STORE_EMAIL = (!STORE_EMAIL_RAW || STORE_EMAIL_RAW.includes('tu-correo') || STORE_EMAIL_RAW.includes('alterego.com'))
  ? (process.env.ADMIN_EMAIL || 'johpser@gmail.com')
  : STORE_EMAIL_RAW;

const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Faltan variables de Supabase en backend/.env');
  console.error('Revisa que existan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

app.use(helmet());
const allowedOrigins = FRONTEND_URL === '*'
  ? true
  : FRONTEND_URL.split(',').map(url => url.trim()).filter(Boolean);

const corsOptions = {
  origin: allowedOrigins === true
    ? true
    : (origin, callback) => {
        // Permite herramientas locales como Live Server aunque cambie entre 5500/5501.
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        if (/^http:\/\/(localhost|127\.0\.0\.1):(5500|5501|5502|3000)$/.test(origin)) return callback(null, true);
        return callback(new Error(`Origen no permitido por CORS: ${origin}`));
      },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json({ limit: '5mb' }));
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const permitido = /^image\//.test(file.mimetype) || ['video/mp4','video/webm','video/ogg'].includes(file.mimetype);
    cb(permitido ? null : new Error('Solo se permiten imágenes o videos MP4, WebM y OGG'), permitido);
  }
});

function crearToken(payload) { return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }); }
function verificarToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Token inválido' }); }
}
function soloAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Solo administrador' });
  next();
}
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizarDistrito(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[().]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const TARIFAS_ENVIO = new Map([
  ['SURCO B D V E', 6],
  ['SURCO A V E', 9],
  ['SAN BORJA', 9],
  ['SAN LUIS', 9],
  ['LA VICTORIA', 9],
  ['SURQUILLO', 9],
  ['MIRAFLORES', 9],
  ['BARRANCO', 9],
  ['LINCE', 9],
  ['JESUS MARIA', 9],
  ['ATE', 12],
  ['LA MOLINA', 12],
  ['SANTA ANITA', 12],
  ['S J M', 12],
  ['SAN JUAN DE MIRAFLORES', 12],
  ['CHORRILLOS', 12],
  ['CERCA DE LIMA', 12],
  ['MAGDALENA', 12],
  ['PUEBLO LIBRE', 12],
  ['SAN MIGUEL', 12],
  ['BRENA', 12],
  ['EL AGUSTINO', 12],
  ['V M T', 15],
  ['VILLA MARIA DEL TRIUNFO', 15],
  ['V E S', 15],
  ['VILLA EL SALVADOR', 15],
  ['LA PERLA', 15],
  ['BELLAVISTA', 15],
  ['CARMEN LA LEGUA', 15],
  ['S J L', 15],
  ['SAN JUAN DE LURIGANCHO', 15],
  ['RIMAC', 15],
  ['INDEPENDENCIA', 15],
  ['LOS OLIVOS', 15],
  ['S M P', 15],
  ['SAN MARTIN DE PORRES', 15],
  ['CALLAO', 15],
  ['LA PUNTA', 15],
  ['VENTANILLA', 18],
  ['MI PERU', 18],
  ['PUENTE PIEDRA', 18],
  ['CARABAYLLO', 18],
  ['COMAS', 18],
  ['L CHOSICA', 18],
  ['LURIGANCHO CHOSICA', 18],
  ['CHACLACAYO', 18],
  ['CIENEGUILLA', 18],
  ['PACHACAMAC', 18],
  ['LURIN', 18],
  ['PUNTA HERMOSA', 21],
  ['PUNTA NEGRA', 21],
  ['SANTA ROSA', 21],
  ['SAN BARTOLO', 21],
  ['ANCON', 24],
  ['STA MARIA DEL MAR', 24],
  ['SANTA MARIA DEL MAR', 24],
  ['PUCUSANA', 24]
]);

function obtenerMontoEnvio(distrito) {
  const key = normalizarDistrito(distrito);
  return TARIFAS_ENVIO.get(key) ?? 0;
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function crearResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function tokenValido(token, hashGuardado) {
  if (!token || !hashGuardado) return false;
  const hash = String(hashGuardado);
  // Compatibilidad con enlaces generados por versiones anteriores que usaban bcrypt.
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    return bcrypt.compare(String(token), hash);
  }
  const recibido = hashResetToken(token);
  try {
    return crypto.timingSafeEqual(Buffer.from(recibido), Buffer.from(hash));
  } catch {
    return recibido === hash;
  }
}


function slugify(value) {
  return String(value || 'promocion')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'promocion';
}

function publicBaseUrl(req) {
  const configured = String(process.env.PUBLIC_FRONTEND_URL || '').trim();
  if (configured) return configured.replace(/\/$/, '');
  const first = String(FRONTEND_URL || '').split(',')[0].trim();
  if (first && first !== '*') return first.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

async function crearPaginaPromocionHTML(banner = {}) {
  const slug = `${slugify(banner.titulo)}-${String(banner.id || Date.now()).slice(0, 8)}`;
  const filename = `promocion-${slug}.html`;
  const paginasDir = join(__dirname, '..', 'paginas');
  const filePath = join(paginasDir, filename);
  const titulo = escapeHtml(banner.titulo || 'Promoción ALTER EGO');
  const subtitulo = escapeHtml(banner.subtitulo || 'Conoce esta promoción especial.');
  const imagen = escapeHtml(banner.imagen || '../archivos/Logo Negativo.png');
  const boton = escapeHtml(banner.texto_boton || 'Ver productos');
  const destino = escapeHtml(banner.destino || './promocion.html');
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo} | ALTER EGO</title>
  <link rel="icon" type="image/png" href="../archivos/Logo Negativo.png">
  <link rel="stylesheet" href="../css/estilos.css">
</head>
<body>
  <header class="menu">
    <a class="logo" href="../index.html"><img src="../archivos/Logo Alter Ego Principal - Blanco.png" alt="ALTER EGO"></a>
    <nav class="nav active"><a href="../index.html">Inicio</a><a href="./productos.html">Productos</a><a href="./ofertas.html">Ofertas</a></nav>
  </header>
  <main class="promo-page">
    <section class="container promo-detail-card reveal-card is-visible">
      <div class="promo-detail-card__text">
        <span class="tag">Promoción activa</span>
        <h1>${titulo}</h1>
        <p>${subtitulo}</p>
        <a class="btn btn--primary" href="${destino}">${boton}</a>
      </div>
      <div class="promo-detail-card__media"><img src="${imagen}" alt="${titulo}"></div>
    </section>
  </main>
  <script src="../js/api.js"></script>
  <script src="../js/carrito.js"></script>
  <script src="../js/app.js"></script>
</body>
</html>`;
  await fs.mkdir(paginasDir, { recursive: true });
  await fs.writeFile(filePath, html, 'utf8');
  return `./paginas/${filename}`;
}

async function enviarCorreoRecuperacion(email, resetUrl) {
  const smtpPass = String(process.env.SMTP_PASS || '').trim();
  const smtpUser = String(process.env.SMTP_USER || '').trim();
  const smtpHost = String(process.env.SMTP_HOST || '').trim();

  if (!smtpHost || !smtpUser || !smtpPass || smtpPass.includes('PEGA_AQUI')) {
    console.warn('Correo recuperación no enviado: configura SMTP_HOST, SMTP_USER y SMTP_PASS con una clave real de aplicación. Enlace:', resetUrl);
    return { enviado: false, resetUrl };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user: smtpUser, pass: smtpPass.replace(/\s+/g, '') }
  });

  const info = await transporter.sendMail({
    from: `ALTER EGO <${smtpUser}>`,
    to: email,
    subject: 'Recupera tu contraseña ALTER EGO',
    text: `Ingresa a este enlace para crear una nueva contraseña: ${resetUrl}`,
    html: `<p>Solicitaste recuperar tu contraseña.</p><p><a href="${escapeHtml(resetUrl)}">Crear nueva contraseña</a></p><p>Este enlace vence en 1 hora.</p>`
  });

  return { enviado: true, messageId: info.messageId || '' };
}


function etiquetaComprobante(tipo) {
  const valor = String(tipo || '').toLowerCase();
  if (valor === 'factura') return 'Factura';
  if (valor === 'boleta_dni') return 'Boleta con DNI';
  return 'Boleta normal';
}

function etiquetaDocumento(tipo) {
  const valor = String(tipo || '').toUpperCase();
  if (valor === 'RUC') return 'RUC';
  if (valor === 'DNI') return 'DNI';
  if (valor === 'CE') return 'CE';
  if (valor === 'PASAPORTE') return 'Pasaporte';
  return 'Documento';
}

function formatearPedidoHTML(pedido = {}) {
  const cliente = pedido.cliente || {};
  const comprobante = cliente.comprobante || {};
  const tipoComprobante = comprobante.tipo || cliente.tipo_comprobante || cliente.tipoComprobante || 'boleta_simple';
  const numeroComprobante = comprobante.numero || cliente.comprobanteNumero || cliente.documento || '';
  const tipoDocumentoCliente = cliente.tipo_documento || cliente.tipoDocumento || (tipoComprobante === 'factura' ? 'RUC' : (tipoComprobante === 'boleta_dni' ? 'DNI' : ''));
  const documentoCliente = cliente.documento || (tipoComprobante === 'boleta_dni' || tipoComprobante === 'factura' ? numeroComprobante : '');
  const items = pedido.order_items || pedido.items || [];
  const subtotalProductos = items.reduce((acc, item) => acc + Number(item.subtotal || (Number(item.precio || item.precio_unitario || 0) * Number(item.cantidad || 0))), 0);
  const envioPedido = Number(pedido.envio || cliente.costo_envio || cliente.envio?.monto || Math.max(0, Number(pedido.total || 0) - subtotalProductos));
  const filas = items.length
    ? items.map(item => {
        const nombre = item.nombre || item.producto_nombre || item.producto_id || item.product_id || 'Producto';
        const cantidad = Number(item.cantidad || 0);
        const precio = Number(item.precio || item.precio_unitario || 0);
        const subtotal = Number(item.subtotal || (precio * cantidad));
        return `<tr><td>${escapeHtml(item.product_id || item.producto_id || item.codigo_barras || '')}</td><td>${escapeHtml(nombre)}</td><td>${cantidad}</td><td>S/ ${precio.toFixed(2)}</td><td>S/ ${subtotal.toFixed(2)}</td></tr>`;
      }).join('')
    : '<tr><td colspan="5">Sin detalle de productos</td></tr>';

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Pedido ${escapeHtml(pedido.numero || pedido.id || '')}</title>
<style>
  body{font-family:Arial,sans-serif;color:#222;margin:30px;}
  .box{border:1px solid #ddd;border-radius:12px;padding:18px;margin-bottom:16px;}
  h1{color:#0b5f42;margin:0 0 10px;}
  table{width:100%;border-collapse:collapse;margin-top:10px;}
  th,td{border:1px solid #ddd;padding:10px;text-align:left;}
  th{background:#0b5f42;color:white;}
  .total{text-align:right;font-size:20px;font-weight:bold;}
  .muted{color:#666;font-size:13px;}
</style>
</head>
<body>
  <h1>ALTER EGO - Pedido ${escapeHtml(pedido.numero || pedido.id || '')}</h1>
  <p class="muted">Generado: ${new Date().toLocaleString('es-PE')}</p>
  <div class="box">
    <h2>Datos del cliente</h2>
    <p><strong>Nombre:</strong> ${escapeHtml(cliente.nombre || '')}</p>
    <p><strong>Apellido:</strong> ${escapeHtml(cliente.apellido || '')}</p>
    <p><strong>Correo:</strong> ${escapeHtml(cliente.email || cliente.correo || '')}</p>
    <p><strong>Teléfono:</strong> ${escapeHtml(cliente.telefono || '')}</p>
    <p><strong>Dirección:</strong> ${escapeHtml(cliente.direccion || '')}</p>
    <p><strong>Distrito:</strong> ${escapeHtml(cliente.distrito || cliente.envio?.distrito || '')}</p>
    <p><strong>Envío:</strong> S/ ${envioPedido.toFixed(2)}</p>
    <p><strong>Método de pago:</strong> ${escapeHtml(pedido.metodo_pago || pedido.metodoPago || cliente.metodoPago || '')}</p>
    <p><strong>Comprobante solicitado:</strong> ${escapeHtml(etiquetaComprobante(tipoComprobante))}</p>
    ${numeroComprobante ? `<p><strong>${escapeHtml(tipoComprobante === 'factura' ? 'RUC' : 'DNI')} comprobante:</strong> ${escapeHtml(numeroComprobante)}</p>` : ''}
    ${comprobante.nombre ? `<p><strong>Razón social:</strong> ${escapeHtml(comprobante.nombre)}</p>` : ''}
    ${comprobante.direccion ? `<p><strong>Dirección fiscal:</strong> ${escapeHtml(comprobante.direccion)}</p>` : ''}
  </div>
  <div class="box">
    <h2>Detalle del pedido</h2>
    <p><strong>Número:</strong> ${escapeHtml(pedido.numero || pedido.id || '')}</p>
    <p><strong>Estado:</strong> ${escapeHtml(pedido.estado || '')}</p>
    <p><strong>Fecha:</strong> ${pedido.created_at ? new Date(pedido.created_at).toLocaleString('es-PE') : ''}</p>
    <table>
      <thead><tr><th>SKU / ID</th><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <p class="total">Subtotal productos: S/ ${subtotalProductos.toFixed(2)}</p>
    <p class="total">Envío: S/ ${envioPedido.toFixed(2)}</p>
    <p class="total">Total: S/ ${Number(pedido.total || 0).toFixed(2)}</p>
  </div>
</body>
</html>`;
}

async function obtenerPedidoCompleto(id) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function enviarCorreoPedido(pedido, cliente) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !STORE_EMAIL) {
    console.log('Correo no enviado: faltan SMTP_HOST, SMTP_USER, SMTP_PASS o STORE_EMAIL/ADMIN_EMAIL');
    return;
  }

  const pedidoCompleto = pedido?.id ? (await obtenerPedidoCompleto(pedido.id)) || pedido : pedido;
  const pedidoConCliente = { ...pedidoCompleto, cliente: pedidoCompleto?.cliente || cliente };
  const html = formatearPedidoHTML(pedidoConCliente);
  const textoItems = (pedidoConCliente.order_items || []).map(item => {
    const nombre = item.nombre || item.producto_nombre || item.producto_id || item.product_id || 'Producto';
    return `- ${item.cantidad} x ${nombre} | S/ ${Number(item.subtotal || 0).toFixed(2)}`;
  }).join('\n');

  const smtpHost = String(process.env.SMTP_HOST || '').trim();
  const smtpUser = String(process.env.SMTP_USER || '').trim();
  const smtpPass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const smtpPort = Number(process.env.SMTP_PORT || 587);

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });

  const info = await transporter.sendMail({
    from: `ALTER EGO <${smtpUser}>`,
    to: STORE_EMAIL,
    replyTo: cliente.email || cliente.correo || undefined,
    subject: `Nuevo pedido ALTER EGO ${pedido.numero || pedido.id || ''}`,
    text: `Nuevo pedido ALTER EGO\nPedido: ${pedido.numero || pedido.id}\nCliente: ${cliente.nombre || ''}\nCorreo: ${cliente.email || cliente.correo || ''}\nTeléfono: ${cliente.telefono || ''}\nDocumento: ${cliente.documento || cliente.comprobante?.numero || ''}\nDirección: ${cliente.direccion || ''}\nComprobante: ${etiquetaComprobante(cliente.comprobante?.tipo)} ${cliente.comprobante?.numero || ''}\n\nProductos:\n${textoItems}\n\nTotal: S/ ${Number(pedido.total || 0).toFixed(2)}`,
    html
  });
  console.log('Correo de pedido enviado a', STORE_EMAIL, info.messageId || '');
}


app.get('/', (req, res) => res.json({ ok: true, mensaje: 'Backend ALTER EGO funcionando' }));

app.get('/api/productos', async (req, res) => {
  const { data, error } = await supabase.from('products')
    .select('id,nombre,marca,marca_imagen,categoria,category_id,precio,precio_oferta,en_oferta,en_promocion,stock,destacado,descripcion,imagen,codigo_barras,activo,visible')
    .eq('visible', true)
    .eq('activo', true).order('nombre', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(p => ({ id:p.id,nombre:p.nombre,marca:p.marca,marca_imagen:p.marca_imagen || '',categoria:p.categoria,category_id:p.category_id || null,precio:Number(p.precio),precio_oferta:p.precio_oferta === null || p.precio_oferta === undefined ? null : Number(p.precio_oferta),en_oferta:Boolean(p.en_oferta),en_promocion:Boolean(p.en_promocion),stock:Number(p.stock),destacado:p.destacado,descripcion:p.descripcion,imagen:p.imagen,codigoBarras:p.codigo_barras,activo:p.activo,visible:p.visible !== false }))); 
});


app.get('/api/ofertas', async (req, res) => {
  const { data, error } = await supabase.from('products')
    .select('id,nombre,marca,marca_imagen,categoria,category_id,precio,precio_oferta,en_oferta,en_promocion,stock,destacado,descripcion,imagen,codigo_barras,activo,visible')
    .eq('visible', true)
    .eq('activo', true)
    .eq('en_oferta', true)
    .order('nombre', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(p => ({
    id:p.id,
    nombre:p.nombre,
    marca:p.marca,
    marca_imagen:p.marca_imagen || '',
    categoria:p.categoria,
    category_id:p.category_id || null,
    precio:Number(p.precio),
    precio_oferta:p.precio_oferta === null || p.precio_oferta === undefined ? null : Number(p.precio_oferta),
    en_oferta:Boolean(p.en_oferta),
    stock:Number(p.stock),
    destacado:p.destacado,
    descripcion:p.descripcion,
    imagen:p.imagen,
    codigoBarras:p.codigo_barras,
    activo:p.activo,
    visible:p.visible !== false
  })));
});

app.get('/api/categorias', async (req, res) => {
  const [categoriesResult, productsResult] = await Promise.all([
    supabase.from('categories').select('*').eq('activo', true).order('orden', { ascending: true }).order('nombre', { ascending: true }),
    supabase.from('products').select('category_id,categoria').eq('activo', true).eq('visible', true)
  ]);

  if (categoriesResult.error) {
    return res.status(500).json({ error: categoriesResult.error.message });
  }

  const normalizar = (valor) => String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const productos = productsResult.error ? [] : (productsResult.data || []);
  const categorias = (categoriesResult.data || []).map((categoria) => {
    const id = String(categoria.id || '');
    const claves = new Set([normalizar(categoria.nombre), normalizar(categoria.slug)].filter(Boolean));
    const product_count = productos.filter((producto) => {
      if (id && String(producto.category_id || '') === id) return true;
      const categoriaProducto = normalizar(producto.categoria);
      return claves.has(categoriaProducto);
    }).length;
    return { ...categoria, product_count };
  });

  res.json(categorias.filter(c => Number(c.product_count || 0) > 0));
});


app.get('/api/marcas', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  const [brandsResult, productsResult] = await Promise.all([
    supabase.from('brands').select('*').eq('activo', true).order('orden', { ascending:true }).order('nombre', { ascending:true }),
    supabase.from('products').select('marca,marca_imagen').eq('activo', true).eq('visible', true)
  ]);
  if (brandsResult.error) return res.status(500).json({ error: brandsResult.error.message });
  const normalizar = (v) => String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const productos = productsResult.error ? [] : (productsResult.data || []);
  const marcas = (brandsResult.data || []).map(m => {
    const count = productos.filter(p => normalizar(p.marca) === normalizar(m.nombre) || normalizar(p.marca) === normalizar(m.slug)).length;
    const sample = productos.find(p => normalizar(p.marca) === normalizar(m.nombre) || normalizar(p.marca) === normalizar(m.slug));
    return { ...m, imagen: m.imagen || sample?.marca_imagen || '', product_count: count };
  }).filter(m => Number(m.product_count || 0) > 0);
  res.json(marcas);
});

app.get('/api/banners', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const { data, error } = await supabase.from('banners').select('*').eq('activo', true).order('orden', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});


app.get('/api/banners/:id', async (req, res) => {
  const { data, error } = await supabase.from('banners').select('*').eq('id', req.params.id).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Banner no encontrado' });
  res.json(data);
});


app.get('/api/hero-slides', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const { data, error } = await supabase.from('hero_slides').select('*').eq('activo', true).order('orden', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get('/api/consulta-documento', async (req, res) => {
  const tipo = String(req.query.tipo || '').toUpperCase();
  const numero = String(req.query.numero || '').replace(/\D/g, '');
  if (!['RUC','DNI'].includes(tipo)) return res.status(400).json({ error: 'Tipo de documento inválido' });
  if ((tipo === 'RUC' && numero.length !== 11) || (tipo === 'DNI' && numero.length !== 8)) {
    return res.status(400).json({ error: tipo === 'RUC' ? 'El RUC debe tener 11 dígitos.' : 'El DNI debe tener 8 dígitos.' });
  }
  const token = process.env.APIS_NET_PE_TOKEN || process.env.SUNAT_API_TOKEN || process.env.RENIEC_API_TOKEN || '';
  if (!token) return res.status(400).json({ error: 'Falta configurar APIS_NET_PE_TOKEN en el archivo .env para consultar RUC/DNI.' });
  const url = tipo === 'RUC'
    ? `https://api.apis.net.pe/v2/sunat/ruc?numero=${numero}`
    : `https://api.apis.net.pe/v2/reniec/dni?numero=${numero}`;
  try {
    const apiRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await apiRes.json().catch(() => ({}));
    if (!apiRes.ok) return res.status(apiRes.status).json({ error: data.message || data.error || 'No se pudo consultar el documento.' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'No se pudo conectar con el servicio de consulta.' });
  }
});


app.post('/api/auth/registro', async (req, res) => {
  const nombre = String(req.body.nombre || '').trim();
  const apellido = String(req.body.apellido || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const telefono = String(req.body.telefono || '').trim();
  const tipo_documento = String(req.body.tipo_documento || req.body.tipoDocumento || '').trim().toUpperCase();
  const documento = String(req.body.documento || '').trim();
  const password = String(req.body.password || '');

  if (!nombre || !apellido || !email || !telefono || !password) {
    return res.status(400).json({ error: 'Completa nombre, apellido, correo, teléfono y contraseña.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener mínimo 6 caracteres.' });
  }

  const filtros = [`email.eq.${email}`];
  if (documento) filtros.push(`documento.eq.${documento}`);
  if (telefono) filtros.push(`telefono.eq.${telefono}`);

  const { data: existentes, error: existeError } = await supabase
    .from('customers')
    .select('id,email,documento,telefono')
    .or(filtros.join(','));

  if (existeError) return res.status(400).json({ error: existeError.message });

  const duplicados = [];
  for (const c of (existentes || [])) {
    if (String(c.email || '').toLowerCase() === email) duplicados.push('correo');
    if (documento && String(c.documento || '') === documento) duplicados.push('documento');
    if (telefono && String(c.telefono || '') === telefono) duplicados.push('teléfono');
  }

  if (duplicados.length) {
    const unicos = [...new Set(duplicados)];
    return res.status(409).json({
      error: `Usuario ya registrado: el ${unicos.join(' y el ')} ya se encuentra registrado. Inicia sesión o usa otros datos.`
    });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const nuevoCliente = { nombre, apellido, email, telefono, tipo_documento, documento, password_hash };

  const { data, error } = await supabase
    .from('customers')
    .insert(nuevoCliente)
    .select('*')
    .single();

  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('apellido')) {
      return res.status(400).json({ error: 'Falta la columna apellido en Supabase. Ejecuta supabase-fix.sql.' });
    }
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return res.status(409).json({ error: 'Usuario ya registrado: el correo, documento o teléfono ya se encuentra registrado.' });
    }
    return res.status(400).json({ error: error.message || 'No se pudo registrar el usuario.' });
  }

  const usuario = {
    id: data.id,
    nombre: data.nombre || '',
    apellido: data.apellido || '',
    email: data.email || '',
    telefono: data.telefono || '',
    tipo_documento: data.tipo_documento || '',
    documento: data.documento || '',
    direccion: data.direccion || '',
    role: 'cliente'
  };

  res.json({ ok: true, usuario, token: crearToken({ id: data.id, role: 'cliente', email: data.email }) });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (email === ADMIN_EMAIL) {
    return res.status(401).json({ error: 'El acceso administrador se realiza solo desde admin-login.html' });
  }
  const { data, error } = await supabase.from('customers').select('*').eq('email', String(email).toLowerCase()).single();
  if (error || !data) return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  const ok = await bcrypt.compare(password, data.password_hash);
  if (!ok) return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  res.json({ ok: true, usuario: { id:data.id,nombre:data.nombre,apellido:data.apellido || '',email:data.email,telefono:data.telefono,tipo_documento:data.tipo_documento || '',documento:data.documento,direccion:data.direccion,role:'cliente' }, token: crearToken({ id: data.id, role: 'cliente', email: data.email }) });
});


app.post('/api/auth/forgot-password', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Escribe tu correo.' });

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id,email,nombre')
    .eq('email', email)
    .maybeSingle();

  if (customerError) {
    console.error('Error buscando correo de recuperación:', customerError.message);
    return res.status(400).json({ error: 'No se pudo validar el correo. Revisa la tabla customers en Supabase.' });
  }

  // Respuesta neutra para no revelar si un correo existe o no.
  if (!customer) {
    return res.json({ ok: true, mensaje: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.' });
  }

  const rawToken = crearResetToken();
  const reset_token_hash = hashResetToken(rawToken);
  const reset_expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('customers')
    .update({ reset_token_hash, reset_expires, updated_at: new Date().toISOString() })
    .eq('id', customer.id);

  if (error) {
    console.error('Error guardando token de recuperación:', error.message);
    return res.status(400).json({ error: `No se pudo crear el enlace: ${error.message}. Ejecuta supabase-fix.sql completo.` });
  }

  const resetUrl = `${publicBaseUrl(req)}/paginas/restablecer.html?id=${encodeURIComponent(customer.id)}&email=${encodeURIComponent(email)}&token=${encodeURIComponent(rawToken)}`;
  let correo = { enviado: false };
  try {
    correo = await enviarCorreoRecuperacion(email, resetUrl);
  } catch (e) {
    console.error('No se pudo enviar correo de recuperación:', e.message);
    return res.status(400).json({ error: `El enlace se creó, pero Gmail rechazó el envío: ${e.message}` });
  }

  if (!correo?.enviado) {
    return res.json({
      ok: true,
      mensaje: 'El enlace fue generado, pero el correo no se envió porque falta configurar SMTP_PASS con una clave real de aplicación de Gmail.',
      resetUrl
    });
  }

  res.json({ ok: true, mensaje: 'Te enviamos un enlace a tu correo para restablecer tu contraseña.' });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const customerId = String(req.body.customerId || req.body.id || '').trim();
  const token = String(req.body.token || '').trim();
  const password = String(req.body.password || '');

  if ((!email && !customerId) || !token || !password) {
    return res.status(400).json({ error: 'Faltan datos para restablecer la contraseña. Abre el enlace completo que llegó al correo.' });
  }

  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener mínimo 6 caracteres.' });

  let query = supabase.from('customers').select('id,email,reset_token_hash,reset_expires');
  query = customerId ? query.eq('id', customerId) : query.eq('email', email);
  const { data: customer, error: findError } = await query.maybeSingle();

  if (findError) return res.status(400).json({ error: findError.message });
  if (!customer || !customer.reset_token_hash || !customer.reset_expires) {
    return res.status(400).json({ error: 'El enlace no es válido o ya fue usado. Solicita uno nuevo.' });
  }

  if (new Date(customer.reset_expires).getTime() < Date.now()) {
    return res.status(400).json({ error: 'El enlace venció. Solicita uno nuevo.' });
  }

  const ok = await tokenValido(token, customer.reset_token_hash);
  if (!ok) return res.status(400).json({ error: 'El enlace no es válido. Solicita uno nuevo.' });

  const password_hash = await bcrypt.hash(password, 10);
  const { error } = await supabase
    .from('customers')
    .update({ password_hash, reset_token_hash: null, reset_expires: null, updated_at: new Date().toISOString() })
    .eq('id', customer.id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true, mensaje: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
});

app.get('/api/mis-pedidos', verificarToken, async (req, res) => {
  if (req.user.role !== 'cliente') return res.status(403).json({ error: 'Solo clientes' });
  const { data, error } = await supabase.from('orders').select('*, order_items(*)').eq('customer_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/perfil', verificarToken, async (req, res) => {
  if (req.user.role !== 'cliente') return res.status(403).json({ error: 'Solo clientes' });

  // Usamos select('*') para que el perfil no se rompa aunque falte una columna nueva.
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', req.user.id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Cliente no encontrado' });

  res.json({
    id: data.id,
    nombre: data.nombre || '',
    apellido: data.apellido || '',
    email: data.email || '',
    telefono: data.telefono || '',
    tipo_documento: data.tipo_documento || '',
    documento: data.documento || '',
    direccion: data.direccion || ''
  });
});

app.put('/api/perfil', verificarToken, async (req, res) => {
  if (req.user.role !== 'cliente') return res.status(403).json({ error: 'Solo clientes' });

  const { nombre, apellido, telefono, tipo_documento, documento, direccion } = req.body;

  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

  const cambios = {
    nombre,
    apellido: apellido || '',
    telefono: telefono || '',
    tipo_documento: tipo_documento || '',
    documento: documento || '',
    direccion: direccion || ''
  };

  let { data, error } = await supabase
    .from('customers')
    .update(changesToDb(cambios))
    .eq('id', req.user.id)
    .select('*')
    .maybeSingle();

  // Si todavía no agregaste la columna direccion en Supabase, no dejamos la página en blanco.
  // Te seguirá dejando modificar nombre/teléfono/documento y mostrará un mensaje claro.
  if (error && String(error.message || '').includes('direccion')) {
    const cambiosSinDireccion = { nombre, apellido: apellido || '', telefono: telefono || '', tipo_documento: tipo_documento || '', documento: documento || '' };
    const retry = await supabase
      .from('customers')
      .update(cambiosSinDireccion)
      .eq('id', req.user.id)
      .select('*')
      .maybeSingle();

    data = retry.data;
    error = retry.error;

    if (!error && data) {
      return res.json({
        ok: true,
        warning: 'Falta agregar la columna direccion en Supabase. Ejecuta el archivo supabase-fix.sql.',
        usuario: {
          id: data.id,
          nombre: data.nombre || '',
          apellido: data.apellido || '',
          email: data.email || '',
          telefono: data.telefono || '',
          tipo_documento: data.tipo_documento || '',
          documento: data.documento || '',
          direccion: '',
          role: 'cliente'
        }
      });
    }
  }

  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Cliente no encontrado' });

  res.json({
    ok: true,
    usuario: {
      id: data.id,
      nombre: data.nombre || '',
      apellido: data.apellido || '',
      email: data.email || '',
      telefono: data.telefono || '',
      tipo_documento: data.tipo_documento || '',
      documento: data.documento || '',
      direccion: data.direccion || '',
      role: 'cliente'
    }
  });
});

function changesToDb(obj) {
  return obj;
}

app.put('/api/mis-pedidos/:id/cancelar', verificarToken, async (req, res) => {
  if (req.user.role !== 'cliente') return res.status(403).json({ error: 'Solo clientes' });

  const { data: pedido, error: pedidoError } = await supabase
    .from('orders')
    .select('id, customer_id, estado, order_items(*)')
    .eq('id', req.params.id)
    .eq('customer_id', req.user.id)
    .maybeSingle();

  if (pedidoError) return res.status(500).json({ error: pedidoError.message });
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

  if (pedido.estado === 'Cancelado') {
    return res.json({ ok: true, mensaje: 'El pedido ya estaba cancelado', pedido });
  }

  if (pedido.estado === 'Entregado' || pedido.estado === 'Enviado') {
    return res.status(400).json({ error: 'No puedes cancelar un pedido enviado o entregado' });
  }

  for (const item of (pedido.order_items || [])) {
    const productId = item.producto_id || item.product_id;
    const cantidad = Number(item.cantidad || 0);

    if (!productId || cantidad <= 0) continue;

    const { data: producto, error: prodError } = await supabase
      .from('products')
      .select('stock')
      .eq('id', productId)
      .maybeSingle();

    if (prodError) return res.status(500).json({ error: prodError.message });

    if (producto) {
      const { error: stockError } = await supabase
        .from('products')
        .update({
          stock: Number(producto.stock || 0) + cantidad,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId);

      if (stockError) return res.status(500).json({ error: stockError.message });
    }
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ estado: 'Cancelado' })
    .eq('id', req.params.id)
    .eq('customer_id', req.user.id)
    .select('*, order_items(*)')
    .maybeSingle();

  if (error) return res.status(400).json({ error: error.message });

  res.json({ ok: true, pedido: data });
});

app.post('/api/pedidos', verificarToken, async (req, res) => {
  if (req.user.role !== 'cliente') return res.status(403).json({ error: 'Solo clientes pueden registrar pedidos' });

  const { cliente, productos, metodoPago } = req.body;
  if (!cliente || !Array.isArray(productos) || productos.length === 0) return res.status(400).json({ error: 'Datos del pedido incompletos' });

  const customerId = req.user.id;

  // Completa los datos desde customers para que en el pedido descargado siempre salgan
  // apellido, teléfono, documento y dirección aunque el navegador tenga una sesión antigua.
  const { data: customerData, error: customerError } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .maybeSingle();

  if (customerError) return res.status(400).json({ error: customerError.message });

  const distritoSeleccionado = cliente.distrito || '';
  const montoEnvio = obtenerMontoEnvio(distritoSeleccionado);

  if (!distritoSeleccionado || montoEnvio <= 0) {
    return res.status(400).json({ error: 'Selecciona un distrito válido para calcular el envío.' });
  }

  const clienteCompleto = {
    nombre: cliente.nombre || customerData?.nombre || '',
    apellido: cliente.apellido || customerData?.apellido || '',
    email: cliente.email || cliente.correo || customerData?.email || '',
    correo: cliente.correo || cliente.email || customerData?.email || '',
    telefono: cliente.telefono || customerData?.telefono || '',
    direccion: cliente.direccion || customerData?.direccion || '',
    distrito: distritoSeleccionado,
    envio: { distrito: distritoSeleccionado, monto: montoEnvio },
    costo_envio: montoEnvio,
    nota: cliente.nota || '',
    metodoPago: cliente.metodoPago || metodoPago || 'pendiente',
    tipo_documento: cliente.tipo_documento || customerData?.tipo_documento || '',
    documento: cliente.documento || customerData?.documento || '',
    comprobante: cliente.comprobante || { tipo: 'boleta_simple', numero: '', nombre: '', direccion: '' }
  };

  const items = productos.map(item => ({ producto_id: String(item.id), cantidad: Number(item.cantidad) }));
  const { data, error } = await supabase.rpc('crear_pedido', {
    p_cliente: clienteCompleto,
    p_items: items,
    p_customer_id: customerId,
    p_metodo_pago: metodoPago || clienteCompleto.metodoPago || 'pendiente',
    p_envio: montoEnvio
  });
  if (error) return res.status(400).json({ error: error.message });

  const pedidoRpc = Array.isArray(data) ? data[0] : data;
  const pedidoId = pedidoRpc?.id;
  const subtotalProductos = Number(pedidoRpc?.subtotal || 0);
  const totalConEnvio = Number(pedidoRpc?.total || (subtotalProductos + montoEnvio));

  let pedido = { ...(pedidoRpc || {}), subtotal: subtotalProductos, envio: montoEnvio, total: totalConEnvio, cliente: clienteCompleto };

  if (pedidoId) {
    const { data: pedidoCompleto, error: fetchError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', pedidoId)
      .maybeSingle();

    if (fetchError) return res.status(400).json({ error: fetchError.message });
    pedido = { ...(pedidoCompleto || pedido), subtotal: subtotalProductos, envio: montoEnvio, total: totalConEnvio, cliente: (pedidoCompleto?.cliente || clienteCompleto) };
  }

  // Respondemos primero para que el checkout no quede cargando si Gmail demora o falla.
  res.json({ ok: true, pedido });

  // El correo se procesa en segundo plano y no bloquea la creación del pedido.
  void enviarCorreoPedido(pedido, clienteCompleto).catch((error) => {
    console.error('Correo de pedido no enviado:', {
      message: error?.message || String(error),
      code: error?.code || '',
      command: error?.command || '',
      response: error?.response || ''
    });
  });
});


app.post('/api/admin/login', async (req, res) => {
  const email = String(req.body.email || '').trim();
  const password = String(req.body.password || '');

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    return res.json({
      ok: true,
      usuario: { nombre: 'Administrador', email, role: 'admin' },
      token: crearToken({ role: 'admin', email })
    });
  }

  return res.status(401).json({ error: 'Credenciales de administrador incorrectas' });
});

// ADMIN


app.get('/api/admin/resumen', verificarToken, soloAdmin, async (req, res) => {
  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();

  const [p, pAct, o, b, sinStock, clientes, pedidosHoy, pedidosMes, pendientes, atendidos, visibles] = await Promise.all([
    supabase.from('products').select('*', { count:'exact', head:true }),
    supabase.from('products').select('*', { count:'exact', head:true }).eq('activo', true),
    supabase.from('orders').select('*', { count:'exact', head:true }),
    supabase.from('banners').select('*', { count:'exact', head:true }),
    supabase.from('products').select('*', { count:'exact', head:true }).lte('stock', 0).eq('activo', true),
    supabase.from('customers').select('*', { count:'exact', head:true }),
    supabase.from('orders').select('total,created_at,estado').gte('created_at', inicioHoy),
    supabase.from('orders').select('total,created_at,estado').gte('created_at', inicioMes),
    supabase.from('orders').select('*', { count:'exact', head:true }).in('estado', ['Registrado','Preparando']),
    supabase.from('orders').select('*', { count:'exact', head:true }).in('estado', ['Enviado','Entregado']),
    supabase.from('products').select('*', { count:'exact', head:true }).eq('visible', true)
  ]);

  const totalHoy = (pedidosHoy.data || []).filter(x => x.estado !== 'Cancelado').reduce((a, x) => a + Number(x.total || 0), 0);
  const totalMes = (pedidosMes.data || []).filter(x => x.estado !== 'Cancelado').reduce((a, x) => a + Number(x.total || 0), 0);

  res.json({
    productos: p.count || 0,
    productosActivos: pAct.count || 0,
    pedidos: o.count || 0,
    banners: b.count || 0,
    sinStock: sinStock.count || 0,
    clientes: clientes.count || 0,
    pedidosPendientes: pendientes.count || 0,
    pendientes: pendientes.count || 0,
    pedidosAtendidos: atendidos.count || 0,
    productosVisibles: visibles.count || 0,
    ventasHoy: totalHoy,
    ventasMes: totalMes
  });
});

app.get('/api/admin/dashboard', verificarToken, soloAdmin, async (req, res) => {
  const hoyInicio = new Date(); hoyInicio.setHours(0,0,0,0);
  const mesInicio = new Date(); mesInicio.setDate(1); mesInicio.setHours(0,0,0,0);
  const desde = new Date(); desde.setDate(desde.getDate() - 29); desde.setHours(0,0,0,0);

  const [pedidosRes, itemsRes, clientesRes] = await Promise.all([
    supabase.from('orders').select('id,numero,total,estado,created_at,cliente,order_items(*)').gte('created_at', desde.toISOString()).order('created_at', { ascending: false }),
    supabase.from('order_items').select('product_id,nombre,cantidad,subtotal'),
    supabase.from('customers').select('id,nombre,apellido,email,telefono,documento,created_at')
  ]);

  if (pedidosRes.error) return res.status(500).json({ error: pedidosRes.error.message });
  if (itemsRes.error) return res.status(500).json({ error: itemsRes.error.message });

  const pedidos = pedidosRes.data || [];
  const todosNoCancelados = pedidos.filter(p => p.estado !== 'Cancelado');
  const ventasHoy = todosNoCancelados.filter(p => new Date(p.created_at) >= hoyInicio).reduce((a,p)=>a+Number(p.total||0),0);
  const ventasMes = todosNoCancelados.filter(p => new Date(p.created_at) >= mesInicio).reduce((a,p)=>a+Number(p.total||0),0);
  const pedidosPendientes = pedidos.filter(p => ['Registrado','Preparando'].includes(p.estado)).length;
  const pedidosAtendidos = pedidos.filter(p => ['Enviado','Entregado'].includes(p.estado)).length;

  const ymd = d => d.toISOString().slice(0,10);
  const dias = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
    dias.push({ fecha: ymd(d), ventas: 0, pedidos: 0 });
  }
  const mapaDias = Object.fromEntries(dias.map(d => [d.fecha, d]));
  for (const p of todosNoCancelados) {
    const key = String(p.created_at || '').slice(0,10);
    if (mapaDias[key]) { mapaDias[key].ventas += Number(p.total || 0); mapaDias[key].pedidos += 1; }
  }

  const meses = {};
  for (const p of todosNoCancelados) {
    const mes = String(p.created_at || '').slice(0,7);
    if (!mes) continue;
    meses[mes] = (meses[mes] || 0) + Number(p.total || 0);
  }

  const topMap = new Map();
  for (const it of (itemsRes.data || [])) {
    const key = it.product_id || it.nombre || 'Producto';
    const old = topMap.get(key) || { sku:key, nombre:it.nombre || key, cantidad:0, total:0 };
    old.cantidad += Number(it.cantidad || 0);
    old.total += Number(it.subtotal || 0);
    topMap.set(key, old);
  }
  const productosVendidos = [...topMap.values()].sort((a,b)=>b.cantidad-a.cantidad).slice(0,20);

  res.json({
    ventasHoy,
    ventasMes,
    pedidosPendientes,
    pedidosAtendidos,
    ventasPorDia: dias,
    ventasPorMes: Object.entries(meses).map(([mes,total]) => ({ mes, total })),
    productosVendidos,
    ultimosPedidos: pedidos.slice(0,20),
    clientesRegistrados: clientesRes.data?.length || 0
  });
});

async function responderPromociones(req, res) {
  const { data, error } = await supabase.from('products')
    .select('id,nombre,marca,marca_imagen,categoria,category_id,precio,precio_oferta,en_oferta,en_promocion,stock,destacado,descripcion,imagen,codigo_barras,activo,visible')
    .eq('visible', true)
    .eq('activo', true)
    .eq('en_promocion', true)
    .order('nombre', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(p => ({
    id:p.id,nombre:p.nombre,marca:p.marca,marca_imagen:p.marca_imagen || '',categoria:p.categoria,category_id:p.category_id || null,precio:Number(p.precio),
    precio_oferta:p.precio_oferta === null || p.precio_oferta === undefined ? null : Number(p.precio_oferta),
    en_oferta:Boolean(p.en_oferta), en_promocion:Boolean(p.en_promocion), stock:Number(p.stock), destacado:p.destacado,
    descripcion:p.descripcion, imagen:p.imagen, codigoBarras:p.codigo_barras, activo:p.activo, visible:p.visible !== false
  })));
}

app.get('/api/promociones', responderPromociones);
app.get('/api/promocion', responderPromociones);

app.get('/api/admin/productos', verificarToken, soloAdmin, async (req, res) => {
  const { data, error } = await supabase.from('products').select('*').order('nombre', { ascending: true });
  if (error) return res.status(500).json({ error:error.message }); res.json(data);
});
app.post('/api/admin/productos', verificarToken, soloAdmin, async (req, res) => {
  const p = req.body;
  const id = String(p.id || p.codigoBarras || p.codigo_barras || Date.now()).trim();

  if (!p.nombre) return res.status(400).json({ error: 'El nombre del producto es obligatorio' });

  const row = {
    id,
    nombre: p.nombre,
    marca: p.marca || 'Sin marca',
    marca_imagen: p.marca_imagen || '',
    categoria: p.categoria || '',
    category_id: p.category_id || null,
    precio: Number(p.precio || 0),
    precio_oferta: p.precio_oferta === '' || p.precio_oferta == null ? null : Number(p.precio_oferta),
    en_oferta: Boolean(p.en_oferta),
    en_promocion: Boolean(p.en_promocion),
    stock: Number(p.stock || 0),
    destacado: Boolean(p.destacado),
    descripcion: p.descripcion || '',
    imagen: p.imagen || '../archivos/producto-default.jpg',
    codigo_barras: p.codigoBarras || p.codigo_barras || p.id || null,
    activo: p.activo !== false,
    visible: p.visible !== false,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('products')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.json(data);
});

app.put('/api/admin/productos/ocultar-agotados', verificarToken, soloAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .update({ visible: false, updated_at: new Date().toISOString() })
    .lte('stock', 0)
    .select('id');

  if (error) return res.status(400).json({ error: error.message });

  res.json({ ok: true, actualizados: data?.length || 0 });
});


app.put('/api/admin/productos/ocultar-no-disponibles', verificarToken, soloAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .update({ visible: false, updated_at: new Date().toISOString() })
    .eq('activo', false)
    .select('id');

  if (error) return res.status(400).json({ error: error.message });

  res.json({ ok: true, actualizados: data?.length || 0 });
});

app.put('/api/admin/productos/:id', verificarToken, soloAdmin, async (req, res) => {
  const p = req.body;

  if (!p.nombre) return res.status(400).json({ error: 'El nombre del producto es obligatorio' });

  const row = {
    nombre: p.nombre,
    marca: p.marca || 'Sin marca',
    marca_imagen: p.marca_imagen || '',
    categoria: p.categoria || '',
    category_id: p.category_id || null,
    precio: Number(p.precio || 0),
    precio_oferta: p.precio_oferta === '' || p.precio_oferta == null ? null : Number(p.precio_oferta),
    en_oferta: Boolean(p.en_oferta),
    en_promocion: Boolean(p.en_promocion),
    stock: Number(p.stock || 0),
    destacado: Boolean(p.destacado),
    descripcion: p.descripcion || '',
    imagen: p.imagen || '../archivos/producto-default.jpg',
    codigo_barras: p.codigoBarras || p.codigo_barras || p.id || null,
    activo: p.activo !== false,
    visible: p.visible !== false,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('products')
    .update(row)
    .eq('id', req.params.id)
    .select()
    .maybeSingle();

  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Producto no encontrado' });

  res.json(data);
});
app.delete('/api/admin/productos/:id', verificarToken, soloAdmin, async (req, res) => {
  const { error } = await supabase.from('products').update({ activo:false, updated_at:new Date().toISOString() }).eq('id', req.params.id);
  if (error) return res.status(400).json({ error:error.message }); res.json({ ok:true });
});
app.get('/api/admin/pedidos', verificarToken, soloAdmin, async (req, res) => {
  const { data, error } = await supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending:false });
  if (error) return res.status(500).json({ error:error.message }); res.json(data);
});

app.get('/api/admin/pedidos/:id/descargar', verificarToken, soloAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', req.params.id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Pedido no encontrado' });

  const html = formatearPedidoHTML(data);
  const nombre = `pedido-${String(data.numero || data.id).replace(/[^a-zA-Z0-9_-]/g, '-')}.html`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
  res.send(html);
});

app.put('/api/admin/pedidos/:id/estado', verificarToken, soloAdmin, async (req, res) => {
  const estadosPermitidos = ['Registrado', 'Preparando', 'Enviado', 'Entregado', 'Cancelado'];
  const estado = req.body.estado;

  if (!estadosPermitidos.includes(estado)) {
    return res.status(400).json({ error: 'Estado no válido' });
  }

  const { data: pedidoActual, error: pedidoError } = await supabase
    .from('orders')
    .select('id, estado, order_items(*)')
    .eq('id', req.params.id)
    .maybeSingle();

  if (pedidoError) return res.status(500).json({ error: pedidoError.message });
  if (!pedidoActual) return res.status(404).json({ error: 'Pedido no encontrado' });

  if (estado === 'Cancelado' && pedidoActual.estado !== 'Cancelado') {
    for (const item of (pedidoActual.order_items || [])) {
      const productId = item.producto_id || item.product_id;
      const cantidad = Number(item.cantidad || 0);

      if (!productId || cantidad <= 0) continue;

      const { data: producto, error: prodError } = await supabase
        .from('products')
        .select('stock')
        .eq('id', productId)
        .maybeSingle();

      if (prodError) return res.status(500).json({ error: prodError.message });

      if (producto) {
        const { error: stockError } = await supabase
          .from('products')
          .update({
            stock: Number(producto.stock || 0) + cantidad,
            updated_at: new Date().toISOString()
          })
          .eq('id', productId);

        if (stockError) return res.status(500).json({ error: stockError.message });
      }
    }
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ estado })
    .eq('id', req.params.id)
    .select()
    .maybeSingle();

  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Pedido no encontrado' });

  res.json(data);
});

app.get('/api/admin/hero-slides', verificarToken, soloAdmin, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { data, error } = await supabase.from('hero_slides').select('*').order('orden', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/admin/hero-slides', verificarToken, soloAdmin, async (req, res) => {
  const body = req.body || {};
  const payload = {
    tipo: ['promocion','destacados','ofertas','general'].includes(String(body.tipo || '').trim()) ? String(body.tipo).trim() : 'general',
    titulo: String(body.titulo || '').trim(),
    subtitulo: String(body.subtitulo || '').trim(),
    etiqueta: String(body.etiqueta || '').trim(),
    imagen: String(body.imagen || '').trim(),
    enlace: String(body.enlace || '').trim(),
    texto_boton: String(body.texto_boton ?? '').trim(),
    orden: Number(body.orden || 1),
    activo: body.activo !== false
  };
  const { data, error } = await supabase.from('hero_slides').insert(payload).select('*').single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true, slide: data });
});

app.put('/api/admin/hero-slides/:id', verificarToken, soloAdmin, async (req, res) => {
  const body = req.body || {};
  const payload = {
    tipo: ['promocion','destacados','ofertas','general'].includes(String(body.tipo || '').trim()) ? String(body.tipo).trim() : 'general',
    titulo: String(body.titulo || '').trim(),
    subtitulo: String(body.subtitulo || '').trim(),
    etiqueta: String(body.etiqueta || '').trim(),
    imagen: String(body.imagen || '').trim(),
    enlace: String(body.enlace || '').trim(),
    texto_boton: String(body.texto_boton ?? '').trim(),
    orden: Number(body.orden || 1),
    activo: body.activo !== false,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await supabase.from('hero_slides').update(payload).eq('id', req.params.id).select('*').single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true, slide: data });
});

app.delete('/api/admin/hero-slides/:id', verificarToken, soloAdmin, async (req, res) => {
  const { error } = await supabase.from('hero_slides').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});


app.post('/api/admin/media', verificarToken, soloAdmin, mediaUpload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Selecciona una imagen o video' });

    const bucket = 'contenido-visual';
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!(buckets || []).some(item => item.name === bucket)) {
      const { error: bucketError } = await supabase.storage.createBucket(bucket, { public: true, fileSizeLimit: 80 * 1024 * 1024 });
      if (bucketError && !String(bucketError.message || '').toLowerCase().includes('already')) throw bucketError;
    }

    const extension = (req.file.originalname.split('.').pop() || (req.file.mimetype.startsWith('video/') ? 'mp4' : 'jpg')).replace(/[^a-z0-9]/gi, '').toLowerCase();
    const nombre = `banners/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(nombre, req.file.buffer, {
      contentType: req.file.mimetype,
      cacheControl: '3600',
      upsert: false
    });
    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(nombre);
    res.json({ ok: true, url: publicData.publicUrl, tipo: req.file.mimetype, nombre: req.file.originalname });
  } catch (error) {
    res.status(400).json({ error: error.message || 'No se pudo subir el archivo' });
  }
});

app.get('/api/admin/banners', verificarToken, soloAdmin, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { data, error } = await supabase
    .from('banners')
    .select('*')
    .order('orden', { ascending:true })
    .order('created_at', { ascending:false });

  if (error) return res.status(500).json({ error:error.message });
  res.json(data || []);
});

function limpiarBannerPayload(body = {}) {
  return {
    tipo: ['promocion','destacados','ofertas'].includes(String(body.tipo || '').trim()) ? String(body.tipo).trim() : 'promocion',
    titulo: String(body.titulo || '').trim(),
    subtitulo: String(body.subtitulo || '').trim(),
    etiqueta: String(body.etiqueta || '').trim(),
    etiqueta: String(body.etiqueta || '').trim(),
    imagen: String(body.imagen || '').trim(),
    enlace: String(body.enlace || '').trim(),
    texto_boton: String(body.texto_boton || body.textoBoton || 'Ver promoción').trim(),
    activo: body.activo !== false,
    orden: Number(body.orden || 1),
    updated_at: new Date().toISOString()
  };
}

app.post('/api/admin/banners', verificarToken, soloAdmin, async (req, res) => {
  const row = limpiarBannerPayload(req.body);
  if (!row.titulo) return res.status(400).json({ error:'El título del banner es obligatorio' });

  const enlaceManual = Boolean(row.enlace);
  const destino = row.enlace || './promocion.html';
  if (!enlaceManual) row.enlace = './paginas/promocion.html';

  const { data, error } = await supabase
    .from('banners')
    .insert(row)
    .select()
    .single();

  if (error) return res.status(400).json({ error:error.message });

  res.json(data);
});

app.put('/api/admin/banners/:id', verificarToken, soloAdmin, async (req, res) => {
  const row = limpiarBannerPayload(req.body);
  if (!row.titulo) return res.status(400).json({ error:'El título del banner es obligatorio' });

  if (!row.enlace || String(row.enlace).includes('promocion-')) row.enlace = './paginas/promocion.html';

  const { data, error } = await supabase
    .from('banners')
    .update(row)
    .eq('id', req.params.id)
    .select()
    .maybeSingle();

  if (error) return res.status(400).json({ error:error.message });
  if (!data) return res.status(404).json({ error:'Banner no encontrado' });

  res.json(data);
});

app.delete('/api/admin/banners/:id', verificarToken, soloAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('banners')
    .delete()
    .eq('id', req.params.id)
    .select()
    .maybeSingle();

  if (error) return res.status(400).json({ error:error.message });
  if (!data) return res.status(404).json({ error:'Banner no encontrado' });
  res.json({ ok:true, banner:data });
});


app.get('/api/admin/dashboard-simple', verificarToken, soloAdmin, async (req, res) => {
  const desde = new Date(); desde.setDate(desde.getDate() - 29); desde.setHours(0,0,0,0);
  const { data: pedidos, error } = await supabase.from('orders').select('id,numero,total,estado,created_at,cliente').gte('created_at', desde.toISOString()).order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  const ventasPorDia = {};
  for (let i=0;i<30;i++) { const d = new Date(desde); d.setDate(desde.getDate()+i); ventasPorDia[d.toISOString().slice(0,10)] = 0; }
  (pedidos || []).filter(p => p.estado !== 'Cancelado').forEach(p => { const k = String(p.created_at || '').slice(0,10); ventasPorDia[k] = (ventasPorDia[k] || 0) + Number(p.total || 0); });
  const ultimosPedidos = (pedidos || []).slice(-8).reverse();
  res.json({ ventasPorDia: Object.entries(ventasPorDia).map(([fecha,total]) => ({ fecha, total })), ultimosPedidos });
});

app.get('/api/admin/clientes', verificarToken, soloAdmin, async (req, res) => {
  const { data: clientes, error } = await supabase.from('customers').select('id,nombre,apellido,email,telefono,tipo_documento,documento,direccion,created_at').order('created_at', { ascending:false });
  if (error) return res.status(500).json({ error:error.message });
  const { data: pedidos } = await supabase.from('orders').select('customer_id,total,created_at,estado');
  const stats = {};
  (pedidos || []).forEach(p => { if (!p.customer_id) return; const k=p.customer_id; if(!stats[k]) stats[k]={compras:0,total:0,ultima:null}; if(p.estado !== 'Cancelado'){ stats[k].compras++; stats[k].total += Number(p.total||0); } if(!stats[k].ultima || String(p.created_at)>String(stats[k].ultima)) stats[k].ultima=p.created_at; });
  res.json((clientes || []).map(c => ({ ...c, compras: stats[c.id]?.compras || 0, total_gastado: stats[c.id]?.total || 0, ultima_compra: stats[c.id]?.ultima || null })));
});

app.get('/api/admin/reportes', verificarToken, soloAdmin, async (req, res) => {
  const { desde, hasta, mes } = req.query;
  let query = supabase.from('orders').select('id,total,estado,created_at,cliente,order_items(*)').order('created_at', { ascending:true });
  if (desde) query = query.gte('created_at', String(desde));
  if (hasta) query = query.lte('created_at', String(hasta));
  if (mes && /^\d{4}-\d{2}$/.test(String(mes))) {
    const ini = `${mes}-01T00:00:00.000Z`;
    const finDate = new Date(`${mes}-01T00:00:00.000Z`);
    finDate.setUTCMonth(finDate.getUTCMonth() + 1);
    query = query.gte('created_at', ini).lt('created_at', finDate.toISOString());
  }
  const { data: pedidos, error } = await query;
  if (error) return res.status(500).json({ error:error.message });
  const ventasDia = {}, ventasMes = {}, productos = {}, clientes = {};
  (pedidos || []).forEach(p => {
    if (p.estado === 'Cancelado') return;
    const dia = String(p.created_at || '').slice(0,10);
    const mesKey = String(p.created_at || '').slice(0,7);
    if (dia) ventasDia[dia] = (ventasDia[dia] || 0) + Number(p.total || 0);
    if (mesKey) ventasMes[mesKey] = (ventasMes[mesKey] || 0) + Number(p.total || 0);
    const cli = p.cliente || {}; const ck = cli.email || cli.correo || cli.telefono || cli.documento || 'Sin identificar';
    if(!clientes[ck]) clientes[ck]={cliente:[cli.nombre, cli.apellido].filter(Boolean).join(' ') || ck, compras:0, total:0};
    clientes[ck].compras++; clientes[ck].total += Number(p.total || 0);
    (p.order_items || []).forEach(i => { const k=i.product_id || i.nombre || 'Producto'; if(!productos[k]) productos[k]={sku:k,nombre:i.nombre || k,cantidad:0,total:0}; productos[k].cantidad += Number(i.cantidad || 0); productos[k].total += Number(i.subtotal || 0); });
  });
  const ventasPorDia = Object.entries(ventasDia).map(([fecha,total]) => ({ fecha,total }));
  const ventasPorMes = Object.entries(ventasMes).map(([mes,total]) => ({ mes,total }));
  res.json({
    ventasPorDia,
    ventasPorMes,
    ventasDia: ventasPorDia,
    ventasMes: ventasPorMes,
    productosVendidos: Object.values(productos).sort((a,b)=>b.cantidad-a.cantidad).slice(0,20),
    clientesFrecuentes: Object.values(clientes).sort((a,b)=>b.total-a.total).slice(0,20)
  });
});

app.get('/api/admin/reportes/excel', verificarToken, soloAdmin, async (req, res) => {
  const { data, error } = await supabase.from('orders').select('numero,total,estado,created_at,cliente,order_items(*)').order('created_at', { ascending:false });
  if (error) return res.status(500).json({ error:error.message });
  const filas = [['Pedido','Fecha','Cliente','Correo','Telefono','Estado','Total','SKU','Producto','Cantidad','Subtotal']];
  (data || []).forEach(p => { const cli=p.cliente||{}; const items=p.order_items||[]; if(!items.length) filas.push([p.numero,p.created_at,`${cli.nombre||''} ${cli.apellido||''}`,cli.email||cli.correo||'',cli.telefono||'',p.estado,p.total,'','','','']); items.forEach(i => filas.push([p.numero,p.created_at,`${cli.nombre||''} ${cli.apellido||''}`,cli.email||cli.correo||'',cli.telefono||'',p.estado,p.total,i.product_id||'',i.nombre||'',i.cantidad||0,i.subtotal||0])); });
  const csv = filas.map(row => row.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="reporte-alterego.csv"');
  res.send('\ufeff' + csv);
});


app.get('/api/admin/marcas', verificarToken, soloAdmin, async (req, res) => {
  const { data, error } = await supabase.from('brands').select('*').order('orden', { ascending:true }).order('nombre', { ascending:true });
  if (error) return res.status(500).json({ error:error.message });
  res.json(data || []);
});

app.post('/api/admin/marcas', verificarToken, soloAdmin, async (req, res) => {
  const body = req.body || {};
  const nombre = String(body.nombre || '').trim();
  if (!nombre) return res.status(400).json({ error:'Nombre de marca obligatorio' });
  const slug = String(body.slug || nombre).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const payload = { nombre, slug, imagen:String(body.imagen || '').trim(), activo:body.activo !== false, orden:Number(body.orden || 1), updated_at:new Date().toISOString() };
  const { data, error } = await supabase.from('brands').upsert(payload, { onConflict:'slug' }).select('*').single();
  if (error) return res.status(400).json({ error:error.message });
  await supabase.from('products').update({ marca_imagen:payload.imagen }).ilike('marca', nombre);
  res.json(data);
});

app.put('/api/admin/marcas/:id', verificarToken, soloAdmin, async (req, res) => {
  const body = req.body || {};
  const nombre = String(body.nombre || '').trim();
  if (!nombre) return res.status(400).json({ error:'Nombre de marca obligatorio' });
  const payload = { nombre, slug:String(body.slug || nombre).trim(), imagen:String(body.imagen || '').trim(), activo:body.activo !== false, orden:Number(body.orden || 1), updated_at:new Date().toISOString() };
  const { data, error } = await supabase.from('brands').update(payload).eq('id', req.params.id).select('*').maybeSingle();
  if (error) return res.status(400).json({ error:error.message });
  if (!data) return res.status(404).json({ error:'Marca no encontrada' });
  await supabase.from('products').update({ marca_imagen:payload.imagen }).ilike('marca', nombre);
  res.json(data);
});

app.delete('/api/admin/marcas/:id', verificarToken, soloAdmin, async (req, res) => {
  const { error } = await supabase.from('brands').update({ activo:false, updated_at:new Date().toISOString() }).eq('id', req.params.id);
  if (error) return res.status(400).json({ error:error.message });
  res.json({ ok:true });
});

app.get('/api/admin/categorias', verificarToken, soloAdmin, async (req, res) => {
  const { data, error } = await supabase.from('categories').select('*').order('orden', { ascending:true }).order('nombre', { ascending:true });
  if (error) {
    console.warn('No se pudieron cargar categorías:', error.message);
    return res.status(500).json({ error:error.message });
  }
  res.json(data || []);
});

app.post('/api/admin/categorias', verificarToken, soloAdmin, async (req, res) => {
  const body = req.body || {};
  const nombre = String(body.nombre || '').trim();
  if (!nombre) return res.status(400).json({ error:'Nombre de categoría obligatorio' });
  const slug = String(body.slug || nombre).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const payload = { nombre, slug, imagen: String(body.imagen || '').trim(), icono: String(body.icono || '').trim(), activo: body.activo !== false, orden: Number(body.orden || 1), updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('categories').upsert(payload, { onConflict:'slug' }).select('*').single();
  if (error) return res.status(400).json({ error:error.message });
  res.json(data);
});

app.put('/api/admin/categorias/:id', verificarToken, soloAdmin, async (req, res) => {
  const body = req.body || {};
  const nombre = String(body.nombre || '').trim();
  if (!nombre) return res.status(400).json({ error:'Nombre de categoría obligatorio' });
  const payload = { nombre, slug: String(body.slug || '').trim(), imagen: String(body.imagen || '').trim(), icono: String(body.icono || '').trim(), activo: body.activo !== false, orden: Number(body.orden || 1), updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('categories').update(payload).eq('id', req.params.id).select('*').maybeSingle();
  if (error) return res.status(400).json({ error:error.message });
  if (!data) return res.status(404).json({ error:'Categoría no encontrada' });
  res.json(data);
});

app.delete('/api/admin/categorias/:id', verificarToken, soloAdmin, async (req, res) => {
  const { error } = await supabase.from('categories').update({ activo:false, updated_at: new Date().toISOString() }).eq('id', req.params.id);
  if (error) return res.status(400).json({ error:error.message });
  res.json({ ok:true });
});

app.get('/api/admin/configuracion', verificarToken, soloAdmin, async (req, res) => {
  const defaults = { correo: STORE_EMAIL, whatsapp: WHATSAPP_TIENDA, tienda_nombre: 'ALTER EGO', direccion: '', instagram: '', facebook: '' };
  const { data, error } = await supabase.from('settings').select('clave,valor');
  if (error) return res.json(defaults);
  const conf = { ...defaults };
  (data || []).forEach(r => { conf[r.clave] = r.valor; });
  res.json(conf);
});

app.put('/api/admin/configuracion', verificarToken, soloAdmin, async (req, res) => {
  const body = req.body || {};
  const rows = Object.entries(body).map(([clave,valor]) => ({ clave, valor: String(valor ?? ''), updated_at: new Date().toISOString() }));
  if (!rows.length) return res.json({ ok:true });
  const { error } = await supabase.from('settings').upsert(rows, { onConflict:'clave' });
  if (error) return res.status(400).json({ error:error.message });
  res.json({ ok:true });
});

app.post('/api/pagos/mercadopago/preferencia', verificarToken, async (req, res) => res.status(501).json({ error:'Falta configurar MERCADOPAGO_ACCESS_TOKEN y credenciales reales.' }));
app.post('/api/pagos/culqi/cargo', verificarToken, async (req, res) => res.status(501).json({ error:'Falta configurar CULQI_SECRET_KEY y token de tarjeta.' }));


app.post('/api/contacto', async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  const email = String(req.body?.email || '').trim();
  const telefono = String(req.body?.telefono || '').trim();
  const sede = String(req.body?.sede || '').trim();
  const asunto = String(req.body?.asunto || '').trim();
  const mensaje = String(req.body?.mensaje || '').trim();

  if (!nombre || !email || !asunto || !mensaje) {
    return res.status(400).json({ error: 'Completa nombre, correo, asunto y mensaje.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Escribe un correo válido.' });
  }

  const smtpHost = String(process.env.SMTP_HOST || '').trim();
  const smtpUser = String(process.env.SMTP_USER || '').trim();
  const smtpPass = String(process.env.SMTP_PASS || '').trim().replace(/\s+/g, '');
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  if (!smtpHost || !smtpUser || !smtpPass || smtpPass.includes('PEGA_AQUI')) {
    return res.status(503).json({ error: 'El correo de contacto todavía no está configurado. Completa SMTP_HOST, SMTP_USER y SMTP_PASS en backend/.env.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass }
    });
    await transporter.sendMail({
      from: `ALTER EGO Web <${smtpUser}>`,
      to: STORE_EMAIL,
      replyTo: email,
      subject: `[Contacto web] ${asunto}`,
      text: `Nombre: ${nombre}\nCorreo: ${email}\nTeléfono: ${telefono || '-'}\nSede: ${sede || '-'}\n\n${mensaje}`,
      html: `<h2>Nuevo mensaje desde la web</h2><p><strong>Nombre:</strong> ${escapeHtml(nombre)}</p><p><strong>Correo:</strong> ${escapeHtml(email)}</p><p><strong>Teléfono:</strong> ${escapeHtml(telefono || '-')}</p><p><strong>Sede:</strong> ${escapeHtml(sede || '-')}</p><p><strong>Asunto:</strong> ${escapeHtml(asunto)}</p><hr><p>${escapeHtml(mensaje).replaceAll('\n', '<br>')}</p>`
    });
    return res.json({ ok: true, mensaje: 'Tu mensaje fue enviado. Nos comunicaremos contigo pronto.' });
  } catch (error) {
    console.error('Error enviando contacto:', error.message);
    return res.status(500).json({ error: 'No se pudo enviar el mensaje. Revisa la configuración SMTP del backend.' });
  }
});

app.listen(PORT, () => console.log(`Backend ALTER EGO activo en puerto ${PORT}`));
