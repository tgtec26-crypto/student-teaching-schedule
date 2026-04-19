/**
 * 참관 신청 시스템 알림 및 이메일 발송 관리 (GAS)
 */

const PROJECT_ID = 'testprojecttgtec';
const CLASS_TIMES = {
  '1': '08:40',
  '2': '09:35',
  '3': '10:30',
  '4': '11:25',
  '5': '13:10',
  '6': '14:05',
  '7': '15:00'
};

// 교사 구글챗 웹훅 주소 (src/lib/teacherWebhooks.ts 기반)
const TEACHER_WEBHOOKS = {
	'김민정': 'https://chat.googleapis.com/v1/spaces/AAQAP9WjC-o/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=0ernJwOL7BSceQ32yW192kXFl3G_e1Ce_lt6U58KgxU',
	'전태상': 'https://chat.googleapis.com/v1/spaces/AAQA4PQ551k/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=M3Bfv44ngYV1vZ89DbkZWqg-YGUTleumvsFkZzD646g',
	'김보미': 'https://chat.googleapis.com/v1/spaces/AAQA7dyDPcg/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=UOqAa-MH01oJySF04Pey5ENdTQJjGBfqD7d-BoeZRvk',
	'김유진': 'https://chat.googleapis.com/v1/spaces/AAQAdT5MU0E/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=13QMsJ9rFCMDP8JJEI9CZJzruSh4LGSLhALW_ob8yI8',
	'송윤호': 'https://chat.googleapis.com/v1/spaces/AAQAWHU_M-E/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=k0EhAgg9beq1tkJeF76DA3LNH81juhnm2SkL3kAq1vA',
	'서강혁': 'https://chat.googleapis.com/v1/spaces/AAQAbzh00Ig/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=0Yc2qtKPuLa_e-tyYNWPPVHd7O1P2Ujlcq3KYO9ZM3g',
	'김일홍': 'https://chat.googleapis.com/v1/spaces/AAQAsK6CKBs/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=TKC28KE84hn-dzZGkljOMCw6sswcj5WitiNm25bvQRE',
	'이지애': 'https://chat.googleapis.com/v1/spaces/AAQAilk9Ac0/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=hE_dV-HGt7y_GQ8mmkwR379yCCOhqysZwG8MyRAd2Fg',
	'최기옥': 'https://chat.googleapis.com/v1/spaces/AAQA1IiIFFk/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=Bw6skHVx7so4TBSh8_0xhHYIbrdtq4wN64RQW3xgVIc',
	'강율이': 'https://chat.googleapis.com/v1/spaces/AAQAXP-P_V8/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=-UhxW6WYT8Llcu2qRfl6WxkTzczZ2lBEh_4Ld8ehzx8',
	'황규창': 'https://chat.googleapis.com/v1/spaces/AAQAnG3V3-0/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=K2MnqlhIRKA6ju8qH4oLlCUXrzSTQaN80CoNOIMU1Xo',
	'정재선': 'https://chat.googleapis.com/v1/spaces/AAQAJ1HWlk4/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=Y7-MfrpMuroPpi-W8d4MJ4KwhSy7BkCumY_kNb4eAyQ',
	'노유리': 'https://chat.googleapis.com/v1/spaces/AAQAldfCCaE/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=d_PRLWAJ3Z2iRxA33_a6l063KQkDx9yMvPfuCVZZEnY',
	'정안나': 'https://chat.googleapis.com/v1/spaces/AAQAakv5Cv4/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=oFwQdR5rCuuri1VPGRU_s_Tt6VzpRxyp1wBn0YU819A',
	'이의진': 'https://chat.googleapis.com/v1/spaces/xfYjAyAAAAE/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=BC4TGAgwlp0vSDlQl4e39u4my5E9th76RwBA5O_XaUw',
	'정자연': 'https://chat.googleapis.com/v1/spaces/AAQA1sXIvf0/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=QDGoTo_HgQGziozDcQj7ZnJXQeCE8eMSETVQPdYcWik',
	'주예진': 'https://chat.googleapis.com/v1/spaces/AAQABQqyjRM/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=OXnc8yZAFkI9NtdIhVjlU26CDAsfCq-Ssnz99Gtb6yc',
	'주지원': 'https://chat.googleapis.com/v1/spaces/AAQAReG4Sfk/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=-7wR_QB5xJUcXhe9Fyt5Cg2vO6Ch_AuOzJszj51a6PU',
	'김기현': 'https://chat.googleapis.com/v1/spaces/AAQAKnF-uQg/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=9TqwX1PbI1PbVTVvuziq4-ONKl7eyS4h6ikb-owS5Us',
	'정예지': 'https://chat.googleapis.com/v1/spaces/AAQArGhyD2k/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=Mi_Oz8-U5ICFFBsGm9Bi4VqrdKStY__yuQAmpRVao2Y',
	'이현진': 'https://chat.googleapis.com/v1/spaces/AAQAEKVHM-E/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=D9wzhXNAW5Xy5mxOkXXqtws2h_yFd2-pHOZiTL432L8',
	'이재국': 'https://chat.googleapis.com/v1/spaces/AAQA-LpPtf4/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=U3B4VLSiPT802BY5JCeCFPoXpsK9B9mLT380OnxKRmQ',
	'이윤경': 'https://chat.googleapis.com/v1/spaces/AAQAtXNN62o/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=Pp2KIfnrc6U7C3hdj8O8MsTB4nJQXtqjXC9K9HX0BIQ',
	'최미정': 'https://chat.googleapis.com/v1/spaces/AAQA-PYadq0/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=LDJUMcVDmBuk981XRZtPbwH719Cod7R8fbWTEEIho34',
	'이선미': 'https://chat.googleapis.com/v1/spaces/AAQAqdiXBno/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=0y16mdPhO7ucyPEGFJSzTz4XGRY_dvQ7aOcCVTe33UY',
	'유수형': 'https://chat.googleapis.com/v1/spaces/AAQAIQXxnuc/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=THxSngLPaB7pusbMRVox8xHSd0hJd8aAZ3DP2SPvjt8',
	'김지영': 'https://chat.googleapis.com/v1/spaces/AAQA5t_ye_A/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=b32wmUDrTUrVtAlDCopPnx7GdwbT3dRi5F8yblkysyQ',
	'박혜리': 'https://chat.googleapis.com/v1/spaces/AAQAOIue5R8/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=RueC2HnmnMRaN-N35MZa9Oo3EVjlJPkht24hSfN7A8k',
	'이경재': 'https://chat.googleapis.com/v1/spaces/AAQA1STnwjY/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=QQf3FqcqAaD9obu2qX_Q4tED_I068e_6CSHF37Xkl6E',
	'이정무': 'https://chat.googleapis.com/v1/spaces/AAQA4eM3vVU/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=AKm3Tv-yq-ThvBydgesXaWSjGHCUVhjlE8fBkB8P74M',
	'김옥배': 'https://chat.googleapis.com/v1/spaces/AAQAPFCXolY/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=MaMHcBp8kBWyZICPtTHX8vSjq7PFPnlNKtZtUlfmPa8',
	'이성운': 'https://chat.googleapis.com/v1/spaces/AAQAjKBwqIU/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=3a2Y6so27egYbNhjGGEsKr8OQHvd9c_UrrYQOgHvMAY',
	'김은희': 'https://chat.googleapis.com/v1/spaces/AAQAGDlwYqQ/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=6gbBJN657yDUh791ggpCk4GRDXDl_ybBF3iLOZuVHCg',
	'황경진': 'https://chat.googleapis.com/v1/spaces/AAQAB4tJSxI/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=QjesthAR5YTDmyZtaSuo9j2MexCsMRJSTMEE8O3k9Wo',
	'최종훈': 'https://chat.googleapis.com/v1/spaces/AAQAL4FAbpA/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=a1mrICEPEmoASwTDxSaXSh1ZtM88QhAJG6rB3M04VxY',
	'엄인우': 'https://chat.googleapis.com/v1/spaces/AAQA3XxyH2M/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=6EyNlaQNZiX25PHApv4jZK-BzXmVfhfar9e9HIguu6Y',
	'최인영': 'https://chat.googleapis.com/v1/spaces/AAQA2AsBFYs/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=EU_7j_ajuYjOYGOZzxoLiVvZv42bb5yjuhWOfNHydc8',
	'강신완': 'https://chat.googleapis.com/v1/spaces/AAQASEyqu5g/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=07dWRCZemnLdTZguc73alL1YvSyc9O2y1fYmp1eqHIE'
};

