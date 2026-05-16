# Connect The App To Google Sheets

Spreadsheet:
https://docs.google.com/spreadsheets/d/13s6gsA3mF2m7bJH9dJBGx2hEteGpV51Ok4caxQ8zv3k/edit?gid=0#gid=0

## 1. Add the Apps Script

1. Open the spreadsheet.
2. Go to `Extensions` > `Apps Script`.
3. Replace the code with the contents of `google-apps-script.gs`.
4. Save the project.

## 2. Deploy as a web app

1. Click `Deploy` > `New deployment`.
2. Choose type: `Web app`.
3. Set `Execute as` to `Me`.
4. Set `Who has access` to `Anyone`.
5. Click `Deploy`.
6. Copy the Web app URL.

## 3. Paste the URL into the app

Open `app.js` and replace:

```js
const GOOGLE_SHEET_WEB_APP_URL = "";
```

with:

```js
const GOOGLE_SHEET_WEB_APP_URL = "YOUR_WEB_APP_URL_HERE";
```

After that, each submitted temperature record saves locally and also appends to the Google Sheet.
Photos are saved to a Google Drive folder named `Maxicare Temperature Photos`, and the sheet stores the photo link.
