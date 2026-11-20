# Daggerheart para Owlbear Rodeo

Extensión de Owlbear Rodeo que añade lo que OBR no trae de serie: hojas de
personaje que cada jugador edita por su cuenta, y fichas de adversarios y
entornos que solo gestiona el DJ.

## Qué resuelve

Owlbear Rodeo solo mueve tokens en un mapa: no sabe qué es una ficha, no
distingue DJ de jugador, y no guarda nada por personaje. Esta extensión
añade esa capa.

| | Jugador | DJ |
|---|---|---|
| Ver hojas de PJ de la mesa | Sí | Sí |
| Editar su propia hoja de PJ | Sí | Sí |
| Editar la hoja de otro jugador | No | Sí |
| Ver y editar adversarios | No | Sí |
| Ver y editar entornos | No | Sí |
| Gastar y ganar Miedo | No | Sí |
| Vincular una ficha a un token | Su propio PJ | Cualquiera |
| Jugar una carta al registro | Sus propias cartas | Cualquiera |
| Ver una carta marcada como privada | Solo las suyas | Todas |
| Vaciar el registro | No | Sí |
| Configurar su barra de dados | Sí | Sí |
| Tirar dados al registro | Sí | Sí |

## Fase actual (0.1.0)

Implementado:

- Hojas de PJ: rasgos, nivel, herencia/clase/subclase, evasión, umbrales,
  pistas de Vida / Estrés / Esperanza / Armadura, armas, experiencias, notas.
- Fichas de adversario: tier, rol, dificultad, umbrales, Vida y Estrés,
  ataque estándar, rasgos.
- Fichas de entorno: tier, tipo, dificultad, impulsos, rasgos.
- Reserva de Miedo compartida, editable solo por el DJ.
- Permisos DJ / jugador en toda la interfaz.
- Vinculación de cualquier ficha a un token del mapa, con acceso desde el
  clic derecho del token.
- **Cartas de dominio**: texto de referencia que el jugador escribe. Al pulsar
  el nombre, el texto se publica al registro de la mesa y salta un aviso a
  todos. Cada carta puede marcarse como privada (solo su dueño y el DJ ven el
  texto en la ficha) y como guardada en la bóveda.
- **Rasgos de adversario y entorno** publicables igual que las cartas, para
  narrar lo que hace un enemigo sin teclearlo de nuevo.
- **Registro de la mesa**: pestaña Registro con lo último jugado, quién lo
  jugó y a qué hora. Persiste con la sala; solo el DJ puede vaciarlo.
- **Aviso flotante**: la última tirada o carta jugada aparece 20 segundos en
  la esquina inferior derecha de la pantalla, encima del mapa, para toda la
  mesa — con el color del resultado y sin necesidad de tener el panel
  abierto. Solo se muestra una a la vez: la siguiente sustituye a la
  anterior, y el historial completo está en la pestaña Registro. El recuadro
  se ajusta a su contenido sin pasar del 25% de la altura de la pantalla, y
  se descarta con un clic.
- **Barra de dados**: fila fija abajo con 6 botones que cada jugador
  configura a su gusto (nombre y fórmula tipo 2d12, 1d8+3, 2d6+1d4). Cada
  uno tiene su propia barra y se guarda con la sala.
- **Armas**: cada arma tiene un botón para tirar su daño y una caja de texto
  propia que se publica al registro como una carta, con su alcance y daño
  como contexto.
- **Tirada desde el rasgo**: cada rasgo lleva un botón de dado junto al
  campo. Al pulsarlo se despliega un menú con Normal, Con ventaja y Con
  desventaja, y la tirada sale como 2d12 + rasgo, sumando o restando 1d6
  según la elección.
- **Tiradas de dualidad**: una ranura marcada como dualidad lee el primer
  d12 como Esperanza y el segundo como Miedo, dice quién gana (o si es
  crítico) y ajusta el recurso solo: Esperanza a la hoja de quien tira,
  Miedo a la reserva de la mesa.
- Sincronización en vivo a toda la mesa, persistida con la sala.

Pendiente para fases siguientes: descansos, tiradas lanzadas desde los
rasgos y armas de la hoja, plantillas de adversarios del SRD, y niveles de
visibilidad más finos para entornos.

## Cómo funciona por dentro

- **Dónde se guarda cada cosa.** Los personajes viven en la *room metadata*
  de Owlbear, que se sincroniza a toda la mesa y acompaña a la sala: así
  siguen disponibles cambies de mapa o no haya escena abierta. Los
  adversarios y los entornos se guardan **en la metadata de su propio
  token**, porque la sala entera solo dispone de 16 KB y las hojas de PJ los
  consumen casi por completo. Cada token tiene su propio espacio, así que el
  DJ puede preparar todos los adversarios que quiera sin quitar sitio a
  nadie.
