/**
 * 컴시간알리미와 시스템 시간표를 비교하고 차이를 Firestore 에 반영한다.
 *
 *   npx tsx scripts/sync-comcigan.ts --dry-run   쓰기 없이 diff 만 출력
 *   npx tsx scripts/sync-comcigan.ts             실제 반영
 *
 * 필요한 환경변수:
 *   FIREBASE_SERVICE_ACCOUNT  서비스 계정 JSON (없으면 SKIPPED 로 끝난다)
 *   ADMIN_CHAT_WEBHOOK        관리자 요약을 받을 Google Chat webhook (선택)
 */

import { fetchComciWeek } from '../src/lib/comcigan/fetch';
import { decodeWeek, type DaySlots } from '../src/lib/comcigan/decode';
import {
	diffTimetable,
	compareBaseTimetable,
	BaseTimetableChanged,
	type Change,
	type OverrideEntry
} from '../src/lib/comcigan/diff';
import { COMCIGAN_TEACHER_ROSTER } from '../src/lib/comcigan/roster';
import { systemBaseByWeekday, staticOverridesByDate } from '../src/lib/comcigan/systemBase';
import {
	SCHOOL_CODE,
	INTERNSHIP_START,
	INTERNSHIP_END,
	HORIZON_DAYS,
	MAX_CHANGES_PER_RUN,
	OVERRIDES_COLLECTION,
	SYNC_RUNS_COLLECTION,
	APPLICATIONS_COLLECTION
} from '../src/lib/comcigan/config';
import { teacherWebhooks } from '../src/lib/teacherWebhooks';
import { GAS_NOTIFY_URL } from '../src/lib/notifyConfig';

const dryRun = process.argv.includes('--dry-run');

function argValue(name: string): string | undefined {
	return process.argv.find((a) => a.startsWith(`${name}=`))?.split('=')[1];
}

/** 점검용으로 실습 기간을 임시로 바꿀 수 있다. dry-run 검증에 쓴다. */
const windowStart = argValue('--from') ?? INTERNSHIP_START;
const windowEnd = argValue('--to') ?? INTERNSHIP_END;

type RunStatus = 'OK' | 'SKIPPED' | 'ABORTED' | 'ERROR';

