<script lang="ts">
	import { studentData } from '$lib/studentData';
	import { teacherWebhooks } from '$lib/teacherWebhooks';
	import { page } from '$app/state';
	import { user, db, isStudent } from '$lib/firebase';
	import { timetableData } from '$lib/timetableData';
	import {
		collection,
		query,
		where,
		onSnapshot,
		addDoc,
		deleteDoc,
		doc,
		Timestamp
	} from 'firebase/firestore';
	import { onMount, onDestroy } from 'svelte';
	import {
		Users,
		Loader2,
		User,
		Calendar,
		ChevronLeft,
		ChevronRight,
		BookOpen,
		Lock
	} from 'lucide-svelte';

	const date = page.params.date ?? '';

	// State for View Mode
	let viewMode = $state<'grade' | 'teacher'>('grade');
	let selectedGrade = $state(1);
	let selectedTeacher = $state<string | null>(null);

	let applications = $state<any[]>([]);
	let restrictions = $state<string[]>([]);
	let teacherRestrictions = $state<string[]>([]);
	let loading = $state(true);

	const grades = [1, 2, 3];
	const maxApplicants = 5;
	const periods = ['1', '2', '3', '4', '5', '6', '7'];
	const weekDays = ['월', '화', '수', '목', '금'];

	// Calculate Week Dates (Mon-Fri) based on the current date
	const weekDates = $derived.by(() => {
		const current = new Date(date);
		const day = current.getDay(); // 0: Sun, 1: Mon...
		const diff = current.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
		const monday = new Date(current.setDate(diff));

		return Array.from({ length: 5 }, (_, i) => {
			const d = new Date(monday);
			d.setDate(monday.getDate() + i);
			return d.toISOString().split('T')[0];
		});
	});

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
	const teacherToSubject = $derived.by(() => {
		const subjectsList: Record<string, Set<string>> = {};
		Object.values(timetableData).forEach((classes) => {
			Object.values(classes as any).forEach((days: any) => {
				Object.values(days).forEach((slot: any) => {
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
	});

	const teachers = $derived(
		Object.keys(teacherToSubject).sort((a, b) => {
			const subjectA = teacherToSubject[a];
			const subjectB = teacherToSubject[b];
			const indexA = getSubjectIndex(subjectA);
			const indexB = getSubjectIndex(subjectB);

			if (indexA !== indexB) return indexA - indexB;
			return a.localeCompare(b);
		})
	);

	// Firestore Listener (Fetch all apps and restrictions for the current week)
	let unsubscribeApps: () => void;
	let unsubscribeRestricted: () => void;

	$effect(() => {
		// Fetch Applications
		const qApps = query(
			collection(db, 'observation_applications'),
			where('date', '>=', weekDates[0]),
			where('date', '<=', weekDates[4])
		);

		unsubscribeApps = onSnapshot(qApps, (snapshot) => {
			applications = snapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data()
			}));
			loading = false;
		});

		// Fetch All Restrictions
		const qRestricted = query(collection(db, 'restricted_lessons'));
		unsubscribeRestricted = onSnapshot(qRestricted, (snapshot) => {
			restrictions = snapshot.docs.map((doc) => doc.id);
		});

		// Fetch Global Teacher Restrictions
		onSnapshot(collection(db, 'teacher_restrictions'), (snapshot) => {
			teacherRestrictions = snapshot.docs.map((doc) => doc.id);
		});

		return () => {
			if (unsubscribeApps) unsubscribeApps();
			if (unsubscribeRestricted) unsubscribeRestricted();
		};
	});

	// Webhook Notification
	async function sendWebhookNotification(
		teacherName: string,
		applicantName: string,
		applicantSubject: string,
		targetDate: string,
		period: string,
		subject: string
	) {
		const webhookUrl = teacherWebhooks[teacherName];
		if (!webhookUrl) return;

		const message = {
			text:
				`🔔 *새로운 참관 신청 알림*\n\n` +
				`* 신청자: [${applicantSubject}] ${applicantName}\n` +
				`* 일시: ${targetDate} ${period}교시\n` +
				`* 과목: ${subject}\n\n` +
				`아래 링크에서 신청을 확인하고 승인해 주세요.\n` +
				`🔗 [지도 교사 승인 페이지 바로가기](https://snug-student-teaching.vercel.app/supervisor)`
		};

		try {
			await fetch(webhookUrl, {
				method: 'POST',
				mode: 'no-cors',
				headers: { 'Content-Type': 'application/json; charset=UTF-8' },
				body: JSON.stringify(message)
			});
		} catch (error) {
			console.error('Webhook notification error:', error);
		}
	}

	// Toggle Application Logic
	async function toggleApplication(
		targetDate: string,
		classId: string,
		period: string,
		subject: string,
		teacher: string
	) {
		if (!$user) return alert('로그인이 필요합니다.');

		const existingApp = applications.find(
			(app) =>
				app.applicantEmail === $user.email &&
				app.date === targetDate &&
				app.classId === classId &&
				app.period === period
		);

		if (existingApp) {
			if (confirm('신청을 취소하시겠습니까?')) {
				await deleteDoc(doc(db, 'observation_applications', existingApp.id));
			}
		} else {
			const slotApps = applications.filter(
				(app) => app.date === targetDate && app.classId === classId && app.period === period
			);

			const hasDuplicate = applications.some(
				(app) =>
					app.applicantEmail === $user.email && app.date === targetDate && app.period === period
			);

			if (hasDuplicate) return alert('해당 교시에 이미 다른 수업을 신청하셨습니다.');
			if (slotApps.length >= maxApplicants) return alert('정원이 초과되었습니다.');

			if (confirm(`${targetDate} ${period}교시 (${subject}) 수업 참관을 신청하시겠습니까?`)) {
				const sInfo = studentData[$user.email];
				const aName = sInfo ? sInfo.name : $user.displayName;
				const aSubject = sInfo ? sInfo.subject : '미정';

				await addDoc(collection(db, 'observation_applications'), {
					date: targetDate,
					classId,
					period,
					subject,
					teacher,
					applicantEmail: $user.email,
					applicantName: aName,
					applicantSubject: aSubject,
					status: 'PENDING',
					timestamp: Timestamp.now()
				});

				// 웹훅 알림 전송
				await sendWebhookNotification(teacher, aName, aSubject, targetDate, period, subject);
			}
		}
	}

	function getClassesForGrade(grade: number) {
		return Object.keys(timetableData).filter((id) => id.startsWith(grade.toString()));
	}

	function is7thPeriodRestricted(targetDate: string, period: string) {
		const day = new Date(targetDate).getDay();
		if ((day === 1 || day === 3 || day === 5) && period === '7') return true;
		return false;
	}
</script>

<div class="full-width container">
	<header class="page-header">
		<div class="header-top">
			<a href="/" class="back-link">
				<ChevronLeft size={20} /> 뒤로가기
			</a>
			<div class="title-group">
				<Calendar size={32} />
				<h1>5월 {new Date(date).getDate()}일 ({weekDays[new Date(date).getDay() - 1]}) 시간표</h1>
			</div>
		</div>
	</header>

	<nav class="main-nav">
		<div class="grade-tabs">
			{#each grades as g}
				<button
					class="nav-item {viewMode === 'grade' && selectedGrade === g ? 'active' : ''}"
					onclick={() => {
						viewMode = 'grade';
						selectedGrade = g;
						selectedTeacher = null;
					}}
				>
					{g}학년
				</button>
			{/each}
		</div>
		<div class="divider"></div>
		<button
			class="nav-item teacher-tab {viewMode === 'teacher' ? 'active' : ''}"
			onclick={() => {
				viewMode = 'teacher';
				selectedGrade = 0;
			}}
		>
			<BookOpen size={18} /> 교사별
		</button>
	</nav>

	{#if loading}
		<div class="loading-state">
			<Loader2 class="spin" size={48} />
			<p>데이터를 불러오는 중입니다...</p>
		</div>
	{:else if viewMode === 'grade'}
		<!-- Grade View -->
		<div class="timetable-wrapper">
			<table class="timetable">
				<thead>
					<tr>
						<th class="sticky-col period-header corner-tl">교시</th>
						{#each getClassesForGrade(selectedGrade) as classId, i}
							<th class={i === getClassesForGrade(selectedGrade).length - 1 ? 'corner-tr' : ''}
								>{parseInt(classId.substring(2))}반</th
							>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each periods as period}
						{#if !(selectedGrade === 3 && period === '7')}
							<tr>
								<td
									class="sticky-col period-cell {period === '7' ||
									(new Date(date).getDay() % 2 === 1 && period === '6')
										? 'last'
										: ''}">{period}</td
								>
								{#each getClassesForGrade(selectedGrade) as classId}
									{@const slot = timetableData[classId][date]?.[period]}
									{@const apps = applications.filter(
										(app) => app.date === date && app.classId === classId && app.period === period
									)}
									{@const isMine = apps.some((a) => a.applicantEmail === $user?.email)}
									{@const isFull = apps.length >= maxApplicants}
									{@const isGlobalRestricted = slot
										? teacherRestrictions.includes(slot.teacher)
										: false}
									{@const isTeacherRestricted = slot
										? restrictions.includes(`${slot.teacher}_${date}_${period}_${classId}`) ||
											isGlobalRestricted
										: false}

									<td
										class="slot-cell {slot ? 'active' : 'empty'} {isTeacherRestricted
											? 'restricted'
											: ''}"
									>
										{#if slot}
											{#if isTeacherRestricted}
												<div class="slot-restricted-msg">
													<Lock size={12} />
													{isGlobalRestricted ? '전면 참관 불가' : '참관 불가'}
												</div>
											{:else}
												<button
													class="slot-btn {isMine ? 'mine' : ''} {isFull && !isMine ? 'full' : ''}"
													onclick={() =>
														toggleApplication(date, classId, period, slot.subject, slot.teacher)}
												>
													<div class="slot-row">
														<div class="slot-info-main">
															<span
																class="subject"
																style="background-color: {getSubjectColor(slot.subject)}"
																>{slot.subject}</span
															>
															<span class="teacher">{slot.teacher}</span>
														</div>
														<div class="status-box">
															<div class="applicant-count">
																<Users size={12} />
																{apps.length}/{maxApplicants}
															</div>
															{#if isMine}
																{@const myApp = apps.find((a) => a.applicantEmail === $user?.email)}
																<span
																	class="my-badge {myApp?.status === 'APPROVED'
																		? 'approved'
																		: 'pending'}"
																>
																	{myApp?.status === 'APPROVED' ? '신청완료' : '승인대기'}
																</span>
															{/if}
														</div>
													</div>

													{#if apps.some((a) => a.status === 'APPROVED')}
														<div class="applicant-list">
															{#each apps.filter((a) => a.status === 'APPROVED') as app}
																<span class="applicant-tag"
																	>{app.applicantSubject
																		? `[${app.applicantSubject}] `
																		: ''}{app.applicantName}</span
																>
															{/each}
														</div>
													{/if}
												</button>
											{/if}
										{:else}
											<div class="no-class">-</div>
										{/if}
									</td>
								{/each}
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
	{:else if viewMode === 'teacher' && !selectedTeacher}
		<!-- Teacher List View -->
		<div class="teacher-selection">
			<div class="view-header">
				<h2>전체 지도 교사 목록</h2>
				<p>시간표를 확인하려는 선생님을 선택하세요.</p>
			</div>
			<div class="teacher-grid">
				{#each teachers as teacher}
					<button class="teacher-card card" onclick={() => (selectedTeacher = teacher)}>
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
		</div>
	{:else if viewMode === 'teacher' && selectedTeacher}
		<!-- Teacher Weekly View -->
		<div class="view-header teacher-view-header">
			<button class="back-btn" onclick={() => (selectedTeacher = null)}>
				<ChevronLeft size={20} /> 목록
			</button>
			<div class="teacher-title">
				<User size={24} />
				<h2>{selectedTeacher} 선생님 주간 시간표</h2>
			</div>
		</div>

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
							<td class="sticky-col period-cell {period === '7' ? 'last' : ''}">{period}</td>
							{#each weekDates as d}
								{@const classId = Object.keys(timetableData).find(
									(id) => timetableData[id][d]?.[period]?.teacher === selectedTeacher
								)}
								{@const slot = classId ? timetableData[classId][d][period] : null}
								{@const apps = classId
									? applications.filter(
											(app) => app.date === d && app.classId === classId && app.period === period
										)
									: []}
								{@const isMine = apps.some((a) => a.applicantEmail === $user?.email)}
								{@const isFull = apps.length >= maxApplicants}
								{@const isRestricted = is7thPeriodRestricted(d, period)}
								{@const isGlobalRestricted = selectedTeacher
									? teacherRestrictions.includes(selectedTeacher)
									: false}
								{@const isTeacherRestricted =
									slot && classId
										? restrictions.includes(`${selectedTeacher}_${d}_${period}_${classId}`) ||
											isGlobalRestricted
										: false}

								<td
									class="slot-cell {slot
										? 'active'
										: isRestricted
											? 'restricted'
											: 'empty'} {isTeacherRestricted ? 'restricted' : ''}"
								>
									{#if slot && classId}
										{#if isTeacherRestricted}
											<div class="slot-restricted-msg">
												<Lock size={12} />
												{isGlobalRestricted ? '전면 참관 불가' : '참관 불가'}
											</div>
										{:else}
											<button
												class="slot-btn {isMine ? 'mine' : ''} {isFull && !isMine ? 'full' : ''}"
												onclick={() =>
													toggleApplication(d, classId, period, slot.subject, selectedTeacher!)}
											>
												<div class="slot-row">
													<div class="slot-info-main">
														<span
															class="subject"
															style="background-color: {getSubjectColor(slot.subject)}"
															>{slot.subject}</span
														>
														<span class="class-label"
															>{classId.substring(0, 1)}-{parseInt(classId.substring(2))}</span
														>
													</div>
													<div class="status-box">
														<div class="applicant-count">
															<Users size={12} />
															{apps.length}/{maxApplicants}
														</div>
														{#if isMine}
															{@const myApp = apps.find((a) => a.applicantEmail === $user?.email)}
															<span
																class="my-badge {myApp?.status === 'APPROVED'
																	? 'approved'
																	: 'pending'}"
															>
																{myApp?.status === 'APPROVED' ? '신청완료' : '승인대기'}
															</span>
														{/if}
													</div>
												</div>

												{#if apps.some((a) => a.status === 'APPROVED')}
													<div class="applicant-list">
														{#each apps.filter((a) => a.status === 'APPROVED') as app}
															<span class="applicant-tag"
																>{app.applicantSubject
																	? `[${app.applicantSubject}] `
																	: ''}{app.applicantName}</span
															>
														{/each}
													</div>
												{/if}
											</button>
										{/if}
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

	.header-top {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.back-link {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #64748b;
		text-decoration: none;
		font-weight: 700;
		width: fit-content;
	}

	.back-link:hover {
		color: var(--header-bg);
	}

	.title-group {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		color: var(--header-bg);
	}

	.title-group h1 {
		margin: 0;
		font-size: 2rem;
		font-weight: 900;
	}

	.main-nav {
		display: flex;
		align-items: center;
		background: #f8fafc;
		padding: 0.5rem;
		border-radius: 12px;
		margin-bottom: 2rem;
		border: 1px solid #e2e8f0;
	}

	.grade-tabs {
		display: flex;
		gap: 0.5rem;
	}

	.nav-item {
		padding: 0.6rem 1.2rem;
		border-radius: 8px;
		border: none;
		background: none;
		font-weight: 800;
		color: #64748b;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		transition: all 0.2s;
	}

	.nav-item:hover {
		background: #f1f5f9;
		color: #1e293b;
	}

	.nav-item.active {
		background: white;
		color: var(--header-bg);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	}

	.divider {
		width: 1px;
		height: 24px;
		background: #cbd5e1;
		margin: 0 1rem;
	}

	.timetable-wrapper {
		background: white;
		border-radius: 16px;
		overflow-x: auto;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		padding: 1rem;
	}

	.timetable {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
	}
	.timetable th,
	.timetable td {
		border: 1px solid #edf2f7;
		width: 120px;
	}
	.timetable.weekly th,
	.timetable.weekly td {
		width: 200px;
	}

	.timetable th {
		background: #dbeafe;
		padding: 0.6rem;
		font-weight: 800;
		color: #1e3a8a;
		font-size: 0.95rem;
		border: 1px solid #bfdbfe;
	}

	.corner-tl {
		border-top-left-radius: 12px !important;
	}
	.corner-tr {
		border-top-right-radius: 12px !important;
	}

	.sticky-col {
		position: sticky;
		left: 0;
		background: #f8fafc !important;
		z-index: 2;
		border-right: 2px solid #cbd5e0 !important;
		width: 60px !important;
	}

	.period-header {
		border-top-left-radius: 10px;
	}
	.period-cell {
		text-align: center;
		font-weight: 900;
		color: #1e40af;
		font-size: 1.1rem;
		border: 1px solid #e2e8f0;
		border-top: none;
	}

	.period-cell.last {
		border-bottom-left-radius: 10px;
	}

	.slot-cell {
		height: 80px;
		vertical-align: top;
		border: 1px solid #edf2f7;
	}
	.slot-cell.restricted {
		background: #f1f5f9;
	}

	.slot-restricted-msg {
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: #94a3b8;
		font-size: 0.75rem;
		font-weight: 800;
		gap: 0.3rem;
		padding: 0.5rem;
		text-align: center;
	}

	.slot-btn {
		width: 100%;
		height: 100%;
		border: none;
		background: none;
		padding: 0.4rem;
		display: flex;
		flex-direction: column;
		text-align: left;
		cursor: pointer;
		transition: all 0.2s;
		gap: 0.3rem;
	}

	.slot-btn:hover {
		background: #f8fafc;
	}
	.slot-btn.mine {
		background: #f0fdf4;
		border: 2px solid #22c55e;
		border-radius: 8px;
	}
	.slot-btn.full {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.slot-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		gap: 0.4rem;
	}

	.slot-info-main {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.slot-info {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.4rem;
	}
	.subject {
		font-weight: 800;
		font-size: 0.8rem;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		width: fit-content;
		white-space: nowrap;
	}
	.teacher,
	.class-label {
		font-size: 0.8rem;
		color: #64748b;
		font-weight: 700;
		white-space: nowrap;
	}

	.status-box {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.4rem;
	}

	.applicant-count {
		font-size: 0.75rem;
		color: #94a3b8;
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}
	.my-badge {
		color: white;
		font-size: 0.7rem;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		font-weight: 800;
	}
	.my-badge.pending {
		background: #f59e0b;
	}
	.my-badge.approved {
		background: #22c55e;
	}

	.applicant-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem;
		margin-top: 0.2rem;
		padding-top: 0.2rem;
		border-top: 1px dashed #e2e8f0;
	}
	.applicant-tag {
		background: rgba(0, 0, 0, 0.05);
		color: #475569;
		font-size: 0.7rem;
		font-weight: 700;
		padding: 0.05rem 0.3rem;
		border-radius: 4px;
		white-space: nowrap;
	}

	.no-class {
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #e2e8f0;
		font-weight: 800;
	}

	.no-class.restricted {
		color: #cbd5e0;
		font-size: 0.8rem;
	}

	/* Teacher Selection Styles */
	.teacher-selection {
		padding: 1rem;
	}

	.teacher-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 1rem;
		margin-top: 2rem;
	}

	.teacher-card {
		padding: 1.5rem 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		transition: all 0.2s;
		background: white;
		cursor: pointer;
		text-align: center;
		border: 2px solid transparent;
	}

	.teacher-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
		border-color: #e2e8f0;
	}

	.teacher-subject-badge {
		padding: 0.2rem 0.8rem;
		border-radius: 20px;
		font-size: 0.85rem;
		font-weight: 800;
		color: #1a202c;
	}

	.teacher-name {
		font-weight: 800;
		color: #2d3748;
		font-size: 1.1rem;
	}

	/* Teacher View Header */
	.teacher-view-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.back-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 1rem;
		background: #f1f5f9;
		border: none;
		border-radius: 8px;
		font-weight: 800;
		color: #475569;
		cursor: pointer;
	}

	.back-btn:hover {
		background: #e2e8f0;
	}

	.teacher-title {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		color: var(--header-bg);
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

	@media (max-width: 1024px) {
		.timetable th,
		.timetable td {
			width: 140px;
		}
	}
</style>
