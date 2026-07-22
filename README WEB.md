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


Solución a los pedidos online:

Web pública (Brasaland)
   └─ botón "Pedir online" → App de pedido (cliente)
                                   │
                                   ▼
                    API CENTRAL 
                    ── Menú por local
                    ── Pedidos (ya existe el modelo Order)
                    ── Estado del pedido en tiempo real (WebSockets,
                       igual que con las recetas de cocina)
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                              ▼
            App de POS (empleados)          Dashboard BI (ya existe)
            Colombia y EE.UU.                ve ventas de ambos
            ven los pedidos entrantes         locales en vivo
            de su propio local en vivo


INFORMACIÓN SOLICITADA POR LA EMPRESA:
Tu departamento y el problema que debes resolver
Trabajas en Brasaland Digital, el equipo interno creado por la CEO Mariana Restrepo para liderar la transformación digital de la empresa, y reportas directamente al CTO Nicolás Park. El sitio web corporativo actual de Brasaland es de 2019, no permite pedidos en línea, y solo muestra el menú. No refleja que la empresa opera en dos países ni presenta adecuadamente la experiencia de marca. Camila Ospina (Gerente de Marketing) necesita un sitio web renovado que presente la marca profesionalmente, muestre las ubicaciones en ambos países, y capture información de personas interesadas en formar parte del programa de fidelización digital.

Tu stakeholder
Camila Ospina, Gerente de Marketing

Hola,

Necesitamos relanzar nuestro sitio web corporativo. Debe presentar Brasaland como lo que somos: una cadena seria de restaurantes a la brasa con presencia en Colombia y Estados Unidos. Quiero una landing page que explique nuestra propuesta de valor, muestre nuestras ubicaciones en ambos países, y presente nuestro nuevo programa de fidelización digital "Brasa Points". También necesito una página con un formulario para que las personas puedan registrarse en el programa de fidelización. Actualmente usamos tarjetas físicas que se pierden y no generan datos. Quiero capturar: nombre, email, teléfono, país, ciudad, ubicación favorita, preferencias alimentarias, y cómo nos conocieron. El sitio debe ser responsive, accesible, y optimizado para SEO. El soporte multiidioma (español e inglés) es opcional pero altamente recomendado; empieza con un idioma base. Usa Tailwind y asegúrate de que las validaciones funcionen perfectamente.

Alcance de idioma
El soporte multiidioma es opcional pero altamente recomendado por la operación de Brasaland en Colombia y Estados Unidos.
Debes escoger un idioma base para toda la experiencia del sitio y del formulario.
Si implementas un segundo idioma, trátalo como una mejora (sin reducir la calidad/completitud del idioma base).
Contenido de la landing page
Tu landing page debe incluir las siguientes secciones, en este orden:

Header
Logo o nombre "Brasaland"
Selector de idioma (ES | EN) si implementas un segundo idioma
Navegación: Inicio | Ubicaciones | Menú | Brasa Points | Contacto
Hero
Titular: "El sabor de la brasa, en cada bocado"
Subtítulo: "Desde 2008 sirviendo las mejores carnes a la brasa en Colombia y Estados Unidos. 14 ubicaciones, una misma pasión por la calidad y el sabor."
Call to action: Botón "Únete a Brasa Points" que enlace al formulario
Nuestra Historia (párrafo + imagen)
Fundada en Medellín en 2008, Brasaland comenzó como un sueño familiar: compartir el auténtico sabor de la carne a la brasa con calidad constante y servicio cálido. Hoy somos 14 restaurantes en dos países, pero mantenemos la misma receta de éxito: productos frescos, técnicas tradicionales, y pasión por cada plato que servimos.

Lo que nos hace únicos (3 columnas)
Calidad Consistente

Mismas recetas y estándares en todos los locales
Ingredientes frescos seleccionados diariamente
Experiencia Cálida

Servicio amable y atento
Ambiente familiar en cada visita
Rapidez

Tu comida lista en minutos
Sin sacrificar sabor ni calidad
Nuestras Ubicaciones (2 columnas)
Colombia

10 restaurantes en Medellín, Bogotá y Cali
Horario: Lun-Dom 11:00 - 22:00
Estados Unidos (Florida)

4 restaurantes en Miami y Orlando
Horario: Mon-Sun 11:00 AM - 10:00 PM
Brasa Points (sección destacada)
Gana puntos con cada visita
Acumula 1 punto por cada $10.000 COP o $5 USD
Canjea tus puntos por descuentos y platos gratis
Ofertas exclusivas para miembros
Registro 100% digital - ¡ya no más tarjetas de papel!
Contacto
Email: hola@brasaland.com
Colombia: +57 4 123 4567
Florida: +1 305 123 4567
Footer
© 2025 Brasaland. Todos los derechos reservados.
Instagram | Facebook
Campos del formulario de registro Brasa Points
Tu formulario debe capturar la siguiente información:

