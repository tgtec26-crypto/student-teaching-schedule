<script lang="ts">
	import { user, isAdmin, isSupervisor, db, logout, userRole } from '$lib/firebase';
	import { Calendar, ArrowRight, Lock, ShieldCheck, AlertCircle, Users, Info, UserCheck } from 'lucide-svelte';
	import { doc, getDoc } from 'firebase/firestore';
	import { onMount } from 'svelte';

	const observationDates = [
		{ date: '2026-05-11', label: '5월 11일(월)' },
		{ date: '2026-05-12', label: '5월 12일(화)' },
		{ date: '2026-05-13', label: '5월 13일(수)' },
		{ date: '2026-05-14', label: '5월 14일(목)' },
		{ date: '2026-05-15', label: '5월 15일(금)' }
	];

	let isWhitelisted = $state(true);
	let checking = $state(true);

	async function checkWhitelist() {
		if (!$user) {
			checking = false;
			return;
		}
		// 관리자나 지도교사는 화이트리스트 체크 제외 (항상 허용)
		if ($isAdmin || $isSupervisor) {
			isWhitelisted = true;
			checking = false;
			return;
		}

		try {
			const docSnap = await getDoc(doc(db, "settings", "admin_whitelist"));
			if (docSnap.exists()) {
				const adminList = docSnap.data().emails || [];
				isWhitelisted = adminList.includes($user.email);
			} else {
				// 화이트리스트가 없으면 기본적으로 학생 권한은 허용 (또는 정책에 따라 변경)
				isWhitelisted = true; 
			}
		} catch (e) {
			console.error("Whitelist check error:", e);
			isWhitelisted = true;
		} finally {
			checking = false;
		}
	}

	$effect(() => {
		if ($user && $userRole !== null) checkWhitelist();
		else if (!$user) checking = false;
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
			<p>본 시스템은 서울사대부여중 교육실습생 전용입니다.<br />학교 계정(@snu-g.ms.kr)으로 로그인해 주세요.</p>
		</div>
	{:else if !isWhitelisted}
		<div class="login-screen card error">
			<div class="lock-icon danger">
				<AlertCircle size={64} />
			</div>
			<h2>🚫 접근이 거부되었습니다</h2>
			<p>시스템 이용 권한이 없습니다. 관리자에게 문의해 주세요.<br />(접속 계정: {$user.email})</p>
			<button class="btn btn-primary" on:click={logout}>다른 계정으로 로그인</button>
		</div>
	{:else}
		<section class="welcome card">
			<div class="welcome-text">
				<h2>👋 안녕하세요, {$user.displayName} 선생님!</h2>
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
			<div class="info-badges">
				<span class="badge">
					<Calendar size={16} />
					참관 기간: 5월 11일 ~ 5월 15일
				</span>
				<span class="badge alert">
					<Info size={16} />
					시간당 최대 5명 신청 가능
				</span>
			</div>
		</section>

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
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.date-card {
		text-decoration: none;
		color: inherit;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		min-height: 140px;
		padding: 1.2rem !important;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		border: 1px solid #eee;
		background-color: #fafaf5 !important; /* 미색 배경 */
	}

	.date-card:hover {
		transform: translateY(-5px);
		border-color: var(--accent-green);
		background-color: #ffffff !important; /* 호버 시 흰색으로 강조 */
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
	}

	.date-header {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.8rem;
		color: var(--header-bg);
	}

	.date-label {
		font-size: 1.25rem;
		font-weight: 800;
		word-break: keep-all;
	}

	.date-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-weight: 700;
		font-size: 0.85rem;
		color: var(--text-muted);
		padding-top: 0.8rem;
		border-top: 1px solid #eee;
	}

	.date-card:hover .date-footer {
		color: var(--header-bg);
	}

	@media (max-width: 1100px) {
		.date-grid {
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		}
	}
</style>
