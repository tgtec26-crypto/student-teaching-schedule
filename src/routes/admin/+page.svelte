<script lang="ts">
	import { user, db, isAdmin } from '$lib/firebase';
	import { doc, getDoc, setDoc } from 'firebase/firestore';
	import { onMount } from 'svelte';
	import { Shield, Save, Users, AlertCircle, CheckCircle2 } from 'lucide-svelte';

	let whitelistInput = $state('');
	let loading = $state(true);
	let saving = $state(false);
	let message = $state({ text: '', type: '' });

	onMount(async () => {
		try {
			const docSnap = await getDoc(doc(db, "settings", "admin_whitelist"));
			if (docSnap.exists()) {
				const emails = docSnap.data().emails || [];
				whitelistInput = emails.join('\n');
			}
		} catch (e) {
			console.error("Whitelist load error:", e);
		} finally {
			loading = false;
		}
	});

	async function saveWhitelist() {
		if (!confirm('화이트리스트를 업데이트하시겠습니까?')) return;
		
		saving = true;
		message = { text: '', type: '' };

		// Clean up emails: split by newline/comma, trim, and filter empty strings
		const emails = whitelistInput
			.split(/[\n,]/)
			.map(e => e.trim())
			.filter(e => e.length > 0 && e.includes('@'));

		try {
			await setDoc(doc(db, "settings", "admin_whitelist"), {
				emails: emails,
				updatedAt: new Date(),
				updatedBy: $user?.email
			});
			message = { text: `성공적으로 저장되었습니다. (총 ${emails.length}명)`, type: 'success' };
			whitelistInput = emails.join('\n'); // 정제된 목록으로 다시 표시
		} catch (e: any) {
			console.error("Save error:", e);
			message = { text: '저장 중 오류가 발생했습니다: ' + e.message, type: 'error' };
		} finally {
			saving = false;
		}
	}
</script>

<div class="container">
	{#if !$isAdmin}
		<div class="error-state card">
			<AlertCircle size={48} color="#e63946" />
			<h2>접근 권한이 없습니다</h2>
			<p>이 페이지는 관리자만 접근할 수 있습니다.</p>
			<a href="/" class="btn btn-primary">홈으로 돌아가기</a>
		</div>
	{:else}
		<header class="admin-header">
			<div class="title-group">
				<Shield size={32} />
				<h1>시스템 관리자 설정</h1>
			</div>
			<p>로그인을 허용할 사용자 이메일 목록을 관리합니다.</p>
		</header>

		<div class="admin-content grid">
			<section class="whitelist-section card">
				<div class="section-header">
					<Users size={20} />
					<h3>이메일 화이트리스트 일괄 등록</h3>
				</div>
				
				<div class="input-group">
					<label for="whitelist">이메일 목록 (줄바꿈 또는 쉼표로 구분)</label>
					<textarea 
						id="whitelist"
						bind:value={whitelistInput}
						placeholder="user1@snu-g.ms.kr&#10;user2@snu-g.ms.kr"
						disabled={loading || saving}
					></textarea>
				</div>

				<div class="action-bar">
					{#if message.text}
						<div class="message {message.type}">
							{#if message.type === 'success'}
								<CheckCircle2 size={18} />
							{:else}
								<AlertCircle size={18} />
							{/if}
							{message.text}
						</div>
					{/if}
					
					<button 
						class="btn btn-save" 
						on:click={saveWhitelist}
						disabled={loading || saving}
					>
						<Save size={20} />
						{saving ? '저장 중...' : '설정 저장하기'}
					</button>
				</div>
			</section>

			<aside class="guide-section card">
				<h3>💡 사용 가이드</h3>
				<ul>
					<li>이메일은 **엔터(줄바꿈)** 또는 **쉼표(,)**로 구분하여 여러 명을 한꺼번에 입력할 수 있습니다.</li>
					<li>입력 시 자동으로 공백을 제거하고 유효한 이메일 형식만 추출합니다.</li>
					<li>관리자(`tgtec26@snu-g.ms.kr`)는 화이트리스트 등록 여부와 상관없이 항상 접속 가능합니다.</li>
					<li>화이트리스트에 없는 사용자가 로그인을 시도하면 시스템 이용이 차단됩니다.</li>
				</ul>
			</aside>
		</div>
	{/if}
</div>

<style>
	.admin-header {
		margin-bottom: 2rem;
	}

	.title-group {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		color: var(--header-bg);
		margin-bottom: 0.5rem;
	}

	.title-group h1 {
		margin: 0;
		font-size: 2rem;
		font-weight: 900;
	}

	.admin-content.grid {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 2rem;
		align-items: start;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
		color: var(--header-bg);
		border-bottom: 2px solid #eee;
		padding-bottom: 0.8rem;
	}

	.section-header h3 { margin: 0; }

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.input-group label {
		font-weight: 700;
		color: #555;
	}

	textarea {
		width: 100%;
		height: 400px;
		padding: 1rem;
		border: 2px solid #ddd;
		border-radius: 8px;
		font-family: 'Consolas', 'Monaco', monospace;
		font-size: 0.95rem;
		line-height: 1.5;
		resize: vertical;
		transition: border-color 0.2s;
	}

	textarea:focus {
		outline: none;
		border-color: var(--header-bg);
	}

	.action-bar {
		margin-top: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.btn-save {
		background-color: var(--header-bg);
		color: white;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem 2rem;
		font-size: 1.1rem;
		border: none;
		border-radius: 8px;
		font-weight: 800;
		cursor: pointer;
		margin-left: auto;
	}

	.btn-save:hover:not(:disabled) {
		background-color: #1e255a;
		transform: translateY(-2px);
	}

	.btn-save:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.message {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 700;
		padding: 0.8rem 1.2rem;
		border-radius: 8px;
	}

	.message.success {
		background: #e6fffa;
		color: #2c7a7b;
	}

	.message.error {
		background: #fff5f5;
		color: #c53030;
	}

	.guide-section h3 {
		margin-top: 0;
		color: var(--header-bg);
		border-bottom: 1px solid #eee;
		padding-bottom: 0.5rem;
	}

	.guide-section ul {
		padding-left: 1.2rem;
		margin: 0;
	}

	.guide-section li {
		margin-bottom: 0.8rem;
		font-size: 0.9rem;
		color: #555;
	}

	.error-state {
		text-align: center;
		padding: 5rem 2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	@media (max-width: 900px) {
		.admin-content.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
