const receiveQrImage = document.getElementById('receive-qr-image');
const sendQrImage = document.getElementById('send-qr-image');
const statusPill = document.getElementById('status-label');
const receiveUrl = document.getElementById('receive-url');
const sendUrl = document.getElementById('send-url');
const filesSummary = document.getElementById('files-summary');
const filesList = document.getElementById('files-list');
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

function setActiveTab(tabName) {
  for (const button of tabButtons) {
    button.classList.toggle('is-active', button.dataset.tab === tabName);
  }

  for (const panel of tabPanels) {
    panel.classList.toggle('is-active', panel.dataset.panel === tabName);
  }
}

function renderFiles(files) {
  const receivedFiles = files.filter((file) => file.direction !== 'send');
  const sentFiles = files.filter((file) => file.direction === 'send');

  if (files.length === 0) {
    filesSummary.textContent = 'Todavía no hay archivos.';
    filesList.innerHTML = '';
    return;
  }

  filesSummary.textContent = `${files.length} archivo${files.length === 1 ? '' : 's'} en total.`;

  const renderFileList = (list, emptyLabel) =>
    list.length
      ? list
          .map(
            (file) => `
              <article class="file-card">
                <div class="file-main">
                  <div class="file-name">${file.originalName}</div>
                  <div class="file-meta">${file.directionLabel} · ${formatBytes(file.size)} · ${formatDate(file.uploadedAt)}</div>
                  <a class="file-link" href="${file.downloadUrl}" target="_blank" rel="noreferrer">Abrir descarga</a>
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
