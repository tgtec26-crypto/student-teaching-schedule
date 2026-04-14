<script lang="ts">
	import { user, db, isSupervisor, isAdmin } from '$lib/firebase';
	import {
		collection,
		query,
		where,
		onSnapshot,
		doc,
		updateDoc,
		setDoc,
		deleteDoc
	} from 'firebase/firestore';
	import { timetableData } from '$lib/timetableData';
	import {
		Users,
		Calendar,
		Clock,
		BookOpen,
		User,
		UserCheck,
		Lock,
		AlertCircle,
		Loader2,
		ChevronLeft
	} from 'lucide-svelte';
	import { onMount, onDestroy } from 'svelte';

	let selectedTeacher = $state('');
	let applications = $state<any[]>([]);
	let restrictions = $state<string[]>([]);
	let loading = $state(false);

	const maxApplicants = 5;
	const periods = ['1', '2', '3', '4', '5', '6', '7'];
	const weekDays = ['월', '화', '수', '목', '금'];
	const weekDates = ['2026-05-11', '2026-05-12', '2026-05-13', '2026-05-14', '2026-05-15'];

	// Subject Color Mapping
	const subjectColors: Record<string, string> = {
		국어: '#fecaca',
		한문: '#fecaca',
		수학: '#bbf7d0',
		도덕: '#e9d5ff',
		사회: '#e9d5ff',
		역사: '#e9d5ff',
		과학: '#fef08a',
		물리: '#fef08a',
		화학: '#fef08a',
		생명: '#fef08a',
		지구: '#fef08a',
		영어: '#bfdbfe',
		기가: '#e2e8f0',
		기술: '#e2e8f0',
		가정: '#e2e8f0',
		체육: '#fed7aa',
		음악: '#bae6fd',
		미술: '#fbcfe8',
		진로: '#f3e8ff',
		정보: '#a7f3d0',
		스포츠: '#cffafe'
	};

	const subjectOrder = [
		'국어',
		'한문',
		'수학',
		'도덕',
		'사회',
		'역사',
		'물리',
		'화학',
		'생명',
		'지구',
		'과학',
		'영어',
		'기가',
		'기술',
		'가정',
		'체육',
		'음악',
		'미술',
		'진로',
		'정보',
		'스포츠',
		'주제',
		'동아리'
	];

	function getSubjectIndex(subject: string) {
		const index = subjectOrder.indexOf(subject);
		return index === -1 ? 999 : index;
	}

	function getSubjectColor(subject: string) {
		if (!subject) return '#f3f4f6';
		const base = subject.substring(0, 2);
		return subjectColors[base] || '#f3f4f6';
	}

	// Extract unique teachers and their subjects (Grouping by main subject)
	const teacherToSubject = (() => {
		const subjectsList: Record<string, Set<string>> = {};
		Object.values(timetableData).forEach((classData: any) => {
			Object.values(classData).forEach((dayData: any) => {
				Object.values(dayData).forEach((slot: any) => {
					if (slot.teacher) {
						if (!subjectsList[slot.teacher]) subjectsList[slot.teacher] = new Set();
						// 숫자와 알파벳 제거하여 과목명 통일 (예: 국어A -> 국어)
						subjectsList[slot.teacher].add(slot.subject.replace(/[A-Z0-9]/g, ''));
					}
				});
			});
		});

		const mapping: Record<string, string> = {};
		for (const [teacher, subjects] of Object.entries(subjectsList)) {
			const arr = Array.from(subjects).sort((a, b) => getSubjectIndex(a) - getSubjectIndex(b));
			mapping[teacher] = arr.length > 0 ? arr[0] : '미지정';
		}
		return mapping;
	})();

	const teachers = Object.keys(teacherToSubject)
		.filter((teacher) => {
			if ($isAdmin) return true;
			return teacher === $user?.displayName;
		})
		.sort((a, b) => {
			const subjectA = teacherToSubject[a];
			const subjectB = teacherToSubject[b];
			const indexA = getSubjectIndex(subjectA);
			const indexB = getSubjectIndex(subjectB);

			if (indexA !== indexB) return indexA - indexB;
			return a.localeCompare(b);
		});

	// Firestore Listener (Fetch all apps and restrictions for the current teacher's week)
	let unsubscribeApps: () => void;
	let unsubscribeRestricted: () => void;

	function fetchApplications() {
		if (!selectedTeacher) {
			applications = [];
			restrictions = [];
			return;
		}

		if (unsubscribeApps) unsubscribeApps();
		if (unsubscribeRestricted) unsubscribeRestricted();

		loading = true;

		// Fetch Applications
		const qApps = query(
			collection(db, 'observation_applications'),
			where('teacher', '==', selectedTeacher),
			where('date', '>=', weekDates[0]),
			where('date', '<=', weekDates[4])
		);

		unsubscribeApps = onSnapshot(qApps, (snapshot) => {
			applications = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
			loading = false;
		});

		// Fetch Teacher Restrictions
		const qRestricted = query(
			collection(db, 'restricted_lessons'),
			where('teacher', '==', selectedTeacher)
		);

		unsubscribeRestricted = onSnapshot(qRestricted, (snapshot) => {
			restrictions = snapshot.docs.map((doc) => doc.id);
		});
	}

	onMount(() => {
		if (selectedTeacher) fetchApplications();
	});

	onDestroy(() => {
		if (unsubscribeApps) unsubscribeApps();
		if (unsubscribeRestricted) unsubscribeRestricted();
	});

	async function toggleRestriction(date: string, period: string, classId: string) {
		const restrictionId = `${selectedTeacher}_${date}_${period}_${classId}`;
		const isCurrentlyRestricted = restrictions.includes(restrictionId);

		try {
			if (isCurrentlyRestricted) {
				await deleteDoc(doc(db, 'restricted_lessons', restrictionId));
			} else {
				// Warn if there are already applications
				const hasApps = applications.some(
					(app) => app.date === date && app.period === period && app.classId === classId
				);
				if (hasApps && !confirm('이미 신청자가 있는 수업입니다. 참관 불가로 전환하시겠습니까?')) {
					return;
				}

				await setDoc(doc(db, 'restricted_lessons', restrictionId), {
					teacher: selectedTeacher,
					date,
					period,
					classId,
					updatedAt: new Date()
				});
			}
		} catch (error) {
			console.error('Error toggling restriction:', error);
		}
	}

	async function approveApplication(appId: string) {
		try {
			const appRef = doc(db, 'observation_applications', appId);
			await updateDoc(appRef, { status: 'APPROVED' });
		} catch (error) {
			console.error('Error approving application:', error);
			alert('승인 중 오류가 발생했습니다.');
		}
	}

	function handleTeacherClick(teacher: string) {
		selectedTeacher = teacher;
		fetchApplications();

		// 선택 후 내역 섹션으로 자동 스크롤
		setTimeout(() => {
			const resultsSection = document.querySelector('.results-section');
			if (resultsSection) {
				resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
		}, 100);
	}

	function getTeacherSlot(teacher: string, targetDate: string, period: string) {
		for (const [classId, dates] of Object.entries(timetableData)) {
			const slot = (dates as any)[targetDate]?.[period];
			if (slot && slot.teacher === teacher) {
				return { classId, ...slot };
			}
		}
		return null;
	}

	function is7thPeriodRestricted(targetDate: string, period: string) {
		const day = new Date(targetDate).getDay();
		if ((day === 1 || day === 3 || day === 5) && period === '7') return true;
		return false;
	}
</script>

<div class="full-width container">
	{#if !$isSupervisor && !$isAdmin}
		<div class="error-state card">
			<AlertCircle size={48} color="#e63946" />
			<h2>접근 권한이 없습니다</h2>
			<p>이 페이지는 지도 교사 또는 관리자만 접근할 수 있습니다.</p>
			<a href="/" class="btn btn-primary">홈으로 돌아가기</a>
		</div>
	{:else}
		<header class="page-header">
			<div class="title-group">
				<Users size={32} />
				<h1>지도 교사 전용 페이지</h1>
			</div>
			<p>자신의 이름을 선택하여 참관 신청 내역을 확인하세요.</p>
		</header>

		<div class="supervisor-content">
			<section class="teacher-grid-section">
				<div class="section-label">선생님 선택</div>
				<div class="teacher-grid">
					{#each teachers as teacher}
						<button
							class="teacher-card card {selectedTeacher === teacher ? 'active' : ''}"
							onclick={() => handleTeacherClick(teacher)}
						>
							<span
								class="teacher-subject-badge"
								style="background-color: {getSubjectColor(teacherToSubject[teacher])}"
							>
								{teacherToSubject[teacher]}
							</span>
							<span class="teacher-name">{teacher}</span>
						</button>
					{/each}
				</div>
			</section>

			{#if selectedTeacher}
				<div
					class="modal-overlay"
					onclick={(e) => {
						if (e.target === e.currentTarget) selectedTeacher = '';
					}}
				>
					<div class="modal-content">
						<div class="modal-header">
							<div class="teacher-info-header">
								<User size={20} />
								<h3>{selectedTeacher} 선생님 주간 참관 현황</h3>
								<span class="count">총 {applications.length}건</span>
							</div>
							<button class="btn-close" onclick={() => (selectedTeacher = '')}> 닫기 </button>
						</div>

						{#if loading}
							<div class="loading-state">
								<Loader2 class="spin" size={32} />
								<p>데이터를 불러오는 중...</p>
							</div>
						{:else}
							<div class="timetable-wrapper">
								<table class="timetable weekly">
									<thead>
										<tr>
											<th class="sticky-col period-header">교시</th>
											{#each weekDays as day, i}
												<th>{day} ({weekDates[i].split('-').slice(1).join('/')})</th>
											{/each}
										</tr>
									</thead>
									<tbody>
										{#each periods as period}
											<tr>
												<td class="sticky-col period-cell {period === '7' ? 'last' : ''}"
													>{period}</td
												>
												{#each weekDates as d}
													{@const slot = getTeacherSlot(selectedTeacher, d, period)}
													{@const apps = slot
														? applications.filter(
																(app) =>
																	app.date === d &&
																	app.classId === slot.classId &&
																	app.period === period
															)
														: []}
													{@const isRestricted = is7thPeriodRestricted(d, period)}

												<td
														class="slot-cell {slot
															? 'active'
															: isRestricted
																? 'restricted'
																: 'empty'}"
													>
														{#if slot}
															{@const restrictionId = `${selectedTeacher}_${d}_${period}_${slot.classId}`}
															{@const isManuallyRestricted = restrictions.includes(restrictionId)}

															<div
																class="slot-content card {isManuallyRestricted ? 'manually-restricted' : ''}"
																style="background-color: {getSubjectColor(slot.subject)}{isManuallyRestricted ? '05' : '15'}"
															>
																<div class="slot-info">
																	<div class="info-left">
																		<span
																			class="subject"
																			style="background-color: {getSubjectColor(slot.subject)}"
																			>{slot.subject}</span
																		>
																		<span class="class-label"
																			>{slot.classId.substring(0, 1)}-{parseInt(
																				slot.classId.substring(2)
																			)}</span
																		>
																	</div>
																	<button 
																		class="btn-toggle-restriction {isManuallyRestricted ? 'restricted' : ''}"
																		onclick={() => toggleRestriction(d, period, slot.classId)}
																		title={isManuallyRestricted ? "참관 가능으로 변경" : "참관 불가로 설정"}
																	>
																		{#if isManuallyRestricted}
																			<Lock size={12} /> 불가
																		{:else}
																			<UserCheck size={12} /> 가능
																		{/if}
																	</button>
																</div>
																<div class="status-box">
																	<div class="applicant-count">
																		<Users size={12} />
																		{apps.length}/{maxApplicants}
																	</div>
																</div>

																{#if !isManuallyRestricted && apps.length > 0}
																	<div class="applicant-list">
																		<!-- 승인된 명단 -->
																		{#each apps.filter((a) => a.status === 'APPROVED') as app}
																			<span class="applicant-tag approved"
																				>{app.applicantSubject
																					? `[${app.applicantSubject}] `
																					: ''}{app.applicantName}</span
																			>
																		{/each}

																		<!-- 승인 대기 명단 (버튼 포함) -->
																		{#each apps.filter((a) => a.status !== 'APPROVED') as app}
																			<button
																				class="applicant-tag pending-btn"
																				onclick={() => approveApplication(app.id)}
																				title="클릭하여 승인"
																			>
																				{app.applicantSubject
																					? `[${app.applicantSubject}] `
																					: ''}{app.applicantName}
																				<span class="approve-label">승인</span>
																			</button>
																		{/each}
																	</div>
																{:else if isManuallyRestricted}
																	<div class="restriction-notice">
																		참관 차단됨
																	</div>
																{/if}
															</div>
														{:else if isRestricted}
															<div class="no-class restricted">수업 없음</div>
														{:else}
															<div class="no-class">-</div>
														{/if}
													</td>
												{/each}
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.full-width {
		max-width: 1400px !important;
		margin: 0 auto;
		padding: 0 2rem 2rem 2rem;
	}

	.page-header {
		margin-bottom: 2rem;
		padding-top: 1rem;
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

	.teacher-grid-section {
		margin-bottom: 3rem;
	}

	.section-label {
		font-weight: 800;
		color: #4a5568;
		margin-bottom: 1rem;
		font-size: 1.1rem;
	}

	.teacher-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		gap: 0.8rem;
	}

	.teacher-card {
		padding: 1rem 0.6rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6rem;
		border: 2px solid transparent;
		transition: all 0.2s;
		background: white;
		cursor: pointer;
		text-align: center;
	}

	.teacher-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
		border-color: #e2e8f0;
	}

	.teacher-card.active {
		border-color: var(--header-bg);
		background: #f0f4ff;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
		border-width: 3px;
	}

	.teacher-subject-badge {
		padding: 0.15rem 0.5rem;
		border-radius: 20px;
		font-size: 0.75rem;
		font-weight: 800;
		color: #1a202c;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
	}

	.teacher-name {
		font-weight: 800;
		color: #2d3748;
		font-size: 0.95rem;
	}

	/* Modal Styling */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal-content {
		background: white;
		width: 100%;
		max-width: 1300px;
		max-height: 95vh;
		border-radius: 16px;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
		overflow: hidden;
	}

	.modal-header {
		padding: 1rem 1.5rem;
		background: #f8fafc;
		border-bottom: 1px solid #e2e8f0;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.teacher-info-header {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		color: var(--header-bg);
	}

	.teacher-info-header h3 {
		margin: 0;
		font-size: 1.2rem;
		font-weight: 800;
	}

	.btn-close {
		background: #cbd5e1;
		color: #334155;
		border: none;
		padding: 0.5rem 1.2rem;
		border-radius: 8px;
		font-weight: 800;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-close:hover {
		background: #94a3b8;
		color: white;
	}

	.count {
		background: var(--header-bg);
		color: white;
		padding: 0.2rem 0.8rem;
		border-radius: 20px;
		font-size: 0.85rem;
		font-weight: 700;
	}

	/* Timetable Styling (Compact) */
	.timetable-wrapper {
		overflow: auto;
		flex: 1;
		padding: 1rem;
	}

	.timetable {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		table-layout: fixed;
		min-width: 1000px;
	}

	.timetable th {
		background: #f8fafc;
		padding: 0.6rem;
		font-weight: 800;
		color: #475569;
		border-bottom: 2px solid #e2e8f0;
		font-size: 0.85rem;
		text-align: center;
	}

	.period-header {
		width: 50px !important;
	}

	.timetable td {
		height: 100px; /* Reduced height */
		border-right: 1px solid #f1f5f9;
		border-bottom: 1px solid #f1f5f9;
		padding: 0.4rem;
		vertical-align: top;
	}

	.sticky-col {
		position: sticky;
		left: 0;
		background: #f8fafc;
		z-index: 10;
		border-right: 2px solid #e2e8f0 !important;
	}

	.period-cell {
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 900;
		color: #64748b;
		font-size: 1.1rem;
	}

	.slot-cell.active {
		background-color: #fcfcfc;
	}

	.slot-content {
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.4rem; /* Reduced gap */
		padding: 0.5rem !important; /* Reduced padding */
		border: 1px solid #eee;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
	}

	.slot-info {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.3rem;
	}

	.info-left {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.btn-toggle-restriction {
		background: #f1f5f9;
		color: #64748b;
		border: 1px solid #e2e8f0;
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
		font-size: 0.7rem;
		font-weight: 800;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.2rem;
		transition: all 0.2s;
	}

	.btn-toggle-restriction:hover {
		background: #e2e8f0;
	}

	.btn-toggle-restriction.restricted {
		background: #fee2e2;
		color: #ef4444;
		border-color: #fecaca;
	}

	.manually-restricted {
		opacity: 0.7;
		background-image: repeating-linear-gradient(
			45deg,
			transparent,
			transparent 10px,
			rgba(0, 0, 0, 0.02) 10px,
			rgba(0, 0, 0, 0.02) 20px
		);
	}

	.restriction-notice {
		margin-top: 0.5rem;
		font-size: 0.75rem;
		color: #ef4444;
		font-weight: 800;
		text-align: center;
		background: rgba(239, 68, 68, 0.1);
		padding: 0.2rem;
		border-radius: 4px;
	}

	.subject {
		font-weight: 800;
		font-size: 0.8rem;
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
		white-space: nowrap;
	}

	.class-label {
		font-size: 0.75rem;
		color: #64748b;
		font-weight: 700;
	}

	.status-box {
		display: flex;
		justify-content: flex-start;
		align-items: center;
	}

	.applicant-count {
		font-size: 0.75rem;
		color: #94a3b8;
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}

	.applicant-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.15rem;
		margin-top: 0.3rem;
		padding-top: 0.3rem;
		border-top: 1px dashed #f1f5f9;
	}

	.applicant-tag {
		background: #f1f5f9;
		color: #475569;
		font-size: 0.7rem;
		font-weight: 700;
		padding: 0.05rem 0.3rem;
		border-radius: 3px;
		white-space: nowrap;
	}

	.no-class {
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #f1f5f9;
		font-weight: 800;
		font-size: 0.8rem;
	}

	.no-class.restricted {
		color: #cbd5e0;
		background: #f8fafc;
	}

	.loading-state {
		text-align: center;
		padding: 5rem 0;
		color: #666;
	}

	.spin {
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
		color: var(--header-bg);
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.error-state {
		text-align: center;
		padding: 5rem 2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	@media (max-width: 600px) {
		.teacher-grid {
			grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
		}
		.modal-content {
			height: 100%;
			max-height: 100vh;
			border-radius: 0;
		}
	}
</style>
