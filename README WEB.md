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

No necesitas servidor backend para ver la web — son archivos estáticos.
Solo necesitas Node para compilar el CSS de Tailwind:

```bash
npm install
npm run build:css
```

Esto genera `css/styles.css`. Después simplemente abre `index.html` en el
navegador (o usa la extensión "Live Server" de VS Code para recarga
automática).

Si vas a seguir editando clases de Tailwind, corre en paralelo:

```bash
npm run watch:css
```

para que se recompile automáticamente cada vez que guardes un archivo.

## Qué incluye

- **Header con navegación clara** — enlaces a cada sección + botón de
  "Reservar mesa" siempre visible, con menú hamburguesa accesible en móvil
  (maneja `aria-expanded`, se cierra con Escape, foco visible).
- **Hero** explicando qué hacemos y por qué reservar.
- **Sección "Qué hacemos"** con los diferenciadores del servicio.
- **Sección de experiencia en hostelería/hotel boutique** con métricas.
- **Contacto** con dirección, teléfono, email, horario y mapa embebido.
- **Footer profesional** con navegación, legal y redes.
- **Formulario de reserva** (`reserva.html`, fuera de la landing) con los
  campos pedidos: nombre, apellidos, email, teléfono, número de personas,
  día y hora.
- **Validación 100% en JS antes de enviar** (`js/reserva.js`): formato de
  email, teléfono, rango de personas (1-20), fecha no pasada, no lunes
  (cerrado), hora dentro del horario de servicio según el día. Cada campo
  muestra su propio mensaje de error, más un resumen accesible
  (`aria-live`) para lectores de pantalla.
- **SEO**: `<title>` y `<meta description>` únicos por página, Open Graph,
  `rel="canonical"`, y marcado **schema.org `Restaurant`** en JSON-LD con
  dirección, teléfono, horario y rango de precio — esto es lo que permite
  que Google muestre el horario y el teléfono directamente en el buscador.
- **Accesibilidad**: enlace "saltar al contenido", landmarks semánticos
  (`header`, `nav`, `main`, `footer`), labels asociados a cada input,
  `aria-invalid`/`aria-describedby` en errores de formulario, contraste
  cuidado, y foco visible en todos los elementos interactivos.

## Pendiente para conectar de verdad el envío de reservas

Ahora mismo `js/reserva.js` **simula** el envío (lo verás en la consola del
navegador) porque todavía no hay backend conectado. El punto exacto a
modificar es la función `enviarReserva()` al final de ese archivo — ahí
está comentado cómo conectarlo:

1. **Opción A (recomendada, ya tienes la pieza):** un `fetch` a tu API
   central del panel operativo (`POST /api/crm/orders` o un endpoint
   nuevo tipo `/api/reservas`), y desde ahí el backend dispara el email al
   cliente y la notificación interna (con Nodemailer, Resend, Postmark...).
2. **Opción B (sin tocar tu backend):** un servicio de email 100%
   client-side como EmailJS, que envía el email directo desde el navegador
   con una API key pública. Más rápido de montar, menos control.

Antes de poner esto en producción, cambia también:
- El dominio real en las etiquetas `canonical` y Open Graph
  (ahora dicen `brasaland.example`).
- La dirección, teléfono, coordenadas del mapa y horario reales en el
  JSON-LD y en la sección de contacto.
- Las imágenes de stock por fotos reales del restaurante.