Campo	Tipo	Validación	Obligatorio
Nombre completo	text	Mínimo 2 palabras	Sí
Email	email	Formato válido de email	Sí
Teléfono	tel	Formato: +[código país] [número]	Sí
País	select	Colombia / Estados Unidos	Sí
Ciudad	select	Medellín / Bogotá / Cali / Miami / Orlando (según país)	Sí
Ubicación favorita de Brasaland	select	Lista de 14 restaurantes según país y ciudad	No
Preferencias alimentarias	checkbox	Sin restricciones / Vegetariano / Sin gluten / Otro	No
¿Cómo nos conociste?	select	Redes sociales / Recomendación / Pasando por el local / Búsqueda en internet / Otro	Sí
Fecha de nacimiento	date	Mayor de 18 años	Sí
Acepto términos del programa	checkbox	Debe estar marcado para enviar	Sí
Quiero recibir ofertas por email	checkbox	Opcional, por defecto no marcado	No
Validaciones específicas
Nombre completo: Debe contener al menos nombre y apellido
Email: Debe ser formato válido (contener @ y dominio)
Teléfono: Debe comenzar con + seguido del código de país (+57 para Colombia, +1 para USA)
Ciudad: Las opciones de ciudad deben cambiar dinámicamente según el país seleccionado
Ubicación favorita: Las opciones deben filtrarse según país y ciudad seleccionados
Fecha de nacimiento: El usuario debe ser mayor de 18 años (validar fecha)
Términos del programa: El checkbox debe estar marcado para poder enviar
Lógica de campos dependientes
País → Ciudad:

Si selecciona "Colombia": mostrar Medellín, Bogotá, Cali
Si selecciona "Estados Unidos": mostrar Miami, Orlando
País + Ciudad → Ubicación favorita:

Colombia - Medellín: Brasaland El Poblado, Brasaland Laureles, Brasaland Envigado, Brasaland Sabaneta
Colombia - Bogotá: Brasaland Usaquén, Brasaland Chapinero, Brasaland Zona Rosa
Colombia - Cali: Brasaland Granada, Brasaland Ciudad Jardín, Brasaland Unicentro
USA - Miami: Brasaland Brickell, Brasaland Coral Gables
USA - Orlando: Brasaland Downtown, Brasaland International Drive
Mensajes de error esperados
Cuando un campo no cumpla la validación, muestra estos mensajes específicos:

Nombre completo: "Ingresa tu nombre completo (nombre y apellido)"
Email: "Ingresa un email válido (ejemplo: nombre@correo.com)"
Teléfono: "El teléfono debe incluir código de país (ejemplo: +57 300 123 4567 o +1 305 123 4567)"
País: "Selecciona tu país"
Ciudad: "Selecciona tu ciudad"
Cómo nos conociste: "Cuéntanos cómo conociste Brasaland"
Fecha de nacimiento: "Debes ser mayor de 18 años para registrarte en Brasa Points"
Términos del programa: "Debes aceptar los términos del programa Brasa Points para continuar"
Mensaje de éxito
Cuando el formulario se valide correctamente (simular envío), mostrar:

¡Bienvenido a Brasa Points!

Tu registro ha sido exitoso. Recibirás un email de confirmación en los próximos minutos con los detalles de tu cuenta y cómo empezar a acumular puntos.

¡Ya puedes disfrutar de tus beneficios en cualquiera de nuestras 14 ubicaciones!

Restricción específica
El programa Brasa Points está diseñado para clientes mayores de 18 años que quieren acumular puntos con sus visitas. No es un formulario de reservas ni de pedidos en línea. El sitio debe incluir un mensaje visible que diga: "¿Quieres hacer un pedido? Llama a tu ubicación favorita o visítanos directamente. ¡Pronto tendremos pedidos en línea!"

Schema.org markup requerido
Implementa el siguiente marcado Schema.org en tu landing page:

Si entregas un solo idioma, configura availableLanguage únicamente con ese idioma base.

{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Brasaland",
  "description": "Cadena de restaurantes de comida a la brasa en Colombia y Estados Unidos",
  "url": "https://brasaland.com",
  "foundingDate": "2008",
  "servesCuisine": "Grilled food, Colombian cuisine",
  "priceRange": "$$",
  "address": [
    {
      "@type": "PostalAddress",
      "addressCountry": "CO",
      "addressLocality": "Medellín",
      "addressRegion": "Antioquia"
    },
    {
      "@type": "PostalAddress",
      "addressCountry": "US",
      "addressLocality": "Miami",
      "addressRegion": "FL"
    }
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+57-4-123-4567",
    "contactType": "customer service",
    "availableLanguage": ["Spanish", "English"]
  },
  "sameAs": [
    "https://instagram.com/brasaland",
    "https://facebook.com/brasaland"
  ]
}
