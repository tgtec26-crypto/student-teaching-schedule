/**
 * 참관 신청 결과 이메일 발송 API (웹 앱)
 */
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const { email, name, date, period, subject, teacher, status } = params;
    
    const statusText = status === 'APPROVED' ? '승인' : '거부';
    const statusSymbol = status === 'APPROVED' ? '✅' : '❌';
    
    const emailSubject = `[참관 신청 결과] ${name} 실습생님의 신청이 ${statusText}되었습니다.`;
    
    const body = `
안녕하세요, ${name} 실습생님.

서울사대부여중 참관 신청 시스템입니다.
요청하신 참관 신청에 대한 처리 결과를 안내드립니다.

■ 참관 정보
- 일시: ${date} (${period}교시)
- 과목: ${subject}
- 담당 선생님: ${teacher}

■ 처리 결과: ${statusSymbol} ${statusText} 처리됨

${status === 'APPROVED' ? '안내된 시간에 맞춰 해당 교실로 방문해 주시기 바랍니다.' : '다른 시간대나 과목으로 다시 신청해 주시기 바랍니다.'}

감사합니다.
    `;
    
    MailApp.sendEmail(email, emailSubject, body);
    
    return ContentService.createTextOutput(JSON.stringify({ result: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 테스트용 (스프레드시트 연결 확인 등)
 */
function doGet() {
  return ContentService.createTextOutput("Email API is running.");
}
