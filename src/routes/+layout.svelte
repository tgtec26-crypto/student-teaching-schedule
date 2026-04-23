<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { user, login, logout, isAdmin, isSupervisor } from '$lib/firebase';
	import { supervisorResetSignal } from '$lib/supervisorNav';
	import { LogIn, LogOut, User as UserIcon, ArrowLeft, ShieldCheck, UserCheck, Bell, HelpCircle } from 'lucide-svelte';

	// /supervisor에 이미 있는 상태에서 '지도교사' 버튼을 누르면 목록 뷰로 복귀
	function handleSupervisorClick() {
		if (page.url.pathname === '/supervisor') {
			supervisorResetSignal.update((n) => n + 1);
		}
	}

	let { children } = $props();

	// observation/[date] 페이지인 경우 날짜 정보를 가져옴
	const dateParam = $derived(page.params.date);
	const formattedDate = $derived(
		dateParam
			? new Date(dateParam).toLocaleDateString('ko-KR', {
					month: 'long',
					day: 'numeric',
					weekday: 'short'
				})
			: ''
	);
</script>

<header class="header-container">
	<div class="header-inner">
		<!-- Top-left: Admin/Supervisor buttons -->
		<div class="top-left-actions">
			{#if $user}
				{#if $isAdmin}
					<a href="/admin" class="top-btn admin">
						<ShieldCheck size={14} /> 관리자
					</a>
				{/if}
				{#if $isSupervisor || $isAdmin}
					<a href="/supervisor" class="top-btn supervisor" onclick={handleSupervisorClick}>
						<UserCheck size={14} /> 지도교사
					</a>
				{/if}
			{/if}
		</div>

		<div class="header-content-main">
			<a href="/" class="header-link">
				<h1 class="header-title"><span class="accent">SNUG</span> 교육실습 참관 신청</h1>
			</a>

			{#if formattedDate}
				<div class="header-subtitle-area">
					<a href="/" class="btn-back-header">
						<ArrowLeft size={16} />
						뒤로가기
					</a>
					<span class="header-date-title">{formattedDate} 시간표</span>
				</div>
			{:else}
				<p class="header-desc">서울사대부여중 교육실습 시스템</p>
			{/if}
		</div>

		<img src="/school-logo.svg" alt="SNUG Logo" class="header-logo" />

		<div class="auth-box">
			{#if $user}
				<div class="user-info">
					<a href="/guide" class="btn-settings" title="이용 안내 (참고)">
						<HelpCircle size={18} />
						<span class="btn-label">참고</span>
					</a>
					<a href="/settings" class="btn-settings" title="알림 설정">
						<Bell size={18} />
					</a>
					<span class="user-name">{$user.displayName}</span>
					<button class="btn-logout" onclick={logout} title="로그아웃">
						<LogOut size={18} />
					</button>
				</div>
			{:else}
				<button class="btn-login" onclick={login}>
					<LogIn size={18} />
					로그인
				</button>
			{/if}
		</div>
	</div>
</header>

<main>
	{@render children()}
</main>

<style>
	.header-container {
		background-color: var(--header-bg);
		color: white;
		padding: 2.5rem 1.5rem 1.5rem 1.5rem;
		position: relative;
		z-index: 10;
	}

	.header-inner {
		max-width: 1300px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		gap: 3rem;
		min-height: 100px;
	}

	.top-left-actions {
		position: absolute;
		left: 0;
		top: 0;
		display: flex;
		gap: 0.5rem;
		z-index: 50;
		pointer-events: auto;
	}

	.top-btn {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem 0.8rem;
		border-radius: 50px;
		font-size: 0.8rem;
		font-weight: 800;
		text-decoration: none;
		color: white;
		background: rgba(255, 255, 255, 0.15);
		border: 1px solid rgba(255, 255, 255, 0.2);
		transition: all 0.2s;
		cursor: pointer;
	}

	.top-btn:hover {
		background: rgba(255, 255, 255, 0.25);
		transform: translateY(-1px);
	}

	.top-btn.admin { border-color: #94a3b8; }
	.top-btn.supervisor { border-color: #f59e0b; color: #fbbf24; }

	.header-content-main {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.5rem;
		z-index: 5;
	}

	.header-link {
		text-decoration: none;
		color: inherit;
	}

	.header-title {
		font-size: 3rem;
		font-weight: 900;
		margin: 0;
		letter-spacing: -0.03em;
		line-height: 1.1;
	}

	.header-title .accent {
		color: var(--accent-green);
	}

	.header-desc {
		margin: 0.5rem 0 0 0;
		font-size: 1.1rem;
		opacity: 0.8;
		font-weight: 500;
		letter-spacing: 0.05em;
	}

	.header-subtitle-area {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.2rem;
		margin-top: 0.8rem;
	}

	.btn-back-header {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		color: white;
		text-decoration: none;
		font-weight: 700;
		font-size: 0.9rem;
		background: rgba(255, 255, 255, 0.15);
		padding: 0.35rem 0.8rem;
		border-radius: 50px;
		transition: all 0.2s;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.btn-back-header:hover {
		background: rgba(255, 255, 255, 0.3);
		transform: translateX(-3px);
	}

	.header-date-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: white;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
	}

	.header-logo {
		width: 100px;
		height: 100px;
		filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.2));
	}

	.auth-box {
		position: absolute;
		right: 0;
		top: 0;
		z-index: 50;
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		background: rgba(255, 255, 255, 0.1);
		padding: 0.4rem 0.8rem;
		border-radius: 50px;
		color: white;
		font-size: 0.85rem;
	}

	.user-name {
		font-weight: 600;
	}

	.btn-logout {
		background: none;
		border: none;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		padding: 0.2rem;
		opacity: 0.7;
	}

	.btn-settings {
		color: white;
		display: flex;
		align-items: center;
		padding: 0.2rem;
		opacity: 0.8;
		transition: all 0.2s;
	}

	.btn-settings:hover {
		opacity: 1;
		transform: scale(1.1);
	}

	.btn-label {
		font-size: 0.75rem;
		font-weight: 800;
		margin-left: 0.2rem;
	}

	.btn-login {
		background-color: var(--accent-green);
		color: var(--header-bg);
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 8px;
		font-weight: 800;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
		font-size: 0.9rem;
	}

	/* ─── ≤1000px: 가로 배치 헤더 (Galaxy 가로 915px 포함) ─── */
	@media (max-width: 1000px) {
		/* iOS 노치/다이나믹 아일랜드 safe-area 대응 */
		.header-container {
			padding: 0.5rem max(1rem, env(safe-area-inset-right)) 0.5rem max(1rem, env(safe-area-inset-left));
		}
		.header-inner {
			flex-direction: row;
			flex-wrap: nowrap;
			align-items: center;
			justify-content: flex-start;
			gap: 0.6rem;
			min-height: auto;
		}
		.header-logo { order: 1; width: 40px; height: 40px; flex-shrink: 0; }
		.header-content-main {
			order: 2; flex: 1; align-items: flex-start;
			text-align: left; gap: 0; min-width: 0;
		}
		.header-title {
			font-size: 1.15rem; letter-spacing: 0;
			white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
		}
		.header-desc { display: none; }
		.top-left-actions { position: static; order: 3; gap: 0.3rem; flex-shrink: 0; }
		.top-btn { padding: 0.25rem 0.55rem; font-size: 0.75rem; }
		.auth-box { position: static; order: 4; flex-shrink: 0; }
		.user-info { padding: 0.3rem 0.65rem; gap: 0.4rem; font-size: 0.8rem; }
		.user-name { white-space: nowrap; }
	}

	/* ─── 다크 모드 ─── */
	@media (prefers-color-scheme: dark) {
		.header-container { border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
		.btn-login { background-color: var(--accent-green); color: #0d1128; font-weight: 900; }
		.user-info { background: rgba(255, 255, 255, 0.08); }
		.top-btn { border-color: rgba(255, 255, 255, 0.22); }
		.top-btn.supervisor { color: #fbbf24; border-color: #fbbf24; }
	}

	/* ─── ≤600px: 소형 모바일 세로 모드 추가 압축 ─── */
	@media (max-width: 600px) {
		.header-container { padding: 0.4rem 0.65rem; }
		.header-inner { gap: 0.35rem; }
		.header-logo { width: 28px; height: 28px; }
		.header-title { font-size: 0.85rem; }
		.top-btn { padding: 0.15rem 0.35rem; font-size: 0.62rem; gap: 0.1rem; }
		.user-info { padding: 0.22rem 0.4rem; gap: 0.2rem; font-size: 0.7rem; }
		.user-name { max-width: 46px; }
		.btn-label { display: none; }
		.btn-settings { padding: 0.1rem; }
		.btn-login { padding: 0.38rem 0.65rem; font-size: 0.78rem; }
	}
</style>
