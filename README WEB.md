# Brasaland — Web pública (landing + reservas)

Sitio estático: HTML, CSS y JS separados (sin framework), con Tailwind CSS
para el diseño. Dos páginas: la landing (`index.html`) y el formulario de
reserva, fuera de la landing (`reserva.html`).

## Estructura

```
index.html          -> landing: header, hero, qué hacemos, experiencia
                        hotelera, contacto, footer
reserva.html         -> formulario de reserva (página aparte)
css/
  input.css           -> fuente de Tailwind (directivas + componentes)
  styles.css           -> CSS ya compilado, lo que cargan los .html
js/
  main.js             -> menú móvil accesible + año dinámico del footer
  reserva.js           -> validación completa del formulario + envío
tailwind.config.js
package.json
```

## Cómo levantarlo

No necesito servidor backend para ver la web — son archivos estáticos.
Solo Node para compilar el CSS de Tailwind:

```bash
npm install
npm run build:css
```

Esto genera `css/styles.css`. 

Clases de Tailwind, correr en paralelo:

```bash
npm run watch:css
```

para que se recompile automáticamente.

## Qué incluye

- **Header con navegación clara** — enlaces a cada sección + botón de
  "Reservar mesa" siempre visible, con menú hamburguesa accesible en móvil
  (maneja `aria-expanded`, se cierra con Escape, foco visible).
- **Hero** explicando qué hacemos y por qué reservar.
- **Sección "Qué hacemos"** con los diferenciadores del servicio.
- **Sección de experiencia en hostelería** con métricas.
- **Contacto** con dirección, teléfono, email, horario y mapa embebido.
- **Footer profesional** con navegación, legal y redes.
- **Formulario de reserva** (`reserva.html`, fuera de la landing) con los
  campos: nombre, apellidos, email, teléfono, número de personas,
  día y hora.
- **Validación 100% en JS antes de enviar** (`js/reserva.js`): formato de
  email, teléfono, rango de personas (1-20), fecha no pasada, no lunes
  (cerrado), hora dentro del horario de servicio según el día. Cada campo
  muestra su propio mensaje de error, más un resumen accesible
  (`aria-live`) para lectores de pantalla.
- **SEO**: `<title>` y `<meta description>` únicos por página, Open Graph,
  `rel="canonical"`, y marcado **schema.org `Restaurant`** en JSON-LD con
  dirección, teléfono, horario y rango de precio.
- **Accesibilidad**: enlace "saltar al contenido", landmarks semánticos
  (`header`, `nav`, `main`, `footer`), labels asociados a cada input,
  `aria-invalid`/`aria-describedby` en errores de formulario, contraste
  cuidado, y foco visible en todos los elementos interactivos.

## Pendiente para conectar de verdad el envío de reservas

Ahora mismo `js/reserva.js` simula el envío porque todavía no hay backend conectado. El punto exacto a
modificar es la función `enviarReserva()` al final de ese archivo:

1. **Opción elegida:** un `fetch` a la API
   central del panel operativo (`POST /api/crm/orders` o un endpoint
   nuevo tipo `/api/reservas`), y desde ahí el backend dispara el email al
   cliente y la notificación interna (con Nodemailer, Resend, Postmark...).

