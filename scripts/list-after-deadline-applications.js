import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

/**
 * 5/4 16:20 KST 이후 ~ 지금 사이에 들어온 참관 신청 조회 (읽기 전용).
 * 본래 신청 차단되어야 했던 시간대(휴일·마감 후)에 새벽 시간대 UTC 버그로 통과한 건 식별용.
 *
 * Usage:
 *   node scripts/list-after-deadline-applications.js
 *   node scripts/list-after-deadline-applications.js --start "2026-05-04T16:20:00+09:00"
 *
 * 인증:
 *   - serviceAccountKey.json 이 프로젝트 루트에 있으면 그것 사용
 *   - 없으면 ADC 사용 ('gcloud auth application-default login' 한 번 필요)
 */

const SERVICE_ACCOUNT_PATH = path.resolve(process.cwd(), 'serviceAccountKey.json');
const PROJECT_ID = 'testprojecttgtec';

const startArgIdx = process.argv.indexOf('--start');
const START_ISO = startArgIdx >= 0 ? process.argv[startArgIdx + 1] : '2026-05-04T16:20:00+09:00';
const startDate = new Date(START_ISO);
const endDate = new Date();

if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
	const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
	admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
	admin.initializeApp({ projectId: PROJECT_ID });
}
const db = admin.firestore();

const fmtKst = (d) =>
	d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul', hour12: false });

async function main() {
	console.log('🔍 조회 범위 (KST):');
	console.log(`   시작: ${fmtKst(startDate)}`);
	console.log(`   종료: ${fmtKst(endDate)} (지금)`);
	console.log('');

	const snap = await db
		.collection('observation_applications')
		.where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startDate))
		.where('timestamp', '<=', admin.firestore.Timestamp.fromDate(endDate))
		.orderBy('timestamp', 'asc')
		.get();

	console.log(`찾은 신청 수: ${snap.size}건`);
	if (snap.size === 0) return;

	console.log('');
	console.log('--- 대상 목록 ---');
	snap.docs.forEach((doc, i) => {
		const x = doc.data();
		const ts = x.timestamp?.toDate ? x.timestamp.toDate() : null;
		const tsStr = ts ? fmtKst(ts) : '(timestamp 없음)';
		console.log(
			`  ${i + 1}. [${x.status}] 신청시각: ${tsStr} KST`
		);
		console.log(
			`     신청자: ${x.applicantName} <${x.applicantEmail}> (${x.applicantSubject || '미정'})`
		);
		console.log(
			`     대상수업: ${x.date} ${x.period}교시 ${x.subject} (${x.classId}) | 교사: ${x.teacher}`
		);
		console.log(`     docId: ${doc.id}`);
		console.log('');
	});
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error('오류:', e);
		process.exit(1);
	});
