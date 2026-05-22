const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const QRCode = require('qrcode');

function getLocalIP() {
  const interfaces = os.networkInterfaces();

  for (const interfaceName of Object.keys(interfaces)) {
    const entries = interfaces[interfaceName] || [];

    for (const entry of entries) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }

  return '127.0.0.1';
}

function ensureUploadsDir() {
  const uploadsDir = path.join(__dirname, 'uploads');

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  return uploadsDir;
}

function getManifestPath() {
  return path.join(ensureUploadsDir(), 'files.json');
}

function loadFileIndex() {
  const manifestPath = getManifestPath();

  if (!fs.existsSync(manifestPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(manifestPath, 'utf8');
    const parsed = JSON.parse(content);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Unable to read manifest, starting with an empty file list.', error);
    return [];
  }
}

function saveFileIndex(files) {
  fs.writeFileSync(getManifestPath(), JSON.stringify(files, null, 2), 'utf8');
}

function formatBytes(bytes) {
  if (!bytes) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function sanitizeOriginalName(name) {
  return name.replace(/[\\/]/g, '_');
}

function createFileRecord(file, direction) {
  return {
    id: crypto.randomUUID(),
    originalName: file.originalname,
    storedName: file.filename,
    size: file.size,
    mimetype: file.mimetype,
    uploadedAt: new Date().toISOString(),
    direction,
  };
}

function getDownloadUrl(baseUrl, fileId) {
  return `${baseUrl}/download/${encodeURIComponent(fileId)}`;
}

function renderReceivePage(baseUrl) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>LibreDrop - Recibir</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #08111f;
        --panel: #101a31;
        --panel-2: #17213b;
        --text: #f3f7ff;
        --muted: #9aa8c7;
        --accent: #6ee7ff;
        --accent-2: #8b5cf6;
        --border: rgba(255, 255, 255, 0.08);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background:
          radial-gradient(circle at top, rgba(110, 231, 255, 0.15), transparent 25%),
          radial-gradient(circle at bottom right, rgba(139, 92, 246, 0.16), transparent 30%),
          var(--bg);
        color: var(--text);
        padding: 24px;
      }
      .card {
        width: min(560px, 100%);
        background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
        border: 1px solid var(--border);
        border-radius: 24px;
        box-shadow: 0 32px 80px rgba(0, 0, 0, 0.35);
        overflow: hidden;
      }
      .hero {
        padding: 24px 24px 18px;
        background: linear-gradient(135deg, rgba(110, 231, 255, 0.12), rgba(139, 92, 246, 0.12));
        border-bottom: 1px solid var(--border);
      }
      h1 {
        margin: 0 0 8px;
        font-size: 30px;
        letter-spacing: -0.03em;
      }
      p {
        margin: 0;
        color: var(--muted);
        line-height: 1.5;
      }
      .content {
        padding: 24px;
        display: grid;
        gap: 18px;
      }
      .box {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 16px;
      }
      .label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--muted);
        margin-bottom: 8px;
      }
      code {
        display: block;
        padding: 14px;
        border-radius: 14px;
        background: var(--panel-2);
        color: var(--accent);
        word-break: break-all;
      }
      form {
        display: grid;
        gap: 12px;
      }
      input[type='file'] {
        width: 100%;
        color: var(--muted);
      }
      .progress-shell {
        display: grid;
        gap: 8px;
      }
      .progress-bar {
        width: 100%;
        height: 12px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid var(--border);
      }
      .progress-bar > span {
        display: block;
        width: 0%;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        transition: width 120ms linear;
      }
      .progress-text {
        color: var(--muted);
        font-size: 14px;
      }
      .success-box {
        display: none;
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(126, 241, 178, 0.12);
        border: 1px solid rgba(126, 241, 178, 0.24);
        color: #bff8d9;
        font-size: 14px;
      }
      .success-box.is-visible {
        display: block;
      }
      button {
        appearance: none;
        border: 0;
        border-radius: 14px;
        padding: 14px 18px;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        color: white;
        font-weight: 700;
        cursor: pointer;
      }
      button:hover { filter: brightness(1.05); }
      .hint { font-size: 14px; color: var(--muted); }
      .status-ok { color: #7ef1b2; }
      .files-note {
        font-size: 13px;
        color: var(--muted);
        margin-top: 8px;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <section class="hero">
        <h1>LibreDrop</h1>
        <p>Servidor local listo para recibir archivos en la misma red.</p>
      </section>
      <section class="content">
        <div class="box">
          <div class="label">Endpoint</div>
          <code>${baseUrl}/upload</code>
        </div>
        <div class="box">
          <div class="label">Prueba rápida</div>
          <form id="upload-form" action="${baseUrl}/upload" method="post" enctype="multipart/form-data">
            <input type="hidden" name="direction" value="receive" />
            <input id="upload-input" type="file" name="files" multiple webkitdirectory directory required />
            <button type="submit">Subir archivo</button>
          </form>
          <div class="progress-shell">
            <div class="progress-bar" aria-hidden="true"><span id="upload-progress-bar"></span></div>
            <div id="upload-progress-text" class="progress-text">0%</div>
          </div>
          <div id="upload-success" class="success-box">Archivos subidos correctamente.</div>
          <div class="files-note">También podés elegir una carpeta completa desde esta página. Cada archivo se guarda por separado.</div>
        </div>
        <div class="hint status-ok">Si llegaste aquí desde el QR, la conexión está funcionando.</div>
      </section>
      <script>
        (function () {
          const form = document.getElementById('upload-form');
          const input = document.getElementById('upload-input');
          const progressBar = document.getElementById('upload-progress-bar');
          const progressText = document.getElementById('upload-progress-text');
          const successBox = document.getElementById('upload-success');

          function setProgress(percent) {
            const value = Math.max(0, Math.min(100, percent));
            progressBar.style.width = value + '%';
            progressText.textContent = value === 100 ? '100%' : value.toFixed(0) + '%';
          }

          form.addEventListener('submit', function (event) {
            event.preventDefault();
            successBox.classList.remove('is-visible');

            if (!input.files || input.files.length === 0) {
              return;
            }

            const data = new FormData();
            data.append('direction', 'receive');
            Array.from(input.files).forEach(function (file) {
              data.append('files', file, file.webkitRelativePath || file.name);
            });

            const xhr = new XMLHttpRequest();
            xhr.open('POST', '${baseUrl}/upload');

            xhr.upload.addEventListener('progress', function (event) {
              if (event.lengthComputable) {
                setProgress((event.loaded / event.total) * 100);
              }
            });

            xhr.addEventListener('load', function () {
              if (xhr.status >= 200 && xhr.status < 300) {
                setProgress(100);
                successBox.classList.add('is-visible');
                setTimeout(function () {
                  setProgress(0);
                }, 1200);
              }
            });

            xhr.addEventListener('error', function () {
              progressText.textContent = 'Error al subir';
            });

            xhr.send(data);
          });
        })();
      </script>
    </main>
  </body>
</html>`;
}

function renderSendPage(baseUrl, files) {
  const sendFiles = files.filter((file) => file.direction === 'send');
  const fileCards = sendFiles.length
    ? sendFiles
        .map(
          (file) => `
            <article class="download-card">
              <div>
                <div class="download-name">${file.originalName}</div>
                <div class="download-meta">${formatBytes(file.size)} · ${new Date(file.uploadedAt).toLocaleString('es-AR')}</div>
              </div>
              <a class="download-button" href="${getDownloadUrl(baseUrl, file.id)}">Descargar</a>
            </article>
          `
        )
        .join('')
    : '<div class="empty-state">Todavía no hay archivos disponibles para descargar.</div>';

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>LibreDrop - Enviar</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #08111f;
        --panel: #101a31;
        --panel-2: #17213b;
        --text: #f3f7ff;
        --muted: #9aa8c7;
        --accent: #6ee7ff;
        --accent-2: #8b5cf6;
        --border: rgba(255, 255, 255, 0.08);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background:
          radial-gradient(circle at top, rgba(110, 231, 255, 0.15), transparent 25%),
          radial-gradient(circle at bottom right, rgba(139, 92, 246, 0.16), transparent 30%),
          var(--bg);
        color: var(--text);
        padding: 24px;
      }
      .card {
        width: min(680px, 100%);
        background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
        border: 1px solid var(--border);
        border-radius: 24px;
        box-shadow: 0 32px 80px rgba(0, 0, 0, 0.35);
        overflow: hidden;
      }
      .hero {
        padding: 24px 24px 18px;
        background: linear-gradient(135deg, rgba(110, 231, 255, 0.12), rgba(139, 92, 246, 0.12));
        border-bottom: 1px solid var(--border);
      }
      h1 {
        margin: 0 0 8px;
        font-size: 30px;
        letter-spacing: -0.03em;
      }
      p {
        margin: 0;
        color: var(--muted);
        line-height: 1.5;
      }
      .content {
        padding: 24px;
        display: grid;
        gap: 16px;
      }
      .box {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 16px;
      }
      .label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--muted);
        margin-bottom: 8px;
      }
      .download-list {
        display: grid;
        gap: 12px;
      }
      .download-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        border-radius: 16px;
        background: var(--panel-2);
        border: 1px solid var(--border);
      }
      .download-name {
        font-weight: 800;
        word-break: break-word;
      }
      .download-meta {
        margin-top: 4px;
        color: var(--muted);
        font-size: 13px;
      }
      .download-button {
        appearance: none;
        border: 0;
        border-radius: 14px;
        padding: 12px 16px;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        color: white;
        font-weight: 700;
        text-decoration: none;
        white-space: nowrap;
      }
      .empty-state {
        padding: 16px;
        color: var(--muted);
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 16px;
      }
      .hint { font-size: 14px; color: var(--muted); }
      @media (max-width: 640px) {
        .download-card {
          flex-direction: column;
          align-items: stretch;
        }
      }
    </style>
  </head>
  <body>
    <main class="card">
      <section class="hero">
        <h1>LibreDrop</h1>
        <p>Escaneá este QR para descargar archivos desde el celular.</p>
      </section>
      <section class="content">
        <div class="box">
          <div class="label">Descargas disponibles</div>
          <div class="download-list">
            ${fileCards}
          </div>
        </div>
        <div class="hint">Si no ves el archivo que buscás, refrescá esta página desde el celular.</div>
      </section>
    </main>
  </body>
</html>`;
}

async function startServer() {
  const app = express();
  const uploadsDir = ensureUploadsDir();
  const fileIndex = loadFileIndex();
  const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, callback) => {
      const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      callback(null, `${uniquePrefix}-${sanitizeOriginalName(file.originalname)}`);
    },
  });

  const upload = multer({ storage });
  const ip = getLocalIP();
  const baseUrlForFiles = () => `http://${ip}:${server.address().port}`;

  app.use(cors());
  app.get('/health', (req, res) => {
    res.json({ ok: true });
  });

  app.get('/', (req, res) => {
    res.redirect('/receive');
  });

  app.get('/receive', (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.type('html').send(renderReceivePage(baseUrl));
  });

  app.get('/send', (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.type('html').send(renderSendPage(baseUrl, fileIndex));
  });

  app.get('/api/files', async (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const files = await Promise.all(
      fileIndex.map(async (file) => {
        const downloadUrl = getDownloadUrl(baseUrl, file.id);

        return {
          ...file,
          downloadUrl,
          directionLabel: file.direction === 'send' ? 'Enviado' : 'Recibido',
          downloadQrDataUrl: await QRCode.toDataURL(downloadUrl, {
            margin: 1,
            width: 220,
            errorCorrectionLevel: 'M',
          }),
          sizeLabel: formatBytes(file.size),
        };
      })
    );

    res.json({ files });
  });

  app.get('/download/:id', (req, res) => {
    const file = fileIndex.find((entry) => entry.id === req.params.id);

    if (!file) {
      res.status(404).send('Archivo no encontrado');
      return;
    }

    const filePath = path.join(uploadsDir, file.storedName);

    if (!fs.existsSync(filePath)) {
      res.status(404).send('El archivo ya no existe en el disco');
      return;
    }

    res.download(filePath, file.originalName);
  });

  app.post('/upload', upload.any(), (req, res) => {
    const receivedFiles = req.files || [];
    const direction = req.body && req.body.direction === 'receive' ? 'receive' : 'send';

    if (receivedFiles.length === 0) {
      res.status(400).json({ success: false, error: 'missing_file' });
      return;
    }

    const newRecords = receivedFiles.map((file) => createFileRecord(file, direction));
    fileIndex.push(...newRecords);
    saveFileIndex(fileIndex);

    for (const file of receivedFiles) {
      console.log(`Archivo recibido: ${file.originalname}`);
    }

    res.json({
      success: true,
      received: newRecords.map((file) => ({
        id: file.id,
        originalName: file.originalName,
        size: file.size,
        direction: file.direction,
      })),
    });
  });

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '0.0.0.0', () => resolve(instance));
  });

  const port = server.address().port;
  const baseUrl = `http://${ip}:${port}`;
  const receiveUrl = `${baseUrl}/receive`;
  const sendUrl = `${baseUrl}/send`;

  return {
    ip,
    port,
    baseUrl,
    receiveUrl,
    sendUrl,
    filesApiUrl: `${baseUrl}/api/files`,
    stop: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
  };
}

module.exports = {
  startServer,
  getLocalIP,
};
