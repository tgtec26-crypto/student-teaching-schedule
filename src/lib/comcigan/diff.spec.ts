import { describe, it, expect } from 'vitest';
import { diffTimetable, compareBaseTimetable, BaseTimetableChanged } from './diff';
import type { DaySlots } from './decode';

const 국어 = { teacher: '이현진', subject: '국어A' };
const 기가 = { teacher: '강율이', subject: '기가' };
const 영어 = { teacher: '박혜리', subject: '영어' };

/** 월요일 기본 시간표: 101 3교시 국어A */
const base: Record<string, DaySlots> = {
	'1': { '101': { '3': 국어 } }
};

function run(
	comciDay: DaySlots,
	overrides: Record<string, any> = {},
	statics: Record<string, any> = {}
) {
	return diffTimetable({
		dates: ['2027-05-10'], // 월요일
		comciActual: { '2027-05-10': comciDay },
		comciBase: base,
		firestoreOverrides: { '2027-05-10': overrides },
		staticOverrides: { '2027-05-10': statics }
	});
}

describe('diffTimetable', () => {
	it('컴시간과 시스템이 같으면 변경이 없다', () => {
		const result = run({ '101': { '3': 국어 } });
		expect(result.changed).toEqual([]);
		expect(result.restored).toEqual([]);
	});

	it('교사가 바뀌면 변경으로 잡고 이전 값을 남긴다', () => {
		const result = run({ '101': { '3': 기가 } });
		expect(result.changed).toEqual([
			{
				date: '2027-05-10',
				classId: '101',
				period: '3',
				entry: {
					teacher: '강율이',
					subject: '기가',
					prevTeacher: '이현진',
					prevSubject: '국어A'
				}
			}
		]);
	});

	it('교사가 같고 과목만 바뀌어도 잡는다', () => {
		const result = run({ '101': { '3': { teacher: '이현진', subject: '국어B' } } });
		expect(result.changed).toHaveLength(1);
	});

	it('기존 override 와 컴시간이 일치하면 다시 쓰지 않는다', () => {
		const result = run({ '101': { '3': 기가 } }, { '101': { '3': { ...기가 } } });
		expect(result.changed).toEqual([]);
		expect(result.restored).toEqual([]);
	});

	it('컴시간이 기본으로 되돌리면 override 를 지운다', () => {
		const result = run({ '101': { '3': 국어 } }, { '101': { '3': { ...기가 } } });
		expect(result.changed).toEqual([]);
		expect(result.restored).toEqual([{ date: '2027-05-10', classId: '101', period: '3' }]);
	});

	it('정적 override 를 기본으로 되돌릴 때는 삭제 대신 덮어쓴다', () => {
		// 정적 상수는 Firestore 에서 지울 수 없으므로 같은 값을 써서 무력화한다.
		const result = run({ '101': { '3': 국어 } }, {}, { '101': { '3': { ...기가 } } });
		expect(result.restored).toEqual([]);
		expect(result.changed).toHaveLength(1);
		expect(result.changed[0].entry).toMatchObject({ teacher: '이현진', subject: '국어A' });
	});

	it('수업이 사라지면 결강으로 기록한다', () => {
		// 3교시가 없어지고 4교시가 생긴 날. 하루 전체가 비면 휴일로 보고 건너뛴다.
		const result = run({ '101': { '4': 영어 } });
		const cancelled = result.changed.find((c) => c.period === '3');
		expect(cancelled!.entry).toEqual({
			cancelled: true,
			prevTeacher: '이현진',
			prevSubject: '국어A'
		});
	});

	it('하루치가 통째로 비어 있으면 휴일로 보고 건너뛴다', () => {
		const result = run({ '101': {} });
		expect(result.changed).toEqual([]);
		expect(result.skippedDates).toEqual(['2027-05-10']);
	});

	it('결강 override 를 이미 반영했으면 다시 쓰지 않는다', () => {
		const result = run(
			{ '101': { '4': 영어 } },
			{ '101': { '3': { cancelled: true, prevTeacher: '이현진', prevSubject: '국어A' } } }
		);
		expect(result.changed.map((c) => c.period)).toEqual(['4']);
	});

	it('빈 슬롯에 수업이 생기면 변경으로 잡는다', () => {
		const result = run({ '101': { '3': 국어, '4': 영어 } });
		expect(result.changed).toHaveLength(1);
		expect(result.changed[0]).toMatchObject({ period: '4' });
	});

	it('같은 입력을 두 번 넣어도 결과가 같다', () => {
		const once = run({ '101': { '3': 기가 } });
		const twice = run({ '101': { '3': 기가 } }, { '101': { '3': once.changed[0].entry } });
		expect(twice.changed).toEqual([]);
		expect(twice.restored).toEqual([]);
	});

	it('컴시간 데이터가 없는 날짜는 건너뛴다', () => {
		const result = diffTimetable({
			dates: ['2027-05-10', '2027-05-11'],
			comciActual: { '2027-05-10': { '101': { '3': 국어 } } },
			comciBase: base,
			firestoreOverrides: {},
			staticOverrides: {}
		});
		expect(result.changed).toEqual([]);
		expect(result.skippedDates).toEqual(['2027-05-11']);
	});
});

describe('compareBaseTimetable', () => {
	const system = { '101': { '3': 국어 } };

	it('일치하면 통과한다', () => {
		expect(compareBaseTimetable({ '1': system }, { '1': system })).toBeUndefined();
	});

	it('다르면 중단한다', () => {
		expect(() => compareBaseTimetable({ '1': { '101': { '3': 기가 } } }, { '1': system })).toThrow(
			BaseTimetableChanged
		);
	});

	it('어긋난 슬롯을 메시지에 담는다', () => {
		expect(() => compareBaseTimetable({ '1': { '101': { '3': 기가 } } }, { '1': system })).toThrow(
			/101.*3교시/
		);
	});
});
