/**
 * 컴시간 동기화가 Firestore 에 기록한 시간표 변동분을 담는다.
 *
 * 비어 있으면 `getSlot` 은 기존 정적 `scheduleOverrides` 만 보고 동작한다.
 * 즉 이 저장소가 비어 있어도 앱은 예전과 똑같이 돈다.
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { setLiveOverrideResolver, type LiveOverride } from './timetableData';
import { OVERRIDES_COLLECTION } from './comcigan/config';

/** 날짜 → 학급 → 교시 → 변동 */
type OverridesByDate = Record<string, Record<string, Record<string, LiveOverride>>>;

let overrides = $state<OverridesByDate>({});
let loaded = $state(false);

export function liveOverridesLoaded() {
	return loaded;
}

function lookup(classId: string, dateStr: string, period: string) {
	return overrides[dateStr]?.[classId]?.[period];
}

setLiveOverrideResolver(lookup);

export async function loadLiveOverrides(fromDate: string, toDate: string) {
	const snap = await getDocs(
		query(
			collection(db, OVERRIDES_COLLECTION),
			where('date', '>=', fromDate),
			where('date', '<=', toDate)
		)
	);

	const next: OverridesByDate = {};
	snap.forEach((docSnap) => {
		const data = docSnap.data();
		if (data?.date && data?.slots) next[data.date] = data.slots;
	});

	overrides = next;
	loaded = true;
}
