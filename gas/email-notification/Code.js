/**
 * 참관 신청 시스템 알림 및 이메일 발송 관리 (GAS)
 */

const PROJECT_ID = 'testprojecttgtec';

// GAS 시간 트리거 주기 (분). GAS 콘솔의 트리거 설정과 반드시 동일해야 한다.
// 알림 발송 윈도우 = [leadTime, leadTime + TRIGGER_INTERVAL_MIN) 으로 사용되므로
// 이 값을 늘리면 비용은 절감되지만 알림이 최대 이 값만큼 일찍 발송될 수 있다.
const TRIGGER_INTERVAL_MIN = 10;

const CLASS_TIMES = {
  '1': '08:40',
  '2': '09:35',
  '3': '10:30',
  '4': '11:25',
  '5': '13:10',
  '6': '14:05',
  '7': '15:00'
};

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

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const { email, name, date, period, subject, teacher, status } = params;
    if (status === 'APPROVED' || status === 'DECLINED') {
      sendImmediateEmail(email, name, date, period, subject, teacher, status);
    }
    return ContentService.createTextOutput(JSON.stringify({ result: 'success' })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function checkAndSendNotifications() {
  // ─── 1단계: 비활성 시간대 즉시 종료 (Firestore read 절감) ───
  // 알림은 수업 시작 전 leadTime(기본 10분 전)에만 발송 가능.
  // 1교시 08:40 시작, 7교시 15:00 시작이므로 평일 07시~17시 외에는
  // 알림 보낼 신청이 0건임이 보장된다 → 그 시간엔 read 자체를 건너뛴다.
  const isoDayOfWeek = parseInt(Utilities.formatDate(new Date(), "Asia/Seoul", "u"), 10); // 1=월 ... 7=일
  const kstHour = parseInt(Utilities.formatDate(new Date(), "Asia/Seoul", "HH"), 10);
  if (isoDayOfWeek >= 6 || kstHour < 7 || kstHour >= 17) return; // 토/일 또는 7~17시 외

  const todayStr = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");

  // ─── 2단계: 서버 사이드 쿼리 필터링 (이전: 전체 컬렉션 fetch) ───
  // runQuery 엔드포인트로 (date == today AND status == APPROVED) 만 fetch.
  // 신청이 누적되어도 매 호출당 read 가 비례 증가하지 않는다.
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
  const queryBody = {
    structuredQuery: {
      from: [{ collectionId: 'observation_applications' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'date' }, op: 'EQUAL', value: { stringValue: todayStr } } },
            { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'APPROVED' } } }
          ]
        }
      }
    }
  };
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify(queryBody),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() !== 200) return;
    const results = JSON.parse(response.getContentText());
    if (!Array.isArray(results)) return;

    // runQuery 응답: [{ document: {...} }, ...] (매칭이 0건이면 [{ readTime: "..." }] 형태)
    // 학생 알림은 신청 1건당 1통 발송, 교사 알림은 (교사·날짜·교시) 단위로 묶어 1통에 전체 명단 발송.
    const teacherGroups = {}; // groupKey -> { teacherEmail, fields, applicants: [{name, subject}] }

    results.forEach(item => {
      if (!item.document) return;
      const fields = item.document.fields;
      const period = fields.period && fields.period.stringValue;
      if (!CLASS_TIMES[period]) return;

      if (fields.applicantEmail) processUserNotif(fields.applicantEmail.stringValue, fields, 'STUDENT');

      if (fields.teacherEmail) {
        const teacherEmail = fields.teacherEmail.stringValue;
        const date = fields.date && fields.date.stringValue;
        const groupKey = `${teacherEmail}|${date}|${period}`;
        if (!teacherGroups[groupKey]) {
          teacherGroups[groupKey] = { teacherEmail, fields, applicants: [] };
        }
        teacherGroups[groupKey].applicants.push({
          name: fields.applicantName ? fields.applicantName.stringValue : '',
          subject: fields.applicantSubject ? fields.applicantSubject.stringValue : '미지정'
        });
      }
    });

    Object.keys(teacherGroups).forEach(key => {
      const g = teacherGroups[key];
      processTeacherGroupNotif(g.teacherEmail, g.fields, g.applicants);
    });
  } catch (e) { console.error("❌ checkAndSendNotifications 에러: " + e.toString()); }
}

