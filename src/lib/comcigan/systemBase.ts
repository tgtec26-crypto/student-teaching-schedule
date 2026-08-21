/**
 * 저장소의 정적 시간표를 컴시간 비교용 형태로 바꾼다.
 *
 * `timetableData` 는 기준 주(2026-05-11 월 … 2026-05-15 금)의 날짜를 요일 대용으로
 * 쓴다. 비교할 때는 요일(1..5) 키로 맞춰야 한다.
 */

import { timetableData, scheduleOverrides } from '../timetableData';
import type { DaySlots, Slot } from './decode';

/** `timetableData` 가 요일 대용으로 쓰는 기준 주의 월요일 */
const BASE_WEEK_MONDAY_OFFSET = 10;

export function systemBaseByWeekday(): Record<string, DaySlots> {
	const base: Record<string, DaySlots> = {};
	for (let weekday = 1; weekday <= 5; weekday++) {
		const key = `2026-05-${BASE_WEEK_MONDAY_OFFSET + weekday}`;
		const day: DaySlots = {};
		for (const classId of Object.keys(timetableData)) {
			const slots = timetableData[classId]?.[key];
			if (slots) day[classId] = slots;
		}
		base[String(weekday)] = day;
	}
	return base;
}

/** 정적 override 를 날짜 → 학급 → 교시 로 뒤집는다. */
export function staticOverridesByDate(): Record<string, Record<string, Record<string, Slot>>> {
	const byDate: Record<string, Record<string, Record<string, Slot>>> = {};
	for (const [classId, dates] of Object.entries(scheduleOverrides)) {
		for (const [date, periods] of Object.entries(dates)) {
			byDate[date] ??= {};
			byDate[date][classId] = periods;
		}
	}
	return byDate;
}
