import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

/**
 * 최종훈 교사의 lesson_notes 일괄 작성 스크립트.
 *
 * 입력: sheet_data.json (gws sheets +read 결과; 2026년 5월 교육실습 수업 배정표)
 * 동작: 각 행을 lesson_notes/{최종훈_${date}_${period}_${classId}} 로 setDoc
 * 메시지 형식: "{실습생} 선생님이 수업합니다. 주제: {수업 주제}"
 *
 * Usage:
 *   node scripts/setup-lesson-notes-jonghoon.js          # dry-run
 *   node scripts/setup-lesson-notes-jonghoon.js --apply  # 실제 쓰기
 */

const SERVICE_ACCOUNT_PATH = path.resolve(process.cwd(), 'serviceAccountKey.json');
const APPLY = process.argv.includes('--apply');
const PROJECT_ID = 'testprojecttgtec';
const TEACHER = '최종훈';
const SHEET_DATA_PATH = path.resolve(process.cwd(), 'sheet_data.json');

if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
	const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
	admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
	admin.initializeApp({ projectId: PROJECT_ID });
}

const db = admin.firestore();

function parseDate(s) {
	// "2026. 5. 11" -> "2026-05-11"
	const m = s.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
	if (!m) throw new Error(`Cannot parse date: ${s}`);
	const [, y, mo, d] = m;
	return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function classIdOf(grade, classNum) {
	return `${grade}${String(classNum).padStart(2, '0')}`;
}

async function main() {
	console.log(APPLY ? '🔥 APPLY MODE — Firestore에 실제 쓰기.' : '🔍 DRY-RUN MODE — 미리보기만, 변경 없음 (--apply 옵션으로 실제 쓰기).');
	console.log('');

	const raw = JSON.parse(fs.readFileSync(SHEET_DATA_PATH, 'utf8'));
	const rows = raw.values.slice(1); // skip header
	console.log(`총 ${rows.length}건 처리 예정.`);
	console.log('');

	const writes = [];
	for (const r of rows) {
		const [dateStr, , periodStr, student, gradeStr, classStr, topic] = r;
		const date = parseDate(dateStr);
		const period = String(periodStr).trim();
		const classId = classIdOf(gradeStr.trim(), classStr.trim());
		const noteId = `${TEACHER}_${date}_${period}_${classId}`;
		const message = `${student.trim()} 선생님이 수업합니다. 주제: ${topic.trim()}`;
		writes.push({ noteId, date, period, classId, student: student.trim(), topic: topic.trim(), message });
	}

	for (const w of writes) {
		console.log(`▶ ${w.noteId}`);
		console.log(`  message: ${w.message}`);
	}

	console.log('');

	if (!APPLY) {
		console.log(`⚠️ 실제 쓰기는 --apply 플래그와 함께 다시 실행:`);
		console.log(`   node scripts/setup-lesson-notes-jonghoon.js --apply`);
		return;
	}

	let ok = 0, fail = 0;
	for (const w of writes) {
		try {
			await db.collection('lesson_notes').doc(w.noteId).set({
				teacher: TEACHER,
				date: w.date,
				period: w.period,
				classId: w.classId,
				message: w.message,
				updatedAt: new Date()
			});
			ok++;
		} catch (e) {
			console.error(`  FAIL ${w.noteId}: ${e.message}`);
			fail++;
		}
	}
	console.log(`✅ 완료: ${ok}건 성공, ${fail}건 실패.`);
}

main().catch((err) => {
	console.error('Failed:', err);
	process.exit(1);
});
