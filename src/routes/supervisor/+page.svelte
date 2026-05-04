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
		deleteDoc,
		getDoc
	} from 'firebase/firestore';
	import { timetableData, scheduleOverrides } from '$lib/timetableData';
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
	import { onMount } from 'svelte';
	import { teacherWebhooks } from '$lib/teacherWebhooks';
	import { autoApproveExpiredApplications } from '$lib/autoApproveExpired';
	import { teacherMetadata } from '$lib/teacherData';
	import { getSupervisedStudents } from '$lib/supervisionMapping';
	import { supervisorResetSignal } from '$lib/supervisorNav';
	import { swipe } from '$lib/swipe';

	// 메시지 입력 모달 상태
	let showDefaultNoteModal = $state(false);
	let showLessonNoteModal = $state(false);
	let noteInput = $state('');
	let editingNoteContext = $state<{ date: string; period: string; classId: string } | null>(null);

	let selectedTeacher = $state('');
	let autoApprove = $state(false);
	let defaultNote = $state('');
	let allApplications = $state<any[]>([]);
	const applications = $derived(allApplications.filter((app) => app.teacher === selectedTeacher));
	let restrictions = $state<string[]>([]);
	let teacherRestrictions = $state<string[]>([]);
	let loading = $state(true);
	let approvingId = $state<string | null>(null);
	let currentWeekIndex = $state(0); // 0, 1, 2, 3 for 4 weeks

	const supervisedStudents = $derived(selectedTeacher ? getSupervisedStudents(selectedTeacher) : []);

	function appendStudentSentence(studentName: string) {
		const newSentence = `${studentName} 선생님이 수업합니다.`;

		// 이미 담당 실습생 문장이 포함되어 있으면 이름만 치환
		for (const s of supervisedStudents) {
			const existing = `${s} 선생님이 수업합니다.`;
			if (noteInput.includes(existing)) {
				noteInput = noteInput.replace(existing, newSentence);
				return;
			}
		}

		// 없으면 기존 텍스트 뒤에 추가
		noteInput = noteInput.trim() ? `${noteInput.trim()} ${newSentence}` : newSentence;
	}

	// '지도교사' 버튼 재클릭 시 목록으로 복귀 (Admin만)
	let lastResetSignal = 0;
	$effect(() => {
		const current = $supervisorResetSignal;
		if (current !== lastResetSignal) {
			lastResetSignal = current;
			if (current > 0 && $isAdmin) {
				selectedTeacher = '';
			}
		}
	});

	const maxApplicants = 5;
	const periods = ['1', '2', '3', '4', '5', '6', '7'];
	const weekDays = ['월', '화', '수', '목', '금'];

	const allWeekDates = [
		'2026-04-20', '2026-04-21', '2026-04-22', '2026-04-23', '2026-04-24',
		'2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30', '2026-05-01',
		'2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08',
		'2026-05-11', '2026-05-12', '2026-05-13', '2026-05-14', '2026-05-15',
		'2026-05-18', '2026-05-19', '2026-05-20', '2026-05-21', '2026-05-22',
		'2026-05-25', '2026-05-26', '2026-05-27', '2026-05-28', '2026-05-29'
	];

	const restrictedDates = ['2026-05-04', '2026-05-05', '2026-05-22', '2026-05-25', '2026-05-29'];
	const forcedApprovalDates = ['2026-05-06', '2026-05-07', '2026-05-08'];

	function getWeekLabel(index: number) {
		if (index === 0) return '-2주차 (테스트)';
		if (index === 1) return '-1주차 (테스트)';
		return `${index - 1}주차`;
	}

	// Subject Color Mapping
	const subjectColors: Record<string, string> = {
		국어: '#fecaca', 한문: '#fecaca', 수학: '#bbf7d0', 도덕: '#e9d5ff',
		사회: '#e9d5ff', 역사: '#e9d5ff', 과학: '#fef08a', 물리: '#fef08a',
		화학: '#fef08a', 생명: '#fef08a', 지구: '#fef08a', 영어: '#bfdbfe',
		가정: '#e2e8f0', 기술: '#e2e8f0', 기가: '#e2e8f0', 체육: '#fed7aa',
		음악: '#deb887', 미술: '#fbcfe8', 진로: '#f3e8ff', 정보: '#a7f3d0',
		스포츠: '#cffafe'
	};

	function getSubjectColor(subject: string) {
		if (!subject) return '#f3f4f6';
		const base = subject.substring(0, 2);
		return subjectColors[base] || '#f3f4f6';
	}

	const teacherToSubject = (() => {
		const mapping: Record<string, string> = {};
		Object.values(teacherMetadata).forEach(meta => { if (meta.name && meta.subject) mapping[meta.name] = meta.subject; });
		const subjectsList: Record<string, Set<string>> = {};
		Object.values(timetableData).forEach((classData: any) => {
			Object.values(classData).forEach((dayData: any) => {
				Object.values(dayData).forEach((slot: any) => {
					if (slot.teacher && !mapping[slot.teacher]) {
						if (!subjectsList[slot.teacher]) subjectsList[slot.teacher] = new Set();
						subjectsList[slot.teacher].add(slot.subject.replace(/[A-Z0-9]/g, ''));
					}
				});
			});
		});
		for (const [teacher, subjects] of Object.entries(subjectsList)) {
			const arr = Array.from(subjects);
			mapping[teacher] = arr.length > 0 ? arr[0] : '미지정';
		}
		return mapping;
	})();

	const subjectOrder = ['국어', '한문', '수학', '도덕', '사회', '역사', '물리', '화학', '생명', '지구', '과학', '영어', '기가', '기술', '가정', '체육', '음악', '미술', '진로', '정보', '스포츠', '주제', '동아리'];
	
	function getSubjectIndex(subject: string) {
		if (!subject) return 999;
		const base = subject.substring(0, 2);
		const idx = subjectOrder.findIndex(s => s === base);
		return idx === -1 ? 998 : idx;
	}

	const teachers = $derived(Object.keys(teacherToSubject)
		.filter((teacher) => {
			if ($isAdmin) return true;
			if ($user?.email) {
				const tMeta = teacherMetadata[$user.email];
				if (tMeta && tMeta.name === teacher) return true;
			}
			const nameOnly = ($user?.displayName || '').split(' (')[0].trim();
			return teacher === nameOnly;
		})
		.sort((a, b) => {
			const idxA = getSubjectIndex(teacherToSubject[a]);
			const idxB = getSubjectIndex(teacherToSubject[b]);
			return idxA !== idxB ? idxA - idxB : a.localeCompare(b);
		}));

	$effect(() => {
		const qApps = query(collection(db, 'observation_applications'), 
			where('date', '>=', allWeekDates[0]), where('date', '<=', allWeekDates[29]));
		return onSnapshot(qApps, (snapshot) => {
			allApplications = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
			loading = false;
			autoApproveExpiredApplications(allApplications);
		});
	});

	let lessonNotes = $state<Record<string, string>>({});

	$effect(() => {
		if (!selectedTeacher) { restrictions = []; autoApprove = false; defaultNote = ''; lessonNotes = {}; return; }
		const teacherKey = selectedTeacher.trim();
		const unsubRestricted = onSnapshot(query(collection(db, 'restricted_lessons'), where('teacher', '==', teacherKey)), (snapshot) => {
			restrictions = snapshot.docs.map((doc) => doc.id);
		});
		const unsubSettings = onSnapshot(doc(db, 'teacher_settings', teacherKey), (docSnap) => {
			autoApprove = docSnap.exists() ? docSnap.data().autoApprove || false : false;
			defaultNote = docSnap.exists() ? docSnap.data().defaultNote || '' : '';
		});
		const unsubNotes = onSnapshot(query(collection(db, 'lesson_notes'), where('teacher', '==', teacherKey)), (snapshot) => {
			const notes: Record<string, string> = {};
			snapshot.docs.forEach(d => { notes[d.id] = d.data().message; });
			lessonNotes = notes;
		});
		return () => { unsubRestricted(); unsubSettings(); unsubNotes(); };
	});

	function openDefaultNoteModal() {
		if (!selectedTeacher) return;
		noteInput = defaultNote || '';
		showDefaultNoteModal = true;
	}

	async function saveDefaultNote() {
		if (!selectedTeacher) return;
		const teacherKey = selectedTeacher.trim();
		try {
			await setDoc(doc(db, 'teacher_settings', teacherKey), { defaultNote: noteInput.trim() }, { merge: true });
			showDefaultNoteModal = false;
		} catch (e) {
			console.error(e);
			alert('저장에 실패했습니다.');
		}
	}

	function openLessonNoteModal(date: string, period: string, classId: string, currentNote: string) {
		editingNoteContext = { date, period, classId };
		noteInput = currentNote || '';
		showLessonNoteModal = true;
	}

	async function saveLessonNote() {
		if (!editingNoteContext) return;
		const { date, period, classId } = editingNoteContext;
		const teacherKey = selectedTeacher.trim();
		const noteId = `${teacherKey}_${date}_${period}_${classId}`;

		try {
			if (noteInput.trim() === '') {
				await deleteDoc(doc(db, 'lesson_notes', noteId));
			} else {
				await setDoc(doc(db, 'lesson_notes', noteId), {
					teacher: teacherKey,
					date,
					period,
					classId,
					message: noteInput.trim(),
					updatedAt: new Date()
				});
			}
			showLessonNoteModal = false;
			editingNoteContext = null;
		} catch (e) {
			console.error(e);
			alert('저장에 실패했습니다.');
		}
	}

	$effect(() => {
		if ($user?.email && $isSupervisor && !$isAdmin && !selectedTeacher) {
			const tMeta = teacherMetadata[$user.email];
			if (tMeta) {
				selectedTeacher = tMeta.name.trim();
			} else {
				selectedTeacher = ($user?.displayName || '').split(' (')[0].trim();
			}
		}
	});

	onMount(() => { return onSnapshot(collection(db, 'teacher_restrictions'), (snapshot) => { teacherRestrictions = snapshot.docs.map((doc) => doc.id); }); });

	async function toggleAutoApprove() {
		if (!selectedTeacher) return;
		const teacherKey = selectedTeacher.trim();
		const newValue = !autoApprove;
		try {
			await setDoc(doc(db, 'teacher_settings', teacherKey), { autoApprove: newValue }, { merge: true });
			alert(`자동 승인 설정이 ${newValue ? 'ON' : 'OFF'}으로 변경되었습니다.`);
		} catch (e) {
			console.error(e);
			alert('설정 변경에 실패했습니다.');
		}
	}

	async function toggleRestriction(date: string, period: string, classId: string) {
		if (forcedApprovalDates.includes(date)) {
			alert('5월 6, 7, 8일은 강제 자동 승인 기간이라 참관 거부로 변경할 수 없습니다.');
			return;
		}
		const teacherKey = selectedTeacher.trim();
		const resId = `${teacherKey}_${date}_${period}_${classId}`;
		if (restrictions.includes(resId)) await deleteDoc(doc(db, 'restricted_lessons', resId));
		else await setDoc(doc(db, 'restricted_lessons', resId), { teacher: teacherKey, date, period, classId, updatedAt: new Date() });
	}

	async function approveApplication(e: Event, appId: string) {
		e.stopPropagation(); if (approvingId) return;
		approvingId = appId;
		
		const appRef = doc(db, 'observation_applications', appId);
		const appSnap = await getDoc(appRef);
		
		await updateDoc(appRef, { status: 'APPROVED' });
		
		if (appSnap.exists()) {
			const data = appSnap.data();
			
			// 선생님 구글챗 알림
			const url = teacherWebhooks[selectedTeacher];
			if (url) {
				const message = [
					`📢 *참관 신청 처리 결과*`,
					'',
					`• *신청자*: ${data.applicantName}`,
					`• *일시*: ${data.date} ${data.period}교시`,
					`• *결과*: ✅ *승인 처리됨*`
				].join('\n');
				fetch(url, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ text: message }) });
			}

			// 실습생 이메일 알림 (GAS)
			const gasUrl = 'https://script.google.com/macros/s/AKfycby2kNaGAvgtD36spyTvTlsxwWpFKow5QjiPrIuhJJDUZuLaBxr8iagIzTYhhCnUHORg/exec';
			fetch(gasUrl, {
				method: 'POST',
				mode: 'no-cors',
				body: JSON.stringify({
					email: data.applicantEmail,
					name: data.applicantName,
					date: data.date,
					period: data.period,
					subject: data.subject,
					teacher: data.teacher,
					status: 'APPROVED'
				})
			});
		}
		
		approvingId = null;
	}

	async function declineApplication(e: Event, appId: string) {
		e.stopPropagation(); if (approvingId || !confirm('거부하시겠습니까?')) return;
		approvingId = appId;
		
		const appRef = doc(db, 'observation_applications', appId);
		const appSnap = await getDoc(appRef);
		
		await updateDoc(appRef, { status: 'DECLINED' });
		
		if (appSnap.exists()) {
			const data = appSnap.data();
			
			// 선생님 구글챗 알림
			const url = teacherWebhooks[selectedTeacher];
			if (url) {
				const message = [
					`📢 *참관 신청 처리 결과*`,
					'',
					`• *신청자*: ${data.applicantName}`,
					`• *일시*: ${data.date} ${data.period}교시`,
					`• *결과*: ❌ *거부 처리됨*`
				].join('\n');
				fetch(url, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ text: message }) });
			}

			// 실습생 이메일 알림 (GAS)
			const gasUrl = 'https://script.google.com/macros/s/AKfycby2kNaGAvgtD36spyTvTlsxwWpFKow5QjiPrIuhJJDUZuLaBxr8iagIzTYhhCnUHORg/exec';
			fetch(gasUrl, {
				method: 'POST',
				mode: 'no-cors',
				body: JSON.stringify({
					email: data.applicantEmail,
					name: data.applicantName,
					date: data.date,
					period: data.period,
					subject: data.subject,
					teacher: data.teacher,
					status: 'DECLINED'
				})
			});
		}
		
		approvingId = null;
	}

	function getTeacherSlot(teacher: string, targetDate: string, period: string) {
		const day = new Date(targetDate).getDay();
		const refDate = `2026-05-${10 + day}`;
		for (const [classId, dates] of Object.entries(timetableData)) {
			const override = scheduleOverrides[classId]?.[targetDate]?.[period];
			const slot = override ?? (dates as any)[refDate]?.[period];
			if (slot && slot.teacher === teacher) return { classId, ...slot };
		}
		return null;
	}

	function is7thPeriodRestricted(targetDate: string, period: string) {
		const day = new Date(targetDate).getDay();
		return (day === 1 || day === 3 || day === 5) && period === '7';
	}