function todayKst(): string {
	return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

function addDays(isoDate: string, days: number): string {
	const [y, m, d] = isoDate.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function isWeekday(isoDate: string): boolean {
	const [y, m, d] = isoDate.split('-').map(Number);
	const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
	return day >= 1 && day <= 5;
}

/** 내일부터 HORIZON_DAYS 까지의 평일 중 실습 기간에 드는 날짜 */
function targetDates(today: string): string[] {
	const dates: string[] = [];
	for (let offset = 1; offset <= HORIZON_DAYS; offset++) {
		const date = addDays(today, offset);
		if (!isWeekday(date)) continue;
		if (date < windowStart || date > windowEnd) continue;
		dates.push(date);
	}
	return dates;
}

function describe(entry: OverrideEntry): string {
	const prev =
		entry.prevTeacher && entry.prevSubject
			? `${entry.prevSubject}/${entry.prevTeacher}`
			: '수업 없음';
	const next = 'cancelled' in entry ? '수업 없음' : `${entry.subject}/${entry.teacher}`;
	return `${prev} → ${next}`;
}

async function postChat(webhook: string, text: string) {
	try {
		await fetch(webhook, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=UTF-8' },
			body: JSON.stringify({ text })
		});
	} catch (err) {
		console.error('Chat 발송 실패', err);
	}
}

async function main() {
	const today = todayKst();
	const dates = targetDates(today);

	if (dates.length === 0) {
		return finish('SKIPPED', `실습 기간(${windowStart}~${windowEnd}) 밖입니다.`);
	}

	const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
	if (!serviceAccount && !dryRun) {
		return finish('SKIPPED', 'FIREBASE_SERVICE_ACCOUNT 가 없어 건너뜁니다.');
	}

	// 1. 컴시간 조회 (이번 주 + 다음 주)
	const weeks = await Promise.all([fetchComciWeek(SCHOOL_CODE, 1), fetchComciWeek(SCHOOL_CODE, 2)]);
	const decoded = weeks.map((raw) => decodeWeek(raw, COMCIGAN_TEACHER_ROSTER));
	const modifiedAt: string = decoded[0].modifiedAt;

	const comciActual: Record<string, DaySlots> = {};
	for (const week of decoded) Object.assign(comciActual, week.actual);

	// 2. 기본 시간표 정합성. 학기가 바뀌면 여기서 멈춘다.
	compareBaseTimetable(decoded[0].base, systemBaseByWeekday());

	// 3. Firestore 준비
	const db = serviceAccount ? await connectFirestore(serviceAccount) : null;

	if (db && !dryRun) {
		const last = await db
			.collection(SYNC_RUNS_COLLECTION)
			.where('status', '==', 'OK')
			.orderBy('finishedAt', 'desc')
			.limit(1)
			.get();
		const lastModifiedAt = last.docs[0]?.data()?.comciModifiedAt;
		if (lastModifiedAt === modifiedAt) {
			return finish('SKIPPED', `컴시간 수정일(${modifiedAt})이 그대로입니다.`, db);
		}
	}

	const firestoreOverrides = db ? await loadOverrides(db, dates) : {};

	// 4. 비교
	const result = diffTimetable({
		dates,
		comciActual,
		comciBase: decoded[0].base,
		firestoreOverrides,
		staticOverrides: staticOverridesByDate()
	});

	console.log(`대상 ${dates.length}일 (${dates[0]} ~ ${dates.at(-1)})`);
	if (result.skippedDates.length) {
		console.log(`컴시간 범위 밖이라 건너뜀: ${result.skippedDates.join(', ')}`);
	}
	for (const change of result.changed) {
		console.log(
			`  변경 ${change.date} ${change.classId} ${change.period}교시  ${describe(change.entry)}`
		);
	}
	for (const restore of result.restored) {
		console.log(`  복원 ${restore.date} ${restore.classId} ${restore.period}교시`);
	}

	if (result.changed.length > MAX_CHANGES_PER_RUN) {
		return finish(
			'ABORTED',
			`변경이 ${result.changed.length}건으로 상한(${MAX_CHANGES_PER_RUN})을 넘습니다. 확인이 필요합니다.`,
			db
		);
	}

	if (dryRun) {
		console.log(`\n[dry-run] 변경 ${result.changed.length}건, 복원 ${result.restored.length}건`);
		return;
	}

	if (result.changed.length === 0 && result.restored.length === 0) {
		return finish('OK', '변동 없음', db, { modifiedAt, dates });
	}

	// 5. 반영
	await applyOverrides(db!, result.changed, result.restored, modifiedAt);
	const cancelled = await cancelAffectedApplications(db!, result.changed);
	await notify(result.changed, cancelled);

	return finish(
		'OK',
		`변경 ${result.changed.length}건, 복원 ${result.restored.length}건, 신청 취소 ${cancelled.length}건`,
		db!,
		{ modifiedAt, dates, changed: result.changed.length, cancelled: cancelled.length }
	);
}

async function connectFirestore(serviceAccountJson: string) {
	const { cert, initializeApp, getApps } = await import('firebase-admin/app');
	const { getFirestore } = await import('firebase-admin/firestore');
	if (getApps().length === 0) {
		initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
	}
	return getFirestore();
}

async function loadOverrides(db: any, dates: string[]) {
	const snap = await db
		.collection(OVERRIDES_COLLECTION)
		.where('date', '>=', dates[0])
		.where('date', '<=', dates.at(-1))
		.get();
	const byDate: Record<string, Record<string, Record<string, OverrideEntry>>> = {};
	snap.forEach((doc: any) => {
		const data = doc.data();
		if (data?.date && data?.slots) byDate[data.date] = data.slots;
	});
	return byDate;
}

async function applyOverrides(
	db: any,
	changed: Change[],
	restored: { date: string; classId: string; period: string }[],
	modifiedAt: string
) {
	const { FieldValue } = await import('firebase-admin/firestore');
	const batch = db.batch();
	const touched = new Set([...changed, ...restored].map((c) => c.date));

	for (const date of touched) {
		const ref = db.collection(OVERRIDES_COLLECTION).doc(date);
		const slots: Record<string, any> = {};

		for (const change of changed.filter((c) => c.date === date)) {
			slots[`${change.classId}.${change.period}`] = change.entry;
		}
		for (const restore of restored.filter((r) => r.date === date)) {
			slots[`${restore.classId}.${restore.period}`] = FieldValue.delete();
		}

		const update: Record<string, any> = {
			date,
			syncedAt: FieldValue.serverTimestamp(),
			comciModifiedAt: modifiedAt
		};
		for (const [path, value] of Object.entries(slots)) {
			update[`slots.${path}`] = value;
		}
		batch.set(ref, update, { merge: true });
	}

	await batch.commit();
}

type CancelledApp = {
	id: string;
	applicantName?: string;
	applicantEmail?: string;
	teacher?: string;
	subject?: string;
	date: string;
	period: string;
	classId: string;
	newSlot: string;
};

/** 변경된 슬롯에 걸린 신청을 취소한다. */
async function cancelAffectedApplications(db: any, changed: Change[]): Promise<CancelledApp[]> {
	if (changed.length === 0) return [];

	const dates = [...new Set(changed.map((c) => c.date))].sort();
	const snap = await db
		.collection(APPLICATIONS_COLLECTION)
		.where('date', '>=', dates[0])
		.where('date', '<=', dates.at(-1))
		.get();

	const { FieldValue } = await import('firebase-admin/firestore');
	const batch = db.batch();
	const cancelled: CancelledApp[] = [];

	snap.forEach((doc: any) => {
		const app = doc.data();
		if (app.status !== 'PENDING' && app.status !== 'APPROVED') return;

		const change = changed.find(
			(c) => c.date === app.date && c.classId === app.classId && c.period === String(app.period)
		);
		if (!change) return;

		// 담당 교사가 그대로면 참관 대상이 유지되므로 취소하지 않는다.
		const newTeacher = 'cancelled' in change.entry ? null : change.entry.teacher;
		if (newTeacher && newTeacher === app.teacher) return;

		batch.update(doc.ref, {
			status: 'CANCELLED',
			cancelReason: 'TIMETABLE_CHANGED',
			cancelledAt: FieldValue.serverTimestamp()
		});
		cancelled.push({
			id: doc.id,
			applicantName: app.applicantName,
			applicantEmail: app.applicantEmail,
			teacher: app.teacher,
			subject: app.subject,
			date: app.date,
			period: String(app.period),
			classId: app.classId,
			newSlot: describe(change.entry)
		});
	});

	if (cancelled.length > 0) await batch.commit();
	return cancelled;
}

async function notify(changed: Change[], cancelled: CancelledApp[]) {
	// 담당이 바뀐 교사에게 알림
	for (const app of cancelled) {
		const webhook = app.teacher ? teacherWebhooks[app.teacher] : undefined;
		if (webhook) {
			await postChat(
				webhook,
				[
					'📢 *시간표 변동으로 참관 신청이 취소되었습니다*',
					'',
					`• *신청자*: ${app.applicantName ?? ''}`,
					`• *일시*: ${app.date} ${app.period}교시 (${app.classId})`,
					`• *변동*: ${app.newSlot}`
				].join('\n')
			);
		}

		if (app.applicantEmail) {
			await fetch(GAS_NOTIFY_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json; charset=UTF-8' },
				body: JSON.stringify({
					email: app.applicantEmail,
					name: app.applicantName,
					date: app.date,
					period: app.period,
					subject: app.subject,
					teacher: app.teacher,
					status: 'CANCELLED'
				})
			}).catch((err) => console.error('실습생 메일 발송 실패', err));
		}
	}

	const adminWebhook = process.env.ADMIN_CHAT_WEBHOOK;
	if (adminWebhook) {
		await postChat(
			adminWebhook,
			[
				`🔄 *컴시간 동기화: 변경 ${changed.length}건, 신청 취소 ${cancelled.length}건*`,
				'',
				...changed
					.slice(0, 20)
					.map((c) => `• ${c.date} ${c.classId} ${c.period}교시  ${describe(c.entry)}`)
			].join('\n')
		);
	}
}

async function finish(status: RunStatus, message: string, db?: any, extra: any = {}) {
	console.log(`[${status}] ${message}`);
	if (db && !dryRun) {
		const { FieldValue } = await import('firebase-admin/firestore');
		await db.collection(SYNC_RUNS_COLLECTION).add({
			status,
			message,
			finishedAt: FieldValue.serverTimestamp(),
			comciModifiedAt: extra.modifiedAt ?? null,
			datesChecked: extra.dates ?? [],
			slotsChanged: extra.changed ?? 0,
			applicationsCancelled: extra.cancelled ?? 0
		});
	}
	if (status === 'ABORTED' || status === 'ERROR') process.exitCode = 1;
}

main().catch(async (err) => {
	if (err instanceof BaseTimetableChanged) {
		const adminWebhook = process.env.ADMIN_CHAT_WEBHOOK;
		if (adminWebhook && !dryRun) {
			await postChat(adminWebhook, `⚠️ *컴시간 동기화 중단*\n\n${err.message}`);
		}
		console.error(`[ABORTED] ${err.message}`);
	} else {
		console.error('[ERROR]', err);
	}
	process.exitCode = 1;
});
