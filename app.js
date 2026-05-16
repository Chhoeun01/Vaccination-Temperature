const STORAGE_KEY = "maxicare-temperature-records";
const GOOGLE_SHEET_ID = "13s6gsA3mF2m7bJH9dJBGx2hEteGpV51Ok4caxQ8zv3k";
const GOOGLE_SHEET_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxh4WBh6j9mD-AfYAPC0ytk0U2vZSWtqwPmUmxBkk57EQtKF6rX9jK4iqOoKOPhzdIXwg/exec";
const SAFE_MIN = 2;
const SAFE_MAX = 8;

const state = {
  records: loadRecords(),
  stream: null,
  capturedPhoto: "",
  search: "",
};

const els = {
  navButtons: document.querySelectorAll(".nav-button"),
  views: document.querySelectorAll(".view"),
  viewTitle: document.getElementById("viewTitle"),
  cameraFeed: document.getElementById("cameraFeed"),
  photoCanvas: document.getElementById("photoCanvas"),
  photoPreview: document.getElementById("photoPreview"),
  cameraEmpty: document.getElementById("cameraEmpty"),
  startCameraBtn: document.getElementById("startCameraBtn"),
  capturePhotoBtn: document.getElementById("capturePhotoBtn"),
  form: document.getElementById("temperatureForm"),
  temperatureInput: document.getElementById("temperatureInput"),
  unitInput: document.getElementById("unitInput"),
  departmentInput: document.getElementById("departmentInput"),
  staffInput: document.getElementById("staffInput"),
  notesInput: document.getElementById("notesInput"),
  statusLabel: document.getElementById("statusLabel"),
  statusDetail: document.getElementById("statusDetail"),
  totalRecords: document.getElementById("totalRecords"),
  averageTemp: document.getElementById("averageTemp"),
  safeCount: document.getElementById("safeCount"),
  alertCount: document.getElementById("alertCount"),
  chart: document.getElementById("temperatureChart"),
  latestReading: document.getElementById("latestReading"),
  recordsTable: document.getElementById("recordsTable"),
  searchInput: document.getElementById("searchInput"),
  exportBtn: document.getElementById("exportBtn"),
  clearBtn: document.getElementById("clearBtn"),
  toast: document.getElementById("toast"),
};

const viewTitles = {
  captureView: "Capture Temperature",
  dashboardView: "Temperature Dashboard",
  recordsView: "Temperature List",
};

els.navButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

els.startCameraBtn.addEventListener("click", startCamera);
els.capturePhotoBtn.addEventListener("click", capturePhoto);
els.form.addEventListener("submit", saveTemperatureRecord);
els.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value.toLowerCase().trim();
  renderRecords();
});
els.exportBtn.addEventListener("click", exportCsv);
els.clearBtn.addEventListener("click", clearRecords);

render();

function setView(viewId) {
  els.navButtons.forEach((button) => {
    const isActive = button.dataset.view === viewId;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  els.views.forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });

  els.viewTitle.textContent = viewTitles[viewId];
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast("Camera is not available in this browser.");
    return;
  }

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    els.cameraFeed.srcObject = state.stream;
    els.cameraEmpty.style.display = "none";
    els.capturePhotoBtn.disabled = false;
    showToast("Camera started.");
  } catch (error) {
    showToast("Camera permission was blocked or unavailable.");
  }
}

function capturePhoto() {
  const video = els.cameraFeed;
  const canvas = els.photoCanvas;
  const sourceWidth = video.videoWidth || 1280;
  const sourceHeight = video.videoHeight || 960;
  const scale = Math.min(1, 960 / sourceWidth);
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);

  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(video, 0, 0, width, height);
  state.capturedPhoto = canvas.toDataURL("image/jpeg", 0.72);

  els.photoPreview.src = state.capturedPhoto;
  els.photoPreview.style.display = "block";
  showToast("Photo captured.");
}