/**
 * 1. 외부 호출용 API (승인/거부 시 즉시 발송)
 */
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const { email, name, date, period, subject, teacher, status } = params;
    
    if (status === 'APPROVED' || status === 'DECLINED') {
      sendImmediateEmail(email, name, date, period, subject, teacher, status);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ result: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 2. 1분마다 실행되는 알림 체크 트리거
 */
function checkAndSendNotifications() {
  const now = new Date();
  const todayStr = Utilities.formatDate(now, "Asia/Seoul", "yyyy-MM-dd");

  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/observation_applications`;
  
  const options = {
    method: 'get',
    headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() !== 200) return;
    if (!data.documents) return;

    data.documents.forEach(doc => {
      const fields = doc.fields;
      if (!fields.date || !fields.status) return;

      const appDate = fields.date.stringValue;
      const appStatus = fields.status.stringValue;
      const period = fields.period.stringValue;

      if (appDate === todayStr && appStatus === 'APPROVED') {
        if (fields.applicantEmail) {
          processUserNotif(fields.applicantEmail.stringValue, fields, 'STUDENT');
        }
        if (fields.teacherEmail) {
          processUserNotif(fields.teacherEmail.stringValue, fields, 'SUPERVISOR');
        }
      }
    });
  } catch (e) {
    console.error("❌ checkAndSendNotifications 에러: " + e.toString());
  }
}

function processUserNotif(userEmail, appData, role) {
  const userUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${userEmail}`;
  const options = {
    method: 'get',
    headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(userUrl, options);
    if (response.getResponseCode() !== 200) return;

    const userData = JSON.parse(response.getContentText());
    const fields = userData.fields || {};

    const isEnabled = fields.notifEnabled ? fields.notifEnabled.booleanValue : false;
    const leadTime = fields.notifLeadTime ? Number(fields.notifLeadTime.integerValue) : 10;
    
    if (!isEnabled) return;

    const startTime = CLASS_TIMES[appData.period.stringValue];
    const diff = getMinutesDiff(startTime);

    if (diff === leadTime) {
      const cacheKey = `notif_${appData.date.stringValue}_${appData.period.stringValue}_${userEmail}_${role}`;
      const cache = CacheService.getScriptCache();
      if (cache.get(cacheKey)) return; // 중복 방지

      if (role === 'STUDENT') {
        sendReminderEmail(userEmail, appData);
      } else {
        sendTeacherChatReminder(appData);
      }
      
      cache.put(cacheKey, 'sent', 3600 * 24); // 24시간 중복 방지
    }
  } catch (e) {
    console.error("❌ processUserNotif 에러: " + userEmail, e.toString());
  }
}

function getMinutesDiff(startTimeStr) {
  if (!startTimeStr) return -999;
  const now = new Date();
  const [h, m] = startTimeStr.split(':').map(Number);
  const start = new Date(now.getTime());
  start.setHours(h, m, 0, 0);
  return Math.round((start.getTime() - now.getTime()) / 60000);
}

function sendImmediateEmail(email, name, date, period, subject, teacher, status) {
  const statusText = status === 'APPROVED' ? '승인' : '거부';
  const mailSubject = `[참관 신청 결과] ${name} 실습생님의 신청이 ${statusText}되었습니다.`;
  const body = `안녕하세요, ${name} 실습생님.\n\n서울사대부여중 참관 신청 처리 결과 안내드립니다.\n\n- 일시: ${date} (${period}교시)\n- 과목: ${subject}\n- 담당: ${teacher}\n- 결과: ${statusText}\n\n감사합니다.`;
  MailApp.sendEmail(email, mailSubject, body);
}

function sendReminderEmail(email, data) {
  const name = data.applicantName.stringValue;
  const period = data.period.stringValue;
  const subject = data.subject.stringValue;
  const mailSubject = `[참관 알림] 곧 수업이 시작됩니다 (${period}교시)`;
  const body = `안녕하세요, ${name} 실습생님.\n\n잠시 후 참관 수업이 시작됩니다.\n\n- 일시: 오늘 ${CLASS_TIMES[period]} 시작\n- 과목: ${subject}\n\n준비하여 이동해 주세요.\n\n감사합니다.`;
  MailApp.sendEmail(email, mailSubject, body);
}

function sendTeacherChatReminder(data) {
  const teacherName = data.teacher.stringValue;
  const webhookUrl = TEACHER_WEBHOOKS[teacherName];
  if (!webhookUrl) return;

  const period = data.period.stringValue;
  const subject = data.subject.stringValue;
  const applicant = data.applicantName.stringValue;
  const classInfo = data.classId ? data.classId.stringValue : "교실";

  const message = {
    text: `📢 *참관 수업 시작 알림*\n\n잠시 후 ${period}교시 수업에 참관 실습생이 방문할 예정입니다.\n\n• *실습생*: ${applicant}\n• *수업*: ${subject} (${classInfo})\n• *시작 시간*: ${CLASS_TIMES[period]}`
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(message)
  };

  UrlFetchApp.fetch(webhookUrl, options);
}
