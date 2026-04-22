<script lang="ts">
	import { user, isAdmin, isSupervisor, db, logout, userRole, isStudent } from '$lib/firebase';
	import {
		Calendar,
		Lock,
		ShieldCheck,
		AlertCircle,
		Users,
		Info,
		UserCheck,
		BookOpen,
		Loader2,
		User as UserIcon,
		ChevronLeft,
		ChevronRight,
		LogOut
	} from 'lucide-svelte';
	import { timetableData } from '$lib/timetableData';
	import { studentData } from '$lib/studentData';
	import { teacherMetadata } from '$lib/teacherData';
	import { teacherWebhooks } from '$lib/teacherWebhooks';
	import { goto } from '$app/navigation';
	import {
		collection,
		query,
		where,
		onSnapshot,
		getDoc,
		addDoc,
		deleteDoc,
		doc,
		Timestamp
	} from 'firebase/firestore';

	// 1. Date & Navigation Logic
	function getDefaultDate() {
		const today = new Date();
		const todayStr = today.toISOString().split('T')[0];
		if (todayStr < '2026-04-20') return '2026-04-20';
		if (todayStr > '2026-05-29') return '2026-05-29';
		const dayOfWeek = today.getDay();
		if (dayOfWeek === 0 || dayOfWeek === 6) {
			const nextMonday = new Date(today);
			nextMonday.setDate(today.getDate() + (dayOfWeek === 0 ? 1 : 2));
			return nextMonday.toISOString().split('T')[0];
		}
		return todayStr;
	}

	let date = $state(getDefaultDate());
	let viewMode = $state<'teacher' | 'grade' | 'my'>('teacher');
	let selectedGrade = $state(1);
	let selectedTeacher = $state<string | null>(null);
	let currentWeekIndex = $state(0);

	const allWeekDates = [
		'2026-04-20', '2026-04-21', '2026-04-22', '2026-04-23', '2026-04-24',
		'2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30', '2026-05-01',
		'2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08',
		'2026-05-11', '2026-05-12', '2026-05-13', '2026-05-14', '2026-05-15',
		'2026-05-18', '2026-05-19', '2026-05-20', '2026-05-21', '2026-05-22',
		'2026-05-25', '2026-05-26', '2026-05-27', '2026-05-28', '2026-05-29'
	];

	const restrictedDates = ['2026-05-04', '2026-05-05', '2026-05-22', '2026-05-25', '2026-05-29'];

	const weekDays = ['월', '화', '수', '목', '금'];
	const periods = ['1', '2', '3', '4', '5', '6', '7'];
	const maxApplicants = 5;

	$effect(() => {
		const idx = allWeekDates.indexOf(date);
		if (idx !== -1) currentWeekIndex = Math.floor(idx / 5);
	});

	function getWeekLabel(index: number) {
		if (index === 0) return '-2주차 (테스트)';
		if (index === 1) return '-1주차 (테스트)';
		return `${index - 1}주차`;
	}

	const weekDates = $derived(allWeekDates.slice(currentWeekIndex * 5, (currentWeekIndex + 1) * 5));

	function prevWeek() { if (currentWeekIndex > 0) { currentWeekIndex--; date = allWeekDates[currentWeekIndex * 5]; } }
	function nextWeek() { if (currentWeekIndex < 5) { currentWeekIndex++; date = allWeekDates[currentWeekIndex * 5]; } }
	function prevDate() {
		const idx = allWeekDates.indexOf(date);
		if (idx > 0) date = allWeekDates[idx - 1];
		else date = allWeekDates[allWeekDates.length - 1];
	}
	function nextDate() {
		const idx = allWeekDates.indexOf(date);
		if (idx < allWeekDates.length - 1) date = allWeekDates[idx + 1];
		else date = allWeekDates[0];
	}

	function formatDateShort(dStr: string) {
		const parts = dStr.split('-');
		const d = new Date(dStr);
		const dayName = weekDays[d.getDay() - 1] || '';
		return `${parseInt(parts[1])}.${parseInt(parts[2])}.(${dayName})`;
	}

	// 2. Data Fetching
	let applications = $state<any[]>([]);
	let restrictions = $state<string[]>([]);
	let teacherRestrictions = $state<string[]>([]);
	let loading = $state(true);
	let checking = $state(true);

	$effect(() => {
		if ($user && $isSupervisor && !$isAdmin) {
			goto('/supervisor');
		}
		checking = false;
	});

	$effect(() => {
		if (checking || !$user) return;
		const qApps = query(collection(db, 'observation_applications'), where('date', '>=', allWeekDates[0]), where('date', '<=', allWeekDates[19]));
		const unsubApps = onSnapshot(qApps, (snap) => { applications = snap.docs.map(d => ({id: d.id, ...d.data()})); loading = false; });
		const unsubRest = onSnapshot(collection(db, 'restricted_lessons'), (snap) => { restrictions = snap.docs.map(d => d.id); });
		const unsubGlobal = onSnapshot(collection(db, 'teacher_restrictions'), (snap) => { teacherRestrictions = snap.docs.map(d => d.id); });
		return () => { unsubApps(); unsubRest(); unsubGlobal(); };
	});

	// 3. Teacher Mapping
	const subjectOrder = ['국어', '한문', '수학', '도덕', '사회', '역사', '물리', '화학', '생명', '지구', '과학', '영어', '기가', '기술', '가정', '체육', '음악', '미술', '진로', '정보', '스포츠', '주제', '동아리'];
	const subjectColors: Record<string, string> = { 국어: '#fecaca', 한문: '#fecaca', 수학: '#bbf7d0', 도덕: '#e9d5ff', 사회: '#e9d5ff', 역사: '#e9d5ff', 과학: '#fef08a', 물리: '#fef08a', 화학: '#fef08a', 생명: '#fef08a', 지구: '#fef08a', 영어: '#bfdbfe', 기가: '#e2e8f0', 기술: '#e2e8f0', 가정: '#e2e8f0', 체육: '#fed7aa', 음악: '#bae6fd', 미술: '#fbcfe8', 진로: '#f3e8ff', 정보: '#a7f3d0', 스포츠: '#cffafe' };
	
	function getSubjectColor(s: string) { if (!s) return '#f3f4f6'; return subjectColors[s.substring(0, 2)] || '#f3f4f6'; }

	const teacherToSubject = (() => {
		const subjectsList: Record<string, Set<string>> = {};
		Object.values(timetableData).forEach((cls) => {
			Object.values(cls as any).forEach((days: any) => {
				Object.values(days).forEach((slot: any) => {
					if (slot.teacher) {
						if (!subjectsList[slot.teacher]) subjectsList[slot.teacher] = new Set();
						subjectsList[slot.teacher].add(slot.subject.replace(/[A-Z0-9]/g, ''));
					}
				});
			});
		});
		const mapping: Record<string, string> = {};
		for (const [t, subs] of Object.entries(subjectsList)) {
			const arr = Array.from(subs).sort((a, b) => subjectOrder.indexOf(a) - subjectOrder.indexOf(b));
			mapping[t] = arr.length > 0 ? arr[0] : '미지정';
		}
		return mapping;
	})();

	const teachers = Object.keys(teacherToSubject).sort((a, b) => {
		const idxA = subjectOrder.indexOf(teacherToSubject[a]);
		const idxB = subjectOrder.indexOf(teacherToSubject[b]);
		return idxA !== idxB ? idxA - idxB : a.localeCompare(b);
	});

	// 4. Actions
	let showNoteModal = $state(false);
	let activeNote = $state('');
	let pendingAppData = $state<any>(null);

	async function toggleApplication(targetDate: string, classId: string, period: string, subject: string, teacher: string) {
		if (!$user) return alert('로그인이 필요합니다.');
		if ($isSupervisor && !$isAdmin) return alert('지도교사는 참관 신청을 할 수 없습니다.');
		if (restrictedDates.includes(targetDate)) return alert('해당 날짜는 신청 불가일입니다.');
		const existing = applications.find(a => a.applicantEmail === $user.email && a.date === targetDate && a.classId === classId && a.period === period);
		if (existing) { if (confirm('신청을 취소하시겠습니까?')) await deleteDoc(doc(db, 'observation_applications', existing.id)); }
		else {
			// 신청 기간 제한 로직 (수업일 및 공휴일 반영)
			const now = new Date();
			const nowStr = now.toISOString().split('T')[0];
			const nowDay = now.getDay();
			const systemHolidays = ['2026-05-05', '2026-05-25'];
			
			// 0. 오늘이 휴일인지 체크 (신청 행위 자체를 차단)
			if (nowDay === 0 || nowDay === 6 || systemHolidays.includes(nowStr)) {
				return alert('주말 및 공휴일에는 참관 신청을 할 수 없습니다.');
			}

			const [y, m, d_] = targetDate.split('-').map(Number);
			const lessonDate = new Date(y, m - 1, d_);
			
			// 휴일 여부 판별 함수
			const isClosed = (d: Date) => {
				const s = d.toISOString().split('T')[0];
				const day = d.getDay();
				return day === 0 || day === 6 || systemHolidays.includes(s);
			};

			// 1. 마감 시간 계산: 수업일 기준 1일 전 16:20
			let endTime = new Date(lessonDate);
			let endCount = 0;
			while (endCount < 1) {
				endTime.setDate(endTime.getDate() - 1);
				if (!isClosed(endTime)) endCount++;
			}
			endTime.setHours(16, 20, 0, 0);

			// 2. 시작 시간 계산: 수업일 기준 3일 전 08:20
			let startTime = new Date(lessonDate);
			let startCount = 0;
			while (startCount < 3) {
				startTime.setDate(startTime.getDate() - 1);
				if (!isClosed(startTime)) startCount++;
			}
			startTime.setHours(8, 20, 0, 0);

			if (now < startTime) {
				const startStr = `${startTime.getMonth() + 1}/${startTime.getDate()}(${weekDays[startTime.getDay() - 1]}) 08:20`;
				return alert(`신청 기간이 아닙니다. ${startStr}부터 신청 가능합니다.`);
			}
			if (now > endTime) {
				const dayNames: Record<number, string> = { 1: '월요일', 2: '화요일', 3: '수요일', 4: '목요일', 5: '금요일' };
				const endDayStr = dayNames[endTime.getDay()] || '수업 전날';
				return alert(`신청 기간이 종료되었습니다. (${endDayStr} 16:20 종료)`);
			}

			// 매일 시간 제한 체크 (08:20 ~ 16:20)
			const currentHour = now.getHours();
			const currentMinute = now.getMinutes();
			const currentTimeVal = currentHour * 60 + currentMinute;
			const startLimit = 8 * 60 + 20; // 08:20
			const endLimit = 16 * 60 + 20;  // 16:20

			if (currentTimeVal < startLimit || currentTimeVal > endLimit) {
				return alert('현재는 신청 가능 시간이 아닙니다.\n참관 신청은 매일 08:20 ~ 16:20 사이에만 가능합니다.');
			}

			if (applications.some(a => a.applicantEmail === $user.email && a.date === targetDate && a.period === period)) return alert('이미 다른 수업을 신청하셨습니다.');
			if (applications.filter(a => a.date === targetDate && a.classId === classId && a.period === period).length >= maxApplicants) return alert('정원이 초과되었습니다.');
			
			const s = studentData[$user.email];
			
			// 교사 설정 및 메시지 확인
			const settingsSnap = await getDoc(doc(db, 'teacher_settings', teacher));
			const noteId = `${teacher}_${targetDate}_${period}_${classId}`;
			const noteSnap = await getDoc(doc(db, 'lesson_notes', noteId));
			
			let combinedNote = '';
			const defNote = settingsSnap.exists() ? settingsSnap.data().defaultNote : '';
			const lesNote = noteSnap.exists() ? noteSnap.data().message : '';

			if (defNote && lesNote) combinedNote = `${defNote}\n\n[수업별 추가 안내]\n${lesNote}`;
			else if (defNote) combinedNote = defNote;
			else if (lesNote) combinedNote = lesNote;

			const tEntry = Object.entries(teacherMetadata).find(([email, meta]) => meta.name === teacher);
			const teacherEmail = tEntry ? tEntry[0] : null;

			const appData = {
				targetDate, classId, period, subject, teacher, teacherEmail,
				applicantEmail: $user.email, applicantName: s ? s.name : $user.displayName,
				applicantSubject: s ? s.subject : '미정'
			};

			activeNote = combinedNote || '별도의 전달 사항이 없습니다. 신청하시겠습니까?';
			pendingAppData = appData;
			showNoteModal = true;
		}
	}

	async function finalizeApplication(data: any) {
		const { targetDate, classId, period, subject, teacher, teacherEmail, applicantEmail, applicantName, applicantSubject } = data;
		
		// 승인 상태 결정 로직
		let status = 'PENDING'; // 기본값은 대기
		
		const settingsSnap = await getDoc(doc(db, 'teacher_settings', teacher));
		
		if (['2026-05-06', '2026-05-07', '2026-05-08'].includes(targetDate)) {
			// 1. 5월 6, 7, 8일은 무조건 자동 승인
			status = 'APPROVED';
		} else if (settingsSnap.exists() && settingsSnap.data().autoApprove === true) {
			// 2. 교사의 설정이 ON인 경우
			status = 'APPROVED';
		}

		await addDoc(collection(db, 'observation_applications'), { 
			date: targetDate, classId, period, subject, teacher, teacherEmail,
			applicantEmail, applicantName, applicantSubject, 
			status: status, timestamp: Timestamp.now() 
		});

		const url = teacherWebhooks[teacher];
		if (url) {
			const statusText = status === 'APPROVED' ? '✅ 자동 승인 완료' : '⏳ 승인 대기 중';
			const statusGuide = status === 'APPROVED' 
				? '교사님의 설정에 따라 자동으로 승인되었습니다.' 
				: '신청이 접수되었습니다. 지도교사 페이지에서 승인 여부를 결정해 주세요.';
			
			const message = [
				`🔔 *새로운 참관 신청 알림 (${status === 'APPROVED' ? '자동 승인됨' : '대기'})*`,
				'',
				`• *신청자*: [${applicantSubject || '미정'}] ${applicantName}`,
				`• *일시*: ${targetDate} ${period}교시`,
				`• *과목*: ${subject}`,
				`• *상태*: ${statusText}`,
				'',
				statusGuide,
				`🔗 [지도 교사 승인 페이지 바로가기](https://student-teaching-schedule.vercel.app/supervisor)`
			].join('\n');

			fetch(url, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ text: message }) });
		}
		
		showNoteModal = false;
		pendingAppData = null;
	}

	function getRepeatingSlot(classId: string, dStr: string, period: string) {
		const day = new Date(dStr).getDay();
		return timetableData[classId]?.[`2026-05-${10 + day}`]?.[period];
	}

	function is7thPeriodRestricted(targetDate: string, period: string) {
		const day = new Date(targetDate).getDay();
		return (day === 1 || day === 3 || day === 5) && period === '7';
	}
