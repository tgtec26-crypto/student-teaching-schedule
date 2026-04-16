<script lang="ts">
	import { user, isAdmin, isSupervisor, db, logout, userRole } from '$lib/firebase';
	import {
		Calendar,
		ArrowRight,
		Lock,
		ShieldCheck,
		AlertCircle,
		Users,
		Info,
		UserCheck
	} from 'lucide-svelte';
	import { doc, getDoc } from 'firebase/firestore';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	const observationDates = [
		{ date: '2026-05-11', label: '5월 11일(월)' },
		{ date: '2026-05-12', label: '5월 12일(화)' },
		{ date: '2026-05-13', label: '5월 13일(수)' },
		{ date: '2026-05-14', label: '5월 14일(목)' },
		{ date: '2026-05-15', label: '5월 15일(금)' },
		{ date: '2026-05-18', label: '5월 18일(월)' },
		{ date: '2026-05-19', label: '5월 19일(화)' },
		{ date: '2026-05-20', label: '5월 20일(수)' },
		{ date: '2026-05-21', label: '5월 21일(목)' },
		{ date: '2026-05-22', label: '5월 22일(금)' },
		{ date: '2026-05-25', label: '5월 25일(월)' },
		{ date: '2026-05-26', label: '5월 26일(화)' },
		{ date: '2026-05-27', label: '5월 27일(수)' },
		{ date: '2026-05-28', label: '5월 28일(목)' },
		{ date: '2026-05-29', label: '5월 29일(금)' }
	];

	let checking = $state(true);

	$effect(() => {
		if ($user && $userRole !== null) {
			// If pure supervisor (not admin), redirect immediately and DON'T show the page content
			if ($isSupervisor && !$isAdmin) {
				goto('/supervisor');
			} else {
				checking = false;
			}
		} else if (!$user) {
			checking = false;
		}
	});
</script>

<div class="container">
	{#if checking}
		<div class="loading-screen card">
			<p>사용자 권한을 확인 중입니다...</p>
		</div>
	{:else if !$user}
		<div class="login-screen card">
			<div class="lock-icon">
				<Lock size={64} />
			</div>
			<h2>🔒 로그인 후 이용 가능합니다</h2>
			<p>
				본 시스템은 서울사대부여중 교육실습생 전용입니다.<br />학교 계정(@snu-g.ms.kr)으로 로그인해
				주세요.
			</p>
		</div>
	{:else}
		<section class="welcome card">
			<div class="welcome-text">
				<h2>안녕하세요, {$user.displayName} 선생님!</h2>
				<p>참관하고 싶은 날짜를 선택하여 시간표를 확인하고 신청해 주세요.</p>
				<div class="badge-group">
					{#if $isAdmin}
						<a href="/admin" class="admin-badge">
							<ShieldCheck size={16} />
							관리자 모드
						</a>
					{/if}
					{#if $isSupervisor || $isAdmin}
						<a href="/supervisor" class="supervisor-badge">
							<UserCheck size={16} />
							지도 교사 페이지
						</a>
					{/if}
				</div>
			</div>
			{#if !$isSupervisor || $isAdmin}
				<div class="info-badges">
					<span class="badge">
						<Calendar size={16} />
						참관 기간: 5월 11일 ~ 5월 29일
					</span>
					<span class="badge alert">
						<Info size={16} />
						시간당 최대 5명 신청 가능
					</span>
				</div>
			{/if}
		</section>

		{#if !$isSupervisor || $isAdmin}
			<div class="date-grid">
				{#each observationDates as item}
					<a href="/observation/{item.date}" class="date-card card">
						<div class="date-header">
							<Calendar size={24} />
							<span class="date-label">{item.label}</span>
						</div>
						<div class="date-footer">
							<span>참관 신청하기</span>
							<ArrowRight size={20} />
						</div>
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.loading-screen {
		text-align: center;
		padding: 5rem 2rem;
		margin-top: 3rem;
	}

	.login-screen {
		text-align: center;
		padding: 5rem 2rem;
		margin-top: 3rem;
	}

	.login-screen.error {
		border: 2px solid #e63946;
	}

	.lock-icon {
		color: var(--header-bg);
		margin-bottom: 1.5rem;
		opacity: 0.2;
	}

	.lock-icon.danger {
		color: #e63946;
		opacity: 1;
	}

	.welcome {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1.5rem;
		border-left: 6px solid var(--accent-green);
	}

	.welcome h2 {
		margin: 0 0 0.5rem 0;
		color: var(--header-bg);
	}

	.admin-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: var(--header-bg);
		color: white;
		padding: 0.3rem 0.8rem;
		border-radius: 50px;
		font-size: 0.85rem;
		font-weight: 700;
		text-decoration: none;
	}

	.admin-badge:hover {
		background: #1e255a;
	}

	.supervisor-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: #f59e0b;
		color: white;
		padding: 0.3rem 0.8rem;
		border-radius: 50px;
		font-size: 0.85rem;
		font-weight: 700;
		text-decoration: none;
	}

	.supervisor-badge:hover {
		background: #d97706;
	}

	.badge-group {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-top: 0.8rem;
	}

	.info-badges {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.badge {
		background: #eef2f1;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		font-weight: 600;
		font-size: 0.9rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--header-bg);
	}

	.badge.alert {
		background: #fff0f0;
		color: #e63946;
	}

	.date-grid {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 0.6rem;
		margin-top: 1rem;
	}

	.date-card {
		text-decoration: none;
		color: inherit;
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-height: auto;
		height: 80px;
		padding: 0.6rem 0.8rem !important;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		border: 1px solid #eee;
		background-color: #fafaf5 !important;
		border-radius: 8px;
	}

	.date-card:hover {
		transform: translateY(-2px);
		border-color: var(--accent-green);
		background-color: #ffffff !important;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.06);
	}

	.date-header {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.6rem;
		color: var(--header-bg);
	}

	.date-label {
		font-size: 1rem;
		font-weight: 800;
		word-break: keep-all;
		letter-spacing: -0.02em;
	}

	.date-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-weight: 700;
		font-size: 0.7rem;
		color: var(--text-muted);
		padding-top: 0.4rem;
		margin-top: 0.4rem;
		border-top: 1px solid #f1f1f1;
	}

	.date-card:hover .date-footer {
		color: var(--header-bg);
	}

	@media (max-width: 1100px) {
		.date-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 600px) {
		.date-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
