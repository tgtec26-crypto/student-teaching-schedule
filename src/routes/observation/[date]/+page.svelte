<script lang="ts">
	import { page } from '$app/state';
	import { user, db } from '$lib/firebase';
	import { timetableData } from '$lib/timetableData';
	import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
	import { onMount, onDestroy } from 'svelte';
	import { Users, CheckCircle, XCircle, ArrowLeft, Loader2 } from 'lucide-svelte';

	const date = page.params.date ?? '';
	const formattedDate = date ? new Date(date).toLocaleDateString('ko-KR', {
		month: 'long',
		day: 'numeric',
		weekday: 'short'
	}) : '날짜 없음';

	let selectedGrade = $state(1);
	let applications = $state<any[]>([]);
	let loading = $state(true);

	const grades = [1, 2, 3];
	const maxApplicants = 5;

	// Firestore Listener
	let unsubscribe: () => void;

	onMount(() => {
		const q = query(collection(db, 'observation_applications'), where('date', '==', date));
		unsubscribe = onSnapshot(q, (snapshot) => {
			applications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
			loading = false;
		});
	});

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
	});

	// Derived state for current user's applications on this date
	const myAppsToday = $derived(applications.filter(app => app.applicantEmail === $user?.email));

	function getAppsForSlot(classId: string, period: string) {
		return applications.filter(app => app.classId === classId && app.period === period);
	}

	async function toggleApplication(classId: string, period: string, subject: string, teacher: string) {
		if (!$user) {
			alert('로그인이 필요합니다.');
			return;
		}

		const slotApps = getAppsForSlot(classId, period);
		const myApp = slotApps.find(app => app.applicantEmail === $user.email);

		if (myApp) {
			if (confirm('신청을 취소하시겠습니까?')) {
				await deleteDoc(doc(db, 'observation_applications', myApp.id));
			}
		} else {
			// Check duplication
			const duplicate = myAppsToday.find(app => app.period === period);
			if (duplicate) {
				const dupClass = duplicate.classId;
				alert(`이미 ${period}교시에 ${dupClass.substring(0,1)}학년 ${parseInt(dupClass.substring(2))}반 수업을 신청하셨습니다.`);
				return;
			}

			if (slotApps.length >= maxApplicants) {
				alert('정원이 초과되어 신청할 수 없습니다.');
				return;
			}

			if (confirm(`${classId.substring(0,1)}학년 ${parseInt(classId.substring(2))}반 ${period}교시 (${subject}) 수업 참관을 신청하시겠습니까?`)) {
				await addDoc(collection(db, 'observation_applications'), {
					date,
					classId,
					period,
					subject,
					teacher,
					applicantEmail: $user.email,
					applicantName: $user.displayName,
					timestamp: Timestamp.now()
				});
			}
		}
	}

	function getClassesForGrade(grade: number) {
		return Object.keys(timetableData).filter(id => id.startsWith(grade.toString())).sort();
	}

	const periods = ['1', '2', '3', '4', '5', '6', '7'];
</script>