function processTeacherGroupNotif(teacherEmail, appData, applicants) {
  const userUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${teacherEmail}`;
  const options = { method: 'get', headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true };

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
    if (diff >= leadTime && diff < leadTime + TRIGGER_INTERVAL_MIN) {
      const cacheKey = `notif_${appData.date.stringValue}_${appData.period.stringValue}_${teacherEmail}_SUPERVISOR`;
      const cache = CacheService.getScriptCache();
      if (cache.get(cacheKey)) return;

      sendTeacherChatReminder(appData, applicants);
      cache.put(cacheKey, 'sent', 3600 * 24);
    }
  } catch (e) { console.error("❌ 에러: " + teacherEmail, e.toString()); }
}

function processUserNotif(userEmail, appData, role) {
  const userUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${userEmail}`;
  const options = { method: 'get', headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true };

  try {
    const response = UrlFetchApp.fetch(userUrl, options);
    if (response.getResponseCode() !== 200) return;
    const userData = JSON.parse(response.getContentText());
    const fields = userData.fields || {};
    const isEnabled = fields.notifEnabled ? fields.notifEnabled.booleanValue : false;
    const leadTime = fields.notifLeadTime ? Number(fields.notifLeadTime.integerValue) : 10;
    if (!isEnabled) return;

    const startTime = CLASS_TIMES[appData.period.stringValue];
    // 윈도우 비교: 발송 시점이 [leadTime, leadTime + TRIGGER_INTERVAL_MIN) 분 사이에
    // 들어오면 발송. 트리거 drift / leadTime ≠ 트리거 주기 약수 케이스에서도 누락 없음.
    // 같은 알림 키는 24h cache 로 중복 방지하므로 윈도우 안에서 첫 트리거에만 발송됨.
    const diff = getMinutesDiff(startTime);
    if (diff >= leadTime && diff < leadTime + TRIGGER_INTERVAL_MIN) {
      const cacheKey = `notif_${appData.date.stringValue}_${appData.period.stringValue}_${userEmail}_${role}`;
      const cache = CacheService.getScriptCache();
      if (cache.get(cacheKey)) return;

      if (role === 'STUDENT') sendReminderEmail(userEmail, appData);

      cache.put(cacheKey, 'sent', 3600 * 24);
    }
  } catch (e) { console.error("❌ 에러: " + userEmail, e.toString()); }
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

function sendTeacherChatReminder(data, applicants) {
  const teacherName = data.teacher.stringValue;
  const webhookUrl = TEACHER_WEBHOOKS[teacherName];
  if (!webhookUrl) return;

  const period = data.period.stringValue;
  const subject = data.subject.stringValue;
  const classInfo = data.classId ? data.classId.stringValue : "교실";

  const list = applicants.map(a => `  • [${a.subject}] ${a.name}`).join('\n');
  const headerLine = applicants.length === 1
    ? `잠시 후 ${period}교시 수업에 참관 실습생이 방문할 예정입니다.`
    : `잠시 후 ${period}교시 수업에 참관 실습생 ${applicants.length}명이 방문할 예정입니다.`;

  const message = {
    text: `📢 *참관 수업 시작 알림*\n\n${headerLine}\n\n• *실습생*:\n${list}\n• *수업*: ${subject} (${classInfo})\n• *시작 시간*: ${CLASS_TIMES[period]}`
  };

  UrlFetchApp.fetch(webhookUrl, { method: 'post', contentType: 'application/json', payload: JSON.stringify(message) });
}
