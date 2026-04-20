function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var to = data.to;
  var subject = data.subject;
  var body = data.body;
  
  try {
    MailApp.sendEmail(to, subject, body);
    return ContentService.createTextOutput('Success').setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    return ContentService.createTextOutput('Error: ' + error.toString()).setMimeType(ContentService.MimeType.TEXT);
  }
}
