import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

/**
 * 테스트 계정의 참관 신청(observation_applications) 정리 스크립트.
 *
 * 기본 대상: applicantName === "test test" 인 모든 신청 (status 무관: APPROVED/PENDING/DECLINED 전부)
 *
 * Usage:
 *   node scripts/cleanup-test-applications.js              # dry-run (변경 없음)
 *   node scripts/cleanup-test-applications.js --apply      # 실제 삭제
 *   node scripts/cleanup-test-applications.js --name "X"   # 다른 이름 지정
 *
 * 인증:
 *   - serviceAccountKey.json 이 프로젝트 루트에 있으면 그것 사용
 *   - 없으면 ADC 사용 (한 번 'gcloud auth application-default login' 필요)
 */

const SERVICE_ACCOUNT_PATH = path.resolve(process.cwd(), 'serviceAccountKey.json');
const APPLY = process.argv.includes('--apply');
const PROJECT_ID = 'testprojecttgtec';

// --name 인자가 있으면 그 값 사용, 없으면 'test test'
const nameArgIdx = process.argv.indexOf('--name');
const TARGET_NAME = nameArgIdx >= 0 ? process.argv[nameArgIdx + 1] : 'test test';

if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
	const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
	admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
	admin.initializeApp({ projectId: PROJECT_ID });
}
const db = admin.firestore();

async function main() {
	console.log(APPLY ? '🔥 APPLY MODE — 실제로 삭제합니다.' : '🔍 DRY-RUN MODE — 변경 없음.');
	console.log(`대상: applicantName === "${TARGET_NAME}"`);
	console.log('');

	const snap = await db
		.collection('observation_applications')
		.where('applicantName', '==', TARGET_NAME)
		.get();

	console.log(`찾은 신청 수: ${snap.size}건`);

	if (snap.size === 0) {
		console.log('삭제할 항목이 없습니다.');
		return;
	}

	console.log('--- 대상 목록 ---');
	snap.docs.forEach((d, i) => {
		const x = d.data();
		console.log(
			`  ${i + 1}. [${x.status}] ${x.date} ${x.period}교시 ${x.subject} (${x.classId}) | 대상교사: ${x.teacher} | 신청자 이메일: ${x.applicantEmail}`
		);
		console.log(`     docId: ${d.id}`);
	});

	if (!APPLY) {
		console.log('');
		console.log('실제 삭제를 원하면 --apply 플래그와 함께 다시 실행하세요:');
		console.log(`  node scripts/cleanup-test-applications.js --apply`);
		return;
	}

	console.log('');
	console.log('삭제 중...');
	const batch = db.batch();
	snap.docs.forEach((d) => batch.delete(d.ref));
	await batch.commit();
	console.log(`✓ ${snap.size}건 삭제 완료`);
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error('오류:', e);
		process.exit(1);
	});
