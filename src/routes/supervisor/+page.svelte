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
		Lock,
		AlertCircle,
		Loader2,
		ChevronLeft,
		ChevronRight,
		User,
		UserCheck
	} from 'lucide-svelte';
	import { onMount, onDestroy } from 'svelte';

	let selectedTeacher = $state('');
	let autoApprove = $state(false);
	let applications = $state<any[]>([]);
	let restrictions = $state<string[]>([]);
	let teacherRestrictions = $state<string[]>([]);
	let loading = $state(false);
	let approvingId = $state<string | null>(null);
	let currentWeekIndex = $state(0); // 0, 1, 2 for 3 weeks

	const maxApplicants = 5;
	const periods = ['1', '2', '3', '4', '5', '6', '7'];
	const weekDays = ['월', '화', '수', '목', '금'];

	const allWeekDates = [
	        '2026-05-11', '2026-05-12', '2026-05-13', '2026-05-14', '2026-05-15',
	        '2026-05-18', '2026-05-19', '2026-05-20', '2026-05-21', '2026-05-22',
	        '2026-05-25', '2026-05-26', '2026-05-27', '2026-05-28', '2026-05-29'
	];

	const weekDates = $derived(allWeekDates.slice(currentWeekIndex * 5, (currentWeekIndex + 1) * 5));

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
	        '국어', '한문', '수학', '도덕', '사회', '역사', '물리', '화학', '생명', '지구',
	        '과학', '영어', '기가', '기술', '가정', '체육', '음악', '미술', '진로', '정보',
	        '스포츠', '주제', '동아리'
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

	// Extract unique teachers and their subjects
	const teacherToSubject = (() => {
	        const subjectsList: Record<string, Set<string>> = {};
	        Object.values(timetableData).forEach((classData: any) => {
	                Object.values(classData).forEach((dayData: any) => {
	                        Object.values(dayData).forEach((slot: any) => {
	                                if (slot.teacher) {
	                                        if (!subjectsList[slot.teacher]) subjectsList[slot.teacher] = new Set();
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

	const teachers = $derived(Object.keys(teacherToSubject)
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
	        }));

	let unsubscribeApps: () => void;
	let unsubscribeRestricted: () => void;
	let unsubscribeSettings: () => void;

	// Global Listeners
	onMount(() => {
	        const unsubGlobal = onSnapshot(collection(db, 'teacher_restrictions'), (snapshot) => {
	                teacherRestrictions = snapshot.docs.map((doc) => doc.id);
	        });

	        if ($user?.displayName && $isSupervisor && !$isAdmin) {
	                selectedTeacher = $user.displayName;
	        }

	        return () => {
	                unsubGlobal();
	                if (unsubscribeApps) unsubscribeApps();
	                if (unsubscribeRestricted) unsubscribeRestricted();
	                if (unsubscribeSettings) unsubscribeSettings();
	        };
	});

	// Reactive Data Fetching
	$effect(() => {
	        if (!selectedTeacher) {
	                applications = [];
	                restrictions = [];
	                autoApprove = false;
	                loading = false;
	                return;
	        }

	        if (unsubscribeApps) unsubscribeApps();
	        if (unsubscribeRestricted) unsubscribeRestricted();
	        if (unsubscribeSettings) unsubscribeSettings();

	        loading = true;

	        // Fetch Applications
	        const qApps = query(
	                collection(db, 'observation_applications'),
	                where('teacher', '==', selectedTeacher),
	                where('date', '>=', allWeekDates[0]),
	                where('date', '<=', allWeekDates[14])
	        );

	        unsubscribeApps = onSnapshot(
	                qApps,
	                (snapshot) => {
	                        applications = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
	                        loading = false;
	                },
	                (error) => {
	                        console.error('Applications fetch error:', error);
	                        loading = false;
	                }
	        );

	        // Fetch Teacher Restrictions
	        const qRestricted = query(
	                collection(db, 'restricted_lessons'),
	                where('teacher', '==', selectedTeacher)
	        );

	        unsubscribeRestricted = onSnapshot(
	                qRestricted,
	                (snapshot) => {
	                        restrictions = snapshot.docs.map((doc) => doc.id);
	                },
	                (error) => {
	                        console.error('Restrictions fetch error:', error);
	                }
	        );

	        // Fetch Teacher Settings (Auto Approve)
	        unsubscribeSettings = onSnapshot(doc(db, 'teacher_settings', selectedTeacher), (docSnap) => {
	                if (docSnap.exists()) {
	                        autoApprove = docSnap.data().autoApprove || false;
	                } else {
	                        autoApprove = false;
	                }
	        });
	});

	async function toggleAutoApprove() {
	        if (!selectedTeacher) return;
	        try {
	                await setDoc(doc(db, 'teacher_settings', selectedTeacher), {
	                        autoApprove: !autoApprove
	                }, { merge: true });
	        } catch (error) {
	                console.error('Toggle auto approve error:', error);
	                alert('설정 변경 중 오류가 발생했습니다.');
	        }
	}
	async function toggleRestriction(date: string, period: string, classId: string) {
		const restrictionId = `${selectedTeacher}_${date}_${period}_${classId}`;
		const isCurrentlyRestricted = restrictions.includes(restrictionId);

		try {
			if (isCurrentlyRestricted) {
				await deleteDoc(doc(db, 'restricted_lessons', restrictionId));
			} else {
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

	async function approveApplication(e: Event, appId: string) {
		e.preventDefault();
		e.stopPropagation();
		if (approvingId) return;

		try {
			approvingId = appId;
			const appRef = doc(db, 'observation_applications', appId);
			const appSnap = await getDoc(appRef);
			const appData = appSnap.data();

			await updateDoc(appRef, { status: 'APPROVED' });
			applications = applications.map(app => 
				app.id === appId ? { ...app, status: 'APPROVED' } : app
			);

			// 결과 알림 전송
			if (appData) {
				await sendResultNotification(appData, '승인');
			}

			alert('승인이 완료되었습니다.');
		} catch (error: any) {
			console.error('Error approving application:', error);
			alert('승인 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
		} finally {
			approvingId = null;
		}
	}

	async function declineApplication(e: Event, appId: string) {
		e.preventDefault();
		e.stopPropagation();
		if (approvingId) return;

		if (!confirm('정말로 이 참관 신청을 거부하시겠습니까?')) return;

		try {
			approvingId = appId;
			const appRef = doc(db, 'observation_applications', appId);
			const appSnap = await getDoc(appRef);
			const appData = appSnap.data();

			await updateDoc(appRef, { status: 'DECLINED' });
			applications = applications.map(app => 
				app.id === appId ? { ...app, status: 'DECLINED' } : app
			);

			// 결과 알림 전송
			if (appData) {
				await sendResultNotification(appData, '거부');
			}

			alert('거부 처리가 완료되었습니다.');
		} catch (error: any) {
			console.error('Error declining application:', error);
			alert('거부 처리 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
		} finally {
			approvingId = null;
		}
	}

	// 결과 알림 (웹훅 + 이메일 GAS 연동)
	async function sendResultNotification(appData: any, statusLabel: string) {
		// 1. 교사 웹훅 알림
		const webhookUrl = teacherWebhooks[appData.teacher];
		if (webhookUrl) {
			const message = {
				text: `📢 *참관 신청 처리 결과*\n\n` +
					`* 신청자: [${appData.applicantSubject}] ${appData.applicantName}\n` +
					`* 일시: ${appData.date} ${appData.period}교시\n` +
					`* 결과: *${statusLabel}* 처리됨`
			};
			try {
				await fetch(webhookUrl, {
					method: 'POST',
					mode: 'no-cors',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(message)
				});
			} catch (err) {
				console.error('Webhook error:', err);
			}
		}

		// 2. 실습생 이메일 알림 (Google Apps Script 연동)
		const gasUrl = 'https://script.google.com/macros/s/AKfycbzt-JyWTvsZpbuohIx1Z0zgdDzW35RdG56VQn1peulRfObsjqXf2k85w59a-nkrWc_KUA/exec';
		const emailPayload = {
			to: appData.applicantEmail,
			subject: `[SNUG] 수업 참관 신청 결과 안내 (${statusLabel})`,
			body: `${appData.applicantName} 선생님, 안녕하세요.\n\n` +
				  `${appData.date} ${appData.period}교시 [${appData.subject}] 수업 참관 신청이 지도교사님의 확인 결과 '${statusLabel}'되었습니다.\n\n` +
				  `상세 내용은 시스템에서 확인해 주세요.\n` +
				  `https://student-teaching-schedule.vercel.app/`
		};

		try {
			await fetch(gasUrl, {
				method: 'POST',
				mode: 'no-cors', // GAS의 리다이렉션 처리를 위해 no-cors 사용
				body: JSON.stringify(emailPayload)
			});
			console.log(`Email sent to ${appData.applicantEmail}`);
		} catch (err) {
			console.error('Email sending error:', err);
		}
	}

	function handleTeacherClick(teacher: string) {
		selectedTeacher = teacher;
	}

	function getTeacherSlot(teacher: string, targetDate: string, period: string) {
		const d = new Date(targetDate);
		const day = d.getDay();
		const refDate = `2026-05-${10 + day}`;

		for (const [classId, dates] of Object.entries(timetableData)) {
			const slot = (dates as any)[refDate]?.[period];
			if (slot && slot.teacher === teacher) {
				return { classId, ...slot };
			}
		}
		return null;
	}

	function is7thPeriodRestricted(targetDate: string, period: string) {
		const day = new Date(targetDate).getDay();
		return (day === 1 || day === 3 || day === 5) && period === '7';
	}

	function closeCalendar() {
		if ($isAdmin) {
			selectedTeacher = '';
		} else {
			window.location.href = '/';
		}
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
		{#if $isAdmin && !selectedTeacher}
			<header class="page-header">
				<div class="title-group">
					<Users size={32} />
					<h1>지도 교사 전용 페이지</h1>
				</div>
				<p>시간표를 확인하려는 선생님을 선택하세요.</p>
			</header>

			<section class="teacher-grid-section">
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
		{/if}

		{#if selectedTeacher}
			<div class="calendar-view-container">
				<div class="calendar-header-box slim">
					<div class="teacher-info-row">
						<h3 class="teacher-title-text">{selectedTeacher} 선생님 참관 현황</h3>
						<span class="count-badge">총 {applications.length}건</span>
						{#if teacherRestrictions.includes(selectedTeacher)}
							<span class="global-restricted-tag">
								<Lock size={12} /> 차단됨
							</span>
						{/if}
					</div>
					<div class="header-actions">
						<button 
							class="btn-action btn-auto-approve {autoApprove ? 'on' : 'off'}" 
							onclick={toggleAutoApprove}
							title={autoApprove ? '자동 승인 끄기' : '자동 승인 켜기'}
						>
							<UserCheck size={16} />
							자동 승인 {autoApprove ? 'ON' : 'OFF'}
						</button>
						{#if $isAdmin}
							<button class="btn-action back slim" onclick={() => selectedTeacher = ''}>
								목록으로
							</button>
						{/if}
					</div>
				</div>

				{#if loading}
					<div class="loading-state">
						<Loader2 class="spin" size={32} />
						<p>데이터를 불러오는 중...</p>
					</div>
				{:else}
					<div class="week-selector">
						<button 
							class="week-nav-btn" 
							disabled={currentWeekIndex === 0}
							onclick={() => currentWeekIndex--}
						>
							<ChevronLeft size={20} />
						</button>
						<div class="week-info">
							<span class="week-label">{currentWeekIndex + 1}주차</span>
							<span class="week-dates">({weekDates[0].split('-').slice(1).join('/')} ~ {weekDates[4].split('-').slice(1).join('/')})</span>
						</div>
						<button 
							class="week-nav-btn" 
							disabled={currentWeekIndex === 2}
							onclick={() => currentWeekIndex++}
						>
							<ChevronRight size={20} />
						</button>
					</div>

					<div class="timetable-wrapper">
						<table class="timetable weekly">
							<thead>
								<tr>
									<th class="sticky-col period-header corner-tl">교시</th>
									{#each weekDates as date, i}
										<th class={i === 4 ? 'corner-tr' : ''}>
											{weekDays[i]} ({date.split('-').slice(1).join('/')})
										</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each periods as period}
									<tr>
										<td class="sticky-col {period === '7' ? 'last' : ''}">
											<div class="period-cell">{period}</div>
										</td>
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
														class="slot-content card {isManuallyRestricted
															? 'manually-restricted'
															: ''}"
														style="background-color: {getSubjectColor(
															slot.subject
														)}{isManuallyRestricted
															? '22'
															: '66'}; border: 1.5px solid {getSubjectColor(slot.subject)};"
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
																<div class="applicant-count">
																	<Users size={12} />
																	{apps.length}/{maxApplicants}
																</div>
															</div>
															<button
																class="btn-toggle-restriction {isManuallyRestricted
																	? 'restricted'
																	: ''}"
																onclick={() => toggleRestriction(d, period, slot.classId)}
																title={isManuallyRestricted
																	? '참관 가능으로 변경'
																	: '참관 불가로 설정'}
															>
																{#if isManuallyRestricted}
																	<Lock size={12} /> 불가
																{:else}
																	<UserCheck size={12} /> 가능
																{/if}
															</button>
														</div>

														{#if !isManuallyRestricted && apps.length > 0}
															<div class="applicant-list">
																{#each apps.filter((a) => a.status === 'APPROVED') as app}
																	<span class="applicant-tag approved"
																		>{app.applicantSubject
																			? `[${app.applicantSubject}] `
																			: ''}{app.applicantName}</span
																	>
																{/each}
																{#each apps.filter((a) => a.status === 'PENDING' || !a.status)}
																	<div class="action-buttons">
																		<button
																			class="applicant-tag pending-btn"
																			onclick={(e) => approveApplication(e, app.id)}
																			disabled={approvingId === app.id}
																		>
																			{app.applicantSubject
																				? `[${app.applicantSubject}] `
																				: ''}{app.applicantName}
																			{#if approvingId === app.id}
																				<Loader2 class="spin" size={12} />
																			{:else}
																				<span class="approve-label">승인</span>
																			{/if}
																		</button>
																		<button
																			class="applicant-tag decline-btn"
																			onclick={(e) => declineApplication(e, app.id)}
																			disabled={approvingId === app.id}
																			title="거부"
																		>
																			거부
																		</button>
																	</div>
																{/each}
																{#each apps.filter((a) => a.status === 'DECLINED') as app}
																	<span class="applicant-tag declined">
																		{app.applicantSubject ? `[${app.applicantSubject}] ` : ''}{app.applicantName} (거부됨)
																	</span>
																{/each}
															</div>
														{:else if isManuallyRestricted}
															<div class="restriction-notice">참관 차단됨</div>
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
		{/if}
	{/if}
</div>

<style>
	.full-width {
		max-width: 1400px !important;
		margin: 0 auto;
		padding: 0 2rem 2rem 2rem;
	}

	.page-header {
		margin-bottom: 1.5rem;
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
		font-size: 1.8rem;
		font-weight: 900;
	}

	.teacher-grid-section {
		margin-bottom: 2rem;
	}

	.teacher-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		gap: 0.3rem;
	}

	.teacher-card {
		padding: 0.4rem 0.6rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
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
	}

	.teacher-name {
		font-weight: 800;
		color: #2d3748;
		font-size: 0.95rem;
	}

	.calendar-view-container {
		background: white;
		border-radius: 16px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		margin-top: 0.5rem;
	}

	.calendar-header-box {
		padding: 1rem 1.5rem;
		background: #f8fafc;
		border-bottom: 1px solid #e2e8f0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.teacher-info-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.teacher-title-text {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 900;
		color: var(--header-bg);
	}

	.count-badge {
		background: var(--header-bg);
		color: white;
		padding: 0.2rem 0.7rem;
		border-radius: 20px;
		font-size: 0.8rem;
		font-weight: 700;
	}

	.global-restricted-tag {
		background: #fee2e2;
		color: #ef4444;
		padding: 0.2rem 0.7rem;
		border-radius: 20px;
		font-size: 0.8rem;
		font-weight: 800;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		border: 1px solid #fecaca;
	}

	.header-actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn-action {
		padding: 0.4rem 0.8rem;
		border-radius: 6px;
		font-weight: 800;
		cursor: pointer;
		transition: all 0.2s;
		border: 1px solid #e2e8f0;
		font-size: 0.85rem;
	}

	.calendar-header-box.slim {
		padding: 0.6rem 1.2rem;
	}

	.btn-action.back.slim {
		padding: 0.25rem 0.6rem;
		font-size: 0.8rem;
	}

	.btn-action:hover {
		filter: brightness(0.95);
	}

	.btn-auto-approve {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.8rem;
		font-size: 0.8rem;
	}

	.btn-auto-approve.on {
		background: #f0fdf4;
		color: #16a34a;
		border-color: #bbf7d0;
	}

	.btn-auto-approve.off {
		background: #f8fafc;
		color: #94a3b8;
	}

	.btn-auto-approve:hover {
		background: #f1f5f9;
	}

	.btn-auto-approve.on:hover {
		background: #dcfce7;
	}

	.week-selector {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.5rem;
		padding: 0.6rem;
		background: #f8fafc;
		border-bottom: 1px solid #e2e8f0;
	}

	.week-info {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.week-label {
		font-weight: 900;
		font-size: 1rem;
		color: var(--header-bg);
	}

	.week-dates {
		font-size: 0.85rem;
		color: #64748b;
		font-weight: 700;
	}

	.week-nav-btn {
		background: white;
		border: 1px solid #e2e8f0;
		color: #64748b;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.week-nav-btn:hover:not(:disabled) {
		background: var(--header-bg);
		color: white;
	}

	.week-nav-btn:disabled {
		opacity: 0.3;
	}

	.timetable-wrapper {
		overflow: auto;
		flex: 1;
		padding: 0.8rem;
	}

	.timetable {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		table-layout: fixed;
		min-width: 1000px;
	}

	.timetable th {
		background: #283151 !important;
		padding: 0.6rem;
		font-weight: 900;
		color: #ffffff;
		border-bottom: 2px solid #0f172a;
		border-right: 1px solid rgba(255, 255, 255, 0.1);
		font-size: 0.85rem;
		text-align: center;
	}

	.timetable th:first-child { border-top-left-radius: 12px; }
	.timetable th:last-child { border-top-right-radius: 12px; border-right: none; }

	.period-header {
		width: 40px !important;
		min-width: 40px !important;
		max-width: 40px !important;
	}

	.timetable td {
		border-right: 1px solid #cbd5e1;
		border-bottom: 1px solid #cbd5e1;
		padding: 0.3rem;
		vertical-align: top;
	}

	.sticky-col {
		position: sticky;
		left: 0;
		background: #283151 !important;
		z-index: 10;
		border-right: 2px solid #0f172a !important;
		padding: 0 !important;
		vertical-align: middle !important;
		width: 40px !important;
		min-width: 40px !important;
		max-width: 40px !important;
	}

	.period-cell {
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 900;
		color: #ffffff;
		font-size: 1.1rem;
		min-height: 60px;
		height: 100%;
		width: 100%;
		background: #283151;
	}

	.slot-content {
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.3rem !important;
	}

	.slot-info {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
	}

	.info-left {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.btn-toggle-restriction {
		background: #f1f5f9;
		color: #64748b;
		border: 1px solid #e2e8f0;
		padding: 0.1rem 0.3rem;
		border-radius: 4px;
		font-size: 0.6rem;
		font-weight: 800;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}

	.btn-toggle-restriction.restricted {
		background: #fee2e2;
		color: #ef4444;
	}

	.subject {
		font-weight: 800;
		font-size: 0.75rem;
		padding: 0.1rem 0.3rem;
		border-radius: 4px;
		white-space: nowrap;
	}

	.class-label { font-size: 0.7rem; color: #64748b; font-weight: 700; }
	.applicant-count { font-size: 0.65rem; color: #94a3b8; font-weight: 700; display: flex; align-items: center; gap: 0.1rem; }

	.applicant-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.15rem;
		margin-top: 0.2rem;
		padding-top: 0.2rem;
		border-top: 1px dashed #f1f5f9;
	}

	.applicant-tag {
		background: #f1f5f9;
		color: #475569;
		font-size: 0.65rem;
		font-weight: 700;
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
		white-space: nowrap;
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
	}

	.applicant-tag.approved { background-color: #f0fdf4; color: #166534; border-color: #bbf7d0; }
	.applicant-tag.declined { background-color: #fef2f2; color: #991b1b; border-color: #fecaca; }
	.pending-btn { background-color: #fffbeb; color: #92400e; border-color: #fde68a; cursor: pointer; }
	.decline-btn { background-color: #fef2f2; color: #ef4444; border-color: #fecaca; cursor: pointer; margin-left: 0.2rem; }
	.decline-btn:hover { background-color: #fee2e2; }
	.approve-label { background: #f59e0b; color: white; font-size: 0.55rem; padding: 0.05rem 0.2rem; border-radius: 2px; font-weight: 900; }

	.action-buttons {
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}

	.no-class { height: 100%; display: flex; align-items: center; justify-content: center; color: #f1f5f9; font-weight: 800; font-size: 0.75rem; }
	.loading-state { text-align: center; padding: 3rem 0; color: #666; }
	.spin { animation: spin 1s linear infinite; color: var(--header-bg); }
	@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

	.error-state {
		text-align: center;
		padding: 5rem 2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	@media (max-width: 600px) {
		.teacher-grid { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); }
	}
</style>
