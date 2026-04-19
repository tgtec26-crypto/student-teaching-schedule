<script lang="ts">
	import { user, db } from '$lib/firebase';
	import { doc, getDoc, updateDoc } from 'firebase/firestore';
	import { Bell, Save, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let loading = $state(true);
	let saving = $state(false);
	let message = $state({ text: '', type: '' });

	let notifEnabled = $state(false);
	let notifLeadTime = $state(10); // Default 10 minutes

	const leadTimeOptions = [5, 10, 15, 20, 30];

	onMount(async () => {
		if ($user) {
			const userRef = doc(db, 'users', $user.email);
			const snap = await getDoc(userRef);
			if (snap.exists()) {
				const data = snap.data();
				notifEnabled = data.notifEnabled ?? false;
				notifLeadTime = data.notifLeadTime ?? 10;
			}
		}
		loading = false;
	});

	async function saveSettings() {
		if (!$user) return;
		saving = true;
		message = { text: '', type: '' };

		try {
			const userRef = doc(db, 'users', $user.email);
			await updateDoc(userRef, {
				notifEnabled,
				notifLeadTime,
				updatedAt: new Date()
			});
			message = { text: '설정이 저장되었습니다.', type: 'success' };
			setTimeout(() => message = { text: '', type: '' }, 3000);
		} catch (e) {
			console.error(e);
			message = { text: '저장 중 오류가 발생했습니다.', type: 'error' };
		} finally {
			saving = false;
		}
	}
</script>

<div class="settings-container">
	<header class="settings-header">
		<a href="/" class="back-link"><ArrowLeft size={20} /> 홈으로</a>
		<div class="title-group">
			<Bell size={32} class="icon-bell" />
			<h1>알림 설정</h1>
		</div>
		<p class="subtitle">수업 시작 전 미리 알림을 받을 수 있도록 설정합니다.</p>
	</header>

	{#if loading}
		<div class="loading-state">
			<Loader2 size={40} class="spin" />
			<p>설정을 불러오는 중...</p>
		</div>
	{:else if !$user}
		<div class="error-state card">
			<AlertCircle size={48} color="#e63946" />
			<h2>로그인이 필요합니다</h2>
			<p>알림 설정을 위해 먼저 로그인해 주세요.</p>
		</div>
	{:else}
		<main class="settings-content card">
			<section class="settings-section">
				<div class="setting-item toggle">
					<div class="setting-info">
						<h3>알림 사용</h3>
						<p>수업 시작 전에 알림을 받습니다. (교사: 구글 챗, 실습생: 이메일)</p>
					</div>
					<label class="switch">
						<input type="checkbox" bind:checked={notifEnabled}>
						<span class="slider round"></span>
					</label>
				</div>

				<div class="setting-item select" class:disabled={!notifEnabled}>
					<div class="setting-info">
						<h3>알림 발송 시점</h3>
						<p>수업 시작 몇 분 전에 알림을 받을지 선택하세요.</p>
					</div>
					<div class="select-wrapper">
						<select bind:value={notifLeadTime} disabled={!notifEnabled}>
							{#each leadTimeOptions as opt}
								<option value={opt}>{opt}분 전</option>
							{/each}
						</select>
					</div>
				</div>
			</section>

			{#if message.text}
				<div class="message-box {message.type}">
					{#if message.type === 'success'}
						<CheckCircle2 size={18} />
					{:else}
						<AlertCircle size={18} />
					{/if}
					{message.text}
				</div>
			{/if}

			<footer class="settings-footer">
				<button class="btn-save" onclick={saveSettings} disabled={saving}>
					{#if saving}
						<Loader2 size={18} class="spin" />
						저장 중...
					{:else}
						<Save size={18} />
						설정 저장
					{/if}
				</button>
			</footer>
		</main>

		<aside class="notif-info card">
			<h3>교시별 시작 시간 안내</h3>
			<div class="time-grid">
				<div class="time-item"><span>1교시</span> <strong>08:40</strong></div>
				<div class="time-item"><span>2교시</span> <strong>09:35</strong></div>
				<div class="time-item"><span>3교시</span> <strong>10:30</strong></div>
				<div class="time-item"><span>4교시</span> <strong>11:25</strong></div>
				<div class="time-item"><span>5교시</span> <strong>13:10</strong></div>
				<div class="time-item"><span>6교시</span> <strong>14:05</strong></div>
				<div class="time-item"><span>7교시</span> <strong>15:00</strong></div>
			</div>
			<p class="info-tip">* 설정하신 시간에 맞춰 자동으로 알림이 발송됩니다.</p>
		</aside>
	{/if}
</div>

<style>
	.settings-container { max-width: 700px; margin: 0 auto; padding: 2rem 1.5rem 5rem 1.5rem; }
	.settings-header { margin-bottom: 2.5rem; }
	.back-link { display: flex; align-items: center; gap: 0.5rem; color: #64748b; text-decoration: none; font-weight: 700; margin-bottom: 1.5rem; width: fit-content; transition: color 0.2s; }
	.back-link:hover { color: var(--header-bg); }
	
	.title-group { display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.5rem; }
	.title-group h1 { margin: 0; font-size: 2.2rem; font-weight: 900; color: var(--header-bg); }
	.icon-bell { color: var(--accent-green); }
	.subtitle { color: #64748b; font-size: 1.1rem; font-weight: 500; margin: 0; }

	.card { background: white; border-radius: 20px; border: 1px solid #eef2f6; box-shadow: 0 10px 25px rgba(0,0,0,0.05); padding: 2rem; }
	
	.settings-section { display: flex; flex-direction: column; gap: 2rem; }
	.setting-item { display: flex; align-items: center; justify-content: space-between; gap: 2rem; }
	.setting-item.disabled { opacity: 0.5; pointer-events: none; }
	
	.setting-info h3 { margin: 0 0 0.3rem 0; font-size: 1.2rem; font-weight: 800; color: #1e293b; }
	.setting-info p { margin: 0; color: #64748b; font-size: 0.95rem; font-weight: 500; line-height: 1.4; }

	/* Switch Style */
	.switch { position: relative; display: inline-block; width: 60px; height: 34px; flex-shrink: 0; }
	.switch input { opacity: 0; width: 0; height: 0; }
	.slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #cbd5e1; transition: .4s; }
	.slider:before { position: absolute; content: ""; height: 26px; width: 26px; left: 4px; bottom: 4px; background-color: white; transition: .4s; }
	input:checked + .slider { background-color: var(--accent-green); }
	input:checked + .slider:before { transform: translateX(26px); }
	.slider.round { border-radius: 34px; }
	.slider.round:before { border-radius: 50%; }

	/* Select Style */
	.select-wrapper select { padding: 0.6rem 2.5rem 0.6rem 1rem; border-radius: 10px; border: 2px solid #e2e8f0; font-size: 1rem; font-weight: 700; color: #1e293b; background: white; appearance: none; cursor: pointer; }
	.select-wrapper { position: relative; }
	.select-wrapper:after { content: '▾'; position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); color: #64748b; pointer-events: none; }

	.message-box { margin-top: 2rem; padding: 1rem; border-radius: 12px; display: flex; align-items: center; gap: 0.6rem; font-weight: 700; font-size: 0.95rem; }
	.message-box.success { background: #dcfce7; color: #166534; }
	.message-box.error { background: #fee2e2; color: #991b1b; }

	.settings-footer { margin-top: 2.5rem; display: flex; justify-content: flex-end; }
	.btn-save { background: var(--header-bg); color: white; border: none; padding: 0.8rem 2rem; border-radius: 12px; font-weight: 800; font-size: 1.1rem; display: flex; align-items: center; gap: 0.6rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(40, 49, 81, 0.2); }
	.btn-save:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(40, 49, 81, 0.3); }
	.btn-save:disabled { opacity: 0.7; cursor: not-allowed; }

	.notif-info { margin-top: 2rem; background: #f8fafc; }
	.notif-info h3 { margin: 0 0 1rem 0; font-size: 1.1rem; font-weight: 800; }
	.time-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.8rem; }
	.time-item { background: white; padding: 0.6rem; border-radius: 10px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; }
	.time-item span { color: #64748b; font-weight: 600; }
	.time-item strong { color: var(--header-bg); font-weight: 800; }
	.info-tip { margin-top: 1.2rem; margin-bottom: 0; font-size: 0.85rem; color: #94a3b8; font-weight: 600; }

	.loading-state, .error-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; gap: 1rem; text-align: center; }
	.spin { animation: spin 1s linear infinite; color: var(--header-bg); }
	@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

	@media (max-width: 600px) {
		.setting-item { flex-direction: column; align-items: flex-start; gap: 1rem; }
		.btn-save { width: 100%; justify-content: center; }
		.time-grid { grid-template-columns: 1fr 1fr; }
	}
</style>
