import { writable } from 'svelte/store';

// 지도교사 페이지에서 '목록으로' 복귀 시그널
// 사용자가 /supervisor에 이미 있는 상태에서 '지도교사' 링크를 클릭하면 증가
export const supervisorResetSignal = writable(0);