- La contrapartida: una ficha de adversario o entorno **pertenece a la
  escena** donde está su token. No aparece en la lista con otro mapa abierto,
  y crearla exige tener un token seleccionado. Es coherente con su uso: un
  adversario pertenece a un encuentro.
- No hace falta servidor propio ni base de datos: todo son datos de Owlbear.
- Las fichas se vinculan a tokens escribiendo el id de la ficha en la
  metadata del propio token, de modo que el vínculo viaja con la escena.
- Los permisos se aplican en la interfaz y se revalidan antes de cada
  escritura. **Importante:** Owlbear no ofrece permisos de escritura por
  campo — la room metadata es técnicamente escribible por cualquiera en la
  sala. Las reglas de `src/domain/permissions.ts` impiden que un jugador
  edite lo que no le toca durante el uso normal, pero no son una barrera
  de seguridad frente a alguien que manipule la consola del navegador a
  propósito. Para una mesa de amigos es suficiente; no lo es para una mesa
  pública con desconocidos.
- Las ediciones se agrupan con un retardo de 400 ms para no emitir una
  escritura por cada tecla pulsada.

### El límite de 16 KB

Owlbear da a cada **sala** 16 KB de metadata en total, compartidos con
cualquier otra extensión que uséis. Al superarlo, las escrituras fallan y
**nada se guarda** — ni fichas, ni tiradas. Por eso:

- El texto de cartas, armas y rasgos está limitado a 150 caracteres, con
  contador visible en el editor.
- El registro guarda 8 entradas y recorta cada texto a 120 caracteres.
- Los identificadores son de 8 caracteres en vez de UUID: con una ficha por
  carta y arma, los UUID costaban más de 2 KB por sí solos.
- Antes de escribir se mide el tamaño y se descartan entradas antiguas del
  registro si hiciera falta; si aun así se rechaza, salta un aviso en vez de
  fallar en silencio.

Medido: **4 jugadores con 6 cartas cada uno entran**, y los adversarios ya
no cuentan para ese total porque viven en sus tokens. Si vuestra mesa es
mayor, lo que sobra es el registro — vaciarlo libera sitio.

Al abrir una escena, el DJ ve cómo las fichas de adversario guardadas por
versiones anteriores se mueven solas a sus tokens, con un aviso. Las que no
tengan token se quedan donde están hasta que les vincules uno.
- El aviso flotante es un `popover` propio anclado por posición a la
  esquina inferior derecha, con `hidePaper` para que Owlbear no dibuje marco
  y el estilo sea entero nuestro. Es la única vía para pintar sobre el mapa:
  el panel lateral no puede salirse de su iframe.
- El popover **se abre al llegar una entrada y se cierra al expirar**. Dejarlo
  montado permanentemente mantendría un recuadro muerto sobre el tablero
  entre tiradas. Quien decide abrirlo y cerrarlo es el panel, porque una
  página no puede abrir su propio popover antes de existir; la página del
  aviso solo dibuja la última entrada del registro.
- El aviso **se mide a sí mismo y ajusta el alto del marco** a su contenido,
  con un tope del **25% del alto del visor** (mínimo 80 px) para que una
  carta larga no acabe tapando el tablero. El tope sale de
  `OBR.viewport.getHeight()`, no de unidades `vh`: dentro del iframe, `vh`
  mide el propio marco y no la pantalla. Ese mismo valor se publica como
  variable CSS, así que el recorte del texto y el tamaño del marco no pueden
  descuadrarse.
- **Nota sobre el aviso nativo de Owlbear:** `notification.show` solo acepta
  texto plano y cinco variantes fijas, sin color ni negrita, y se dibuja
  fuera de nuestro iframe. Por eso los avisos propios lo sustituyen.

## Desarrollo local

```bash
npm install
npm run dev
```

Vite sirve en `http://localhost:5173`. En Owlbear Rodeo, abre una sala y
añade la extensión con **Add Extension** usando:

```
http://localhost:5173/manifest.json
```

El manifest se genera al vuelo, así que `npm run dev` basta: no hace falta
compilar antes. Los cambios recargan en caliente dentro de OBR.

Abrir `index.html` directamente en el navegador muestra un aviso: la
extensión solo funciona embebida dentro de Owlbear Rodeo.

## Comprobaciones

```bash
npm run typecheck   # TypeScript en modo estricto
npm test            # permisos, cartas, dados y migración (86 pruebas)
npm run build       # build de producción
```

Las reglas de DJ / jugador, la visibilidad de cartas, el parser de dados,
el reparto de Esperanza y Miedo, y la migración de salas antiguas están
cubiertos por pruebas en `src/domain/`, que corren sin Owlbear porque esa
carpeta no depende del SDK. El motor de tiradas recibe su aleatoriedad como
parámetro, así que las pruebas fijan resultados exactos en vez de depender
de la suerte.

