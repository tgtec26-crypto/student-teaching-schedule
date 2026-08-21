/**
 * 실제 컴시간 응답 한 주치로 디코딩 → 정합성 검증 → diff 전체 흐름을 확인한다.
 * 네트워크는 쓰지 않는다. 픽스처는 2026-08-17 주간 실측 응답이다.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseComciJson, decodeWeek } from './decode';
import { diffTimetable, compareBaseTimetable } from './diff';
import { COMCIGAN_TEACHER_ROSTER } from './roster';

const week = decodeWeek(
	parseComciJson(
		readFileSync(
			fileURLToPath(new URL('./__fixtures__/week-2026-08-17.json', import.meta.url)),
			'utf8'
		)
	),
	COMCIGAN_TEACHER_ROSTER
);

const dates = Object.keys(week.actual);

describe('컴시간 한 주 동기화', () => {
	it('기본 시간표가 같으면 정합성 검증을 통과한다', () => {
		expect(compareBaseTimetable(week.base, week.base)).toBeUndefined();
	});

	it('수업이 없는 날은 건너뛴다', () => {
		// 2026-08-17 은 광복절 대체휴일이라 컴시간에 하루치가 통째로 비어 있다.
		const result = diffTimetable({
			dates,
			comciActual: week.actual,
			comciBase: week.base,
			firestoreOverrides: {},
			staticOverrides: {}
		});
		expect(result.skippedDates).toEqual(['2026-08-17']);
	});

	const key = (c: { date: string; classId: string; period: string }) =>
		`${c.date}/${c.classId}/${c.period}`;

	it("컴시간이 '>' 로 표시한 실질 변경을 빠짐없이 잡는다", () => {
		const result = diffTimetable({
			dates,
			comciActual: week.actual,
			comciBase: week.base,
			firestoreOverrides: {},
			staticOverrides: {}
		});

		// 플래그가 붙었어도 교사·과목이 그대로면 참관 관점에서는 변동이 아니다.
		const realFlagged = week.flaggedChanges.filter(
			(c) =>
				!result.skippedDates.includes(c.date) &&
				(c.from?.teacher !== c.to?.teacher || c.from?.subject !== c.to?.subject)
		);

		expect(realFlagged.length).toBeGreaterThan(0);
		const found = new Set(result.changed.map(key));
		expect(realFlagged.filter((c) => !found.has(key(c)))).toEqual([]);
	});

	it('플래그가 없어도 기본과 다르면 잡는다', () => {
		// 실측: 2026-08-21 203반 1교시↔5교시 교체는 '>' 없이 자료147 만 바뀌어 있다.
		const result = diffTimetable({
			dates,
			comciActual: week.actual,
			comciBase: week.base,
			firestoreOverrides: {},
			staticOverrides: {}
		});

		const flagged = new Set(week.flaggedChanges.map(key));
		const unflagged = result.changed.filter((c) => !flagged.has(key(c)));
		expect(unflagged.map(key)).toEqual(['2026-08-21/203/1', '2026-08-21/203/5']);
	});

	it('이전 담당 교사를 함께 기록한다', () => {
		const result = diffTimetable({
			dates,
			comciActual: week.actual,
			comciBase: week.base,
			firestoreOverrides: {},
			staticOverrides: {}
		});
		const sample = result.changed[0];
		expect(sample.entry.prevTeacher).toBeTruthy();
	});

	it('한 번 반영한 뒤 다시 돌리면 변경이 없다', () => {
		const first = diffTimetable({
			dates,
			comciActual: week.actual,
			comciBase: week.base,
			firestoreOverrides: {},
			staticOverrides: {}
		});

		const applied: Record<string, any> = {};
		for (const change of first.changed) {
			applied[change.date] ??= {};
			applied[change.date][change.classId] ??= {};
			applied[change.date][change.classId][change.period] = change.entry;
		}

		const second = diffTimetable({
			dates,
			comciActual: week.actual,
			comciBase: week.base,
			firestoreOverrides: applied,
			staticOverrides: {}
		});

		expect(second.changed).toEqual([]);
		expect(second.restored).toEqual([]);
	});
});
