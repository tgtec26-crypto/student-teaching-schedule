<script lang="ts">
	import { db, isSupervisor, isAdmin } from '$lib/firebase';
	import { collection, query, where, getDocs } from 'firebase/firestore';
	import { timetableData } from '$lib/timetableData';
	import { Users, Calendar, Clock, BookOpen, User, AlertCircle, Loader2, ChevronLeft } from 'lucide-svelte';

	let selectedTeacher = $state('');
	let applications = $state<any[]>([]);
	let loading = $state(false);

	// Subject Color Mapping
	const subjectColors: Record<string, string> = {
		'국어': '#fecaca', '수학': '#bbf7d0', '영어': '#bfdbfe', '과학': '#fef08a',
		'사회': '#e9d5ff', '체육': '#fed7aa', '미술': '#fbcfe8', '음악': '#bae6fd',
		'정보': '#a7f3d0', '기술': '#e2e8f0', '가정': '#ffedd5', '한문': '#e7e5e4',
		'도덕': '#dcfce7', '진로': '#f3e8ff', '스포츠': '#cffafe'
	};

	function getSubjectColor(subject: string) {
		if (!subject) return '#f3f4f6';
		const base = subject.substring(0, 2);
		return subjectColors[base] || '#f3f4f6';
	}

	// Extract unique teachers and their subjects
	const teacherToSubject = (() => {
		const mapping: Record<string, string> = {};
		Object.values(timetableData).forEach((classData: any) => {
			Object.values(classData).forEach((dayData: any) => {
				Object.values(dayData).forEach((slot: any) => {
					if (slot.teacher && !mapping[slot.teacher]) {
						mapping[slot.teacher] = slot.subject;
					}
				});
			});
		});
		return mapping;
	})();

	const teachers = Object.keys(teacherToSubject).sort((a, b) => {
		const subjectA = teacherToSubject[a];
		const subjectB = teacherToSubject[b];
		if (subjectA !== subjectB) return subjectA.localeCompare(subjectB);
		return a.localeCompare(b);
	});

	async function fetchApplications() {
		if (!selectedTeacher) {
			applications = [];
			return;
		}

		loading = true;
		try {
			const q = query(
				collection(db, 'observation_applications'),
				where('teacher', '==', selectedTeacher)
			);
			const querySnapshot = await getDocs(q);
			applications = querySnapshot.docs.map(doc => ({
				id: doc.id,
				...doc.data()
			})).sort((a: any, b: any) => {
				if (a.date !== b.date) return a.date.localeCompare(b.date);
				return a.period.localeCompare(b.period);
			});
		} catch (error) {
			console.error("Error fetching applications:", error);
		} finally {
			loading = false;
		}
	}

	function handleTeacherClick(teacher: string) {
		selectedTeacher = teacher;
		fetchApplications();
	}
</script>

<div class="container">
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
							on:click={() => handleTeacherClick(teacher)}
						>
							<span class="teacher-subject-badge" style="background-color: {getSubjectColor(teacherToSubject[teacher])}">
								{teacherToSubject[teacher]}
							</span>
							<span class="teacher-name">{teacher}</span>
						</button>
					{/each}
				</div>
			</section>

			{#if selectedTeacher}
				<section class="results-section">
					<div class="section-header">
						<button class="back-btn-mini" on:click={() => selectedTeacher = ''}>
							<ChevronLeft size={16} /> 다른 선생님 선택
						</button>
						<h3>{selectedTeacher} 선생님의 참관 신청 현황</h3>
						<span class="count">총 {applications.length}건</span>
					</div>

					{#if loading}
						<div class="loading-state">
							<Loader2 class="spin" size={32} />
							<p>데이터를 불러오는 중...</p>
						</div>
					{:else if applications.length === 0}
						<div class="empty-state card">
							<p>신청된 내역이 없습니다.</p>
						</div>
					{:else}
						<div class="applications-grid">
							{#each applications as app}
								<div class="app-card card">
									<div class="app-header">
										<span class="date-badge">
											<Calendar size={14} />
											{app.date}
										</span>
										<span class="period-badge">
											<Clock size={14} />
											{app.period}교시
										</span>
									</div>
									<div class="app-body">
										<div class="info-row">
											<BookOpen size={16} />
											<span class="subject">{app.subject}</span>
											<span class="class-id">({app.classId.substring(0,1)}학년 {parseInt(app.classId.substring(2))}반)</span>
										</div>
										<div class="applicant-info">
											<div class="applicant-name">
												<strong>신청자:</strong> {app.applicantName}
											</div>
											<div class="applicant-email">{app.applicantEmail}</div>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{/if}
		</div>
	{/if}
</div>

<style>
	.page-header {
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
		padding: 1.2rem 0.8rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.8rem;
		border: 2px solid transparent;
		transition: all 0.2s;
		background: white;
		cursor: pointer;
		text-align: center;
	}

	.teacher-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 10px rgba(0,0,0,0.1);
		border-color: #e2e8f0;
	}

	.teacher-card.active {
		border-color: var(--header-bg);
		background: #f0f4ff;
	}

	.teacher-subject-badge {
		padding: 0.2rem 0.6rem;
		border-radius: 20px;
		font-size: 0.8rem;
		font-weight: 800;
		color: #1a202c;
		box-shadow: inset 0 0 0 1px rgba(0,0,0,0.05);
	}

	.teacher-name {
		font-weight: 800;
		color: #2d3748;
		font-size: 1rem;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		border-bottom: 2px solid #edf2f7;
		padding-bottom: 0.8rem;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.back-btn-mini {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		padding: 0.4rem 0.8rem;
		border-radius: 6px;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
	}

	.back-btn-mini:hover { background: #edf2f7; }

	.section-header h3 {
		margin: 0;
		color: var(--header-bg);
		font-size: 1.3rem;
	}

	.count {
		background: var(--header-bg);
		color: white;
		padding: 0.3rem 1rem;
		border-radius: 20px;
		font-size: 0.95rem;
		font-weight: 700;
	}

	.applications-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1.5rem;
	}

	.app-card {
		padding: 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		transition: transform 0.2s;
	}

	.app-card:hover {
		transform: translateY(-4px);
	}

	.app-header {
		display: flex;
		gap: 0.8rem;
	}

	.date-badge, .period-badge {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.3rem 0.6rem;
		border-radius: 6px;
		font-size: 0.85rem;
		font-weight: 700;
	}

	.date-badge {
		background: #f0f4ff;
		color: #3b82f6;
	}

	.period-badge {
		background: #fff7ed;
		color: #f59e0b;
	}

	.info-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		color: #333;
	}

	.subject {
		font-weight: 800;
		font-size: 1.1rem;
	}

	.class-id {
		color: #666;
		font-size: 0.95rem;
	}

	.applicant-info {
		background: #f9fafb;
		padding: 0.8rem;
		border-radius: 6px;
		border-left: 4px solid #ddd;
	}

	.applicant-name {
		font-size: 1rem;
		margin-bottom: 0.2rem;
	}

	.applicant-email {
		font-size: 0.85rem;
		color: #666;
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
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		color: #666;
		font-weight: 600;
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
		.applications-grid {
			grid-template-columns: 1fr;
		}
		.teacher-grid {
			grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
		}
	}
</style>