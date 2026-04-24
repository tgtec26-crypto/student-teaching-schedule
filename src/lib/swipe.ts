// 좌우 스와이프 감지 Svelte 액션
// - 내부 가로 스크롤(overflow-x)이 있는 요소에서도 충돌 없이 동작하도록
//   스크롤이 양 끝에 도달했을 때만 콜백을 발화한다.
// - 수직 스크롤을 방해하지 않기 위해 수평 이동이 수직 이동보다 클 때만 스와이프로 간주.

export type SwipeOptions = {
	onLeft?: () => void;
	onRight?: () => void;
	threshold?: number; // 수평 이동 최소 px (기본 50)
};

export function swipe(node: HTMLElement, options: SwipeOptions) {
	let opts = options;
	let startX = 0;
	let startY = 0;
	let tracking = false;
	let startScrollLeft = 0;
	let startMaxScroll = 0;

	function onTouchStart(e: TouchEvent) {
		if (e.touches.length !== 1) {
			tracking = false;
			return;
		}
		const t = e.touches[0];
		startX = t.clientX;
		startY = t.clientY;
		startScrollLeft = node.scrollLeft;
		startMaxScroll = Math.max(0, node.scrollWidth - node.clientWidth);
		tracking = true;
	}

	function onTouchEnd(e: TouchEvent) {
		if (!tracking) return;
		tracking = false;
		const t = e.changedTouches[0];
		if (!t) return;
		const dx = t.clientX - startX;
		const dy = t.clientY - startY;
		const threshold = opts.threshold ?? 50;
		if (Math.abs(dx) < threshold) return;
		if (Math.abs(dy) > Math.abs(dx)) return; // 세로 제스처 우선

		const endScrollLeft = node.scrollLeft;
		const endMax = Math.max(0, node.scrollWidth - node.clientWidth);

		// 내부 가로 스크롤이 끝(또는 처음)에 도달한 상태에서만 주차 이동
		// 스크롤이 불가능한(컨텐츠가 충분히 좁은) 경우도 바로 발화
		if (dx < 0) {
			// 왼쪽으로 스와이프 → 다음 주
			if (endMax === 0 || endScrollLeft >= endMax - 2 || startScrollLeft >= startMaxScroll - 2) {
				opts.onLeft?.();
			}
		} else {
			// 오른쪽으로 스와이프 → 이전 주
			if (endMax === 0 || endScrollLeft <= 2 || startScrollLeft <= 2) {
				opts.onRight?.();
			}
		}
	}

	function onTouchCancel() {
		tracking = false;
	}

	node.addEventListener('touchstart', onTouchStart, { passive: true });
	node.addEventListener('touchend', onTouchEnd, { passive: true });
	node.addEventListener('touchcancel', onTouchCancel, { passive: true });

	return {
		update(newOptions: SwipeOptions) {
			opts = newOptions;
		},
		destroy() {
			node.removeEventListener('touchstart', onTouchStart);
			node.removeEventListener('touchend', onTouchEnd);
			node.removeEventListener('touchcancel', onTouchCancel);
		}
	};
}
