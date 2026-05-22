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
    <title>LibreDrop — Recibir</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
    <style>
      :root {
        --bg:       #0b1a10;
        --bg-2:     #0f2016;
        --bg-3:     #142a1a;
        --s1:       rgba(17, 34, 22, 0.92);
        --s2:       rgba(22, 44, 28, 0.97);
        --tx:       #e8f5ec;
        --tx2:      #8db89a;
        --tx3:      #527a5e;
        --bd:       rgba(61, 138, 80, 0.18);
        --bd2:      rgba(61, 138, 80, 0.32);
        --ac:       #3aab5c;
        --ac-glow:  rgba(58, 171, 92, 0.24);
        --r-sm:     8px;
        --r-md:     14px;
        --r-lg:     20px;
        --r-xl:     26px;
        color-scheme: dark;
      }

      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      body {
        font-family: 'DM Sans', system-ui, sans-serif;
        background: var(--bg);
        background-image:
          radial-gradient(ellipse 70% 40% at 50% 0%, rgba(58, 171, 92, 0.1) 0%, transparent 60%),
          radial-gradient(ellipse 40% 30% at 90% 100%, rgba(34, 138, 66, 0.06) 0%, transparent 50%);
        color: var(--tx);
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px 16px;
      }

      .card {
        width: min(480px, 100%);
        display: flex;
        flex-direction: column;
        gap: 0;
        background: var(--s1);
        border: 1px solid var(--bd);
        border-radius: var(--r-xl);
        overflow: hidden;
      }

      /* Header */
      .card-header {
        padding: 24px 24px 20px;
        border-bottom: 1px solid var(--bd);
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .logo-mark {
        width: 38px;
        height: 38px;
        border-radius: 11px;
        background: linear-gradient(135deg, #196b33, #0b3319);
        display: grid;
        place-items: center;
        color: #a8e0b7;
        flex-shrink: 0;
        box-shadow: 0 2px 14px rgba(58, 171, 92, 0.28);
      }

      .header-text h1 {
        font-family: 'Syne', sans-serif;
        font-size: 20px;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--tx);
        line-height: 1;
      }

      .header-text p {
        font-size: 13px;
        color: var(--tx2);
        margin-top: 4px;
        line-height: 1.4;
      }

      .status-badge {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 99px;
        background: rgba(58, 171, 92, 0.1);
        border: 1px solid var(--bd2);
        font-size: 11px;
        font-family: 'DM Mono', monospace;
        color: #6dca87;
        flex-shrink: 0;
      }

      .mobile-switcher {
        display: flex;
        gap: 8px;
        margin: 16px 24px 0;
        padding: 8px;
        border-radius: 18px;
        background: rgba(58, 171, 92, 0.06);
        border: 1px solid var(--bd);
      }

      .mobile-switcher-link {
        flex: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 10px 14px;
        border-radius: 14px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--tx2);
        text-decoration: none;
        font-family: 'DM Mono', monospace;
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .mobile-switcher-link.is-active {
        background: rgba(58, 171, 92, 0.16);
        border-color: var(--bd2);
        color: var(--tx);
      }

      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--ac);
        box-shadow: 0 0 8px var(--ac);
        animation: pulse 2.4s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }

      /* Body */
      .card-body {
        padding: 22px 22px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      /* Endpoint row */
      .endpoint-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        background: var(--s2);
        border: 1px solid var(--bd);
        border-radius: var(--r-md);
      }

      .endpoint-label {
        font-family: 'DM Mono', monospace;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: var(--tx3);
        flex-shrink: 0;
      }

      .endpoint-url {
        font-family: 'DM Mono', monospace;
        font-size: 12px;
        color: var(--ac);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
      }

      /* Drop zone */
      .drop-zone {
        border: 1.5px dashed var(--bd2);
        border-radius: var(--r-lg);
        background: rgba(58, 171, 92, 0.03);
        transition: all 0.15s ease;
        cursor: pointer;
        position: relative;
      }

      .drop-zone.is-over {
        border-color: var(--ac);
        background: rgba(58, 171, 92, 0.08);
      }

      .drop-zone.has-files {
        border-color: var(--bd2);
        border-style: solid;
      }

      .drop-inner {
        padding: 32px 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        text-align: center;
      }

      .drop-icon {
        width: 48px;
        height: 48px;
        border-radius: 14px;
        background: rgba(58, 171, 92, 0.1);
        border: 1px solid var(--bd);
        display: grid;
        place-items: center;
        color: var(--ac);
        margin-bottom: 4px;
      }

      .drop-title {
        font-size: 15px;
        font-weight: 500;
        color: var(--tx);
      }

      .drop-sub {
        font-size: 13px;
        color: var(--tx2);
        margin-bottom: 4px;
      }

      .drop-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: center;
      }

      /* File list inside drop zone */
      .file-list {
        padding: 0 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .file-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        background: var(--s2);
        border: 1px solid var(--bd);
        border-radius: var(--r-sm);
      }

      .file-row svg { color: var(--ac); flex-shrink: 0; }
      .file-row-name { font-size: 13px; color: var(--tx); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
      .file-row-size { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--tx3); flex-shrink: 0; }

      /* Buttons */
      .btn {
        appearance: none;
        border: none;
        border-radius: var(--r-md);
        padding: 10px 16px;
        font-family: 'DM Sans', sans-serif;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        transition: all 0.14s ease;
        white-space: nowrap;
      }

      .btn--ghost {
        background: var(--s2);
        border: 1px solid var(--bd2);
        color: var(--tx2);
        font-size: 13px;
        padding: 8px 14px;
      }

      .btn--ghost:hover {
        background: rgba(58, 171, 92, 0.1);
        border-color: var(--ac);
        color: var(--tx);
      }

      .btn--primary {
        background: var(--ac);
        color: #06200f;
        font-weight: 600;
        width: 100%;
        padding: 14px;
        font-size: 15px;
        border-radius: var(--r-lg);
      }

      .btn--primary:hover {
        filter: brightness(1.08);
        box-shadow: 0 0 22px var(--ac-glow);
      }

      .btn--primary:disabled {
        opacity: 0.38;
        cursor: not-allowed;
        box-shadow: none;
        filter: none;
      }

      /* Hidden file input */
      #upload-input { display: none; }

      /* Progress */
      .progress-wrap {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .progress-track {
        flex: 1;
        height: 4px;
        background: var(--bd);
        border-radius: 99px;
        overflow: hidden;
      }

      #upload-progress-bar {
        display: block;
        height: 100%;
        width: 0%;
        background: var(--ac);
        border-radius: inherit;
        transition: width 120ms linear;
        box-shadow: 0 0 8px rgba(58, 171, 92, 0.6);
      }

      .progress-pct {
        font-family: 'DM Mono', monospace;
        font-size: 12px;
        color: var(--tx2);
        min-width: 38px;
        text-align: right;
      }

      /* Success */
      .toast-success {
        display: none;
        align-items: center;
        gap: 8px;
        padding: 12px 14px;
        border-radius: var(--r-md);
        background: rgba(58, 171, 92, 0.12);
        border: 1px solid rgba(58, 171, 92, 0.3);
        color: #a8e0b7;
        font-size: 14px;
      }

      .toast-success.is-visible { display: flex; }

      /* Note */
      .note {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        font-size: 12px;
        color: var(--tx3);
        line-height: 1.5;
        padding: 10px 14px;
        background: var(--s2);
        border-radius: var(--r-sm);
        border: 1px solid var(--bd);
      }

      .note svg { flex-shrink: 0; margin-top: 1px; }
    </style>
  </head>
  <body>
    <main class="card">

      <header class="card-header">
        <div class="logo-mark">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2L17 6v8l-7 4-7-4V6l7-4Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
            <path d="M10 6v6M7 8l3-2 3 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="header-text">
          <h1>LibreDrop</h1>
          <p>Servidor local en la red</p>
        </div>
        <div class="status-badge">
          <span class="status-dot"></span>
          Activo
        </div>
      </header>

      <nav class="mobile-switcher" aria-label="Cambiar pantalla">
        <a class="mobile-switcher-link is-active" href="${baseUrl}/receive" aria-current="page">Enviar</a>
        <a class="mobile-switcher-link" href="${baseUrl}/send">Recibir</a>
      </nav>

      <div class="card-body">

        <div class="endpoint-row">
          <span class="endpoint-label">Endpoint</span>
          <span class="endpoint-url">${baseUrl}/upload</span>
        </div>

        <div class="drop-zone" id="drop-zone">
          <div class="drop-inner" id="drop-inner">
            <div class="drop-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 4v14M6 10l6-6 6 6M4 20h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <p class="drop-title">Arrastrá archivos aquí</p>
            <p class="drop-sub">o elegí desde el dispositivo</p>
            <div class="drop-actions">
              <button class="btn btn--ghost" id="pick-files-btn" type="button">Archivos</button>
              <button class="btn btn--ghost" id="pick-folder-btn" type="button">Carpeta</button>
            </div>
          </div>
          <div class="file-list" id="file-list"></div>
        </div>

        <input id="upload-input" type="file" name="files" multiple />
        <input id="upload-folder-input" type="file" name="files" multiple webkitdirectory directory style="display:none" />

        <button class="btn btn--primary" id="submit-btn" type="button" disabled>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v10M4 6l4-4 4 4M2 14h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Subir archivos
        </button>

        <div class="progress-wrap" id="progress-wrap" style="display:none">
          <div class="progress-track">
            <span id="upload-progress-bar"></span>
          </div>
          <span class="progress-pct" id="upload-progress-text">0%</span>
        </div>

        <div class="toast-success" id="upload-success">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7l3.5 3.5L12 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Archivos subidos correctamente.
        </div>

        <div class="note">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" stroke-width="1.2"/>
            <path d="M6.5 5.5v4M6.5 3.5v1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          También podés elegir una carpeta completa. Cada archivo se guarda por separado en la desktop.
        </div>

      </div>
    </main>

    <script>
      (function () {
        const dropZone   = document.getElementById('drop-zone');
        const dropInner  = document.getElementById('drop-inner');
        const fileList   = document.getElementById('file-list');
        const input      = document.getElementById('upload-input');
        const folderInput = document.getElementById('upload-folder-input');
        const pickFiles  = document.getElementById('pick-files-btn');
        const pickFolder = document.getElementById('pick-folder-btn');
        const submitBtn  = document.getElementById('submit-btn');
        const progressWrap = document.getElementById('progress-wrap');
        const progressBar  = document.getElementById('upload-progress-bar');
        const progressText = document.getElementById('upload-progress-text');
        const successBox   = document.getElementById('upload-success');

        let selectedFiles = [];

        function formatSize(bytes) {
          if (bytes < 1024) return bytes + ' B';
          if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
          return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        }

        function renderFiles() {
          fileList.innerHTML = '';
          if (selectedFiles.length === 0) {
            dropInner.style.display = '';
            dropZone.classList.remove('has-files');
            submitBtn.disabled = true;
            return;
          }
          dropInner.style.display = 'none';
          dropZone.classList.add('has-files');
          submitBtn.disabled = false;

          selectedFiles.forEach(function (f) {
            const row = document.createElement('div');
            row.className = 'file-row';
            row.innerHTML = [
              '<svg width="14" height="14" viewBox="0 0 14 14" fill="none">',
              '  <path d="M3 2a1 1 0 0 1 1-1h4l3 3v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>',
              '</svg>',
              '<span class="file-row-name">' + f.name + '</span>',
              '<span class="file-row-size">' + formatSize(f.size) + '</span>',
            ].join('');
            fileList.appendChild(row);
          });
        }

        function setFiles(files) {
          selectedFiles = Array.from(files);
          renderFiles();
        }

        pickFiles.addEventListener('click', function () { input.click(); });
        pickFolder.addEventListener('click', function () { folderInput.click(); });

        input.addEventListener('change', function () {
          if (input.files.length) setFiles(input.files);
        });

        folderInput.addEventListener('change', function () {
          if (folderInput.files.length) setFiles(folderInput.files);
        });

        dropZone.addEventListener('dragover', function (e) {
          e.preventDefault();
          dropZone.classList.add('is-over');
        });

        dropZone.addEventListener('dragleave', function () {
          dropZone.classList.remove('is-over');
        });

        dropZone.addEventListener('drop', function (e) {
          e.preventDefault();
          dropZone.classList.remove('is-over');
          if (e.dataTransfer.files.length) setFiles(e.dataTransfer.files);
        });

        function setProgress(percent) {
          const v = Math.max(0, Math.min(100, percent));
          progressBar.style.width = v + '%';
          progressText.textContent = v === 100 ? '100%' : v.toFixed(0) + '%';
        }

        submitBtn.addEventListener('click', function () {
          if (!selectedFiles.length) return;

          successBox.classList.remove('is-visible');
          progressWrap.style.display = 'flex';
          setProgress(0);
          submitBtn.disabled = true;

          const data = new FormData();
          data.append('direction', 'receive');
          selectedFiles.forEach(function (f) {
            data.append('files', f, f.webkitRelativePath || f.name);
          });

          const xhr = new XMLHttpRequest();
          xhr.open('POST', '${baseUrl}/upload');

          xhr.upload.addEventListener('progress', function (e) {
            if (e.lengthComputable) setProgress((e.loaded / e.total) * 100);
          });

          xhr.addEventListener('load', function () {
            if (xhr.status >= 200 && xhr.status < 300) {
              setProgress(100);
              successBox.classList.add('is-visible');
              setTimeout(function () {
                progressWrap.style.display = 'none';
                setProgress(0);
                selectedFiles = [];
                renderFiles();
                submitBtn.disabled = true;
              }, 2000);
            }
          });

          xhr.addEventListener('error', function () {
            progressText.textContent = 'Error al subir';
            submitBtn.disabled = false;
          });

          xhr.send(data);
        });
      })();
    </script>
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
    <title>LibreDrop — Enviar</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
    <style>
      :root {
        --bg:       #0b1a10;
        --bg-2:     #0f2016;
        --s1:       rgba(17, 34, 22, 0.92);
        --s2:       rgba(22, 44, 28, 0.97);
        --tx:       #e8f5ec;
        --tx2:      #8db89a;
        --tx3:      #527a5e;
        --bd:       rgba(61, 138, 80, 0.18);
        --bd2:      rgba(61, 138, 80, 0.32);
        --ac:       #3aab5c;
        --ac-glow:  rgba(58, 171, 92, 0.24);
        --r-sm:     8px;
        --r-md:     14px;
        --r-lg:     20px;
        --r-xl:     26px;
        color-scheme: dark;
      }

      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      body {
        font-family: 'DM Sans', system-ui, sans-serif;
        background: var(--bg);
        background-image:
          radial-gradient(ellipse 70% 40% at 50% 0%, rgba(58, 171, 92, 0.1) 0%, transparent 60%),
          radial-gradient(ellipse 40% 30% at 90% 100%, rgba(34, 138, 66, 0.06) 0%, transparent 50%);
        color: var(--tx);
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px 16px;
      }

      .card {
        width: min(560px, 100%);
        background: var(--s1);
        border: 1px solid var(--bd);
        border-radius: var(--r-xl);
        overflow: hidden;
      }

      /* Header */
      .card-header {
        padding: 20px 22px;
        border-bottom: 1px solid var(--bd);
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .logo-mark {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: linear-gradient(135deg, #196b33, #0b3319);
        display: grid;
        place-items: center;
        color: #a8e0b7;
        flex-shrink: 0;
        box-shadow: 0 2px 14px rgba(58, 171, 92, 0.28);
      }

      .header-text h1 {
        font-family: 'Syne', sans-serif;
        font-size: 18px;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--tx);
        line-height: 1;
      }

      .header-text p {
        font-size: 12px;
        color: var(--tx2);
        margin-top: 3px;
        line-height: 1.4;
      }

      .status-badge {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 5px 10px;
        border-radius: 99px;
        background: rgba(58, 171, 92, 0.1);
        border: 1px solid var(--bd2);
        font-size: 10px;
        font-family: 'DM Mono', monospace;
        color: #6dca87;
        flex-shrink: 0;
      }

      .mobile-switcher {
        display: flex;
        gap: 8px;
        padding: 16px;
        background: rgba(255, 255, 255, 0.02);
        border-bottom: 1px solid var(--border);
      }

      .mobile-switcher-link {
        flex: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 12px 16px;
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: var(--panel);
        color: var(--muted);
        text-decoration: none;
        font-weight: 700;
        letter-spacing: 0.02em;
      }

      .mobile-switcher-link.is-active {
        color: white;
        border-color: rgba(110, 231, 255, 0.28);
        background: linear-gradient(135deg, rgba(110, 231, 255, 0.16), rgba(139, 92, 246, 0.16));
      }

      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--ac);
        box-shadow: 0 0 8px var(--ac);
        animation: pulse 2.4s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }

      /* Body */
      .card-body {
        padding: 20px 22px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      /* Section label */
      .section-label {
        font-family: 'DM Mono', monospace;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        color: var(--tx3);
        margin-bottom: 10px;
      }

      /* Download list */
      .download-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .download-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 13px 16px;
        background: var(--s2);
        border: 1px solid var(--bd);
        border-radius: var(--r-lg);
        transition: border-color 0.14s;
      }

      .download-card:hover {
        border-color: var(--bd2);
      }

      .file-icon {
        width: 34px;
        height: 34px;
        border-radius: 9px;
        background: rgba(58, 171, 92, 0.1);
        border: 1px solid var(--bd);
        display: grid;
        place-items: center;
        color: var(--ac);
        flex-shrink: 0;
      }

      .file-info {
        flex: 1;
        min-width: 0;
      }

      .file-name {
        font-size: 14px;
        font-weight: 500;
        color: var(--tx);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .file-meta {
        font-family: 'DM Mono', monospace;
        font-size: 11px;
        color: var(--tx3);
        margin-top: 2px;
      }

      .download-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border-radius: 99px;
        background: rgba(58, 171, 92, 0.1);
        border: 1px solid var(--bd2);
        color: #6dca87;
        text-decoration: none;
        font-size: 13px;
        font-weight: 500;
        font-family: 'DM Sans', sans-serif;
        transition: all 0.14s ease;
        flex-shrink: 0;
        white-space: nowrap;
      }

      .download-btn:hover {
        background: rgba(58, 171, 92, 0.2);
        border-color: var(--ac);
        color: #a8e0b7;
      }

      /* Empty state */
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 40px 24px;
        background: var(--s2);
        border: 1px solid var(--bd);
        border-radius: var(--r-lg);
        text-align: center;
        color: var(--tx3);
      }

      .empty-state p { font-size: 14px; color: var(--tx2); }
      .empty-state span { font-size: 12px; color: var(--tx3); }

      /* Hint */
      .note {
        display: flex;
        gap: 7px;
        align-items: flex-start;
        font-size: 12px;
        color: var(--tx3);
        line-height: 1.5;
        padding: 9px 12px;
        background: var(--s2);
        border-radius: var(--r-sm);
        border: 1px solid var(--bd);
      }

      .note svg { flex-shrink: 0; margin-top: 1px; }

      @media (max-width: 480px) {
        .download-card { flex-wrap: wrap; }
        .download-btn { width: 100%; justify-content: center; }
      }
    </style>
  </head>
  <body>
    <main class="card">

      <header class="card-header">
        <div class="logo-mark">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L15.5 5.5v7L9 16l-6.5-3.5v-7L9 2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
            <path d="M9 5.5v5M6.5 7L9 5.5l2.5 1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="header-text">
          <h1>LibreDrop</h1>
          <p>Descargá archivos desde el celular</p>
        </div>
        <div class="status-badge">
          <span class="status-dot"></span>
          Activo
        </div>
      </header>

      <nav class="mobile-switcher" aria-label="Cambiar pantalla">
        <a class="mobile-switcher-link" href="${baseUrl}/receive">Recibir</a>
        <a class="mobile-switcher-link is-active" href="${baseUrl}/send" aria-current="page">Enviar</a>
      </nav>

      <div class="card-body">

        <div>
          <p class="section-label">Descargas disponibles</p>
          <div class="download-list">
            ${fileCards}
          </div>
        </div>

        <div class="note">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.2"/>
            <path d="M6 5v3.5M6 3v1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          Si no ves el archivo que buscás, refrescá esta página desde el celular.
        </div>

      </div>
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
