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
		BookOpen
	} from 'lucide-svelte';

	const date = page.params.date ?? '';

	// State for View Mode
	let viewMode = $state<'grade' | 'teacher'>('grade');
	let selectedGrade = $state(1);
	let selectedTeacher = $state<string | null>(null);

	let applications = $state<any[]>([]);
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

	// Firestore Listener (Fetch all apps for the current week)
	let unsubscribe: () => void;
	onMount(() => {
		const q = query(
			collection(db, 'observation_applications'),
			where('date', '>=', weekDates[0]),
			where('date', '<=', weekDates[4])
		);
		unsubscribe = onSnapshot(q, (snapshot) => {
			applications = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
			loading = false;
		});
	});

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
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
			// Using no-cors might be needed for some webhooks if they don't support OPTIONS preflight,
			// but Google Chat webhooks usually work with a simple POST if sent from a secure origin.
			await fetch(webhookUrl, {
				method: 'POST',
				mode: 'no-cors', // Avoid CORS issues for simple webhook delivery
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
		if (!$isStudent) return alert('참관 신청은 실습생 전용 기능입니다.');

		const slotApps = applications.filter(
			(app) => app.date === targetDate && app.classId === classId && app.period === period
		);
		const myApp = slotApps.find((app) => app.applicantEmail === $user.email);

		if (myApp) {
			if (confirm('신청을 취소하시겠습니까?')) {
				await deleteDoc(doc(db, 'observation_applications', myApp.id));
			}
		} else {
			// Duplicate check for the same period on the same day
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
		return Object.keys(timetableData)
			.filter((id) => id.startsWith(grade.toString()))
			.sort();
	}

	// Teacher Weekly Data Filter
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
			<BookOpen size={18} />
			교사별
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
						{#if !is7thPeriodRestricted(date, period)}
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

									<td class="slot-cell {slot ? 'active' : 'empty'}">
										{#if slot}
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
			<div class="week-info">
				{weekDates[0]} ~ {weekDates[4]}
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
								{@const slot = getTeacherSlot(selectedTeacher, d, period)}
								{@const apps = slot
									? applications.filter(
											(app) =>
												app.date === d && app.classId === slot.classId && app.period === period
										)
									: []}
								{@const isMine = apps.some((a) => a.applicantEmail === $user?.email)}
								{@const isFull = apps.length >= maxApplicants}
								{@const isRestricted = is7thPeriodRestricted(d, period)}

								<td class="slot-cell {slot ? 'active' : isRestricted ? 'restricted' : 'empty'}">
									{#if slot}
										<button
											class="slot-btn {isMine ? 'mine' : ''} {isFull && !isMine ? 'full' : ''}"
											onclick={() =>
												toggleApplication(d, slot.classId, period, slot.subject, selectedTeacher!)}
										>
											<div class="slot-row">
												<div class="slot-info-main">
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
		max-width: 1300px !important;
		margin: 0 auto;
		padding: 0 2rem 2rem 2rem;
	}

	.main-nav {
		display: flex;
		align-items: center;
		justify-content: center;
		background: white;
		border-bottom: 1px solid #e2e8f0;
		margin: 0 -2rem 1.5rem -2rem;
		padding: 0 2rem;
		gap: 1rem;
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.grade-tabs {
		display: flex;
		gap: 0.5rem;
	}

	.nav-item {
		border: none;
		background: none;
		padding: 1rem 1.5rem;
		font-weight: 700;
		cursor: pointer;
		color: #64748b;
		font-size: 1rem;
		transition: all 0.2s;
		border-bottom: 4px solid transparent;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.nav-item:hover {
		color: var(--header-bg);
		background: #f8fafc;
	}
	.nav-item.active {
		color: #1e40af;
		border-bottom-color: #1e40af;
		background: #eff6ff;
	}

	.divider {
		width: 1px;
		height: 24px;
		background: #e2e8f0;
		margin: 0 0.5rem;
	}

	.teacher-tab {
		color: #0f172a;
	}

	.view-header {
		margin-bottom: 1.5rem;
		text-align: center;
	}

	.view-header h2 {
		margin: 0;
		color: #1e293b;
		font-size: 1.5rem;
		font-weight: 800;
	}
	.date-info,
	.week-info {
		color: #64748b;
		font-weight: 600;
		margin-top: 0.3rem;
		display: block;
	}

	.teacher-view-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: #f8fafc;
		padding: 1rem 1.5rem;
		border-radius: 12px;
		border: 1px solid #e2e8f0;
	}

	.back-btn {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		background: white;
		border: 1px solid #cbd5e0;
		padding: 0.5rem 1rem;
		border-radius: 8px;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s;
	}

	.back-btn:hover {
		background: #f1f5f9;
	}

	.teacher-title {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		color: #1e40af;
	}

	.teacher-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		gap: 0.8rem;
		margin-top: 1rem;
	}

	.teacher-card {
		padding: 1.5rem 0.8rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.teacher-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		border-color: #3b82f6;
	}

	.teacher-subject-badge {
		padding: 0.3rem 0.8rem;
		border-radius: 20px;
		font-size: 0.85rem;
		font-weight: 800;
		color: #1a202c;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
	}

	.teacher-name {
		font-weight: 800;
		font-size: 1.1rem;
		color: #1e293b;
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
		background: #f8fafc;
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
		margin-top: auto;
	}
	.applicant-count {
		font-size: 0.8rem;
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
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px dashed #e2e8f0;
	}
	.applicant-tag {
		background: rgba(0, 0, 0, 0.05);
		color: #475569;
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0.1rem 0.4rem;
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

	.loading-state {
		padding: 10rem 0;
		text-align: center;
	}
	.spin {
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
		color: #3b82f6;
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
