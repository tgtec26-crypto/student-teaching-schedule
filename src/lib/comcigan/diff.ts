/**
 * 컴시간 실제 시간표와 시스템 시간표를 비교한다.
 *
 * 시스템 슬롯은 기본 시간표 위에 정적 `scheduleOverrides`, 그 위에 Firestore
 * override 를 얹은 결과다. 컴시간 값과 다르면 Firestore override 를 쓰고,
 * 컴시간이 기본으로 되돌아왔으면 Firestore override 를 지운다.
 */

import type { DaySlots, Slot } from './decode';

export type OverrideEntry =
	| { teacher: string; subject: string; prevTeacher: string | null; prevSubject: string | null }
	| { cancelled: true; prevTeacher: string | null; prevSubject: string | null };

export type Change = {
	date: string;
	classId: string;
	period: string;
	entry: OverrideEntry;
};

export type Restore = { date: string; classId: string; period: string };

export type DiffResult = {
	changed: Change[];
	restored: Restore[];
	skippedDates: string[];
};

export type DiffInput = {
	dates: string[];
	/** 날짜 → 학급 → 교시 → 슬롯 */
	comciActual: Record<string, DaySlots>;
	/** 요일(1..5) → 학급 → 교시 → 슬롯 */
	comciBase: Record<string, DaySlots>;
	/** 날짜 → 학급 → 교시 → override */
	firestoreOverrides: Record<string, Record<string, Record<string, OverrideEntry>>>;
	staticOverrides: Record<string, Record<string, Record<string, Slot>>>;
};

export class BaseTimetableChanged extends Error {}

function weekdayOf(isoDate: string): string {
	const [y, m, d] = isoDate.split('-').map(Number);
	return String(new Date(Date.UTC(y, m - 1, d)).getUTCDay());
}

function sameSlot(a: Slot | null | undefined, b: Slot | null | undefined): boolean {
	if (!a && !b) return true;
	if (!a || !b) return false;
	return a.teacher === b.teacher && a.subject === b.subject;
}

function hasAnySlot(day: DaySlots): boolean {
	return Object.values(day).some((periods) => Object.keys(periods).length > 0);
}

function entryToSlot(entry: OverrideEntry | undefined): Slot | null | undefined {
	if (!entry) return undefined;
	if ('cancelled' in entry) return null;
	return { teacher: entry.teacher, subject: entry.subject };
}

function makeEntry(target: Slot | null, current: Slot | null | undefined): OverrideEntry {
	const prevTeacher = current?.teacher ?? null;
	const prevSubject = current?.subject ?? null;
	if (!target) return { cancelled: true, prevTeacher, prevSubject };
	return { teacher: target.teacher, subject: target.subject, prevTeacher, prevSubject };
}

export function diffTimetable(input: DiffInput): DiffResult {
	const changed: Change[] = [];
	const restored: Restore[] = [];
	const skippedDates: string[] = [];

	for (const date of input.dates) {
		const comciDay = input.comciActual[date];
		// 하루치가 통째로 비어 있으면 공휴일이거나 아직 발행 전이다.
		// 전 슬롯을 결강 처리하면 시간표를 통째로 날리므로 건너뛴다.
		if (!comciDay || !hasAnySlot(comciDay)) {
			skippedDates.push(date);
			continue;
		}
		const baseDay = input.comciBase[weekdayOf(date)] ?? {};
		const fsDay = input.firestoreOverrides[date] ?? {};
		const staticDay = input.staticOverrides[date] ?? {};

		// 컴시간과 시스템 어느 쪽에라도 존재하는 슬롯을 모두 훑는다.
		const classIds = new Set([
			...Object.keys(comciDay),
			...Object.keys(baseDay),
			...Object.keys(fsDay),
			...Object.keys(staticDay)
		]);

		for (const classId of classIds) {
			const periods = new Set([
				...Object.keys(comciDay[classId] ?? {}),
				...Object.keys(baseDay[classId] ?? {}),
				...Object.keys(fsDay[classId] ?? {}),
				...Object.keys(staticDay[classId] ?? {})
			]);

			for (const period of periods) {
				const target = comciDay[classId]?.[period] ?? null;
				const baseSlot = baseDay[classId]?.[period] ?? null;
				const fsEntry = fsDay[classId]?.[period];
				const staticSlot = staticDay[classId]?.[period];

				// `??` 를 쓰면 결강 override(null)와 override 없음을 구분하지 못한다.
				const current =
					fsEntry !== undefined
						? entryToSlot(fsEntry)
						: staticSlot !== undefined
							? staticSlot
							: baseSlot;

				if (sameSlot(target, current)) continue;

				const backToBase = sameSlot(target, baseSlot);
				if (backToBase && fsEntry && !staticSlot) {
					restored.push({ date, classId, period });
					continue;
				}

				changed.push({ date, classId, period, entry: makeEntry(target, current) });
			}
		}
	}

	return { changed, restored, skippedDates };
}

/**
 * 컴시간 기본 시간표와 시스템 기본 시간표가 같은지 확인한다.
 * 학기가 바뀌면 전 슬롯이 어긋나므로, 여기서 막지 않으면 시간표 전체를 덮어쓴다.
 */
export function compareBaseTimetable(
	comciBase: Record<string, DaySlots>,
	systemBase: Record<string, DaySlots>
): void {
	const mismatches: string[] = [];

	for (const weekday of Object.keys(systemBase)) {
		const comciDay = comciBase[weekday] ?? {};
		const systemDay = systemBase[weekday];
		for (const classId of Object.keys(systemDay)) {
			for (const period of Object.keys(systemDay[classId])) {
				const expected = systemDay[classId][period];
				const actual = comciDay[classId]?.[period] ?? null;
				if (!sameSlot(expected, actual)) {
					mismatches.push(
						`${classId} ${weekday}요일 ${period}교시: 시스템 ${expected.subject}/${expected.teacher}` +
							` ↔ 컴시간 ${actual ? `${actual.subject}/${actual.teacher}` : '없음'}`
					);
				}
			}
		}
	}

	if (mismatches.length > 0) {
		throw new BaseTimetableChanged(
			`기본 시간표가 컴시간과 다릅니다 (${mismatches.length}건). 학기가 바뀌었다면 ` +
				`기본 시간표와 교사 로스터를 다시 수입해야 합니다.\n` +
				mismatches.slice(0, 10).join('\n')
		);
	}
}
