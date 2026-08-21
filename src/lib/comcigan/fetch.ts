import { parseComciJson } from './decode';

const ENDPOINT = 'http://comci.net:4082/36179';
const DATA_PREFIX = '73629_';

/**
 * 컴시간 주간 시간표를 받아온다. `week` 는 `일자자료` 의 인덱스로 1=이번 주, 2=다음 주.
 *
 * 평문 HTTP 만 제공된다. 공개 시간표라 민감정보는 없지만 인증에 쓰면 안 된다.
 */
export async function fetchComciWeek(schoolCode: number, week: number): Promise<any> {
	const payload = `${DATA_PREFIX}${schoolCode}_0_${week}`;
	const url = `${ENDPOINT}?${Buffer.from(payload, 'ascii').toString('base64')}`;

	const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
	if (!res.ok) {
		throw new Error(`컴시간 응답 오류 ${res.status} (주차 ${week})`);
	}
	return parseComciJson(await res.text());
}
