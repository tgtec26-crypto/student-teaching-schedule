<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { user, login, logout, isAdmin, isSupervisor } from '$lib/firebase';
	import { LogIn, LogOut, User as UserIcon, ArrowLeft, ShieldCheck, UserCheck } from 'lucide-svelte';

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
					<a href="/supervisor" class="top-btn supervisor">
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
					<UserIcon size={18} />
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

	@media (max-width: 1000px) {
		.header-inner {
			flex-direction: column;
			gap: 1.5rem;
		}
		.header-logo {
			width: 80px;
			height: 80px;
		}
		.header-title {
			font-size: 2.2rem;
		}
		.auth-box {
			position: static;
			margin-top: 1rem;
		}
		.top-left-actions {
			position: static;
			margin-bottom: 0.5rem;
		}
	}
</style>
