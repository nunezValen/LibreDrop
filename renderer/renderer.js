const receiveQrImage = document.getElementById('receive-qr-image');
const sendQrImage = document.getElementById('send-qr-image');
const statusPill = document.getElementById('status-label');
const receiveUrl = document.getElementById('receive-url');
const sendUrl = document.getElementById('send-url');
const filesSummary = document.getElementById('files-summary');
const filesList = document.getElementById('files-list');
const filesEmpty = document.getElementById('files-empty');
const filePreviewPanel = document.getElementById('file-preview-panel');
const filePreviewTitle = document.getElementById('file-preview-title');
const filePreviewBadge = document.getElementById('file-preview-badge');
const filePreviewMedia = document.getElementById('file-preview-media');
const filePreviewMeta = document.getElementById('file-preview-meta');
const filePreviewActions = document.getElementById('file-preview-actions');
const desktopUploadForm = document.getElementById('desktop-upload-form');
const desktopUploadFilesInput = document.getElementById('desktop-upload-files-input');
const desktopUploadFolderInput = document.getElementById('desktop-upload-folder-input');
const pickFilesButton = document.getElementById('pick-files-button');
const pickFolderButton = document.getElementById('pick-folder-button');
const desktopUploadProgressBar = document.getElementById('desktop-upload-progress-bar');
const desktopUploadProgressText = document.getElementById('desktop-upload-progress-text');
const desktopUploadSuccess = document.getElementById('desktop-upload-success');
const tabButtons = Array.from(document.querySelectorAll('.nav-item'));
const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));

let currentBaseUrl = null;
let refreshTimer = null;
let currentFiles = [];
let selectedFileId = null;

function formatDate(value) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
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

function getFileKind(file) {
  if (file.mimetype?.startsWith('image/')) return 'image';
  if (file.mimetype?.startsWith('video/')) return 'video';
  if (file.mimetype?.startsWith('audio/')) return 'audio';
  if (file.mimetype === 'application/pdf') return 'pdf';
  if (file.mimetype?.startsWith('text/')) return 'text';
  return 'file';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getPreviewMarkup(file) {
  const kind = getFileKind(file);

  if (kind === 'image') {
    return `<img src="${file.downloadUrl}" alt="Vista previa de ${escapeHtml(file.originalName)}" />`;
  }

  if (kind === 'video') {
    return `<video controls src="${file.downloadUrl}"></video>`;
  }

  if (kind === 'audio') {
    return `<audio controls src="${file.downloadUrl}"></audio>`;
  }

  if (kind === 'pdf') {
    return `<iframe title="Vista previa de ${escapeHtml(file.originalName)}" src="${file.downloadUrl}" loading="lazy"></iframe>`;
  }

  return `
    <div class="files-preview-placeholder">
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none"><path d="M12 14a4 4 0 0 1 4-4h14l8 8h6a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V14Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M22 32l5-6 6 7 4-4 5 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="21" cy="22" r="2" fill="currentColor"/></svg>
      <p>No hay vista previa automática para este tipo de archivo.</p>
    </div>
  `;
}

function setSelectedFile(fileId) {
  selectedFileId = fileId;
  renderFiles(currentFiles);
}

function renderPreview(file) {
  if (!file) {
    filePreviewTitle.textContent = 'Elegí un archivo';
    filePreviewBadge.textContent = '—';
    filePreviewMedia.innerHTML = `
      <div class="files-preview-placeholder">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none"><path d="M12 14a4 4 0 0 1 4-4h14l8 8h6a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V14Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M22 32l5-6 6 7 4-4 5 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="21" cy="22" r="2" fill="currentColor"/></svg>
        <p>Seleccioná un archivo para verlo acá.</p>
      </div>
    `;
    filePreviewMeta.innerHTML = '';
    filePreviewActions.innerHTML = '';
    return;
  }

  const kind = getFileKind(file);

  filePreviewTitle.textContent = file.originalName;
  filePreviewBadge.textContent = kind === 'file' ? file.directionLabel : kind;
  filePreviewMedia.innerHTML = getPreviewMarkup(file);
  filePreviewMeta.innerHTML = `
    <div class="preview-meta-row">
      <span class="preview-meta-label">Tipo</span>
      <span class="preview-meta-value">${escapeHtml(file.mimetype || 'desconocido')}</span>
    </div>
    <div class="preview-meta-row">
      <span class="preview-meta-label">Tamaño</span>
      <span class="preview-meta-value">${formatBytes(file.size)}</span>
    </div>
    <div class="preview-meta-row">
      <span class="preview-meta-label">Recibido</span>
      <span class="preview-meta-value">${formatDate(file.uploadedAt)}</span>
    </div>
  `;
  filePreviewActions.innerHTML = `
    <a class="preview-action" href="${file.downloadUrl}" target="_blank" rel="noreferrer">Abrir descarga</a>
  `;
}

function setActiveTab(tabName) {
  for (const button of tabButtons) {
    button.classList.toggle('is-active', button.dataset.tab === tabName);
  }

  for (const panel of tabPanels) {
    panel.classList.toggle('is-active', panel.dataset.panel === tabName);
  }
}

function renderFiles(files) {
  currentFiles = files;
  const receivedFiles = files.filter((file) => file.direction !== 'send');
  const sentFiles = files.filter((file) => file.direction === 'send');

  if (files.length === 0) {
    filesSummary.textContent = 'Todavía no hay archivos.';
    filesList.innerHTML = '';
    filesEmpty.style.display = 'flex';
    if (filePreviewPanel) {
      filePreviewPanel.hidden = true;
    }
    renderPreview(null);
    return;
  }

  filesSummary.textContent = `${files.length} archivo${files.length === 1 ? '' : 's'} en total.`;
  filesEmpty.style.display = 'none';
  if (filePreviewPanel) {
    filePreviewPanel.hidden = false;
  }

  const previewCandidates = receivedFiles.length > 0 ? receivedFiles : files;
  if (!selectedFileId || !files.some((file) => file.id === selectedFileId)) {
    selectedFileId = previewCandidates[0]?.id || null;
  }

  const activeFile = files.find((file) => file.id === selectedFileId) || previewCandidates[0] || null;
  renderPreview(activeFile);

  const renderFileList = (list, emptyLabel) =>
    list.length
      ? list
          .map(
            (file) => `
              <article class="file-card ${file.id === selectedFileId ? 'is-active' : ''}" data-file-id="${file.id}" role="button" tabindex="0">
                <div class="file-preview-thumb">
                  ${
                    getFileKind(file) === 'image'
                      ? `<img src="${file.downloadUrl}" alt="Miniatura de ${escapeHtml(file.originalName)}" />`
                      : `<svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M7 4.5A2.5 2.5 0 0 1 9.5 2h6L22 8.5V21.5A2.5 2.5 0 0 1 19.5 24h-10A2.5 2.5 0 0 1 7 21.5v-17Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M15.5 2V8.5H22" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`
                  }
                </div>
                <div class="file-info">
                  <div class="file-name">${file.originalName}</div>
                  <div class="file-meta">${file.directionLabel} · ${formatBytes(file.size)} · ${formatDate(file.uploadedAt)}</div>
                </div>
                <div class="file-actions">
                  <a class="file-link" href="${file.downloadUrl}" target="_blank" rel="noreferrer">Abrir</a>
                </div>
              </article>
            `
          )
          .join('')
      : `<div class="empty-state">${emptyLabel}</div>`;

  filesList.innerHTML = `
    <section class="files-group">
      <div class="files-group-title">Recibidos</div>
      ${renderFileList(receivedFiles, 'Todavía no hay archivos recibidos.')}
    </section>
    <section class="files-group">
      <div class="files-group-title">Enviados</div>
      ${renderFileList(sentFiles, 'Todavía no hay archivos enviados.')}
    </section>
  `;

  filesList.querySelectorAll('.file-card').forEach((card) => {
    const fileId = card.dataset.fileId;
    card.addEventListener('click', () => setSelectedFile(fileId));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setSelectedFile(fileId);
      }
    });
  });
}

function setDesktopUploadProgress(percent) {
  const value = Math.max(0, Math.min(100, percent));
  desktopUploadProgressBar.style.width = `${value}%`;
  desktopUploadProgressText.textContent = value === 100 ? '100%' : `${value.toFixed(0)}%`;
}

function uploadDesktopFiles(files, sourceInput) {
  if (!currentBaseUrl || !files || files.length === 0) {
    return;
  }

  desktopUploadSuccess.classList.remove('is-visible');
  setDesktopUploadProgress(0);

  const formData = new FormData();
  Array.from(files).forEach((file) => {
    formData.append('files', file, file.webkitRelativePath || file.name);
  });

  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${currentBaseUrl}/upload`);

  xhr.upload.addEventListener('progress', (event) => {
    if (event.lengthComputable) {
      setDesktopUploadProgress((event.loaded / event.total) * 100);
    }
  });

  xhr.addEventListener('load', async () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      setDesktopUploadProgress(100);
      desktopUploadSuccess.classList.add('is-visible');
      await refreshFiles();
      setTimeout(() => setDesktopUploadProgress(0), 1200);
      if (sourceInput) {
        sourceInput.value = '';
      }
    } else {
      desktopUploadProgressText.textContent = 'Error al subir';
    }
  });

  xhr.addEventListener('error', () => {
    desktopUploadProgressText.textContent = 'Error al subir';
  });

  xhr.send(formData);
}

