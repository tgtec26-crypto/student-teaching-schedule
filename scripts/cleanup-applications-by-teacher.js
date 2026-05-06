import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

/**
 * 특정 교사 수업에 대한 참관 신청(observation_applications) 일괄 삭제 스크립트.
 *
 * 대상: teacher === <지정 교사명> 인 모든 신청 (status 무관)
 *
 * Usage:
 *   node scripts/cleanup-applications-by-teacher.js --teacher 김미경            # dry-run
 *   node scripts/cleanup-applications-by-teacher.js --teacher 김미경 --apply    # 실제 삭제
 *
 * 인증:
 *   - serviceAccountKey.json 이 프로젝트 루트에 있으면 그것 사용
 *   - 없으면 ADC 사용
 */

const SERVICE_ACCOUNT_PATH = path.resolve(process.cwd(), 'serviceAccountKey.json');
const APPLY = process.argv.includes('--apply');
const PROJECT_ID = 'testprojecttgtec';

const teacherArgIdx = process.argv.indexOf('--teacher');
const TARGET_TEACHER = teacherArgIdx >= 0 ? process.argv[teacherArgIdx + 1] : null;

if (!TARGET_TEACHER) {
	console.error('--teacher <교사명> 인자가 필요합니다.');
	process.exit(1);
}

if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
	const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
	admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
	admin.initializeApp({ projectId: PROJECT_ID });
}
const db = admin.firestore();

async function main() {
	console.log(APPLY ? '🔥 APPLY MODE — 실제로 삭제합니다.' : '🔍 DRY-RUN MODE — 변경 없음.');
	console.log(`대상: teacher === "${TARGET_TEACHER}"`);
	console.log('');

	const snap = await db
		.collection('observation_applications')
		.where('teacher', '==', TARGET_TEACHER)
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
			`  ${i + 1}. [${x.status}] ${x.date} ${x.period}교시 ${x.subject} (${x.classId}) | 신청자: ${x.applicantName} <${x.applicantEmail}>`
		);
		console.log(`     docId: ${d.id}`);
	});

	if (!APPLY) {
		console.log('');
		console.log('실제 삭제를 원하면 --apply 플래그와 함께 다시 실행하세요:');
		console.log(`  node scripts/cleanup-applications-by-teacher.js --teacher ${TARGET_TEACHER} --apply`);
		return;
	}

	console.log('');
	console.log('삭제 중...');
	// Firestore batch는 500건 제한 → 분할 처리
	const docs = snap.docs;
	const CHUNK = 400;
	let done = 0;
	for (let i = 0; i < docs.length; i += CHUNK) {
		const batch = db.batch();
		docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
		await batch.commit();
		done += Math.min(CHUNK, docs.length - i);
		console.log(`  ${done}/${docs.length} 삭제 완료`);
	}
	console.log(`✓ 총 ${snap.size}건 삭제 완료`);
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error('오류:', e);
		process.exit(1);
	});