async function saveTemperatureRecord(event) {
  event.preventDefault();
  const submitButton = els.form.querySelector('button[type="submit"]');

  const temperature = Number(els.temperatureInput.value);
  const record = {
    id: crypto.randomUUID(),
    temperature,
    status: getStatus(temperature).label,
    unit: els.unitInput.value.trim(),
    department: els.departmentInput.value,
    staff: els.staffInput.value.trim(),
    notes: els.notesInput.value.trim(),
    photo: state.capturedPhoto,
    createdAt: new Date().toISOString(),
    sheetId: GOOGLE_SHEET_ID,
  };

  submitButton.disabled = true;
  submitButton.textContent = "Saving...";
  state.records.unshift(record);
  saveRecords();
  els.form.reset();
  state.capturedPhoto = "";
  els.photoPreview.removeAttribute("src");
  els.photoPreview.style.display = "none";
  render();

  try {
    await saveRecordToGoogleSheet(record);
    showToast("Temperature record saved to Google Sheet.");
  } catch (error) {
    showToast(error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Save Temperature Record";
  }
}

function render() {
  renderStatus();
  renderDashboard();
  renderRecords();
}

function renderStatus() {
  const latest = state.records[0];

  if (!latest) {
    els.statusLabel.textContent = "No records yet";
    els.statusDetail.textContent = "Add a temperature reading to begin monitoring.";
    return;
  }

  const status = getStatus(latest.temperature);
  els.statusLabel.textContent = status.label;
  els.statusDetail.textContent = `${formatTemp(latest.temperature)} in ${latest.unit} at ${formatDate(latest.createdAt)}.`;
}

function renderDashboard() {
  const records = state.records;
  const safeRecords = records.filter((record) => getStatus(record.temperature).key === "safe");
  const alertRecords = records.length - safeRecords.length;
  const average = records.length
    ? records.reduce((sum, record) => sum + record.temperature, 0) / records.length
    : null;

  els.totalRecords.textContent = records.length;
  els.averageTemp.textContent = average === null ? "--" : formatTemp(average);
  els.safeCount.textContent = safeRecords.length;
  els.alertCount.textContent = alertRecords;

  renderChart(records.slice(0, 12).reverse());
  renderLatest(records[0]);
}

function renderChart(records) {
  if (!records.length) {
    els.chart.innerHTML = '<div class="latest-empty">No chart data yet.</div>';
    return;
  }

  els.chart.innerHTML = records
    .map((record) => {
      const status = getStatus(record.temperature);
      const height = Math.max(6, Math.min(100, ((record.temperature + 5) / 20) * 100));
      return `
        <div class="bar" title="${escapeHtml(record.unit)} ${formatTemp(record.temperature)}">
          <div class="bar-fill ${status.key}" style="height:${height}%"></div>
          <small>${formatTemp(record.temperature)}</small>
        </div>
      `;
    })
    .join("");
}

function renderLatest(record) {
  if (!record) {
    els.latestReading.className = "latest-empty";
    els.latestReading.textContent = "No temperature has been recorded yet.";
    return;
  }

  const status = getStatus(record.temperature);
  els.latestReading.className = "latest-card";
  els.latestReading.innerHTML = `
    <img src="${record.photo || placeholderImage()}" alt="Latest temperature record photo" />
    <dl>
      <dt>Temperature</dt>
      <dd><strong>${formatTemp(record.temperature)}</strong></dd>
      <dt>Status</dt>
      <dd><span class="status-pill ${status.key}">${status.label}</span></dd>
      <dt>Unit</dt>
      <dd>${escapeHtml(record.unit)}</dd>
      <dt>Department</dt>
      <dd>${escapeHtml(record.department)}</dd>
      <dt>Staff</dt>
      <dd>${escapeHtml(record.staff)}</dd>
      <dt>Date</dt>
      <dd>${formatDate(record.createdAt)}</dd>
      <dt>Notes</dt>
      <dd>${escapeHtml(record.notes || "None")}</dd>
    </dl>
  `;
}

function renderRecords() {
  const filtered = state.records.filter((record) => {
    if (!state.search) return true;
    return [record.unit, record.department, record.staff, record.notes]
      .join(" ")
      .toLowerCase()
      .includes(state.search);
  });

  if (!filtered.length) {
    els.recordsTable.innerHTML = `
      <tr>
        <td class="empty-row" colspan="7">No matching temperature records.</td>
      </tr>
    `;
    return;
  }

  els.recordsTable.innerHTML = filtered
    .map((record) => {
      const status = getStatus(record.temperature);
      return `
        <tr>
          <td>${formatDate(record.createdAt)}</td>
          <td><strong>${formatTemp(record.temperature)}</strong></td>
          <td><span class="status-pill ${status.key}">${status.label}</span></td>
          <td>${escapeHtml(record.unit)}</td>
          <td>${escapeHtml(record.department)}</td>
          <td>${escapeHtml(record.staff)}</td>
          <td><img class="thumb" src="${record.photo || placeholderImage()}" alt="Record photo" /></td>
        </tr>
      `;
    })
    .join("");
}

function exportCsv() {
  if (!state.records.length) {
    showToast("No records to export.");
    return;
  }

  const headers = ["Date", "Temperature C", "Status", "Unit", "Department", "Staff", "Notes"];
  const rows = state.records.map((record) => [
    formatDate(record.createdAt),
    record.temperature,
    getStatus(record.temperature).label,
    record.unit,
    record.department,
    record.staff,
    record.notes,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = `maxicare-temperature-records-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("CSV exported.");
}

function clearRecords() {
  if (!state.records.length) {
    showToast("There are no records to clear.");
    return;
  }

  const confirmed = window.confirm("Clear all saved temperature records on this device?");
  if (!confirmed) return;

  state.records = [];
  saveRecords();
  render();
  showToast("All records cleared.");
}

function getStatus(temperature) {
  if (temperature >= SAFE_MIN && temperature <= SAFE_MAX) {
    return { key: "safe", label: "Safe" };
  }

  return { key: "alert", label: "Out of Range" };
}

function formatTemp(value) {
  return `${Number(value).toFixed(1)}°C`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-KH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (error) {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
}

async function saveRecordToGoogleSheet(record) {
  if (!GOOGLE_SHEET_WEB_APP_URL) {
    throw new Error("Saved locally. Add the Google Apps Script web app URL to sync with Sheets.");
  }

  const payload = {
    id: record.id,
    sheetId: record.sheetId,
    createdAt: record.createdAt,
    temperature: record.temperature,
    status: record.status,
    unit: record.unit,
    department: record.department,
    staff: record.staff,
    notes: record.notes,
    photo: record.photo,
  };

  await fetch(GOOGLE_SHEET_WEB_APP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function placeholderImage() {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='240' viewBox='0 0 320 240'%3E%3Crect width='320' height='240' fill='%23e7edf4'/%3E%3Cpath d='M96 156h128v16H96zM126 68h68l12 22h32v86H82V90h32z' fill='%2395a3b8'/%3E%3Ccircle cx='160' cy='130' r='32' fill='%23f8fafc'/%3E%3Ccircle cx='160' cy='130' r='18' fill='%2395a3b8'/%3E%3C/svg%3E";
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 2600);
}