async function refreshFiles() {
  if (!currentBaseUrl) {
    return;
  }

  try {
    const response = await fetch(`${currentBaseUrl}/api/files`);
    const data = await response.json();
    renderFiles(data.files || []);
  } catch (error) {
    filesSummary.textContent = 'No se pudo cargar la lista de archivos.';
    filesList.innerHTML = '';
    console.error(error);
  }
}

function startPolling() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  refreshTimer = setInterval(refreshFiles, 5000);
}

for (const button of tabButtons) {
  if (button) button.addEventListener('click', () => setActiveTab(button.dataset.tab));
}

pickFilesButton.addEventListener('click', () => desktopUploadFilesInput.click());
pickFolderButton.addEventListener('click', () => desktopUploadFolderInput.click());

desktopUploadFilesInput.addEventListener('change', () => {
  uploadDesktopFiles(desktopUploadFilesInput.files, desktopUploadFilesInput);
});

desktopUploadFolderInput.addEventListener('change', () => {
  uploadDesktopFiles(desktopUploadFolderInput.files, desktopUploadFolderInput);
});

if (desktopUploadForm) {
  desktopUploadForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const selectedFiles = desktopUploadFilesInput.files.length > 0 ? desktopUploadFilesInput.files : desktopUploadFolderInput.files;
    const sourceInput = desktopUploadFilesInput.files.length > 0 ? desktopUploadFilesInput : desktopUploadFolderInput;
    uploadDesktopFiles(selectedFiles, sourceInput);
  });
}

window.libredrop.onServerState((state) => {
  currentBaseUrl = state.baseUrl;
  receiveQrImage.src = state.receiveQrCodeDataUrl;
  sendQrImage.src = state.sendQrCodeDataUrl;
  statusPill.textContent = 'Servidor listo';
  receiveUrl.textContent = state.receiveUrl;
  sendUrl.textContent = state.sendUrl;
  refreshFiles();
  startPolling();
});
