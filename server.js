const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const multer = require('multer');
const cors = require('cors');

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

function renderHomePage(baseUrl) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>LibreDrop Upload</title>
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
          <form action="${baseUrl}/upload" method="post" enctype="multipart/form-data">
            <input type="file" name="file" required />
            <button type="submit">Subir archivo</button>
          </form>
        </div>
        <div class="hint status-ok">Si llegaste aquí desde el QR, la conexión está funcionando.</div>
      </section>
    </main>
  </body>
</html>`;
}

async function startServer() {
  const app = express();
  const uploadsDir = ensureUploadsDir();
  const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, callback) => {
      const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      callback(null, `${uniquePrefix}-${file.originalname}`);
    },
  });

  const upload = multer({ storage });
  const ip = getLocalIP();

  app.use(cors());
  app.get('/health', (req, res) => {
    res.json({ ok: true });
  });

  app.get('/', (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.type('html').send(renderHomePage(baseUrl));
  });

  app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'missing_file' });
      return;
    }

    console.log(`Archivo recibido: ${req.file.originalname}`);

    res.json({
      success: true,
      filename: req.file.originalname,
      storedAs: req.file.filename,
    });
  });

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '0.0.0.0', () => resolve(instance));
  });

  const port = server.address().port;
  const uploadUrl = `http://${ip}:${port}/upload`;
  const baseUrl = `http://${ip}:${port}`;

  return {
    ip,
    port,
    baseUrl,
    uploadUrl,
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
