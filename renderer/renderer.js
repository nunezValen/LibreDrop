const qrImage = document.getElementById('qr-image');
const statusPill = document.getElementById('status-pill');
const ipValue = document.getElementById('ip-value');
const portValue = document.getElementById('port-value');
const serverUrl = document.getElementById('server-url');
const uploadUrl = document.getElementById('upload-url');

window.libredrop.onServerState((state) => {
  qrImage.src = state.qrCodeDataUrl;
  statusPill.textContent = 'Servidor listo';
  ipValue.textContent = state.ip;
  portValue.textContent = String(state.port);
  serverUrl.textContent = state.baseUrl;
  uploadUrl.textContent = state.qrUrl;
});
