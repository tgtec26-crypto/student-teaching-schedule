<script lang="ts">
	import { user, db, isAdmin, type UserRole } from '$lib/firebase';
	import {
		collection,
		getDocs,
		doc,
		updateDoc,
		query,
		orderBy,
		setDoc,
		onSnapshot,
		deleteDoc
	} from 'firebase/firestore';
	import { onMount } from 'svelte';
	import {
		Shield,
		Save,
		Users,
		AlertCircle,
		CheckCircle2,
		UserCog,
		Mail,
		ShieldCheck,
		UserPlus,
		Lock,
		Unlock
	} from 'lucide-svelte';

	let usersList = $state<any[]>([]);
	let teacherRestrictions = $state<string[]>([]);
	let loading = $state(true);
	let saving = $state<string | null>(null);
	let adding = $state(false);
	let message = $state({ text: '', type: '' });

	// New user bulk input state
	let bulkEmailsInput = $state('');
	let newUserRole = $state<UserRole>('STUDENT');

	const roles: UserRole[] = ['STUDENT', 'SUPERVISOR', 'ADMIN'];

	async function fetchUsers() {
		loading = true;
		try {
			// Fetch users
			const q = query(collection(db, 'users'), orderBy('email', 'asc'));
			const querySnapshot = await getDocs(q);
			usersList = querySnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data()
			}));

			// Subscribe to teacher restrictions
			onSnapshot(collection(db, 'teacher_restrictions'), (snapshot) => {
				teacherRestrictions = snapshot.docs.map((doc) => doc.id);
			});
		} catch (e) {
			console.error('Users load error:', e);
			message = { text: '사용자 목록을 불러오는 중 오류가 발생했습니다.', type: 'error' };
		} finally {
			loading = false;
		}
	}

	async function toggleTeacherRestriction(displayName: string) {
		if (!displayName) return;
		const isCurrentlyRestricted = teacherRestrictions.includes(displayName);

		try {
			if (isCurrentlyRestricted) {
				await deleteDoc(doc(db, 'teacher_restrictions', displayName));
				message = { text: `${displayName} 선생님의 참관 제한이 해제되었습니다.`, type: 'success' };
			} else {
				if (!confirm(`${displayName} 선생님의 모든 수업을 참관 불가로 전환하시겠습니까?`)) return;
				await setDoc(doc(db, 'teacher_restrictions', displayName), {
					restricted: true,
					updatedAt: new Date(),
					updatedBy: $user?.email
				});
				message = { text: `${displayName} 선생님의 참관이 전면 차단되었습니다.`, type: 'success' };
			}
		} catch (e: any) {
			console.error('Restriction error:', e);
			message = { text: '제한 설정 중 오류가 발생했습니다.', type: 'error' };
		}
	}

	onMount(() => {
		fetchUsers();
	});

	async function addUsers() {
		if (!bulkEmailsInput.trim()) {
			alert('이메일을 입력해주세요.');
			return;
		}

		// Split by newline or comma, trim, and filter valid emails
		const emails = bulkEmailsInput
			.split(/[\n,]/)
			.map((e) => e.trim().toLowerCase())
			.filter((e) => e.length > 0 && e.includes('@'));

		if (emails.length === 0) {
			alert('유효한 이메일 형식이 없습니다.');
			return;
		}

		if (!confirm(`총 ${emails.length}명의 사용자를 ${newUserRole} 권한으로 등록하시겠습니까?`)) {
			return;
		}

		adding = true;
		message = { text: '', type: '' };
		let successCount = 0;

		try {
			for (const email of emails) {
				const userRef = doc(db, 'users', email);
				await setDoc(
					userRef,
					{
						email: email,
						role: newUserRole,
						updatedAt: new Date(),
						updatedBy: $user?.email
					},
					{ merge: true }
				);
				successCount++;
			}

			message = {
				text: `${successCount}명의 사용자가 성공적으로 등록되었습니다.`,
				type: 'success'
			};
			bulkEmailsInput = '';
			fetchUsers();
		} catch (e: any) {
			console.error('Bulk add error:', e);
			message = { text: '사용자 등록 중 일부 오류가 발생했습니다: ' + e.message, type: 'error' };
		} finally {
			adding = false;
		}
	}

	async function updateUserRole(email: string, newRole: UserRole) {
		if (!confirm(`${email} 사용자의 권한을 ${newRole}(으)로 변경하시겠습니까?`)) {
			fetchUsers();
			return;
		}

		saving = email;
		message = { text: '', type: '' };

		try {
			const userRef = doc(db, 'users', email);
			await updateDoc(userRef, {
				role: newRole,
				updatedAt: new Date(),
				updatedBy: $user?.email
			});
			message = { text: `${email}의 권한이 ${newRole}(으)로 변경되었습니다.`, type: 'success' };
			usersList = usersList.map((u) => (u.email === email ? { ...u, role: newRole } : u));
		} catch (e: any) {
			console.error('Update error:', e);
			message = { text: '권한 변경 중 오류가 발생했습니다: ' + e.message, type: 'error' };
			fetchUsers();
		} finally {
			saving = null;
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
			<p>사용자들을 화이트리스트에 일괄 등록하고 권한을 관리합니다.</p>
		</header>

		<div class="admin-content">
			<!-- Add User Section (Bulk) -->
			<section class="add-user-section card">
				<div class="section-header">
					<UserPlus size={20} />
					<h3>사용자 일괄 추가(화이트리스트)</h3>
				</div>
				<div class="add-user-form bulk">
					<div class="input-group full-width">
						<label for="bulk-emails">이메일 목록 (줄바꿈 또는 쉼표로 구분)</label>
						<textarea
							id="bulk-emails"
							bind:value={bulkEmailsInput}
							placeholder="user1@snu-g.ms.kr&#10;user2@snu-g.ms.kr, user3@snu-g.ms.kr"
							disabled={adding}
						></textarea>
					</div>
					<div class="action-row">
						<div class="input-group">
							<label for="new-role">부여할 공통 권한</label>
							<select id="new-role" bind:value={newUserRole} disabled={adding}>
								{#each roles as role}
									<option value={role}>{role}</option>
								{/each}
							</select>
						</div>
						<button
							class="btn btn-add"
							onclick={addUsers}
							disabled={adding || !bulkEmailsInput.trim()}
						>
							<Save size={18} />
							{adding ? '처리 중...' : '사용자 일괄 등록'}
						</button>
					</div>
				</div>
			</section>

			<!-- User List Section -->
			<section class="user-management-section card">
				<div class="section-header">
					<UserCog size={20} />
					<h3>전체 사용자 권한 관리</h3>
					{#if message.text}
						<div class="message {message.type}">
							{#if message.type === 'success'}
								<CheckCircle2 size={16} />
							{:else}
								<AlertCircle size={16} />
							{/if}
							{message.text}
						</div>
					{/if}
				</div>

				{#if loading}
					<div class="loading">사용자 목록을 불러오는 중...</div>
				{:else}
					<div class="table-container">
						<table>
							<thead>
								<tr>
									<th>사용자 정보</th>
									<th>이메일</th>
									<th>현재 권한</th>
									<th>권한 변경</th>
									<th>참관 차단</th>
								</tr>
							</thead>
							<tbody>
								{#each usersList as u}
									<tr class:is-admin={u.role === 'ADMIN'}>
										<td>
											<div class="user-info">
												<img
													src={u.photoURL || '/school-logo.svg'}
													alt={u.displayName}
													class="avatar"
												/>
												<span class="name">{u.displayName || '미가입 사용자'}</span>
											</div>
										</td>
										<td>
											<div class="email-cell">
												<Mail size={14} />
												{u.email}
											</div>
										</td>
										<td>
											<span class="role-badge {u.role.toLowerCase()}">
												{u.role}
											</span>
										</td>
										<td>
											<select
												value={u.role}
												onchange={(e) => updateUserRole(u.email, e.currentTarget.value as UserRole)}
												disabled={saving === u.email || u.email === 'tgtec26@snu-g.ms.kr'}
											>
												{#each roles as role}
													<option value={role}>{role}</option>
												{/each}
											</select>
											{#if saving === u.email}
												<span class="saving-text">저장 중...</span>
											{/if}
										</td>
										<td>
											{#if u.role === 'SUPERVISOR'}
												{@const restrictionKey = u.displayName || u.email}
												<button
													class="btn-toggle-block {teacherRestrictions.includes(restrictionKey)
														? 'restricted'
														: ''}"
													onclick={() => toggleTeacherRestriction(restrictionKey)}
												>
													{#if teacherRestrictions.includes(restrictionKey)}
														<Lock size={14} /> 차단됨
													{:else}
														<Unlock size={14} /> 허용됨
													{/if}
												</button>
											{:else}
												<span class="not-applicable">-</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</section>

			<aside class="guide-section card">
				<div class="section-header">
					<ShieldCheck size={20} />
					<h3>💡 관리자 가이드</h3>
				</div>
				<ul>
					<li>
						<strong>일괄 추가:</strong> 여러 개의 이메일을 엔터(줄바꿈)나 쉼표로 구분하여 한꺼번에 등록할
						수 있습니다.
					</li>
					<li>
						<strong>권한 자동 부여:</strong> 등록 시 선택한 권한이 입력한 모든 사용자에게 동일하게 적용됩니다.
					</li>
					<li>
						<strong>로그인 허용:</strong> 화이트리스트에 등록된 이메일로 로그인하는 사용자만 시스템을
						이용할 수 있습니다.
					</li>
					<li>
						<strong>이름 자동 연동:</strong> 사용자가 최초 로그인 시 구글 계정의 이름이 자동으로 목록에
						나타납니다.
					</li>
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

	.admin-content {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.add-user-section {
		background: #f8fafc;
		border: 2px dashed #e2e8f0;
	}

	.add-user-form.bulk {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.input-group.full-width {
		width: 100%;
	}

	.add-user-form label {
		font-weight: 700;
		font-size: 0.9rem;
		color: #666;
	}

	textarea {
		width: 100%;
		height: 120px;
		padding: 1rem;
		border: 2px solid #ddd;
		border-radius: 8px;
		font-family: inherit;
		font-size: 0.95rem;
		line-height: 1.5;
		resize: vertical;
		transition: border-color 0.2s;
	}

	textarea:focus {
		outline: none;
		border-color: var(--header-bg);
	}

	.action-row {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1.5rem;
		flex-wrap: wrap;
	}

	.action-row .input-group {
		flex: 1;
		min-width: 250px;
	}

	.btn-add {
		background-color: var(--header-bg);
		color: white;
		border: none;
		padding: 0.7rem 2rem;
		border-radius: 8px;
		font-weight: 800;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		height: 45px;
		transition: all 0.2s;
	}

	.btn-add:hover:not(:disabled) {
		background-color: #1e255a;
		transform: translateY(-1px);
	}

	.btn-add:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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

	.section-header h3 {
		margin: 0;
	}

	.message {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.85rem;
		font-weight: 700;
		padding: 0.4rem 0.8rem;
		border-radius: 6px;
	}

	.message.success {
		background: #e6fffa;
		color: #2c7a7b;
	}
	.message.error {
		background: #fff5f5;
		color: #c53030;
	}

	.table-container {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.95rem;
	}

	th {
		text-align: left;
		padding: 1rem;
		background: #f8f9fa;
		color: #555;
		font-weight: 700;
		border-bottom: 2px solid #eee;
	}

	td {
		padding: 1rem;
		border-bottom: 1px solid #eee;
		vertical-align: middle;
	}

	tr:hover {
		background-color: #fcfcfc;
	}

	tr.is-admin {
		background-color: #f0f4ff;
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}

	.avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		object-fit: cover;
		border: 1px solid #ddd;
	}

	.name {
		font-weight: 700;
		color: #333;
	}

	.email-cell {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		color: #666;
		font-size: 0.9rem;
	}

	.role-badge {
		padding: 0.2rem 0.6rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.role-badge.student {
		background: #edf2f7;
		color: #4a5568;
	}
	.role-badge.supervisor {
		background: #feebc8;
		color: #c05621;
	}
	.role-badge.admin {
		background: #c6f6d5;
		color: #22543d;
	}

	select {
		padding: 0.4rem 0.6rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.9rem;
		background: white;
		cursor: pointer;
	}

	select:focus {
		outline: none;
		border-color: var(--header-bg);
	}

	.saving-text {
		font-size: 0.8rem;
		color: #666;
		margin-left: 0.5rem;
	}

	.btn-toggle-block {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.8rem;
		border-radius: 6px;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
		border: 1px solid #e2e8f0;
		background: #f8fafc;
		color: #64748b;
		transition: all 0.2s;
	}

	.btn-toggle-block:hover {
		background: #f1f5f9;
	}

	.btn-toggle-block.restricted {
		background: #fff5f5;
		color: #e53e3e;
		border-color: #feb2b2;
	}

	.btn-toggle-block.restricted:hover {
		background: #fed7d7;
	}

	.not-applicable {
		color: #cbd5e0;
		font-size: 0.9rem;
	}

	.loading {
		text-align: center;
		padding: 3rem;
		color: #666;
		font-weight: 600;
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
</style>
