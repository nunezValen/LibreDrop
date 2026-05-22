# LibreDrop

LibreDrop es una alternativa tipo AirDrop pensada para entornos que no dependen de macOS.

## MVP

Empezar con una sola cosa:

> mandar un archivo desde PC a celular por WiFi local.

Nada más. Si eso funciona sólido, después se agregan más capacidades.

## Arquitectura mínima

### Desktop app

La PC:

- muestra un QR
- levanta un servidor HTTP local
- espera conexiones

### Mobile app

El celular:

- escanea el QR
- obtiene IP y puerto
- sube o descarga archivos

## Stack recomendado

### Desktop

- Electron
- Node.js
- Express

### Mobile

- Flutter

Flutter es una buena opción para:

- escaneo de QR
- manejo de archivos
- networking
- soporte futuro para Android e iOS

## Paso 1: Desktop app

Crear el proyecto:

```bash
mkdir fluxdrop
cd fluxdrop

npm init -y
npm install electron express qrcode multer cors
```

Estructura inicial:

```txt
fluxdrop/
├── main.js
├── preload.js
├── server.js
├── renderer/
│   └── index.html
```

## Paso 2: Servidor local

El servidor puede empezar con una ruta simple de upload usando `multer` y `express`.

## Paso 3: Obtener IP local

La app de escritorio necesita detectar una IP local válida para construir el QR.

## Paso 4: Generar QR

El QR puede contener un JSON con:

```json
{
	"ip": "192.168.0.15",
	"port": 3000
}
```

## Paso 5: UI de Electron

La ventana de Electron solo necesita mostrar el QR y el estado del servidor.

## Paso 6: App Flutter

La app móvil puede:

- escanear el QR con `mobile_scanner`
- elegir un archivo con `file_picker`
- subirlo con `dio`

## Etapas después del MVP

### Etapa 2

- barra de progreso
- drag and drop
- previews

### Etapa 3

- descubrimiento automático con mDNS o Zeroconf
- dispositivos visibles sin QR

### Etapa 4

- transferencias bidireccionales

## Regla de alcance

No arrancar con:

- cifrado
- cuentas
- relay servers
- nube
- WebRTC
- peer to peer complejo

Primero hay que lograr una sola meta:

> que el archivo llegue.

## Cómo correr el MVP

```bash
npm install
npm start
```

Al abrirse la ventana de Electron, vas a ver el QR y la IP local. El QR apunta al servidor HTTP local, que también expone una página simple de subida en `/` y el endpoint de upload en `/upload`.