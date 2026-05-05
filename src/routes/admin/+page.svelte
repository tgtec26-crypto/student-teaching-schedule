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
		deleteDoc
	} from 'firebase/firestore';
	import { onMount } from 'svelte';
	import { Shield, Save, Users, AlertCircle, CheckCircle2, UserCog, Mail, ShieldCheck, UserPlus, Lock, Unlock, Trash2 } from 'lucide-svelte';
	import { timetableData } from '$lib/timetableData';
	import { teacherMetadata, getStandardizedName } from '$lib/teacherData';

	const subjectOrder = [
		'국어', '한문', '수학', '도덕', '사회', '역사', '물리', '화학', '생명', '지구', 
		'과학', '영어', '기가', '기술', '가정', '체육', '음악', '미술', '진로', '정보', 
		'스포츠', '주제', '동아리'
	];

	function getSubjectIndex(subject: string) {
		const index = subjectOrder.indexOf(subject);
		return index === -1 ? 999 : index;
	}

	function getDisplayUserInfo(u: any) {
		if (u.displayName) return u.displayName;
		const meta = teacherMetadata[u.email];
		if (meta) {
			return meta.subject ? `${meta.name} (${meta.subject})` : meta.name;
		}
		return '미가입 사용자';
	}

	let usersList = $state<any[]>([]);

	// Derived sorted users list: 1st by role (ADMIN > SUPERVISOR > STUDENT), 2nd by subject (if SUPERVISOR), 3rd by name
	const rolePriority: Record<UserRole, number> = {
		ADMIN: 1,
		SUPERVISOR: 2,
		STUDENT: 3
	};

	const sortedUsers = $derived(
		[...usersList].sort((a, b) => {
			// 1st Priority: Role
			const roleDiff = (rolePriority[a.role as UserRole] || 99) - (rolePriority[b.role as UserRole] || 99);
			if (roleDiff !== 0) return roleDiff;

			// 2nd Priority: Subject (if SUPERVISOR)
			if (a.role === 'SUPERVISOR' && b.role === 'SUPERVISOR') {
				const subjectA = teacherMetadata[a.email]?.subject || '';
				const subjectB = teacherMetadata[b.email]?.subject || '';
				const indexA = getSubjectIndex(subjectA);
				const indexB = getSubjectIndex(subjectB);
				if (indexA !== indexB) return indexA - indexB;
			}

			// 3rd Priority: Name (using getDisplayUserInfo)
			const nameA = getDisplayUserInfo(a);
			const nameB = getDisplayUserInfo(b);
			return nameA.localeCompare(nameB, 'ko');
		})
	);

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
			const q = query(collection(db, 'users'), orderBy('email', 'asc'));
			const querySnapshot = await getDocs(q);
			usersList = querySnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data()
			}));
		} catch (e: any) {
			console.error('Users load error:', e);
			message = { text: '사용자 목록 로드 실패: ' + (e.message || '알 수 없는 오류'), type: 'error' };
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
				teacherRestrictions = teacherRestrictions.filter((n) => n !== displayName);
				message = { text: `${displayName} 선생님의 참관 제한이 해제되었습니다.`, type: 'success' };
			} else {
				if (!confirm(`${displayName} 선생님의 모든 수업을 참관 불가로 전환하시겠습니까?`)) return;
				await setDoc(doc(db, 'teacher_restrictions', displayName), {
					restricted: true,
					updatedAt: new Date(),
					updatedBy: $user?.email
				});
				teacherRestrictions = [...teacherRestrictions, displayName];
				message = { text: `${displayName} 선생님의 참관이 전면 차단되었습니다.`, type: 'success' };
			}
		} catch (e: any) {
			console.error('Restriction error:', e);
			message = { text: '제한 설정 중 오류가 발생했습니다.', type: 'error' };
		}
	}

	// 차단 정보는 admin 본인이 토글 — 진입 시 1회 fetch + 토글 후 로컬 갱신.
	// 이전: onSnapshot 으로 push 마다 read 발생.
	onMount(async () => {
		fetchUsers();
		try {
			const snap = await getDocs(collection(db, 'teacher_restrictions'));
			teacherRestrictions = snap.docs.map((d) => d.id);
		} catch (err) {
			console.error('teacher_restrictions load error:', err);
		}
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

	async function deleteUser(email: string) {
		if (email === 'tgtec26@snu-g.ms.kr') {
			alert('시스템 관리자 계정은 삭제할 수 없습니다.');
			return;
		}

		if (!confirm(`${email} 사용자를 화이트리스트에서 삭제하시겠습니까?\n삭제 후에는 해당 계정으로 로그인이 불가능합니다.`)) {
			return;
		}

		try {
			await deleteDoc(doc(db, 'users', email));
			message = { text: `${email} 사용자가 삭제되었습니다.`, type: 'success' };
			usersList = usersList.filter((u) => u.email !== email);
		} catch (e: any) {
			console.error('Delete error:', e);
			message = { text: '사용자 삭제 중 오류가 발생했습니다: ' + e.message, type: 'error' };
		}
	}

	async function resetApplications() {
		if (!confirm('모든 참관 신청 및 승인 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
			return;
		}

		try {
			const q = query(collection(db, 'observation_applications'));
			const snapshot = await getDocs(q);
			const deletePromises = snapshot.docs.map((d) => deleteDoc(d.ref));
			await Promise.all(deletePromises);
			message = { text: '모든 참관 신청 데이터가 삭제되었습니다.', type: 'success' };
		} catch (e: any) {
			console.error('Reset applications error:', e);
			message = { text: '데이터 삭제 중 오류가 발생했습니다: ' + e.message, type: 'error' };
		}
	}

	async function resetRestrictions() {
		if (!confirm('모든 개별 수업 차단, 안내 메시지, 교사 설정을 초기화하시겠습니까?\n선생님들이 직접 입력한 모든 데이터가 삭제됩니다.')) {
			return;
		}

		try {
			// 1. 개별 수업 차단 초기화
			const qRest = query(collection(db, 'restricted_lessons'));
			const snapRest = await getDocs(qRest);
			const delRest = snapRest.docs.map((d) => deleteDoc(d.ref));
			
			// 2. 안내 메시지 초기화
			const qNotes = query(collection(db, 'lesson_notes'));
			const snapNotes = await getDocs(qNotes);
			const delNotes = snapNotes.docs.map((d) => deleteDoc(d.ref));

			// 3. 교사 설정(기본 안내, 자동 승인) 초기화
			const qSettings = query(collection(db, 'teacher_settings'));
			const snapSettings = await getDocs(qSettings);
			const delSettings = snapSettings.docs.map((d) => deleteDoc(d.ref));

			await Promise.all([...delRest, ...delNotes, ...delSettings]);
			message = { text: '모든 참관 차단, 안내 메시지 및 교사 설정이 초기화되었습니다.', type: 'success' };
		} catch (e: any) {
			console.error('Reset all teacher data error:', e);
			message = { text: '데이터 초기화 중 오류가 발생했습니다: ' + e.message, type: 'error' };
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
			<div class="admin-quick-links">
				<a href="/admin/stats" class="quick-link">📊 참관 신청 통계</a>
			</div>
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
									<th style="width: 50px;">관리</th>
								</tr>
							</thead>
							<tbody>
								{#each sortedUsers as u}
									<tr class:is-admin={u.role === 'ADMIN'}>
										<td>
											<div class="user-info">
												<img
													src={u.photoURL || '/school-logo.svg'}
													alt={u.displayName}
													class="avatar"
												/>
												<span class="name">{getDisplayUserInfo(u)}</span>
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
												{@const meta = teacherMetadata[u.email]}
												{@const restrictionKey = (u.displayName || (meta ? meta.name : u.email)).split(' (')[0]}
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
										<td>
											<button
												class="btn-delete"
												onclick={() => deleteUser(u.email)}
												title="삭제"
												disabled={u.email === 'tgtec26@snu-g.ms.kr'}
											>
												<Trash2 size={16} />
											</button>
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

			<!-- Maintenance Section -->
			<section class="maintenance-section card">
				<div class="section-header">
					<AlertCircle size={20} />
					<h3>시스템 데이터 초기화 (테스트용)</h3>
				</div>
				<div class="maintenance-content">
					<p class="warning-text">
						2차 테스트를 위해 기존 데이터를 정리합니다. 삭제된 데이터는 복구할 수 없습니다.
					</p>
					<div class="maintenance-actions">
						<button class="btn btn-danger" onclick={resetApplications}>
							<Trash2 size={18} />
							참관 신청 및 승인 데이터 전체 삭제
						</button>
						<button class="btn btn-warning" onclick={resetRestrictions}>
							<Trash2 size={18} />
							교사 데이터 초기화 (차단, 안내 메시지, 설정)
						</button>
					</div>
				</div>
			</section>
		</div>
	{/if}
</div>

<style>
	.admin-header {
		margin-bottom: 2rem;
	}

	.admin-quick-links {
		margin-top: 0.8rem;
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.quick-link {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.9rem;
		border: 2px solid var(--header-bg);
		border-radius: 8px;
		background: white;
		color: var(--header-bg);
		font-weight: 700;
		font-size: 0.9rem;
		text-decoration: none;
		transition: all 0.15s;
		word-break: keep-all;
	}

	.quick-link:hover {
		background: var(--header-bg);
		color: white;
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

	.btn-delete {
		background: none;
		border: 1px solid #e2e8f0;
		color: #a0aec0;
		padding: 0.4rem;
		border-radius: 6px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.btn-delete:hover:not(:disabled) {
		background-color: #fff5f5;
		color: #e53e3e;
		border-color: #feb2b2;
	}

	.btn-delete:disabled {
		opacity: 0.3;
		cursor: not-allowed;
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

	.maintenance-section {
		border: 2px solid #fee2e2;
		background-color: #fffafb;
	}

	.maintenance-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.warning-text {
		color: #e53e3e;
		font-weight: 600;
		font-size: 0.95rem;
	}

	.maintenance-actions {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.btn-danger {
		background-color: #e63946;
		color: white;
		border: none;
		padding: 0.7rem 1.5rem;
		border-radius: 8px;
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-danger:hover {
		background-color: #c53030;
		transform: translateY(-1px);
	}

	.btn-warning {
		background-color: #f6ad55;
		color: white;
		border: none;
		padding: 0.7rem 1.5rem;
		border-radius: 8px;
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-warning:hover {
		background-color: #ed8936;
		transform: translateY(-1px);
	}

	/* ════════════════════════════════════════
	   다크 모드
	════════════════════════════════════════ */
	@media (prefers-color-scheme: dark) {
		/* 헤더 */
		.title-group { color: #e2e8f0; }
		.admin-header p { color: #94a3b8; }

		/* 섹션 헤더 */
		.section-header { color: #e2e8f0; border-bottom-color: #2d3748; }

		/* 사용자 추가 섹션 */
		.add-user-section { background: #1a1f35; border-color: #374151; }
		.add-user-form label { color: #94a3b8; }
		textarea {
			background: #111827;
			border-color: #374151;
			color: #e2e8f0;
		}
		textarea:focus { border-color: #3b82f6; }

		/* 테이블 */
		th { background: #1e2a4a; color: #94a3b8; border-bottom-color: #2d3748; }
		td { border-bottom-color: #2d3748; }
		tr:hover { background-color: #1e2a4a; }
		tr.is-admin { background-color: #1a2540; }

		/* 셀 텍스트 */
		.name { color: #e2e8f0; }
		.email-cell { color: #94a3b8; }
		.saving-text { color: #94a3b8; }
		.not-applicable { color: #4b5563; }
		.loading { color: #94a3b8; }

		/* select */
		select {
			background: #1e2a4a;
			border-color: #374151;
			color: #e2e8f0;
		}

		/* 참관 차단 버튼 */
		.btn-toggle-block {
			background: #1e2a4a;
			border-color: #374151;
			color: #94a3b8;
		}
		.btn-toggle-block:hover { background: #2d3748; }
		.btn-toggle-block.restricted {
			background: #2d1515;
			color: #f87171;
			border-color: #7f1d1d;
		}
		.btn-toggle-block.restricted:hover { background: #3d1a1a; }

		/* 삭제 버튼 */
		.btn-delete { border-color: #374151; color: #4b5563; }
		.btn-delete:hover:not(:disabled) {
			background-color: #2d1515;
			color: #f87171;
			border-color: #7f1d1d;
		}

		/* 메시지 */
		.message.success { background: #064e3b; color: #6ee7b7; }
		.message.error { background: #7f1d1d; color: #fca5a5; }

		/* 가이드 섹션 */
		.guide-section li { color: #94a3b8; }
		.guide-section li strong { color: #e2e8f0; }

		/* 유지보수 섹션 */
		.maintenance-section { background-color: #1a1215; border-color: #7f1d1d; }
		.warning-text { color: #f87171; }
	}
</style>
