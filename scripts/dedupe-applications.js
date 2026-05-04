import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

/**
 * 중복 신청(observation_applications) 정리 스크립트.
 *
 * (applicantEmail, date, period, classId) 기준으로 같은 doc이 2개 이상이면 하나만 남기고 삭제.
 * 남길 doc 우선순위: APPROVED > PENDING > DECLINED, 동일 status 내에서는 timestamp 오름차순(먼저 생성된 것).
 *
 * Usage:
 *   node scripts/dedupe-applications.js           # dry-run (변경 없음)
 *   node scripts/dedupe-applications.js --apply   # 실제 삭제
 */

const SERVICE_ACCOUNT_PATH = path.resolve(process.cwd(), 'serviceAccountKey.json');
const APPLY = process.argv.includes('--apply');
const PROJECT_ID = 'testprojecttgtec';

// 자격 우선순위: serviceAccountKey.json (있으면) → Application Default Credentials (gcloud auth application-default login)
if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
	const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
	admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
	admin.initializeApp({ projectId: PROJECT_ID });
}
const db = admin.firestore();

const STATUS_PRIORITY = { APPROVED: 0, PENDING: 1, DECLINED: 2 };

function pickKeeper(list) {
	return list.slice().sort((a, b) => {
		const aStatus = a.data.status || 'PENDING';
		const bStatus = b.data.status || 'PENDING';
		const statusDiff = (STATUS_PRIORITY[aStatus] ?? 99) - (STATUS_PRIORITY[bStatus] ?? 99);
		if (statusDiff !== 0) return statusDiff;
		const aTs = a.data.timestamp?.toMillis?.() ?? 0;
		const bTs = b.data.timestamp?.toMillis?.() ?? 0;
		return aTs - bTs;
	})[0];
}

function tsStr(ts) {
	try { return ts?.toDate?.().toISOString() ?? 'N/A'; } catch { return 'N/A'; }
}

async function main() {
	console.log(APPLY ? '🔥 APPLY MODE — 중복 doc을 실제로 삭제합니다.' : '🔍 DRY-RUN MODE — 변경 없음 (--apply 옵션으로 실제 삭제).');
	console.log('');

	const snap = await db.collection('observation_applications').get();
	const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
	console.log(`전체 신청 doc 수: ${docs.length}`);

	const groups = new Map();
	for (const d of docs) {
		const key = `${d.data.applicantEmail}|${d.data.date}|${d.data.period}|${d.data.classId}`;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(d);
	}

	const dupGroups = [...groups.entries()].filter(([, list]) => list.length > 1);
	console.log(`중복 그룹 수: ${dupGroups.length}`);

	if (dupGroups.length === 0) {
		console.log('중복 없음. 종료.');
		return;
	}

	let totalDeletions = 0;
	for (const [key, list] of dupGroups) {
		const keeper = pickKeeper(list);
		const toDelete = list.filter((d) => d.id !== keeper.id);
		const [email, date, period, classId] = key.split('|');
		const className = `${classId[0]}-${parseInt(classId.substring(2))}반`;
		const applicant = keeper.data.applicantName || email;
		console.log('');
		console.log(`▶ ${applicant} (${email}) | ${date} ${period}교시 ${className}  (총 ${list.length}개)`);
		console.log(`  KEEP   : id=${keeper.id} status=${keeper.data.status || 'PENDING'} ts=${tsStr(keeper.data.timestamp)}`);
		for (const d of toDelete) {
			console.log(`  DELETE : id=${d.id} status=${d.data.status || 'PENDING'} ts=${tsStr(d.data.timestamp)}`);
			totalDeletions++;
		}

		if (APPLY) {
			for (const d of toDelete) {
				await db.collection('observation_applications').doc(d.id).delete();
			}
		}
	}

	console.log('');
	console.log(`총 삭제 대상 doc 수: ${totalDeletions}`);
	if (APPLY) {
		console.log('✅ 삭제 완료.');
	} else {
		console.log('⚠️ 실제 삭제하려면 --apply 플래그와 함께 다시 실행하세요:');
		console.log('   node scripts/dedupe-applications.js --apply');
	}
}

main().catch((err) => {
	console.error('Failed:', err);
	process.exit(1);
});