<div class="container full-width">
	<nav class="grade-nav">
		{#each grades as g}
			<button 
				class="nav-item {selectedGrade === g ? 'active' : ''}" 
				on:click={() => selectedGrade = g}
			>
				{g}학년
			</button>
		{/each}
	</nav>

	{#if loading}
		<div class="loading-state">
			<Loader2 class="spin" size={48} />
			<p>데이터를 불러오는 중입니다...</p>
		</div>
	{:else}
		<div class="timetable-wrapper">
			<table class="timetable">
				<thead>
					<tr>
						<th class="sticky-col period-header">교시</th>
						{#each getClassesForGrade(selectedGrade) as classId}
							<th>{parseInt(classId.substring(2))}반</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each periods as period}
						<tr>
							<td class="sticky-col period-cell">{period}</td>
							{#each getClassesForGrade(selectedGrade) as classId}
								{@const slot = timetableData[classId][date]?.[period]}
								{@const apps = getAppsForSlot(classId, period)}
								{@const isMine = apps.some(a => a.applicantEmail === $user?.email)}
								{@const isFull = apps.length >= maxApplicants}
								
								<td class="slot-cell {slot ? 'active' : 'empty'}">
									{#if slot}
										<button 
											class="slot-btn {isMine ? 'mine' : ''} {isFull && !isMine ? 'full' : ''}"
											on:click={() => toggleApplication(classId, period, slot.subject, slot.teacher)}
										>
											<div class="slot-info">
												<span class="subject">{slot.subject}</span>
												<span class="teacher">{slot.teacher}</span>
											</div>
											
											<div class="status-box">
												<div class="applicant-count">
													<Users size={14} />
													<span>{apps.length}/{maxApplicants}</span>
												</div>
												{#if isMine}
													<span class="my-badge">신청완료</span>
												{:else if isFull}
													<span class="full-badge">마감</span>
												{/if}
											</div>

											{#if apps.length > 0}
												<div class="applicant-names">
													{apps.map(a => a.applicantName).join(', ')}
												</div>
											{/if}
										</button>
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
		max-width: 1200px !important;
		margin: 0 auto;
		padding: 0 3rem 2rem 3rem;
	}

	.grade-nav {
		display: flex;
		justify-content: center;
		background: white;
		border-bottom: 1px solid #e2e8f0;
		margin: 0 -3rem 1.5rem -3rem;
		padding: 0 3rem;
		gap: 0.5rem;
	}

	.nav-item {
		border: none;
		background: none;
		padding: 0.8rem 2rem;
		font-weight: 700;
		cursor: pointer;
		color: #4a5568;
		font-size: 1.05rem;
		transition: all 0.2s;
		border-bottom: 3px solid transparent;
	}

	.nav-item:hover {
		color: var(--header-bg);
		background: #f8fafc;
	}

	.nav-item.active {
		background: #ebf4ff;
		color: #1e40af;
		border-bottom: 4px solid #1e40af;
	}

	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 10rem 0;
		color: var(--header-bg);
	}

	.spin {
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.timetable-wrapper {
		background: white;
		border-radius: 12px;
		overflow-x: auto;
		box-shadow: 0 4px 12px rgba(0,0,0,0.08);
		padding: 0.5rem;
		display: flex;
		justify-content: center;
	}

	.timetable {
		width: auto;
		border-collapse: separate;
		border-spacing: 0;
		table-layout: fixed;
	}

	.timetable th, .timetable td {
		width: 180px;
	}

	.timetable th.period-header, .timetable td.period-cell {
		width: 60px;
	}

	.timetable th {
		background: #dbeafe;
		padding: 0.5rem;
		border: 1px solid #bfdbfe;
		font-weight: 800;
		color: #1e3a8a;
		font-size: 0.95rem;
		border-top-left-radius: 10px;
		border-top-right-radius: 10px;
	}

	.timetable th:not(:first-child) {
		border-left: none;
	}

	.sticky-col {
		position: sticky;
		left: 0;
		background: #f8fafc !important;
		z-index: 2;
		border-right: 2px solid #cbd5e0 !important;
		border-top-left-radius: 10px;
	}

	.period-header { width: 60px; }
	.period-cell {
		text-align: center;
		font-size: 1.1rem;
		font-weight: 900;
		color: var(--header-bg);
	}

	.slot-cell {
		border: 1px solid #edf2f7;
		vertical-align: top;
		height: 95px;
	}

	.slot-btn {
		width: 100%;
		height: 100%;
		border: none;
		background: none;
		padding: 0.6rem;
		display: flex;
		flex-direction: column;
		text-align: left;
		cursor: pointer;
		transition: all 0.2s;
		gap: 0.3rem;
	}

	.slot-btn:hover:not(.full) {
		background: #f1f5f9;
	}

	.slot-btn.mine {
		background: #f0fff4;
		border: 2px solid var(--accent-green);
	}

	.slot-btn.full:not(.mine) {
		background: #f7fafc;
		cursor: not-allowed;
		opacity: 0.7;
	}

	.slot-info {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.subject {
		font-weight: 800;
		font-size: 0.95rem;
		color: #1a202c;
		line-height: 1.1;
	}

	.teacher {
		font-size: 0.8rem;
		color: #718096;
		font-weight: 600;
	}

	.status-box {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 0.2rem;
	}

	.applicant-count {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		font-size: 0.8rem;
		font-weight: 700;
		color: #4a5568;
	}

	.my-badge {
		background: var(--accent-green);
		color: var(--header-bg);
		font-size: 0.7rem;
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
		font-weight: 800;
	}

	.full-badge {
		background: #cbd5e0;
		color: #4a5568;
		font-size: 0.7rem;
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
		font-weight: 800;
	}

	.applicant-names {
		font-size: 0.7rem;
		color: #a0aec0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		border-top: 1px dashed #edf2f7;
		padding-top: 0.2rem;
		margin-top: auto;
	}

	.mine .applicant-names {
		color: #2d3748;
		font-weight: 500;
	}

	.no-class {
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #eee;
		font-weight: 900;
	}
</style>