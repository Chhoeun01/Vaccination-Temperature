const SPREADSHEET_ID = "13s6gsA3mF2m7bJH9dJBGx2hEteGpV51Ok4caxQ8zv3k";
const PHOTO_FOLDER_NAME = "Maxicare Temperature Photos";

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || "{}");
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheets()[0];

  ensureHeaders(sheet);

  const photoUrl = payload.photo ? savePhoto(payload) : "";

  sheet.appendRow([
    new Date(),
    payload.createdAt || "",
    payload.temperature || "",
    payload.status || "",
    payload.unit || "",
    payload.department || "",
    payload.staff || "",
    payload.notes || "",
    photoUrl,
    payload.id || "",
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, photoUrl }))
    .setMimeType(ContentService.MimeType.JSON);
}

function ensureHeaders(sheet) {
  const headers = [
    "Saved At",
    "Reading Time",
    "Temperature C",
    "Status",
    "Storage Unit",
    "Department",
    "Staff",
    "Notes",
    "Photo URL",
    "Record ID",
  ];
  const existingHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeaders = existingHeaders.some(Boolean);

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
}

function savePhoto(payload) {
  const folder = getOrCreateFolder(PHOTO_FOLDER_NAME);
  const base64 = payload.photo.replace(/^data:image\/jpeg;base64,/, "");
  const blob = Utilities.newBlob(
    Utilities.base64Decode(base64),
    "image/jpeg",
    `temperature-${payload.id || Date.now()}.jpg`
  );
  const file = folder.createFile(blob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}