</script>

<div class="main-hub">
	{#if checking}
		<div class="loading-screen"><Loader2 class="spin" size={32} /><p>권한 확인 중...</p></div>
	{:else if !$user}
		<div class="login-screen card"><div class="lock-icon"><Lock size={64} /></div><h2>🔒 로그인 후 이용 가능합니다</h2><p>본 시스템은 서울사대부여중 교육실습생 전용입니다.</p></div>
	{:else}
		<!-- Full-width Navigator Bar -->
		<nav class="integrated-nav-row">
			<div class="nav-main-group">
				<button class="nav-item {viewMode === 'teacher' ? 'active' : ''}" onclick={() => { viewMode = 'teacher'; selectedTeacher = null; }}>교사별</button>
				<div class="v-line"></div>
				<div class="grade-tabs">
					{#each [1, 2, 3] as g}
						<button class="nav-item {viewMode === 'grade' && selectedGrade === g ? 'active' : ''}" onclick={() => { viewMode = 'grade'; selectedGrade = g; selectedTeacher = null; }}>{g}학년</button>
					{/each}
				</div>
				<div class="v-line"></div>
				<button class="nav-item {viewMode === 'my' ? 'active' : ''}" onclick={() => { viewMode = 'my'; selectedTeacher = null; }}>내 일정</button>
			</div>
		</nav>

		<div class="content-container">
			<!-- Attached Dual Navigation (Show only in Grade and My views) -->
			{#if viewMode !== 'teacher'}
				<div class="centered-nav-unit">
					<div class="nav-unit-box">
						<div class="control-group">
							<button class="arrow" disabled={currentWeekIndex === 0} onclick={prevWeek}><ChevronLeft size={20} /></button>
							<span class="val week">{getWeekLabel(currentWeekIndex)}</span>
							<button class="arrow" disabled={currentWeekIndex === 5} onclick={nextWeek}><ChevronRight size={20} /></button>
						</div>
						{#if viewMode === 'grade'}
							<div class="control-divider"></div>
							<div class="control-group">
								<button class="arrow" onclick={prevDate}><ChevronLeft size={20} /></button>
								<span class="val date">{formatDateShort(date)}</span>
								<button class="arrow" onclick={nextDate}><ChevronRight size={20} /></button>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<main class="content-area">
				{#if loading}
					<div class="loading-state"><Loader2 class="spin" size={48} /><p>로딩 중...</p></div>
				{:else}
					{#if viewMode === 'teacher'}
						{#if !selectedTeacher}
							<div class="teacher-grid">
								{#each teachers as t}
									<button class="teacher-card card" onclick={() => selectedTeacher = t}>
										<span class="teacher-subject-badge" style="background-color: {getSubjectColor(teacherToSubject[t])}">{teacherToSubject[t]}</span>
										<span class="teacher-name">{t}</span>
									</button>
								{/each}
							</div>
						{:else}
							<div class="view-header-grid">
								<div class="h-left">
									<button class="back-btn-static" onclick={() => selectedTeacher = null}><ChevronLeft size={18} /> 목록</button>
								</div>
								<div class="h-center">
									<div class="nav-unit-box mini">
										<button class="arrow" disabled={currentWeekIndex === 0} onclick={prevWeek}><ChevronLeft size={16} /></button>
										<span class="val week">{getWeekLabel(currentWeekIndex)}</span>
										<button class="arrow" disabled={currentWeekIndex === 5} onclick={nextWeek}><ChevronRight size={16} /></button>
									</div>
								</div>
								<div class="h-right">
									<h3 class="teacher-title-static">{selectedTeacher} 선생님 시간표</h3>
								</div>
							</div>
							<div class="timetable-wrapper">
								<table class="timetable weekly">
									<thead><tr><th class="corner-tl sticky-col">교시</th>{#each weekDates as d, i}<th class={i === 4 ? 'corner-tr' : ''}>{weekDays[i]} ({d.split('-').slice(1).join('/')})</th>{/each}</tr></thead>
									<tbody>
										{#each periods as p}
											<tr>
												<td class="sticky-col"><div class="period-cell">{p}</div></td>
												{#each weekDates as d}
													{@const classId = Object.keys(timetableData).find(id => getRepeatingSlot(id, d, p)?.teacher === selectedTeacher)}
													{@const slot = classId ? getRepeatingSlot(classId, d, p) : null}
													{@const apps = classId ? applications.filter(a => a.date === d && a.classId === classId && a.period === p) : []}
													{@const isMine = apps.some(a => a.applicantEmail === $user?.email)}
													{@const isRes = restrictedDates.includes(d) || (slot && (restrictions.includes(`${selectedTeacher}_${d}_${p}_${classId}`) || teacherRestrictions.includes(selectedTeacher!)))}
													<td class="slot-cell {slot ? 'active' : 'empty'} {isRes ? 'restricted' : ''}">
														{#if slot}
															{#if isRes}<div class="res-msg"><Lock size={12} /> { restrictedDates.includes(d) ? '불가' : '차단'}</div>
															{:else}
																<button class="slot-btn {isMine ? 'mine' : ''}" onclick={() => toggleApplication(d, classId, p, slot.subject, selectedTeacher!)}>
																	<div class="slot-main"><span class="subject" style="background-color: {getSubjectColor(slot.subject)}">{slot.subject}</span><span class="class">{classId.substring(0,1)}-{parseInt(classId.substring(2))}반</span></div>
																	<div class="slot-footer">
																		<Users size={12} /> {apps.length}/5 
																		{#if isMine}
																			{@const myApp = apps.find(a => a.applicantEmail === $user?.email)}
																			<span class="status-tag {myApp?.status || 'PENDING'}">
																				{myApp?.status === 'APPROVED' ? '확정' : '대기'}
																			</span>
																		{/if}
																	</div>
																</button>
															{/if}
														{/if}
													</td>
												{/each}
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					{:else if viewMode === 'grade'}
						<div class="timetable-wrapper">
							<table class="timetable">
								<thead>
									<tr>
										<th class="corner-tl sticky-col">교시</th>
										{#each Object.keys(timetableData).filter(id => id.startsWith(selectedGrade.toString())) as cid, i}
											<th class={i === Object.keys(timetableData).filter(id => id.startsWith(selectedGrade.toString())).length - 1 ? 'corner-tr' : ''}>{parseInt(cid.substring(2))}반</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each periods as p}
										{#if !is7thPeriodRestricted(date, p)}
											<tr>
												<td class="sticky-col"><div class="period-cell">{p}</div></td>
												{#each Object.keys(timetableData).filter(id => id.startsWith(selectedGrade.toString())) as cid}
													{@const slot = getRepeatingSlot(cid, date, p)}
													{@const apps = applications.filter(a => a.date === date && a.classId === cid && a.period === p)}
													{@const isMine = apps.some(a => a.applicantEmail === $user?.email)}
													{@const isRes = restrictedDates.includes(date) || (slot && (restrictions.includes(`${slot.teacher}_${date}_${p}_${cid}`) || teacherRestrictions.includes(slot.teacher)))}
													<td class="slot-cell {slot ? 'active' : 'empty'} {isRes ? 'restricted' : ''}">
														{#if slot}
															{#if isRes}<div class="res-msg"><Lock size={12} /> { restrictedDates.includes(date) ? '불가' : '차단'}</div>
															{:else}
																<button class="slot-btn {isMine ? 'mine' : ''}" onclick={() => toggleApplication(date, cid, p, slot.subject, slot.teacher)}>
																	<div class="slot-main"><span class="subject" style="background-color: {getSubjectColor(slot.subject)}">{slot.subject}</span><span class="teacher">{slot.teacher}</span></div>
																	<div class="slot-footer"><Users size={12} /> {apps.length}/5 {#if isMine}<span class="mine-tag">O</span>{/if}</div>
																</button>
															{/if}
														{/if}
													</td>
												{/each}
											</tr>
										{/if}
									{/each}
								</tbody>
							</table>
						</div>
					{:else if viewMode === 'my'}
						<div class="timetable-wrapper">
							<table class="timetable weekly">
								<thead><tr><th class="corner-tl sticky-col">교시</th>{#each weekDates as d, i}<th class={i === 4 ? 'corner-tr' : ''}>{weekDays[i]} ({d.split('-').slice(1).join('/')})</th>{/each}</tr></thead>
								<tbody>
									{#each periods as p}
										<tr>
											<td class="sticky-col"><div class="period-cell">{p}</div></td>
											{#each weekDates as d}
												{@const myApp = applications.find(a => a.applicantEmail === $user?.email && a.date === d && a.period === p && a.status === 'APPROVED')}
												<td class="slot-cell {myApp ? 'active' : 'empty'}">
													{#if myApp}
														<div class="my-slot-card" style="border-left: 4px solid {getSubjectColor(myApp.subject)}">
															<div class="slot-main"><span class="subject" style="background-color: {getSubjectColor(myApp.subject)}">{myApp.subject}</span><span class="teacher">{myApp.teacher}</span></div>
															<div class="slot-class">{myApp.classId.substring(0,1)}-{parseInt(myApp.classId.substring(2))}반</div>
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
				{/if}
			</main>
		</div>
	{/if}
</div>

{#if showNoteModal}
	<div class="note-modal-overlay">
		<div class="note-modal-card board-style">
			<div class="note-header">
				<AlertCircle size={24} />
				<h3>지도교사 전달 사항</h3>
			</div>
			<div class="note-body">
				<p class="note-content">{activeNote}</p>
			</div>
			<div class="note-footer">
				<button class="btn-cancel-note" onclick={() => { showNoteModal = false; pendingAppData = null; }}>
					취소
				</button>
				<button class="btn-confirm-note" onclick={() => finalizeApplication(pendingAppData)}>
					신청 완료
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Modal Styles */
	.note-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
	.note-modal-card { background: white; width: 90%; max-width: 450px; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2); animation: modalIn 0.3s ease-out; }
	.board-style { border: 4px solid #283151; }
	.note-header { background: #283151; color: white; padding: 0.9rem 1.2rem; display: flex; align-items: center; gap: 0.8rem; }
	.note-header h3 { margin: 0; font-size: 1.15rem; font-weight: 900; }
	.note-body { padding: 2.2rem 2rem; text-align: center; background: #fdfbf2; }
	.note-content { font-size: 1.15rem; font-weight: 700; color: #1e293b; line-height: 1.6; word-break: keep-all; margin: 0; white-space: pre-wrap; }
	.note-footer { padding: 1.2rem; display: flex; justify-content: center; gap: 0.8rem; background: white; border-top: 1px solid #e2e8f0; }
	.btn-confirm-note { background: #283151; color: white; border: none; padding: 0.8rem 1.5rem; border-radius: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s; flex: 1.5; font-size: 1rem; }
	.btn-confirm-note:hover { background: #1e293b; transform: translateY(-2px); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
	.btn-cancel-note { background: #f1f5f9; color: #475569; border: none; padding: 0.8rem 1.5rem; border-radius: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s; flex: 1; font-size: 1rem; }
	.btn-cancel-note:hover { background: #e2e8f0; color: #1e293b; }

	@keyframes modalIn { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }

	.main-hub { width: 100%; min-height: 100vh; background: #f8fafc; }
	.content-container { max-width: 1300px; margin: 0 auto; padding: 0 1.5rem 3rem 1.5rem; }
	.card { background: white; border-radius: 12px; border: 1px solid #eef2f6; box-shadow: 0 4px 10px rgba(0,0,0,0.03); }
	
	/* Full-width Integrated Navigation Row */
	.integrated-nav-row { 
		display: flex; 
		align-items: center; 
		justify-content: center; 
		padding: 0.4rem 0; 
		margin-top: 0; 
		margin-bottom: 0.5rem; 
		width: 100%; 
		background: white; 
		border-bottom: 1px solid #e2e8f0; 
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); 
		position: sticky; 
		top: 0; 
		z-index: 100;
	}
	.nav-main-group { display: flex; align-items: center; gap: 0.2rem; }
	.nav-item { padding: 0.4rem 1.4rem; border-radius: 8px; border: none; background: none; font-weight: 800; color: #64748b; cursor: pointer; transition: all 0.2s; font-size: 1rem; }
	.nav-item:hover { color: #1e293b; background: #f1f5f9; }
	.nav-item.active { background: #e0eaff; color: #2563eb; }
	.v-line { width: 1px; height: 18px; background: #e2e8f0; margin: 0 0.8rem; }
	.grade-tabs { display: flex; gap: 0.2rem; }

	/* Attached Dual Nav */
	.centered-nav-unit { display: flex; justify-content: center; margin-bottom: 0.2rem; margin-top: 1rem; }
	.nav-unit-box { display: flex; align-items: center; background: white; padding: 0.3rem; border-radius: 50px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
	.control-group { display: flex; align-items: center; gap: 0.5rem; padding: 0 0.5rem; }
	.control-divider { width: 1px; height: 20px; background: #e2e8f0; margin: 0 0.5rem; }
	.arrow { background: #f8fafc; border: 1px solid #e2e8f0; color: #64748b; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
	.arrow:hover:not(:disabled) { background: #1e293b; color: white; border-color: #1e293b; }
	.arrow:disabled { opacity: 0.2; cursor: not-allowed; }
	.val { font-weight: 900; font-size: 1rem; color: #1e293b; text-align: center; }
	.val.week { width: 160px; padding: 0 0.5rem; flex-shrink: 0; }
	.val.date { width: 140px; flex-shrink: 0; }

	/* Teacher Grid */
	.teacher-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 0.3rem; margin-top: 1rem; }
	.teacher-card { padding: 1rem 1.2rem; display: flex; flex-direction: column; align-items: center; gap: 0.4rem; cursor: pointer; border: 1.5px solid #eef2f6; border-radius: 12px; background-color: #fdfbf2 !important; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.06); }
	.teacher-card:hover { transform: translateY(-3px); border-color: #2563eb; box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12); }
	.teacher-subject-badge { padding: 0.15rem 0.7rem; border-radius: 20px; font-size: 0.75rem; font-weight: 800; color: #1e293b; background-color: rgba(255, 255, 255, 0.8); }
	.teacher-name { font-weight: 800; font-size: 1.1rem; color: #1e293b; }

	/* Timetable Refinement */
	.view-header-grid { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; width: 100%; margin-bottom: 0.8rem; margin-top: 0.5rem; gap: 1rem; }
	.h-left { display: flex; justify-content: flex-start; }
	.h-center { display: flex; justify-content: center; }
	.h-right { display: flex; justify-content: flex-end; }

	.back-btn-static { padding: 0.4rem 0.8rem; background: #f1f5f9; border: none; border-radius: 8px; font-weight: 800; color: #475569; cursor: pointer; display: flex; align-items: center; gap: 0.3rem; }
	.teacher-title-static { font-size: 1.4rem; font-weight: 900; color: #1e293b; margin: 0; text-align: right; }
	
	.nav-unit-box.mini { padding: 0.25rem; border-radius: 50px; background: white; border: 1px solid #e2e8f0; box-shadow: 0 4px 10px rgba(0,0,0,0.05); flex-shrink: 0; }
	.nav-unit-box.mini .arrow { width: 28px; height: 28px; flex-shrink: 0; }
	.nav-unit-box.mini .val { font-size: 0.9rem; width: 140px; flex-shrink: 0; }

	.timetable-wrapper { background: white; border-radius: 20px; overflow-x: auto; padding: 1.5rem; border: 1px solid #eef2f6; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); -webkit-overflow-scrolling: touch; touch-action: pan-x pan-y; }
	.timetable { border-collapse: separate; border-spacing: 6px 0; width: auto; table-layout: fixed; margin: 0 auto; }
	.timetable th { 
		background: #283151; 
		color: white; 
		padding: 0.5rem; 
		font-weight: 900; 
		font-size: 0.95rem; 
		text-align: center; 
		white-space: nowrap; 
		width: 170px;
		border-radius: 12px 12px 0 0; /* 헤더 개별 상단 라운드 */
		border: none;
	}
	
	.corner-tl, .corner-tr { border-radius: 12px 12px 0 0 !important; }

	.timetable td { border: 1px solid #cbd5e1; height: 85px; vertical-align: top; width: 170px; min-width: 170px; max-width: 170px; background: white; }
	
	/* 교시 셀 너비 40px로 통일 */
	.sticky-col { 
		position: sticky; 
		left: 0; 
		background: #283151 !important; 
		width: 40px !important; 
		min-width: 40px !important; 
		max-width: 40px !important; 
		z-index: 10; 
		border-radius: 0 !important; /* 교시 숫자는 라운드 제외하거나 헤더만 적용 */
		box-sizing: border-box;
		padding: 0 !important;
		border: none !important;
	}
	
	th.sticky-col { border-radius: 12px 12px 0 0 !important; } /* 교시 헤더만 라운드 */
	
	.period-cell { 
		display: flex; 
		align-items: center; 
		justify-content: center; 
		height: 100%; 
		font-weight: 900; 
		font-size: 1rem; 
		color: white; 
		width: 100%;
	}
	
	.slot-cell.restricted { background: #f8fafc; }
	.res-msg { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 0.75rem; color: #cbd5e1; font-weight: 800; gap: 0.2rem; }
	.slot-btn, .slot-display { width: 100%; height: 100%; border: 2px solid transparent; background: none; padding: 0.6rem; display: flex; flex-direction: column; gap: 0.5rem; text-align: left; position: relative; border-radius: 10px; }
	.slot-btn { cursor: pointer; transition: all 0.2s ease-in-out; }
	.slot-btn:hover { background: white; border-color: #2563eb; transform: translateY(-4px); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); z-index: 10; }
	.slot-display { cursor: default; }
	.slot-btn.mine, .slot-display.mine { background: #f0fdf4; border: 2px solid #22c55e; border-radius: 10px; }
	.slot-btn.mine:hover { border-color: #2563eb; background: #f0fdf4; }
	.slot-main { display: flex; justify-content: space-between; align-items: center; width: 100%; }
	.subject { font-size: 0.75rem; font-weight: 900; padding: 0.15rem 0.5rem; border-radius: 4px; width: fit-content; }
	.teacher, .class { font-size: 0.85rem; font-weight: 700; color: #64748b; text-align: right; }
	.slot-footer { margin-top: auto; display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; font-weight: 700; color: #94a3b8; }
	
	.status-tag { 
		font-size: 0.65rem; 
		padding: 0.15rem 0.4rem; 
		border-radius: 4px; 
		font-weight: 900; 
		color: white; 
	}
	.status-tag.PENDING { background-color: #f59e0b; } /* 주황색 (대기) */
	.status-tag.APPROVED { background-color: #22c55e; } /* 초록색 (확정) */
	
	.my-slot-card { height: 100%; padding: 0.8rem; background: #f8fafc; border: 2px solid transparent; border-radius: 10px; display: flex; flex-direction: column; gap: 0.5rem; }

	.loading-state, .loading-screen { text-align: center; padding: 5rem; color: #64748b; }
	.login-screen { text-align: center; padding: 5rem 2rem; margin-top: 3rem; }
	.spin { animation: spin 1s linear infinite; color: #1e293b; margin-bottom: 1rem; }
	@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

	/* ─── ≤1000px: 시간표 컴팩트 (Galaxy 가로 915px 포함) ─── */
	@media (max-width: 1000px) {
		/* iOS safe-area 대응: 노치/다이나믹 아일랜드 가로 모드 */
		.content-container {
			padding: 0 max(0.5rem, env(safe-area-inset-right)) 2.5rem max(0.5rem, env(safe-area-inset-left));
		}

		/* 탭 네비게이션 */
		.integrated-nav-row { padding: 0.3rem 0.5rem; }
		.nav-item { padding: 0.35rem 0.8rem; font-size: 0.88rem; }

		/* 주차/날짜 네비게이션 */
		.val.week { width: 130px; font-size: 0.9rem; }
		.val.date { width: 118px; font-size: 0.9rem; }

		/* 시간표 래퍼 */
		.timetable-wrapper { padding: 0.75rem 0.25rem; -webkit-overflow-scrolling: touch; }

		/* 컬럼 120px → 6반 포함 총 794px, iPhone 12 가로(828px 가용)에서 34px 여유 ✓ */
		.timetable th { width: 120px; font-size: 0.82rem; padding: 0.45rem 0.2rem; border-radius: 8px 8px 0 0; }
		.timetable td { width: 120px; min-width: 120px; max-width: 120px; height: 75px; }
		.sticky-col { width: 32px !important; min-width: 32px !important; max-width: 32px !important; }

		.slot-btn, .slot-display { padding: 0.45rem 0.35rem; gap: 0.25rem; }
		.subject { font-size: 0.65rem; padding: 0.09rem 0.3rem; }
		.teacher, .class { font-size: 0.72rem; }
		.slot-footer { font-size: 0.65rem; }

		.teacher-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.25rem; }
		.back-btn { position: static; margin-bottom: 0.5rem; }
	}

	/* ─── ≤430px: iPhone 세로 모드 전용 (SE 375px ~ Pro Max 430px) ─── */
	@media (max-width: 430px) {
		/* 컬럼 85px → 5반(교사별/내 일정) 총 ~481px, iPhone SE(375px)에서 106px 스크롤 */
		.timetable th { width: 85px; font-size: 0.7rem; padding: 0.3rem 0.1rem; }
		.timetable td { width: 85px; min-width: 85px; max-width: 85px; height: 62px; }
		.sticky-col { width: 24px !important; min-width: 24px !important; max-width: 24px !important; }
		.slot-btn, .slot-display { padding: 0.24rem 0.18rem; gap: 0.12rem; }
		.subject { font-size: 0.52rem; padding: 0.04rem 0.17rem; }
		.teacher, .class { font-size: 0.57rem; }
		.slot-footer { font-size: 0.52rem; }
		.nav-item { padding: 0.25rem 0.38rem; font-size: 0.72rem; }
		.val.week { width: 96px; font-size: 0.75rem; }
		.val.date { width: 84px; font-size: 0.75rem; }
	}

	/* ─── ≤600px: 소형 모바일 세로 모드 ─── */
	@media (max-width: 600px) {
		.content-container { padding: 0 0.4rem 2rem 0.4rem; }

		/* 탭 네비게이션 */
		.integrated-nav-row { padding: 0.2rem 0.35rem; }
		.nav-item { padding: 0.28rem 0.45rem; font-size: 0.76rem; }
		.v-line { height: 13px; margin: 0 0.25rem; }

		/* 주차/날짜 네비게이션 */
		.centered-nav-unit { margin-top: 0.4rem; }
		.nav-unit-box { padding: 0.15rem; }
		.val.week { width: 105px; font-size: 0.78rem; }
		.val.date { width: 92px; font-size: 0.78rem; }
		.arrow { width: 26px; height: 26px; }
		.control-group { gap: 0.25rem; padding: 0 0.25rem; }

		/* 시간표: 컬럼 100px → 총 26+5*100=526px, 세로 모드(412px)에서 114px 스크롤 */
		.timetable-wrapper { padding: 0.5rem 0.3rem; border-radius: 10px; }
		.timetable th { width: 100px; font-size: 0.7rem; padding: 0.32rem 0.1rem; border-radius: 7px 7px 0 0; }
		.timetable td { width: 100px; min-width: 100px; max-width: 100px; height: 64px; }
		.sticky-col { width: 26px !important; min-width: 26px !important; max-width: 26px !important; }
		.period-cell { font-size: 0.75rem; }

		.slot-btn, .slot-display { padding: 0.28rem 0.22rem; gap: 0.15rem; border-radius: 6px; }
		.slot-main { gap: 0; }
		.subject { font-size: 0.55rem; padding: 0.05rem 0.2rem; }
		.teacher, .class { font-size: 0.6rem; }
		.slot-footer { font-size: 0.55rem; }
		.status-tag { font-size: 0.5rem; padding: 0.07rem 0.2rem; }
		.res-msg { font-size: 0.58rem; }

		/* 교사 카드 그리드 */
		.teacher-grid { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 0.18rem; margin-top: 0.4rem; }
		.teacher-card { padding: 0.65rem 0.7rem; }
		.teacher-name { font-size: 0.92rem; }
		.teacher-subject-badge { font-size: 0.67rem; }

		/* 교사 시간표 헤더 */
		.view-header-grid { gap: 0.35rem; margin-bottom: 0.4rem; margin-top: 0.35rem; }
		.teacher-title-static { font-size: 0.95rem; }
		.nav-unit-box.mini .val { width: 96px; font-size: 0.74rem; }
		.nav-unit-box.mini .arrow { width: 22px; height: 22px; }
		.back-btn-static { padding: 0.28rem 0.5rem; font-size: 0.74rem; }

		/* 내 일정 카드 */
		.my-slot-card { padding: 0.38rem; gap: 0.15rem; }
		.slot-class { font-size: 0.6rem; }

		/* 로딩/로그인 화면 */
		.loading-state { padding: 2.5rem 1rem; }
		.login-screen { padding: 2.5rem 1.5rem; margin-top: 0.5rem; }
	}

	/* 터치 기기: 호버 효과 비활성화 */
	@media (hover: none) {
		.slot-btn:hover { transform: none; box-shadow: none; background: none; border-color: transparent; z-index: auto; }
		.teacher-card:hover { transform: none; border-color: #eef2f6; box-shadow: 0 4px 10px rgba(0,0,0,0.06); }
	}

	/* ════════════════════════════════════════
	   다크 모드
	════════════════════════════════════════ */
	@media (prefers-color-scheme: dark) {
		/* 전체 배경 */
		.main-hub { background: #0f1117; }

		/* 네비 탭 바 */
		.integrated-nav-row {
			background: #111827;
			border-bottom-color: #2d3748;
			box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
		}
		.nav-item { color: #94a3b8; }
		.nav-item:hover { color: #e2e8f0; background: #1e2a4a; }
		.nav-item.active { background: #1e3a5f; color: #93c5fd; }
		.v-line { background: #2d3748; }

		/* 주차·날짜 네비 */
		.nav-unit-box {
			background: #1a1f35;
			border-color: #2d3748;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
		}
		.arrow { background: #1e2a4a; border-color: #374151; color: #94a3b8; }
		.arrow:hover:not(:disabled) { background: #e2e8f0; color: #111827; border-color: #e2e8f0; }
		.val { color: #e2e8f0; }
		.control-divider { background: #2d3748; }

		/* 시간표 래퍼 */
		.timetable-wrapper {
			background: #1a1f35;
			border-color: #2d3748;
			box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
		}

		/* 시간표 헤더 행 */
		.timetable th { background: #1e2a4a; }

		/* 시간표 데이터 셀 */
		.timetable td { border-color: #2d3748; background: #1a1f35; }

		/* 교시 고정 열 */
		.sticky-col { background: #1e2a4a !important; }

		/* 빈 슬롯 배경 */
		.slot-cell.empty { background: #161d30; }
		.slot-cell.restricted { background: #111827; }
		.res-msg { color: #374151; }

		/* 슬롯 버튼 */
		.slot-btn:hover {
			background: #1e2a4a;
			border-color: #3b82f6;
			box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
		}
		.slot-btn.mine, .slot-display.mine {
			background: #052e16;
			border-color: #16a34a;
		}
		.slot-btn.mine:hover { border-color: #3b82f6; }

		/* 슬롯 내부 텍스트 */
		.teacher, .class { color: #94a3b8; }
		.slot-footer { color: #4b5563; }

		/* 내 일정 카드 */
		.my-slot-card { background: #1e2a4a; }
		.slot-class { color: #94a3b8; }

		/* 교사 카드 */
		.teacher-card {
			background-color: #1e2235 !important;
			border-color: #2d3748;
			box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
		}
		.teacher-card:hover { border-color: #3b82f6; box-shadow: 0 8px 16px rgba(0, 0, 0, 0.5); }
		.teacher-name { color: #e2e8f0; }
		.teacher-subject-badge { background-color: rgba(255, 255, 255, 0.12) !important; color: #cbd5e1; }

		/* 교사 시간표 뷰 헤더 */
		.back-btn-static { background: #1e2a4a; color: #94a3b8; }
		.back-btn-static:hover { background: #2d3748; color: #e2e8f0; }
		.teacher-title-static { color: #e2e8f0; }

		/* 로그인·로딩 화면 */
		.card { background: #1a1f35; border-color: #2d3748; }
		.loading-state { color: #94a3b8; }
		.login-screen h2 { color: #e2e8f0; }
		.login-screen p { color: #94a3b8; }

		/* 신청 확인 모달 */
		.note-modal-card { background: #1a1f35; }
		.board-style { border-color: #374151; }
		.note-body { background: #111827; }
		.note-content { color: #e2e8f0; }
		.note-footer { background: #1a1f35; border-top-color: #2d3748; }
		.btn-cancel-note { background: #2d3748; color: #94a3b8; }
		.btn-cancel-note:hover { background: #374151; color: #e2e8f0; }
	}
</style>
