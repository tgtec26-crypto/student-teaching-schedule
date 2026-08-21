/**
 * 컴시간 동기화 설정.
 *
 * 학교코드는 아래로 찾는다 (EUC-KR 퍼센트인코딩된 학교명):
 *   http://comci.net:4082/36179?17384l<학교명>
 * 서울사대부설여자중학교 = 38761.
 */
export const SCHOOL_CODE = 38761;

/**
 * 교육실습 기간. 이 밖의 날짜는 비교하지 않는다.
 * 실습 일정이 확정되면 정확한 날짜로 고쳐야 한다.
 */
export const INTERNSHIP_START = '2027-05-01';
export const INTERNSHIP_END = '2027-05-31';

/** 컴시간이 주는 조회 범위가 2주뿐이라 그 이상은 의미가 없다. */
export const HORIZON_DAYS = 14;

/**
 * 한 번에 반영할 수 있는 변경 건수 상한.
 * 넘으면 기본 시간표가 어긋났다고 보고 중단한다.
 */
export const MAX_CHANGES_PER_RUN = 30;

export const OVERRIDES_COLLECTION = 'timetable_overrides';
export const SYNC_RUNS_COLLECTION = 'sync_runs';
export const APPLICATIONS_COLLECTION = 'observation_applications';
