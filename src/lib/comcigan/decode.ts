/**
 * 컴시간알리미 웹 응답(`http://comci.net:4082/36179?...`) 디코더.
 *
 * 응답 구조는 컴시간 열람 페이지(`/st`)의 자바스크립트를 따른다.
 * - `자료481` 기본 시간표, `자료147` 당일 실제 시간표
 * - 변경된 슬롯은 값 앞에 `>` 가 붙는다 (`변경알림=1`)
 * - 슬롯 값: 교사 = v % 1000, 과목 = floor(v / 1000) % 분리
 * - 요일 1=월 … 5=금, 교시 1..8
 */

export type Slot = { teacher: string; subject: string };
/** 학급코드 → 교시 → 슬롯 */
export type DaySlots = Record<string, Record<string, Slot>>;

export type FlaggedChange = {
	date: string;
	classId: string;
	period: string;
	from: Slot | null;
	to: Slot | null;
};

export type ComciWeek = {
	weekStart: string;
	modifiedAt: string;
	classIds: string[];
	/** 날짜 → 학급 → 교시 → 슬롯 (실제) */
	actual: Record<string, DaySlots>;
	/** 요일(1..5) → 학급 → 교시 → 슬롯 (기본) */
	base: Record<string, DaySlots>;
	flaggedChanges: FlaggedChange[];
};

export class TeacherRosterMismatch extends Error {}

const WEEKDAYS = [1, 2, 3, 4, 5];
const MAX_PERIOD = 8;

/** 응답 꼬리에 붙는 쓰레기 바이트를 잘라내고 JSON 으로 만든다. */
export function parseComciJson(text: string): any {
	const end = text.lastIndexOf('}');
	if (end < 0) throw new Error('컴시간 응답에서 JSON 을 찾지 못했습니다.');
	return JSON.parse(text.slice(0, end + 1));
}

export function decodeSlotValue(
	value: unknown,
	divisor: number
): { subjectIdx: number; teacherIdx: number } | null {
	if (value === undefined || value === null) return null;
	const text = String(value).startsWith('>') ? String(value).slice(1) : String(value);
	const n = Number(text);
	if (!Number.isFinite(n) || n <= 0) return null;
	return { subjectIdx: Math.floor(n / 1000) % divisor, teacherIdx: n % 1000 };
}

function isFlagged(value: unknown): boolean {
	return String(value ?? '').startsWith('>');
}

/**
 * 마스킹된 교사명(`이현*`)을 로스터 실명으로 되돌린다.
 * 인덱스로 맞추되 접두사가 실제로 일치하는지 확인한다. 어긋나면 던진다.
 */
export function buildTeacherMap(masked: string[], roster: string[]): string[] {
	const names = masked.slice(1); // 0번은 빈 자리
	if (names.length !== roster.length) {
		throw new TeacherRosterMismatch(
			`교사 인원이 다릅니다. 컴시간 ${names.length}명, 로스터 ${roster.length}명. ` +
				`src/lib/comcigan/roster.ts 를 갱신하세요.`
		);
	}
	const map = [''];
	names.forEach((maskedName, i) => {
		const full = roster[i];
		const prefix = maskedName.replace(/\*/g, '');
		if (!full.startsWith(prefix)) {
			throw new TeacherRosterMismatch(
				`${i + 1}번 교사가 어긋납니다. 컴시간 "${maskedName}", 로스터 "${full}". ` +
					`src/lib/comcigan/roster.ts 를 갱신하세요.`
			);
		}
		map.push(full);
	});
	return map;
}

function addDays(isoDate: string, days: number): string {
	const [y, m, d] = isoDate.split('-').map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d + days));
	return dt.toISOString().slice(0, 10);
}

export function decodeWeek(raw: any, roster: string[]): ComciWeek {
	const divisor = raw.분리 ?? 100;
	const teachers = buildTeacherMap(raw.자료446, roster);
	const subjects: string[] = raw.자료492;
	const classCounts: number[] = raw.학급수; // [합계, 1학년, 2학년, 3학년]

	const classIds: string[] = [];
	for (let grade = 1; grade <= 3; grade++) {
		for (let room = 1; room <= classCounts[grade]; room++) {
			classIds.push(`${grade}0${room}`);
		}
	}

	const toSlot = (value: unknown): Slot | null => {
		const parts = decodeSlotValue(value, divisor);
		if (!parts) return null;
		const teacher = teachers[parts.teacherIdx];
		const subject = subjects[parts.subjectIdx];
		if (!teacher || !subject) return null;
		return { teacher, subject };
	};

	const actual: Record<string, DaySlots> = {};
	const base: Record<string, DaySlots> = {};
	const flaggedChanges: FlaggedChange[] = [];

	for (const weekday of WEEKDAYS) {
		const date = addDays(raw.시작일, weekday - 1);
		const actualDay: DaySlots = {};
		const baseDay: DaySlots = {};

		for (const classId of classIds) {
			const grade = Number(classId[0]);
			const room = Number(classId.slice(1));
			const actualSlots: Record<string, Slot> = {};
			const baseSlots: Record<string, Slot> = {};

			for (let period = 1; period <= MAX_PERIOD; period++) {
				const rawActual = raw.자료147?.[grade]?.[room]?.[weekday]?.[period];
				const rawBase = raw.자료481?.[grade]?.[room]?.[weekday]?.[period];
				const actualSlot = toSlot(rawActual);
				const baseSlot = toSlot(rawBase);
				if (actualSlot) actualSlots[String(period)] = actualSlot;
				if (baseSlot) baseSlots[String(period)] = baseSlot;
				if (isFlagged(rawActual)) {
					flaggedChanges.push({
						date,
						classId,
						period: String(period),
						from: baseSlot,
						to: actualSlot
					});
				}
			}

			actualDay[classId] = actualSlots;
			baseDay[classId] = baseSlots;
		}

		actual[date] = actualDay;
		base[String(weekday)] = baseDay;
	}

	return {
		weekStart: raw.시작일,
		modifiedAt: raw.자료244,
		classIds,
		actual,
		base,
		flaggedChanges
	};
}
