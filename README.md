# Human-Readable Transactions

Pega la URL de un token en un explorador de bloques y obtén el mismo reporte que genera la skill
`onchain-trade-report`, pero **generado de forma determinista en el navegador** — sin claves de API y
sin necesidad de un LLM.

El frontend descarga la actividad on-chain del token, **clasifica** cada transacción (emisión / compra /
venta), **identifica las wallets** por su comportamiento (treasury, contrato de mercado, fee wallet,
liquidez, operador, inversores), **deriva el modelo de comisiones** y **renderiza** dos informes que
reusan el mismo design system de la skill:

- **Tipo A — Informe explicativo**: portada, glosario, who's-who de wallets, ficha del activo, un
  _buy_ y un _sell_ trabajados con diagramas de flujo SVG, el modelo de fees, el ledger completo y un
  apéndice técnico.
- **Tipo B — Transacción por transacción**: una tarjeta por transacción con una tabla de movimientos
  donde cada leg interno va etiquetado por rol (Payment in / Fee / Proceeds / Asset / Mint).

## Cómo funciona

1. **Parseo de la URL** (`src/explorer/parseUrl.ts`): extrae la cadena (por el host) y la dirección del
   token. También acepta una dirección `0x…` suelta y un selector de red.
2. **Capa de datos** (`src/explorer/`): interfaz `DataSource` con dos backends, ambos con CORS abierto y
   sin API key:
   - **Blockscout v2** para Ethereum, Arbitrum, Base, Optimism, Polygon, Gnosis y sus testnets.
   - **Routescan (etherscan-compatible) + RPC** para Avalanche C-Chain y Fuji (que no tienen Blockscout).
     Los _legs_ internos de cada trade se reconstruyen decodificando los logs `Transfer` del recibo de
     la transacción con `viem`.
3. **Modelo** (`src/model/build.ts`): convierte unidades con los decimales reales, clasifica por
   dirección del activo, detecta el token de pago, la fee wallet y la liquidez por frecuencia, y deriva
   el porcentaje de fee.
4. **Render** (`src/report/`): rellena las plantillas Tipo A / Tipo B (CSS idéntico al de la skill).

## Uso

```bash
npm install
npm run dev      # abre el servidor de Vite
```

Pega una URL como `https://arbitrum-sepolia.blockscout.com/token/0x…` y pulsa **Generar reporte**.
Desde el visor puedes **descargar el HTML** (archivo autocontenido) o **abrirlo en una pestaña** para
imprimir a PDF (Cmd/Ctrl + P).

## Despliegue (GitHub Pages)

En vivo: **https://miguelschneider.github.io/human-readable-transactions/**

El sitio es estático y se sirve desde la rama `gh-pages` (modo "deploy from branch"). El
`vite.config.ts` aplica `base: "/human-readable-transactions/"` solo en `build` (el `dev` sigue en
la raíz). Para volver a desplegar tras un cambio:

```bash
npm run deploy
```

Esto reconstruye y publica `dist/` en `gh-pages` (con un `.nojekyll`). Pages tarda ~30-60 s en
reconstruir. Si renombras el repo, actualiza `REPO` en `vite.config.ts` y las URLs en
`scripts/deploy.sh`.

## Añadir una cadena

Agrega una fila en `src/explorer/chains.ts` (id, nombre, `backend`, base de Blockscout o API de
Routescan + RPC, base del explorador y los `hosts` que aparecen en las URLs). El parser y la capa de
datos la recogen automáticamente.

## Notas

- Solo lee datos públicos del ledger; nunca firma ni envía transacciones.
- En testnets, los importes y precios son de prueba y no representan valor real (el reporte lo indica).
- La paginación tiene un tope de seguridad; si se alcanza, el reporte avisa de que no se muestran todas
  las transferencias.
