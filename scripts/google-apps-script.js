/**
 * Sunnylink Toggle Wiki - Google Apps Script
 * 
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Sheet
 * 2. Go to Extensions > Apps Script
 * 3. Paste this code and save
 * 4. Click Deploy > New Deployment
 * 5. Select "Web app" as the type
 * 6. Set "Execute as" to "Me"
 * 7. Set "Who has access" to "Anyone"
 * 8. Click Deploy and copy the Web App URL
 * 9. Add the URL to your .env.local file as NEXT_PUBLIC_GOOGLE_SCRIPT_URL
 */

function doPost(e) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
        const data = JSON.parse(e.postData.contents);

        // Add headers if sheet is empty
        if (sheet.getLastRow() === 0) {
            sheet.appendRow([
                'Timestamp',
                'Setting Key',
                'Setting Label',
                'Feedback Type',
                'Comment',
                'User Agent'
            ]);
        }

        // Append the feedback data
        sheet.appendRow([
            data.timestamp || new Date().toISOString(),
            data.settingKey || '',
            data.settingLabel || '',
            data.feedbackType || '',
            data.comment || '',
            data.userAgent || ''
        ]);

        return ContentService
            .createTextOutput(JSON.stringify({ success: true }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService
            .createTextOutput(JSON.stringify({ success: false, error: error.message }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

function doGet(e) {
    return ContentService
        .createTextOutput('Sunnylink Feedback API is running')
        .setMimeType(ContentService.MimeType.TEXT);
}
