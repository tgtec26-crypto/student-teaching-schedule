<script lang="ts">
	import { studentData } from '$lib/studentData';
	import { teacherMetadata } from '$lib/teacherData';
	import { teacherWebhooks } from '$lib/teacherWebhooks';
	import { page } from '$app/state';
	import { user, db, isStudent, isAdmin } from '$lib/firebase';
	import { timetableData, getSlot } from '$lib/timetableData';
	import {
		collection,
		query,
		where,
		onSnapshot,
		getDoc,
		setDoc,
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
		Lock,
		AlertCircle,
		ArrowLeft
	} from 'lucide-svelte';

	// URL Params & Query
	let date = $state(page.params.date ?? '');
	const queryView = page.url.searchParams.get('view');
	const queryGrade = page.url.searchParams.get('grade');
	const queryTeacher = page.url.searchParams.get('teacher');

	// State for View Mode
	let viewMode = $state<'grade' | 'teacher' | 'my'>( (queryView as any) || 'teacher');
	let selectedGrade = $state(queryGrade ? parseInt(queryGrade) : 1);
	let selectedTeacher = $state<string | null>(queryTeacher || null);

	let applications = $state<any[]>([]);
	let restrictions = $state<string[]>([]);
	let teacherRestrictions = $state<string[]>([]);
	let loading = $state(true);

	const grades = [1, 2, 3];
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

	// Navigation State
	let currentWeekIndex = $state(0); 

	// Sync currentWeekIndex with current date
	$effect(() => {
		const idx = allWeekDates.indexOf(date);
		if (idx !== -1) {
			currentWeekIndex = Math.floor(idx / 5);
		}
	});

	const weekDates = $derived(allWeekDates.slice(currentWeekIndex * 5, (currentWeekIndex + 1) * 5));

	// Navigation Logic with URL Sync
	function updateURL(newDate: string) {
		date = newDate;
		const url = new URL(page.url);
		url.pathname = `/observation/${newDate}`;
		// Use history.replaceState to avoid polluting browser history while switching dates
		history.replaceState({}, '', url.toString());
	}

	function nextWeek() {
		if (currentWeekIndex < 5) {
			currentWeekIndex++;
			updateURL(allWeekDates[currentWeekIndex * 5]); // Reset to Monday
		}
	}

	function prevWeek() {
		if (currentWeekIndex > 0) {
			currentWeekIndex--;
			updateURL(allWeekDates[currentWeekIndex * 5]); // Reset to Monday
		}
	}

	function nextDate() {
		const idx = allWeekDates.indexOf(date);
		if (idx < allWeekDates.length - 1) {
			updateURL(allWeekDates[idx + 1]);
		} else {
			updateURL(allWeekDates[0]); // Cycle to the very beginning
		}
	}

	function prevDate() {
		const idx = allWeekDates.indexOf(date);
		if (idx > 0) {
			updateURL(allWeekDates[idx - 1]);
		} else {
			updateURL(allWeekDates[allWeekDates.length - 1]); // Cycle to the very end
		}
	}

	function formatDateShort(dStr: string) {
		const parts = dStr.split('-');
		const d = new Date(dStr);
		const dayName = weekDays[d.getDay() - 1] || '';
		return `${parseInt(parts[1])}.${parseInt(parts[2])}.(${dayName})`;
	}

	// Subject Color Mapping
	const subjectColors: Record<string, string> = {
		국어: '#fecaca', 한문: '#fecaca', 수학: '#bbf7d0', 도덕: '#e9d5ff',
		사회: '#e9d5ff', 역사: '#e9d5ff', 과학: '#fef08a', 물리: '#fef08a',
		화학: '#fef08a', 생명: '#fef08a', 지구: '#fef08a', 영어: '#bfdbfe',
		기가: '#e2e8f0', 기술: '#e2e8f0', 가정: '#e2e8f0', 체육: '#fed7aa',
		음악: '#deb887', 미술: '#fbcfe8', 진로: '#f3e8ff', 정보: '#a7f3d0',
		스포츠: '#cffafe'
	};

	function getSubjectColor(subject: string) {
		if (!subject) return '#f3f4f6';
		const base = subject.substring(0, 2);
		return subjectColors[base] || '#f3f4f6';
	}

	const subjectOrder = [
		'국어', '한문', '수학', '도덕', '사회', '역사', '물리', '화학', '생명', '지구',
		'과학', '영어', '기가', '기술', '가정', '체육', '음악', '미술', '진로', '정보',
		'스포츠', '주제', '동아리'
	];

	function getSubjectIndex(subject: string) {
		const index = subjectOrder.indexOf(subject);
		return index === -1 ? 999 : index;
	}

	const teacherToSubject = $derived.by(() => {
		const subjectsList: Record<string, Set<string>> = {};
		Object.values(timetableData).forEach((classes) => {
			Object.values(classes as any).forEach((days: any) => {
				Object.values(days).forEach((slot: any) => {
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

	// Firestore Listeners
	let unsubscribeApps: () => void;
	let unsubscribeRestricted: () => void;
	let unsubscribeGlobal: () => void;

	$effect(() => {
		const qApps = query(
			collection(db, 'observation_applications'),
			where('date', '>=', allWeekDates[0]),
			where('date', '<=', allWeekDates[19])
		);

		unsubscribeApps = onSnapshot(qApps, (snapshot) => {
			applications = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
			loading = false;
		});

		unsubscribeRestricted = onSnapshot(query(collection(db, 'restricted_lessons')), (snapshot) => {
			restrictions = snapshot.docs.map((doc) => doc.id);
		});

		unsubscribeGlobal = onSnapshot(collection(db, 'teacher_restrictions'), (snapshot) => {
			teacherRestrictions = snapshot.docs.map((doc) => doc.id);
		});

		return () => {
			if (unsubscribeApps) unsubscribeApps();
			if (unsubscribeRestricted) unsubscribeRestricted();
			if (unsubscribeGlobal) unsubscribeGlobal();
		};
	});

	function isDateDisabled(targetDate: string) {
		return restrictedDates.includes(targetDate);
	}

	// 4. Actions
	let showNoteModal = $state(false);
	let activeNote = $state('');
	let pendingAppData = $state<any>(null);

	async function finalizeApplication(data: any) {
		const { targetDate, classId, period, subject, teacher, teacherEmail, applicantEmail, applicantName, applicantSubject } = data;
		
		// 승인 상태 결정 로직
		let status = 'PENDING';
		
		const settingsSnap = await getDoc(doc(db, 'teacher_settings', teacher));
		
		if (['2026-05-06', '2026-05-07', '2026-05-08'].includes(targetDate)) {
			status = 'APPROVED';
		} else if (settingsSnap.exists() && settingsSnap.data().autoApprove === true) {
			status = 'APPROVED';
		}

		// 결정적 ID로 동일 (실습생, 수업) 중복 doc 생성 방지
		const appId = `${applicantEmail}_${targetDate}_${period}_${classId}`;
		const appRef = doc(db, 'observation_applications', appId);

		// 다른 탭/기기에서 이미 신청한 경우(특히 이미 승인된 경우) 덮어쓰지 않음
		const existingSnap = await getDoc(appRef);
		if (existingSnap.exists()) {
			showNoteModal = false;
			pendingAppData = null;
			return;
		}

		await setDoc(appRef, {
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

	async function toggleApplication(targetDate: string, classId: string, period: string, subject: string, teacher: string) {
		if (!$user) return alert('로그인이 필요합니다.');
		if (isDateDisabled(targetDate)) return alert('해당 날짜는 참관 신청이 불가능한 날입니다.');

		const existingApp = applications.find(
			(app) => app.applicantEmail === $user.email && app.date === targetDate && app.classId === classId && app.period === period
		);

		if (existingApp) {
			if (confirm('신청을 취소하시겠습니까?')) {
				await deleteDoc(doc(db, 'observation_applications', existingApp.id));
			}
		} else {
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

			const hasDuplicate = applications.some(
				(app) => app.applicantEmail === $user.email && app.date === targetDate && app.period === period
			);
			if (hasDuplicate) return alert('해당 교시에 이미 다른 수업을 신청하셨습니다.');
			
			const slotApps = applications.filter((app) => app.date === targetDate && app.classId === classId && app.period === period);
			if (slotApps.length >= maxApplicants) return alert('정원이 초과되었습니다.');

			const sInfo = studentData[$user.email];
			const aName = sInfo ? sInfo.name : $user.displayName;
			const aSubject = sInfo ? sInfo.subject : '미정';

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
				applicantEmail: $user.email, applicantName: aName, applicantSubject: aSubject
			};

			activeNote = combinedNote || '별도의 전달 사항이 없습니다. 신청하시겠습니까?';
			pendingAppData = appData;
			showNoteModal = true;
		}
	}

	function getClassesForGrade(grade: number) {
		return Object.keys(timetableData).filter((id) => id.startsWith(grade.toString()));
	}

	function is7thPeriodRestricted(targetDate: string, period: string) {
		const day = new Date(targetDate).getDay();
		return (day === 1 || day === 3 || day === 5) && period === '7';
	}

	function getRepeatingSlot(classId: string, targetDate: string, period: string) {
		return getSlot(classId, targetDate, period);
	}
</script>

<div class="full-width container">
	{#if !$isStudent && !$isAdmin}
		<div class="error-state card">
			<AlertCircle size={48} color="#e63946" />
			<h2>신청 권한이 없습니다</h2>
			<p>지도 교사는 참관 신청을 할 수 없습니다. 지도 교사 페이지를 이용해 주세요.</p>
			<a href="/supervisor" class="btn btn-primary">지도 교사 페이지로 이동</a>
		</div>
	{:else}
		<header class="page-header">
			<a href="/" class="back-link">
				<ArrowLeft size={20} /> 홈으로 돌아가기
			</a>
			<nav class="main-nav">
				<button class="nav-item {viewMode === 'teacher' ? 'active' : ''}" onclick={() => { viewMode = 'teacher'; selectedTeacher = null; }}>
					<BookOpen size={18} /> 교사별
				</button>
				<div class="divider"></div>
				<div class="grade-tabs">
					{#each grades as g}
						<button class="nav-item {viewMode === 'grade' && selectedGrade === g ? 'active' : ''}" onclick={() => { viewMode = 'grade'; selectedGrade = g; selectedTeacher = null; }}>
							{g}학년
						</button>
					{/each}
				</div>
				<div class="divider"></div>
				<button class="nav-item {viewMode === 'my' ? 'active' : ''}" onclick={() => { viewMode = 'my'; selectedTeacher = null; }}>
					<User size={18} /> 내 일정
				</button>
			</nav>
		</header>

		{#if loading}
			<div class="loading-state">
				<Loader2 class="spin" size={48} />
				<p>데이터를 불러오는 중입니다...</p>
			</div>
		{:else if viewMode === 'grade'}
			<!-- Grade View with Dual Nav -->
			<div class="dual-nav">
				<div class="nav-group week-nav">
					<button class="nav-arrow" disabled={currentWeekIndex === 0} onclick={prevWeek}><ChevronLeft size={20} /></button>
					<span class="nav-label">{currentWeekIndex + 1}주차</span>
					<button class="nav-arrow" disabled={currentWeekIndex === 3} onclick={nextWeek}><ChevronRight size={20} /></button>
				</div>
				<div class="nav-group date-nav">
					<button class="nav-arrow" onclick={prevDate}><ChevronLeft size={20} /></button>
					<div class="date-info">
						<Calendar size={16} />
						<span class="nav-label">{formatDateShort(date)}</span>
					</div>
					<button class="nav-arrow" onclick={nextDate}><ChevronRight size={20} /></button>
				</div>
			</div>

			<div class="timetable-wrapper">
				<table class="timetable">
					<thead>
						<tr>
							<th class="sticky-col period-header corner-tl">교시</th>
							{#each getClassesForGrade(selectedGrade) as classId, i}
								<th class={i === getClassesForGrade(selectedGrade).length - 1 ? 'corner-tr' : ''}>{parseInt(classId.substring(2))}반</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each periods as period}
							{#if !is7thPeriodRestricted(date, period)}
								<tr>
									<td class="sticky-col {period === '7' ? 'last' : ''}"><div class="period-cell">{period}</div></td>
									{#each getClassesForGrade(selectedGrade) as classId}
										{@const slot = getRepeatingSlot(classId, date, period)}
										{@const apps = applications.filter((app) => app.date === date && app.classId === classId && app.period === period)}
										{@const isMine = apps.some((a) => a.applicantEmail === $user?.email)}
										{@const isFull = apps.length >= maxApplicants}
										{@const isGlobalRestricted = slot ? teacherRestrictions.includes(slot.teacher) : false}
										{@const isDisabledDate = isDateDisabled(date)}
										{@const isTeacherRestricted = slot ? (restrictions.includes(`${slot.teacher}_${date}_${period}_${classId}`) || isGlobalRestricted) : false}

										<td class="slot-cell {slot ? 'active' : 'empty'} {isTeacherRestricted || isDisabledDate ? 'restricted' : ''}">
											{#if slot}
												{#if isTeacherRestricted || isDisabledDate}
													<div class="slot-restricted-msg"><Lock size={12} /> {isDisabledDate ? '신청 불가일' : '참관 불가'}</div>
												{:else}
													<button class="slot-btn {isMine ? 'mine' : ''} {isFull && !isMine ? 'full' : ''}" onclick={() => toggleApplication(date, classId, period, slot.subject, slot.teacher)}>
														<div class="slot-row">
															<div class="slot-info-main">
																<span class="subject" style="background-color: {getSubjectColor(slot.subject)}">{slot.subject}</span>
																<span class="teacher">{slot.teacher}</span>
															</div>
															<div class="applicant-count"><Users size={12} /> {apps.length}/{maxApplicants}</div>
														</div>
														{#if isMine}
															<span class="my-badge {apps.find(a => a.applicantEmail === $user?.email)?.status === 'APPROVED' ? 'approved' : 'pending'}">
																{apps.find(a => a.applicantEmail === $user?.email)?.status === 'APPROVED' ? '신청완료' : '승인대기'}
															</span>
														{/if}
													</button>
												{/if}
											{:else}<div class="no-class">-</div>{/if}
										</td>
									{/each}
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{:else if viewMode === 'teacher' && !selectedTeacher}
			<!-- Teacher Selection (Fallback) -->
			<div class="teacher-grid">
				{#each teachers as t}
					<button class="teacher-card card" onclick={() => selectedTeacher = t}>
						<span class="teacher-subject-badge" style="background-color: {getSubjectColor(teacherToSubject[t])}">{teacherToSubject[t]}</span>
						<span class="teacher-name">{t}</span>
					</button>
				{/each}
			</div>
		{:else if viewMode === 'teacher' && selectedTeacher}
			<!-- Teacher 4-Week View -->
			<div class="view-header-row">
				<button class="back-btn" onclick={() => selectedTeacher = null}><ChevronLeft size={20} /> 목록</button>
				<div class="teacher-title"><User size={24} /> <h2>{selectedTeacher} 선생님</h2></div>
			</div>

			<div class="week-selector">
				<button class="week-nav-btn" disabled={currentWeekIndex === 0} onclick={() => currentWeekIndex--}><ChevronLeft size={20} /></button>
				<div class="week-info"><Calendar size={18} /> <span class="week-label">{currentWeekIndex + 1}주차</span> <span class="week-dates">({formatDateShort(weekDates[0])} ~ {formatDateShort(weekDates[4])})</span></div>
				<button class="week-nav-btn" disabled={currentWeekIndex === 3} onclick={() => currentWeekIndex++}><ChevronRight size={20} /></button>
			</div>

			<div class="timetable-wrapper">
				<table class="timetable weekly">
					<thead>
						<tr>
							<th class="sticky-col period-header">교시</th>
							{#each weekDays as day, i}<th>{day} ({formatDateShort(weekDates[i])})</th>{/each}
						</tr>
					</thead>
					<tbody>
						{#each periods as period}
							<tr>
								<td class="sticky-col {period === '7' ? 'last' : ''}"><div class="period-cell">{period}</div></td>
								{#each weekDates as d}
									{@const classId = Object.keys(timetableData).find(id => getRepeatingSlot(id, d, period)?.teacher === selectedTeacher)}
									{@const slot = classId ? getRepeatingSlot(classId, d, period) : null}
									{@const apps = classId ? applications.filter(app => app.date === d && app.classId === classId && app.period === period) : []}
									{@const isMine = apps.some(a => a.applicantEmail === $user?.email)}
									{@const isFull = apps.length >= maxApplicants}
									{@const isRestricted = is7thPeriodRestricted(d, period)}
									{@const isGlobalRestricted = teacherRestrictions.includes(selectedTeacher!)}
									{@const isDisabledDate = isDateDisabled(d)}
									{@const isTeacherRestricted = (slot && classId) ? (restrictions.includes(`${selectedTeacher}_${d}_${period}_${classId}`) || isGlobalRestricted) : false}

									<td class="slot-cell {slot ? 'active' : 'empty'} {isTeacherRestricted || isDisabledDate ? 'restricted' : ''}">
										{#if slot && classId}
											{#if isTeacherRestricted || isDisabledDate}
												<div class="slot-restricted-msg"><Lock size={12} /> {isDisabledDate ? '신청 불가일' : '참관 불가'}</div>
											{:else}
												<button class="slot-btn {isMine ? 'mine' : ''} {isFull && !isMine ? 'full' : ''}" onclick={() => toggleApplication(d, classId, period, slot.subject, selectedTeacher!)}>
													<div class="slot-row">
														<div class="slot-info-main">
															<span class="subject" style="background-color: {getSubjectColor(slot.subject)}">{slot.subject}</span>
															<span class="class-label">{classId.substring(0, 1)}-{parseInt(classId.substring(2))}</span>
														</div>
														<div class="applicant-count"><Users size={12} /> {apps.length}/{maxApplicants}</div>
													</div>
													{#if isMine}
														<span class="my-badge {apps.find(a => a.applicantEmail === $user?.email)?.status === 'APPROVED' ? 'approved' : 'pending'}">
															{apps.find(a => a.applicantEmail === $user?.email)?.status === 'APPROVED' ? '신청완료' : '승인대기'}
														</span>
													{/if}
												</button>
											{/if}
										{:else if isRestricted}<div class="no-class restricted">수업 없음</div>
										{:else}<div class="no-class">-</div>{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else if viewMode === 'my'}
			<!-- My Schedule -->
			<div class="week-selector">
				<button class="week-nav-btn" disabled={currentWeekIndex === 0} onclick={() => currentWeekIndex--}><ChevronLeft size={20} /></button>
				<div class="week-info"><Calendar size={18} /> <span class="week-label">{currentWeekIndex + 1}주차</span></div>
				<button class="week-nav-btn" disabled={currentWeekIndex === 3} onclick={() => currentWeekIndex++}><ChevronRight size={20} /></button>
			</div>
			<div class="timetable-wrapper">
				<table class="timetable weekly">
					<thead>
						<tr>
							<th class="sticky-col period-header">교시</th>
							{#each weekDays as day, i}<th>{day} ({formatDateShort(weekDates[i])})</th>{/each}
						</tr>
					</thead>
					<tbody>
						{#each periods as period}
							<tr>
								<td class="sticky-col {period === '7' ? 'last' : ''}"><div class="period-cell">{period}</div></td>
								{#each weekDates as d}
									{@const myApp = applications.find(a => a.applicantEmail === $user?.email && a.date === d && a.period === period && a.status === 'APPROVED')}
									<td class="slot-cell {myApp ? 'active' : 'empty'}">
										{#if myApp}
											<div class="slot-content card compact" style="background-color: {getSubjectColor(myApp.subject)}33; border: 1px solid {getSubjectColor(myApp.subject)}80;">
												<div class="slot-info single-row">
													<span class="subject" style="background-color: {getSubjectColor(myApp.subject)}">{myApp.subject}</span>
													<span class="class-label">{myApp.classId.substring(0, 1)}-{parseInt(myApp.classId.substring(2))}</span>
													<span class="teacher-name-small">{myApp.teacher}</span>
												</div>
											</div>
										{:else}<div class="no-class">-</div>{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
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

	.full-width { max-width: 1400px !important; margin: 0 auto; padding: 0 2rem 2rem 2rem; }
	.page-header { margin-bottom: 1.5rem; padding-top: 1rem; display: flex; flex-direction: column; gap: 1rem; }
	.back-link { display: flex; align-items: center; gap: 0.5rem; color: #64748b; text-decoration: none; font-weight: 700; width: fit-content; }
	.back-link:hover { color: var(--header-bg); }
	
	.main-nav { display: flex; align-items: center; justify-content: center; background: #f8fafc; padding: 0.4rem; border-radius: 12px; border: 1px solid #e2e8f0; }
	.grade-tabs { display: flex; gap: 0.3rem; }
	.nav-item { padding: 0.5rem 1rem; border-radius: 8px; border: none; background: none; font-weight: 800; color: #64748b; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; transition: all 0.2s; font-size: 0.9rem; }
	.nav-item:hover { background: #f1f5f9; color: #1e293b; }
	.nav-item.active { background: white; color: var(--header-bg); box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); }
	.divider { width: 1px; height: 20px; background: #cbd5e1; margin: 0 0.8rem; }

	/* Dual Nav System */
	.dual-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; gap: 1rem; }
	.nav-group { display: flex; align-items: center; gap: 0.8rem; background: #f8fafc; padding: 0.4rem 0.8rem; border-radius: 12px; border: 1px solid #e2e8f0; }
	.nav-arrow { background: white; border: 1px solid #e2e8f0; color: #64748b; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
	.nav-arrow:hover:not(:disabled) { background: var(--header-bg); color: white; border-color: var(--header-bg); }
	.nav-arrow:disabled { opacity: 0.3; cursor: not-allowed; }
	.nav-label { font-weight: 900; font-size: 1rem; color: var(--header-bg); min-width: 60px; text-align: center; }
	.date-info { display: flex; align-items: center; gap: 0.5rem; color: var(--header-bg); min-width: 120px; justify-content: center; }

	.timetable-wrapper { background: white; border-radius: 16px; overflow-x: auto; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); padding: 0.8rem; }
	.timetable { width: 100%; border-collapse: separate; border-spacing: 0; }
	.timetable th { background: #283151 !important; padding: 0.6rem; font-weight: 900; color: #ffffff; font-size: 0.9rem; border: 1px solid rgba(255, 255, 255, 0.1); text-align: center; }
	.timetable td { border: 1px solid #edf2f7; height: 70px; vertical-align: top; }
	.timetable.weekly td { width: 200px; }

	.sticky-col { position: sticky; left: 0; background: #283151 !important; z-index: 5; border-right: 2px solid #0f172a !important; width: 40px !important; min-width: 40px; padding: 0 !important; }
	.period-cell { display: flex; align-items: center; justify-content: center; font-weight: 900; color: #ffffff; font-size: 1.1rem; height: 100%; background: #283151; }

	.slot-cell.restricted { background: #f1f5f9; }
	.slot-restricted-msg { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; font-size: 0.7rem; font-weight: 800; gap: 0.2rem; text-align: center; }
	
	.slot-btn, .slot-display { width: 100%; height: 100%; border: 2px solid transparent; background: none; padding: 0.4rem; display: flex; flex-direction: column; text-align: left; gap: 0.3rem; position: relative; border-radius: 8px; }
	.slot-btn { cursor: pointer; transition: all 0.2s ease-in-out; }
	.slot-btn:hover:not(.full) { background: white; border-color: #2563eb; transform: translateY(-4px); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); z-index: 10; }
	.slot-display { cursor: default; }
	.slot-btn.mine, .slot-display.mine { background: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; }
	.slot-btn.mine:hover { border-color: #2563eb; background: #f0fdf4; }
	.slot-btn.full { opacity: 0.6; cursor: not-allowed; }

	.slot-row { display: flex; align-items: center; justify-content: space-between; width: 100%; }
	.slot-info-main { display: flex; align-items: center; gap: 0.3rem; }
	.subject { font-weight: 800; font-size: 0.75rem; padding: 0.1rem 0.35rem; border-radius: 4px; white-space: nowrap; }
	.teacher, .class-label { font-size: 0.75rem; color: #64748b; font-weight: 700; }
	.applicant-count { font-size: 0.7rem; color: #94a3b8; font-weight: 700; display: flex; align-items: center; gap: 0.1rem; }
	
	.my-badge { color: white; font-size: 0.65rem; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: 800; width: fit-content; margin-top: auto; }
	.my-badge.pending { background: #f59e0b; }
	.my-badge.approved { background: #22c55e; }

	.teacher-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.6rem; margin-top: 1rem; }
	.teacher-card { padding: 0.8rem; display: flex; flex-direction: column; align-items: center; gap: 0.4rem; background: white; cursor: pointer; text-align: center; border: 2px solid transparent; }
	.teacher-card:hover { transform: translateY(-3px); box-shadow: 0 8px 12px rgba(0, 0, 0, 0.08); border-color: #e2e8f0; }
	.teacher-subject-badge { padding: 0.15rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 800; }
	.teacher-name { font-weight: 800; color: #2d3748; font-size: 1rem; }

	.view-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
	.back-btn { display: flex; align-items: center; gap: 0.4rem; padding: 0.5rem 0.8rem; background: #f1f5f9; border: none; border-radius: 8px; font-weight: 800; color: #475569; cursor: pointer; }
	.teacher-title { display: flex; align-items: center; gap: 0.6rem; color: var(--header-bg); }
	.teacher-title h2 { margin: 0; font-size: 1.4rem; }

	.week-selector { display: flex; align-items: center; justify-content: center; gap: 1.5rem; padding: 0.6rem; background: #f8fafc; border-radius: 12px; margin-bottom: 1rem; border: 1px solid #e2e8f0; }
	.week-info { display: flex; align-items: center; gap: 0.6rem; color: var(--header-bg); }
	.week-label { font-weight: 900; font-size: 1rem; }
	.week-dates { font-size: 0.85rem; color: #64748b; font-weight: 700; }
	.week-nav-btn { background: white; border: 1px solid #e2e8f0; color: #64748b; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
	.week-nav-btn:hover:not(:disabled) { background: var(--header-bg); color: white; }

	.no-class { height: 100%; display: flex; align-items: center; justify-content: center; color: #e2e8f0; font-weight: 800; font-size: 0.8rem; }
	.loading-state { text-align: center; padding: 5rem 0; color: #666; }
	.spin { animation: spin 1s linear infinite; color: var(--header-bg); }
	@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

	.error-state { text-align: center; padding: 5rem 2rem; display: flex; flex-direction: column; align-items: center; gap: 1rem; }

	@media (max-width: 768px) {
		.dual-nav { flex-direction: column; }
		.nav-group { width: 100%; justify-content: center; }
	}
</style>