## Despliegue en GitHub Pages

Tus jugadores cargan la extensión desde su propio navegador, así que
`localhost` no les sirve: hace falta una URL pública. La extensión es
estática, así que GitHub Pages la sirve gratis.

1. Crea un repo en GitHub y sube esto:

   ```bash
   git init
   git add .
   git commit -m "Daggerheart para Owlbear Rodeo"
   git branch -M main
   git remote add origin https://github.com/<tu-usuario>/<tu-repo>.git
   git push -u origin main
   ```

2. En GitHub: **Settings → Pages → Build and deployment → Source:
   GitHub Actions**.

3. El workflow de `.github/workflows/deploy.yml` construye y publica en
   cada push a `main`, pasando el `VITE_BASE` correcto automáticamente.

4. Da a tus jugadores esta URL para **Add Extension**:

   ```
   https://<tu-usuario>.github.io/<tu-repo>/manifest.json
   ```

Cada jugador la añade una vez en la sala. El DJ ve las cuatro pestañas; los
jugadores ven Personajes y Registro.

## Uso en mesa

- **Panel principal:** icono de Daggerheart en la barra de Owlbear.
- **Crear tu PJ (jugador):** pestaña Personajes → `+ Nueva`. Queda a tu
  nombre y solo tú (y el DJ) podéis editarla.
- **Crear adversarios y entornos (DJ):** selecciona primero un token en el
  mapa y pulsa `+ Nueva` en la pestaña correspondiente. La ficha se guarda
  en ese token, así que vive con la escena.
- **Vincular un PJ a un token:** selecciona el token en el mapa, abre la
  hoja y pulsa `Vincular token`. Requiere una escena abierta. Solo aplica a
  personajes: los adversarios y entornos ya nacen dentro de su token.
- **Abrir la ficha desde el mapa:** clic derecho sobre un token vinculado →
  *Ficha de Daggerheart*.
- **Añadir una carta de dominio:** en tu hoja, apartado Cartas de dominio →
  `+ Añadir`. Escribes nombre, dominio y texto a mano: la extensión no trae
  base de datos de cartas, así que vale igual para el SRD y para material
  propio.
- **Tirar un rasgo:** pulsa el dado junto al rasgo y elige Normal, ventaja o
  desventaja. Sale como tirada de dualidad, así que el resultado también
  ajusta tu Esperanza o el Miedo de la mesa.
- **Tirar daño:** el dado junto al campo Daño de cada arma. No es tirada de
  dualidad, así que no toca Esperanza ni Miedo.
- **Texto de un arma:** escríbelo en su caja y pulsa Enviar para mandarlo al
  registro, igual que una carta.
- **Jugar una carta:** pulsa su nombre. El texto va al registro de la mesa y
  salta un aviso a todos. La flecha despliega el texto sin publicarlo, y el
  lápiz abre la edición — así un toque accidental en combate no reescribe
  nada.
- **Carta privada:** marca *Visible a la mesa* para quitarla. Las demás
  personas verán que tienes una carta privada, pero no su texto; al jugarla,
  el texto se publica igual.
- **Tirar dados:** la fila de abajo. Un toque en un botón tira y publica el
  resultado al registro. Está siempre visible, también con una ficha abierta.
- **Configurar la barra:** botón *Configurar* de la fila. Cada ranura tiene
  nombre y fórmula; se admite `2d12`, `1d8+3`, `d20-1`, `2d6+1d4+2`. Una
  fórmula inválida se marca en rojo y su botón queda deshabilitado en vez de
  tirar algo equivocado.
- **Dualidad:** marca la casilla *Dualidad* en una ranura de dos d12. El
  primero cuenta como Esperanza y el segundo como Miedo; el registro dice
  quién gana y la extensión marca sola +1 Esperanza en tu hoja o +1 Miedo en
  la reserva de la mesa. Ni Esperanza ni Miedo pasan de su máximo.

## Estructura

```
src/
  domain/        Modelo de Daggerheart y reglas de permisos (sin OBR)
  obr/           Capa de Owlbear: estado, hooks, tokens, menú contextual
  components/    Interfaz: editores de ficha, pistas de pips, listas
  App.tsx        Panel principal
  TokenSheet.tsx Ficha embebida en el clic derecho de un token
  ToastStack.tsx Avisos flotantes sobre el mapa
scripts/
  manifest.mjs         El manifest, parametrizado por la URL de hosting
  manifest-plugin.mjs  Lo sirve en dev y lo emite en el build
```

`src/domain/` no importa nada de Owlbear, así que las reglas del juego y
los permisos se pueden razonar y probar sin el SDK.