</script>

<div class="full-width container">
	{#if !$isSupervisor && !$isAdmin}
		<div class="error-state card"><AlertCircle size={48} color="#e63946" /><h2>접근 권한이 없습니다</h2><a href="/" class="btn btn-primary">홈으로 돌아가기</a></div>
	{:else}
		{#if $isAdmin && !selectedTeacher}
			<header class="page-header"><div class="title-group"><Users size={32} /> <h1>지도 교사 전용 페이지</h1></div><p>선생님을 선택하세요.</p></header>
			<section class="teacher-grid">
				{#each teachers as teacher}
					<button class="teacher-card card" onclick={() => { selectedTeacher = teacher; currentWeekIndex = 0; }}>
						<span class="teacher-subject-badge" style="background-color: {getSubjectColor(teacherToSubject[teacher])}">{teacherToSubject[teacher]}</span>
						<span class="teacher-name">{teacher}</span>
					</button>
				{/each}
			</section>
		{/if}

		{#if selectedTeacher}
			<div class="calendar-view-container">
				<div class="calendar-header-box slim">
					<div class="teacher-info-row">
						<h3 class="teacher-title-text">{selectedTeacher} 선생님 참관 현황</h3>
						{#if teacherRestrictions.includes(selectedTeacher)}<span class="global-restricted-tag"><Lock size={12} /> 차단됨</span>{/if}
					</div>
					<div class="header-actions">
						<button class="btn-action" class:on={!!defaultNote} onclick={openDefaultNoteModal}><AlertCircle size={16} /> 기본 안내 {defaultNote ? 'ON' : 'OFF'}</button>
						<button class="btn-action" class:on={autoApprove === true} onclick={toggleAutoApprove}><UserCheck size={16} /> 자동 승인 {autoApprove ? 'ON' : 'OFF'}</button>
						{#if $isAdmin}<button class="btn-action" onclick={() => selectedTeacher = ''}><Users size={16} /> 목록으로</button>{/if}
					</div>
				</div>

				{#if loading}
					<div class="loading-state"><Loader2 class="spin" size={32} /><p>데이터 로딩 중...</p></div>
				{:else}
					<div class="week-selector">
						<button class="week-nav-btn" disabled={currentWeekIndex === 0} onclick={() => currentWeekIndex--}><ChevronLeft size={20} /></button>
						<div class="week-info"><span class="week-label">{getWeekLabel(currentWeekIndex)}</span></div>
						<button class="week-nav-btn" disabled={currentWeekIndex === 5} onclick={() => currentWeekIndex++}><ChevronRight size={20} /></button>
					</div>

					<div class="timetable-wrapper" use:swipe={{ onLeft: () => { if (currentWeekIndex < 5) currentWeekIndex++; }, onRight: () => { if (currentWeekIndex > 0) currentWeekIndex--; } }}>
						<table class="timetable weekly">
							<thead>
								<tr>
									<th class="sticky-col period-header">교시</th>
									{#each allWeekDates.slice(currentWeekIndex * 5, (currentWeekIndex + 1) * 5) as d, i}<th>{weekDays[i]} ({d.split('-').slice(1).join('/')})</th>{/each}
								</tr>
							</thead>
							<tbody>
								{#each periods as period}
									<tr>
										<td class="sticky-col"><div class="period-cell">{period}</div></td>
										{#each allWeekDates.slice(currentWeekIndex * 5, (currentWeekIndex + 1) * 5) as d}
											{@const slot = getTeacherSlot(selectedTeacher, d, period)}
											{@const apps = applications.filter(a => a.date === d && a.period === period && (slot ? a.classId === slot.classId : true))}
											{@const isRestricted = is7thPeriodRestricted(d, period)}
											{@const isDisabledDate = restrictedDates.includes(d)}
											<td class="slot-cell {(isRestricted || isDisabledDate) ? 'restricted' : slot ? 'active' : 'empty'}">
												{#if isDisabledDate}
													<div class="no-class-text">신청 불가</div>
												{:else if isRestricted}
													<div class="no-class-text">수업 없음</div>
												{/if}

												{#if !isDisabledDate && slot}
													{@const resId = `${selectedTeacher}_${d}_${period}_${slot.classId}`}
													{@const isBlocked = restrictions.includes(resId)}
													{@const isForcedApproval = forcedApprovalDates.includes(d)}
													{@const hasNote = lessonNotes[resId]}
													<div class="slot-content card {isBlocked ? 'manually-restricted' : ''}"
														style="background-color: {isBlocked ? '#fff5f5' : getSubjectColor(slot.subject) + '66'}; border: 1.5px solid {isBlocked ? '#fecaca' : getSubjectColor(slot.subject)};"
													>
														<div class="slot-info">
															<span 
																class="subject clickable" 
																style="background-color: {getSubjectColor(slot.subject)}"
																onclick={() => openLessonNoteModal(d, period, slot.classId, hasNote)}
																role="button"
																tabindex="0"
																title="메시지 입력/수정"
															>
																{slot.subject}
																{#if hasNote}
																	<span class="note-indicator">💬</span>
																{/if}
															</span>
															<span class="class-label">{slot.classId.substring(0, 1)}-{parseInt(slot.classId.substring(2))}</span>
															<button class="btn-toggle-restriction {isForcedApproval ? 'is-forced' : isBlocked ? 'is-restricted' : 'is-available'}" onclick={() => toggleRestriction(d, period, slot.classId)} disabled={isForcedApproval} title={isForcedApproval ? '5월 6, 7, 8일은 강제 자동 승인 기간입니다.' : ''}>
																{isForcedApproval ? '필수' : isBlocked ? '불가' : '가능'}
															</button>
														</div>
														{#if hasNote}
															<div class="lesson-note-preview">{hasNote}</div>
														{/if}
														<div class="applicant-list">
															{#each apps as app}
																<div class="app-item {app.status || 'PENDING'}">
																	<span class="app-name">[{app.applicantSubject || '미정'}] {app.applicantName}</span>
																	{#if app.status === 'PENDING' || !app.status}
																		<div class="app-btns">
																			<button class="btn-v" onclick={(e) => approveApplication(e, app.id)}>승인</button>
																			<button class="btn-x" onclick={(e) => declineApplication(e, app.id)}>거부</button>
																		</div>
																	{/if}
																</div>
															{/each}
														</div>
													</div>
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

{#if showDefaultNoteModal}
	<div class="msg-modal-overlay" onclick={() => showDefaultNoteModal = false} role="presentation">
		<div class="msg-modal-card" onclick={(e) => e.stopPropagation()} role="presentation">
			<div class="msg-modal-header">
				<AlertCircle size={20} />
				<h3>기본 안내 메시지</h3>
			</div>
			<div class="msg-modal-body">
				<p class="msg-help">모든 수업에 공통으로 적용됩니다. 개별 수업 메시지가 있으면 해당 수업에는 개별 메시지가 우선 표시됩니다.</p>
				<textarea
					bind:value={noteInput}
					placeholder="예) 수업 시작 5분 전까지 교실 뒤쪽에 조용히 입실해주세요."
					rows="4"
				></textarea>
			</div>
			<div class="msg-modal-footer">
				<button class="msg-btn-cancel" onclick={() => showDefaultNoteModal = false}>취소</button>
				<button class="msg-btn-save" onclick={saveDefaultNote}>저장</button>
			</div>
		</div>
	</div>
{/if}

{#if showLessonNoteModal && editingNoteContext}
	<div class="msg-modal-overlay" onclick={() => showLessonNoteModal = false} role="presentation">
		<div class="msg-modal-card" onclick={(e) => e.stopPropagation()} role="presentation">
			<div class="msg-modal-header">
				<AlertCircle size={20} />
				<h3>개별 수업 메시지</h3>
			</div>
			<div class="msg-modal-body">
				<p class="msg-context">{editingNoteContext.date} · {editingNoteContext.period}교시 · {editingNoteContext.classId.substring(0, 1)}-{parseInt(editingNoteContext.classId.substring(2))}반</p>
				<textarea
					bind:value={noteInput}
					placeholder="실습생에게 전달할 안내 메시지를 입력하세요. 비우고 저장하면 삭제됩니다."
					rows="4"
				></textarea>
				{#if supervisedStudents.length > 0}
					<div class="student-quick-insert">
						<span class="quick-label">빠른 입력:</span>
						<div class="student-btn-group">
							{#each supervisedStudents as student}
								<button class="student-btn" type="button" onclick={() => appendStudentSentence(student)}>
									{student}
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
			<div class="msg-modal-footer">
				<button class="msg-btn-cancel" onclick={() => showLessonNoteModal = false}>취소</button>
				<button class="msg-btn-save" onclick={saveLessonNote}>저장</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.full-width { max-width: 1400px !important; margin: 0 auto; padding: 0 2rem 2rem 2rem; }
	.page-header { margin-bottom: 1.5rem; }
	.title-group { display: flex; align-items: center; gap: 0.8rem; color: var(--header-bg); }
	.teacher-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.5rem; }
	.teacher-card { padding: 0.8rem; display: flex; flex-direction: column; align-items: center; gap: 0.4rem; cursor: pointer; border: 1px solid #eee; background: white; border-radius: 8px; }
	.teacher-subject-badge { padding: 0.2rem 0.5rem; border-radius: 20px; font-size: 0.75rem; font-weight: 800; }
	.teacher-name { font-weight: 800; font-size: 1rem; }
	.calendar-view-container { background: white; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); overflow: hidden; margin-top: 1rem; }
	.calendar-header-box { padding: 0.3rem 1rem; background: #f8fafc; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
	.teacher-info-row { display: flex; align-items: center; gap: 1rem; }
	.global-restricted-tag { color: #ff7b89; font-weight: 800; font-size: 0.8rem; background: #fee2e2; padding: 0.2rem 0.5rem; border-radius: 4px; }
	.header-actions { display: flex; gap: 0.4rem; }
	.btn-action { display: flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.7rem; border-radius: 6px; cursor: pointer; font-weight: 800; border: 1.5px solid #cbd5e1; background: white; font-size: 0.85rem; color: #1e293b; transition: all 0.2s; line-height: 1; }
	.btn-action:hover { background: #f1f5f9; border-color: #94a3b8; }
	.btn-action.on { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
	.week-selector { display: flex; align-items: center; justify-content: center; gap: 0.8rem; padding: 0.6rem; border-bottom: 1px solid #eee; }
	.week-nav-btn { width: 30px; height: 30px; border-radius: 50%; cursor: pointer; border: 1px solid #cbd5e1; background: white; display: flex; align-items: center; justify-content: center; padding: 0; flex-shrink: 0; color: #1e293b; transition: all 0.2s; }
	.week-nav-btn:hover:not(:disabled) { background: #1e293b; color: white; border-color: #1e293b; }
	.week-nav-btn:disabled { opacity: 0.25; cursor: not-allowed; }
	.week-label { font-weight: 900; color: var(--header-bg); width: 160px; text-align: center; display: inline-block; flex-shrink: 0; }
	.timetable-wrapper { overflow-x: auto; padding: 1.5rem; }
	.timetable { border-collapse: separate; border-spacing: 6px 0; width: auto; table-layout: fixed; margin: 0 auto; }
	.timetable th { background: #283151; color: white; padding: 0.5rem; font-size: 0.85rem; width: 210px; border-radius: 12px 12px 0 0; border: none; }
	.timetable td { border: 1px solid #cbd5e1; height: 80px; vertical-align: top; padding: 0.2rem; width: 210px; background: white; }
	.sticky-col { position: sticky; left: 0; background: #283151 !important; width: 40px !important; min-width: 40px !important; max-width: 40px !important; color: white; z-index: 10; padding: 0 !important; border: none !important; }
	th.sticky-col { border-radius: 12px 12px 0 0 !important; }
	.period-cell { display: flex; align-items: center; justify-content: center; height: 100%; width: 100%; font-weight: 900; font-size: 1.1rem; color: white; }
	.slot-content { height: 100%; padding: 0.3rem; border: 2px solid transparent; border-radius: 6px; position: relative; }
	.slot-info { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
	.subject { font-size: 0.85rem; font-weight: 900; padding: 0.2rem 0.4rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 2px; white-space: nowrap; }
	.subject.clickable { cursor: pointer; transition: transform 0.1s; }
	.subject.clickable:hover { transform: scale(1.05); }
	.note-indicator { font-size: 0.7rem; }
	.lesson-note-preview { font-size: 0.7rem; color: #475569; background: rgba(255,255,255,0.5); padding: 0.2rem 0.4rem; border-radius: 4px; margin-top: 0.2rem; word-break: keep-all; overflow-wrap: break-word; line-height: 1.4; max-width: 100%; border: 1px dashed #cbd5e1; }
	.class-label { font-size: 0.95rem; color: #1e293b; font-weight: 900; white-space: nowrap; }
	.btn-toggle-restriction { font-size: 0.8rem; cursor: pointer; padding: 0.2rem 0.5rem; border: 1.5px solid #cbd5e1; border-radius: 4px; background: white; font-weight: 800; transition: all 0.2s; white-space: nowrap; flex-shrink: 0; }
	.btn-toggle-restriction.is-available { background-color: #f0fdf4; border-color: #bbf7d0; color: #16a34a; }
	.btn-toggle-restriction.is-available:hover { background-color: #dcfce7; }
	.btn-toggle-restriction.is-restricted { background-color: #fff5f5; border-color: #fecaca; color: #ff7b89; }
	.btn-toggle-restriction.is-restricted:hover { background-color: #fee2e2; }
	.btn-toggle-restriction.is-forced { background-color: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; cursor: not-allowed; opacity: 0.95; }
	.btn-toggle-restriction.is-forced:hover { background-color: #eff6ff; }
	.applicant-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.2rem 0.4rem; margin-top: 0.5rem; border-top: 1px dashed #cbd5e1; padding-top: 0.5rem; }
	.app-item { font-size: 0.85rem; font-weight: 600; color: #000; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 0.2rem; text-align: center; line-height: 1.1; }
	.app-item.DECLINED { opacity: 0.4; text-decoration: line-through; }
	.app-name { word-break: keep-all; }
	.app-btns { display: flex; gap: 2px; width: 100%; justify-content: center; }
	.btn-v, .btn-x { border: none; border-radius: 4px; padding: 2px 0 !important; font-size: 0.65rem !important; font-weight: 900 !important; cursor: pointer; color: white !important; line-height: 1.2; flex: 1; text-align: center; }
	.btn-v { background-color: #22c55e; }
	.btn-v:hover { background-color: #16a34a; }
	.btn-x { background-color: #ff7b89; }
	.btn-x:hover { background-color: #ff7b89; }
	.no-class-text { display: flex; align-items: center; justify-content: center; height: 100%; color: #ff7b89; font-size: 0.95rem; font-weight: 900; background-color: white; }
	.slot-cell.restricted { background-color: white; }
	.loading-state { text-align: center; padding: 3rem; }
	.spin { animation: spin 1s linear infinite; display: inline-block; }
	@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
	.error-state { text-align: center; padding: 5rem; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
	.btn-primary { background: var(--header-bg); color: white; padding: 0.5rem 1rem; border-radius: 6px; text-decoration: none; font-weight: 800; }

	/* 메시지 입력 모달 */
	.msg-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
	.msg-modal-card { background: white; width: 90%; max-width: 520px; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.25); animation: modalIn 0.25s ease-out; }
	.msg-modal-header { background: #283151; color: white; padding: 0.9rem 1.2rem; display: flex; align-items: center; gap: 0.6rem; }
	.msg-modal-header h3 { margin: 0; font-size: 1.05rem; font-weight: 900; }
	.msg-modal-body { padding: 1.2rem 1.4rem; display: flex; flex-direction: column; gap: 0.8rem; }
	.msg-help { margin: 0; font-size: 0.82rem; color: #64748b; line-height: 1.5; }
	.msg-context { margin: 0; font-size: 0.9rem; font-weight: 800; color: var(--header-bg); padding: 0.4rem 0.7rem; background: #f1f5f9; border-radius: 6px; display: inline-block; width: fit-content; }
	.msg-modal-body textarea { width: 100%; padding: 0.7rem; border: 1.5px solid #cbd5e1; border-radius: 8px; font-family: inherit; font-size: 0.95rem; line-height: 1.5; resize: vertical; box-sizing: border-box; }
	.msg-modal-body textarea:focus { outline: none; border-color: var(--header-bg); }
	.student-quick-insert { display: flex; flex-direction: column; gap: 0.4rem; padding-top: 0.4rem; border-top: 1px dashed #cbd5e1; }
	.quick-label { font-size: 0.8rem; font-weight: 700; color: #64748b; }
	.student-btn-group { display: flex; flex-wrap: wrap; gap: 0.35rem; }
	.student-btn { padding: 0.35rem 0.8rem; border-radius: 20px; font-size: 0.85rem; font-weight: 700; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; cursor: pointer; transition: all 0.15s; }
	.student-btn:hover { background: #1d4ed8; color: white; transform: translateY(-1px); }
	.msg-modal-footer { padding: 0.9rem 1.2rem; display: flex; justify-content: flex-end; gap: 0.6rem; border-top: 1px solid #e2e8f0; background: #f8fafc; }
	.msg-btn-cancel, .msg-btn-save { padding: 0.55rem 1.2rem; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 0.9rem; border: none; transition: all 0.15s; }
	.msg-btn-cancel { background: #e2e8f0; color: #475569; }
	.msg-btn-cancel:hover { background: #cbd5e1; }
	.msg-btn-save { background: var(--header-bg); color: white; }
	.msg-btn-save:hover { background: #1e255a; transform: translateY(-1px); }

	@keyframes modalIn { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }

	/* ════════════════════════════════════════
	   반응형 (≤1000px: 태블릿 가로, Galaxy 915px 포함)
	════════════════════════════════════════ */
	@media (max-width: 1000px) {
		/* 좌우 여백 축소 + iOS safe-area */
		.full-width {
			padding: 0 max(0.5rem, env(safe-area-inset-right)) 1rem max(0.5rem, env(safe-area-inset-left));
		}

		/* 캘린더 헤더 (선생님 이름 + 버튼 묶음) */
		.calendar-header-box { padding: 0.3rem 0.6rem; flex-wrap: wrap; gap: 0.35rem; }
		.teacher-info-row { min-width: 0; gap: 0.5rem; }
		.teacher-title-text { font-size: 0.95rem; }
		.header-actions { gap: 0.3rem; flex-wrap: wrap; }
		.btn-action { padding: 0.3rem 0.5rem; font-size: 0.72rem; gap: 0.25rem; }

		/* 주차 네비 */
		.week-selector { padding: 0.5rem; gap: 0.6rem; }
		.week-label { width: 130px; font-size: 0.88rem; }
		.week-nav-btn { width: 26px; height: 26px; }

		/* 시간표 래퍼: 좌우 패딩 축소 + 터치 스크롤 */
		.timetable-wrapper { padding: 0.75rem 0.3rem; -webkit-overflow-scrolling: touch; touch-action: pan-x pan-y; }
		.timetable { border-spacing: 4px 0; }

		/* 컬럼 120px → 요일 5칸 총 ~648px, iPhone 12 가로(828px)에서 여유 */
		.timetable th { width: 120px; padding: 0.4rem 0.2rem; font-size: 0.78rem; }
		.timetable td { width: 120px; height: 72px; padding: 0.15rem; }
		.sticky-col { width: 32px !important; min-width: 32px !important; max-width: 32px !important; }
		.period-cell { font-size: 0.9rem; }

		/* 슬롯 내용: 폰트/패딩 축소 */
		.slot-content { padding: 0.2rem; }
		.slot-info { margin-bottom: 0.2rem; gap: 0.15rem; }
		.subject { font-size: 0.62rem; padding: 0.08rem 0.22rem; gap: 1px; }
		.class-label { font-size: 0.7rem; }
		.btn-toggle-restriction { font-size: 0.6rem; padding: 0.1rem 0.3rem; }
		.lesson-note-preview { font-size: 0.58rem; padding: 0.08rem 0.2rem; margin-top: 0.1rem; }

		/* 신청자 목록 */
		.applicant-list { gap: 0.1rem 0.2rem; padding-top: 0.3rem; margin-top: 0.3rem; }
		.app-item { font-size: 0.62rem; gap: 0.1rem; }
		.btn-v, .btn-x { font-size: 0.52rem !important; padding: 1px 0 !important; }

		/* 수업 없음/신청 불가 */
		.no-class-text { font-size: 0.8rem; }

		/* 교사 그리드 (Admin 목록 화면) */
		.teacher-grid { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 0.3rem; }
		.teacher-card { padding: 0.55rem; }
		.teacher-name { font-size: 0.88rem; }
	}

	/* ≤600px: 모바일 세로 */
	@media (max-width: 600px) {
		.full-width { padding: 0 max(0.3rem, env(safe-area-inset-right)) 0.8rem max(0.3rem, env(safe-area-inset-left)); }
		.calendar-header-box { padding: 0.25rem 0.4rem; gap: 0.25rem; }
		.teacher-title-text { font-size: 0.85rem; }
		.btn-action { padding: 0.22rem 0.4rem; font-size: 0.65rem; gap: 0.2rem; }

		.week-selector { padding: 0.35rem; gap: 0.5rem; }
		.week-label { width: 110px; font-size: 0.78rem; }

		.timetable-wrapper { padding: 0.5rem 0.2rem; }
		.timetable { border-spacing: 3px 0; }
		.timetable th { width: 95px; padding: 0.3rem 0.12rem; font-size: 0.7rem; }
		.timetable td { width: 95px; height: 62px; padding: 0.1rem; }
		.sticky-col { width: 26px !important; min-width: 26px !important; max-width: 26px !important; }
		.period-cell { font-size: 0.78rem; }

		.subject { font-size: 0.55rem; padding: 0.05rem 0.18rem; }
		.class-label { font-size: 0.62rem; }
		.btn-toggle-restriction { font-size: 0.54rem; padding: 0.08rem 0.22rem; }
		.lesson-note-preview { font-size: 0.52rem; }
		.app-item { font-size: 0.55rem; }
		.no-class-text { font-size: 0.72rem; }

		/* 교사 목록: 가로 2-3열 */
		.teacher-grid { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 0.25rem; }
		.teacher-card { padding: 0.45rem 0.3rem; }
		.teacher-name { font-size: 0.8rem; }
		.teacher-subject-badge { font-size: 0.65rem; padding: 0.12rem 0.4rem; }
	}

	/* ════════════════════════════════════════
	   다크 모드
	════════════════════════════════════════ */
	@media (prefers-color-scheme: dark) {
		/* 헤더 타이틀 */
		.title-group { color: #e2e8f0; }

		/* 교사 카드 (목록 화면) */
		.teacher-card {
			background: #1a1f35;
			border-color: #2d3748;
		}
		.teacher-name { color: #e2e8f0; }

		/* 캘린더 컨테이너 */
		.calendar-view-container { background: #1a1f35; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }

		/* 캘린더 헤더 */
		.calendar-header-box { background: #111827; border-bottom-color: #2d3748; }
		.teacher-title-text,
		h3 { color: #e2e8f0; }

		/* 헤더 액션 버튼 */
		.btn-action { background: #1e2a4a; border-color: #374151; color: #e2e8f0; }
		.btn-action:hover { background: #2d3748; border-color: #4b5563; }
		.btn-action.on { background: #064e3b; color: #6ee7b7; border-color: #065f46; }

		/* 주차 선택 */
		.week-selector { border-bottom-color: #2d3748; }
		.week-nav-btn { background: #1e2a4a; border-color: #374151; color: #e2e8f0; }
		.week-nav-btn:hover:not(:disabled) { background: #e2e8f0; color: #111827; border-color: #e2e8f0; }
		.week-label { color: #e2e8f0; }

		/* 시간표 */
		.timetable td { background: #1a1f35; border-color: #2d3748; }
		.timetable tr:hover td { background: #1e2a4a; }

		/* 빈 슬롯 / 신청 불가 */
		.no-class-text { background-color: #161d30; color: #f87171; }
		.slot-cell.restricted { background-color: #161d30; }

		/* 슬롯 내 텍스트 */
		.class-label { color: #e2e8f0; }
		.lesson-note-preview { color: #94a3b8; background: rgba(0,0,0,0.3); border-color: #374151; }

		/* 차단/허용 버튼 */
		.btn-toggle-restriction { background: #1e2a4a; border-color: #374151; color: #94a3b8; }
		.btn-toggle-restriction.is-available { background: #064e3b; border-color: #065f46; color: #6ee7b7; }
		.btn-toggle-restriction.is-available:hover { background: #065f46; }
		.btn-toggle-restriction.is-restricted { background: #2d1515; border-color: #7f1d1d; color: #f87171; }
		.btn-toggle-restriction.is-restricted:hover { background: #3d1a1a; }
		.btn-toggle-restriction.is-forced { background: #1e293b; border-color: #1d4ed8; color: #93c5fd; }
		.btn-toggle-restriction.is-forced:hover { background: #1e293b; }

		/* 신청자 목록 */
		.applicant-list { border-top-color: #374151; }
		.app-item { color: #e2e8f0; }
		.app-item.DECLINED { color: #4b5563; }

		/* 메시지 입력 모달 */
		.msg-modal-card { background: #1a1f35; }
		.msg-help { color: #94a3b8; }
		.msg-context { background: #1e2a4a; color: #e2e8f0; }
		.msg-modal-body textarea { background: #111827; border-color: #374151; color: #e2e8f0; }
		.msg-modal-body textarea:focus { border-color: #3b82f6; }
		.student-quick-insert { border-top-color: #374151; }
		.quick-label { color: #94a3b8; }
		.student-btn { background: #1e2a4a; color: #93c5fd; border-color: #374151; }
		.student-btn:hover { background: #1d4ed8; color: white; border-color: #1d4ed8; }
		.msg-modal-footer { background: #111827; border-top-color: #374151; }
		.msg-btn-cancel { background: #2d3748; color: #cbd5e1; }
		.msg-btn-cancel:hover { background: #374151; }
	}
</style>
