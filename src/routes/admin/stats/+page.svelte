<script lang="ts">
	import { db, isAdmin } from '$lib/firebase';
	import { collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
	import {
		AlertCircle,
		BarChart3,
		Users,
		GraduationCap,
		Grid3x3,
		RefreshCw,
		X,
		ArrowLeft,
		Trash2
	} from 'lucide-svelte';

	// ---------- 상태 ----------
	type AppDoc = {
		id: string;
		date: string;
		period: number;
		subject: string;
		classId: string;
		teacher: string;
		teacherEmail: string;
		applicantName: string;
		applicantEmail: string;
		applicantSubject?: string;
		status: string;
	};

	let apps = $state<AppDoc[]>([]);
	let loading = $state(true);
	let errorMsg = $state('');
	let lastFetched = $state<Date | null>(null);

	// 매트릭스 셀 클릭 시 상세 모달
	let selectedTeacher = $state<string | null>(null);
	let selectedStudent = $state<string | null>(null);

	// ---------- 데이터 로드 (APPROVED 만, 1회 + 새로고침) ----------
	async function fetchApprovedApps() {
		loading = true;
		errorMsg = '';
		try {
			const q = query(
				collection(db, 'observation_applications'),
				where('status', '==', 'APPROVED')
			);
			const snap = await getDocs(q);
			apps = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppDoc, 'id'>) }));
			lastFetched = new Date();
		} catch (e: any) {
			console.error('Stats load error:', e);
			errorMsg = '통계 데이터 로드 실패: ' + (e.message || '알 수 없는 오류');
		} finally {
			loading = false;
		}
	}

	// $isAdmin 은 Firebase auth 비동기로 인해 처음에 false였다가 true 로 바뀐다.
	// onMount 는 한 번만 실행되므로 새로고침 시 fetch 누락 가능 → $effect 로 추적.
	let initialFetchDone = $state(false);
	$effect(() => {
		if ($isAdmin && !initialFetchDone) {
			initialFetchDone = true;
			fetchApprovedApps();
		}
	});

	// ---------- 집계 (모두 derived) ----------

	// 교사별 신청 수 (수업 과목도 함께 집계)
	const teacherCounts = $derived.by(() => {
		const m = new Map<string, { count: number; subject: string }>();
		for (const a of apps) {
			const cur = m.get(a.teacher) ?? { count: 0, subject: a.subject ?? '' };
			cur.count += 1;
			if (!cur.subject && a.subject) cur.subject = a.subject;
			m.set(a.teacher, cur);
		}
		return [...m.entries()]
			.map(([name, v]) => ({ name, count: v.count, subject: v.subject }))
			.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'));
	});

	// 학생별 신청 수
	const studentCounts = $derived.by(() => {
		const m = new Map<string, { count: number; subject: string }>();
		for (const a of apps) {
			const cur = m.get(a.applicantName) ?? { count: 0, subject: a.applicantSubject ?? '' };
			cur.count += 1;
			if (!cur.subject && a.applicantSubject) cur.subject = a.applicantSubject;
			m.set(a.applicantName, cur);
		}
		return [...m.entries()]
			.map(([name, v]) => ({ name, count: v.count, subject: v.subject }))
			.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'));
	});

	// 매트릭스: row=teacher, col=student, value=count
	type MatrixRow = { teacher: string; total: number; cells: Map<string, number> };
	const matrix = $derived.by(() => {
		const teachers = teacherCounts.map((t) => t.name); // 신청 많은 순
		const students = studentCounts.map((s) => s.name); // 신청 많은 순

		const rows: MatrixRow[] = teachers.map((t) => ({
			teacher: t,
			total: 0,
			cells: new Map<string, number>()
		}));
		const rowIndex = new Map(rows.map((r, i) => [r.teacher, i]));
		const colTotals = new Map<string, number>();

		for (const a of apps) {
			const r = rows[rowIndex.get(a.teacher)!];
			if (!r) continue;
			r.cells.set(a.applicantName, (r.cells.get(a.applicantName) ?? 0) + 1);
			r.total += 1;
			colTotals.set(a.applicantName, (colTotals.get(a.applicantName) ?? 0) + 1);
		}

		return { teachers, students, rows, colTotals };
	});

	// 매트릭스 셀의 최댓값 (히트맵 강도 정규화에 사용)
	const maxCellValue = $derived.by(() => {
		let max = 0;
		for (const r of matrix.rows) {
			for (const v of r.cells.values()) if (v > max) max = v;
		}
		return max || 1;
	});

	// 과목 lookup 테이블 (매트릭스 행/열 헤더에서 빠르게 조회)
	const teacherSubjectMap = $derived.by(() => {
		const m = new Map<string, string>();
		for (const t of teacherCounts) m.set(t.name, t.subject);
		return m;
	});
	const studentSubjectMap = $derived.by(() => {
		const m = new Map<string, string>();
		for (const s of studentCounts) m.set(s.name, s.subject);
		return m;
	});

	// ---------- 요약 ----------
	const summary = $derived({
		total: apps.length,
		teachers: teacherCounts.length,
		students: studentCounts.length
	});

	// ---------- 셀 클릭 → 상세 ----------
	// portal로 옮긴 DOM에서는 $derived.by 의 반응성 추적이 끊기는 경우가 있어
	// $state + 명시적 할당 패턴으로 변경하여 안정성 확보
	let detailItems = $state<AppDoc[]>([]);

	function openDetail(teacher: string, student: string, count: number) {
		if (count === 0) return;
		selectedTeacher = teacher;
		selectedStudent = student;
		detailItems = apps
			.filter((a) => a.teacher === teacher && a.applicantName === student)
			.sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period);
	}

	function closeDetail() {
		selectedTeacher = null;
		selectedStudent = null;
		detailItems = [];
	}

	// 개별 신청 삭제 (관리자 권한)
	let deletingId = $state<string | null>(null);

	async function deleteApplication(item: AppDoc) {
		const confirmMsg = `이 신청을 삭제하시겠습니까?\n\n${item.date} ${item.period}교시 ${item.subject} (${item.classId})\n대상 교사: ${item.teacher}\n신청자: ${item.applicantName}\n\n이 작업은 되돌릴 수 없습니다.`;
		if (!confirm(confirmMsg)) return;

		deletingId = item.id;
		try {
			await deleteDoc(doc(db, 'observation_applications', item.id));
			// 로컬 상태 갱신 (매트릭스 / 막대 / 모달 카운트 모두 자동 반영)
			apps = apps.filter((a) => a.id !== item.id);
			detailItems = detailItems.filter((d) => d.id !== item.id);
			// 모든 항목이 삭제되었으면 모달 자동 닫기
			if (detailItems.length === 0) {
				closeDetail();
			}
		} catch (e: any) {
			console.error('Delete application error:', e);
			alert('삭제 실패: ' + (e?.message || '알 수 없는 오류'));
		} finally {
			deletingId = null;
		}
	}

	// ---------- 행 헤더(교사 이름) 클릭 → 그 교사에게 신청한 실습생 분포 막대 그래프 ----------
	let selectedRowTeacher = $state<string | null>(null);
	let teacherDistribution = $state<Array<{ name: string; subject: string; count: number }>>([]);

	function openTeacherDistribution(teacher: string) {
		selectedRowTeacher = teacher;
		const m = new Map<string, { count: number; subject: string }>();
		for (const a of apps) {
			if (a.teacher !== teacher) continue;
			const cur = m.get(a.applicantName) ?? { count: 0, subject: a.applicantSubject ?? '' };
			cur.count += 1;
			if (!cur.subject && a.applicantSubject) cur.subject = a.applicantSubject;
			m.set(a.applicantName, cur);
		}
		teacherDistribution = [...m.entries()]
			.map(([name, v]) => ({ name, count: v.count, subject: v.subject }))
			.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'));
	}

	function closeTeacherDistribution() {
		selectedRowTeacher = null;
		teacherDistribution = [];
	}

	// 히트맵 셀 색상 (count → HSL alpha)
	function cellColor(count: number) {
		if (count === 0) return 'transparent';
		const intensity = count / maxCellValue; // 0~1
		// 베이스 컬러: var(--header-bg) 계열의 짙은 남색을 알파로 흐리게 적용
		const alpha = 0.15 + intensity * 0.65; // 0.15 ~ 0.80
		return `rgba(46, 53, 110, ${alpha})`;
	}

	function cellTextColor(count: number) {
		if (count === 0) return '#cbd5e1';
		const intensity = count / maxCellValue;
		return intensity > 0.5 ? '#fff' : '#1e293b';
	}

	function maxBar(arr: { count: number }[]) {
		return arr.length ? Math.max(...arr.map((x) => x.count)) : 1;
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
				<BarChart3 size={32} />
				<h1>참관 신청 통계</h1>
			</div>
			<p class="header-desc">
				승인된 신청만 집계합니다 (전체 기간).
				{#if lastFetched}
					<span class="last-fetched">
						· 최근 새로고침: {lastFetched.toLocaleString('ko-KR')}
					</span>
				{/if}
			</p>

			<div class="header-actions">
				<a href="/admin" class="btn-back">
					<ArrowLeft size={16} /> 관리자 페이지
				</a>
				<button class="btn-refresh" onclick={fetchApprovedApps} disabled={loading}>
					<RefreshCw size={16} class={loading ? 'spin' : ''} />
					{loading ? '불러오는 중...' : '새로고침'}
				</button>
			</div>
		</header>

		{#if errorMsg}
			<div class="error-banner card">
				<AlertCircle size={18} /> {errorMsg}
			</div>
		{/if}

		{#if loading && apps.length === 0}
			<div class="loading card">통계 데이터를 불러오는 중...</div>
		{:else if apps.length === 0}
			<div class="empty card">
				<p>승인된 참관 신청이 아직 없습니다.</p>
			</div>
		{:else}
			<!-- 요약 카드 -->
			<section class="summary-row">
				<div class="summary-card card">
					<BarChart3 size={20} />
					<div>
						<div class="summary-label">총 승인 신청</div>
						<div class="summary-value">{summary.total}<span class="unit">건</span></div>
					</div>
				</div>
				<div class="summary-card card">
					<GraduationCap size={20} />
					<div>
						<div class="summary-label">신청 받은 교사</div>
						<div class="summary-value">{summary.teachers}<span class="unit">명</span></div>
					</div>
				</div>
				<div class="summary-card card">
					<Users size={20} />
					<div>
						<div class="summary-label">신청한 실습생</div>
						<div class="summary-value">{summary.students}<span class="unit">명</span></div>
					</div>
				</div>
			</section>

			<!-- 교사별 / 실습생별 막대 차트 -->
			<section class="bar-section card">
				<div class="section-header">
					<GraduationCap size={20} />
					<h3>교사별 받은 신청 수 (많은 순)</h3>
				</div>
				<div class="bar-list">
					{#each teacherCounts as t (t.name)}
						{@const max = maxBar(teacherCounts)}
						<div class="bar-row">
							<div class="bar-label">{t.name}</div>
							<div class="bar-track">
								<div class="bar-fill teacher" style="width: {(t.count / max) * 100}%"></div>
							</div>
							<div class="bar-count">{t.count}</div>
						</div>
					{/each}
				</div>
			</section>

			<section class="bar-section card">
				<div class="section-header">
					<Users size={20} />
					<h3>실습생별 신청 수 (많은 순)</h3>
				</div>
				<div class="bar-list">
					{#each studentCounts as s (s.name)}
						{@const max = maxBar(studentCounts)}
						<div class="bar-row">
							<div class="bar-label">
								{s.name}
								{#if s.subject}<span class="subject-tag">{s.subject}</span>{/if}
							</div>
							<div class="bar-track">
								<div class="bar-fill student" style="width: {(s.count / max) * 100}%"></div>
							</div>
							<div class="bar-count">{s.count}</div>
						</div>
					{/each}
				</div>
			</section>

			<!-- 매트릭스 -->
			<section class="matrix-section card">
				<div class="section-header">
					<Grid3x3 size={20} />
					<h3>교사 × 실습생 매트릭스 (교사명 / 셀 클릭 → 상세)</h3>
				</div>
				<div class="matrix-scroll">
					<table class="matrix-table">
						<thead>
							<tr>
								<th class="corner">교사 \ 실습생</th>
								{#each matrix.students as st}
									{@const stSubj = studentSubjectMap.get(st) ?? ''}
									<th class="col-header" title={stSubj ? `${stSubj} · ${st}` : st}>
										{#if stSubj}
											<span class="col-subject">{stSubj}</span>
										{/if}
										<span class="col-name">{st}</span>
									</th>
								{/each}
								<th class="row-total-header">합계</th>
							</tr>
						</thead>
						<tbody>
							{#each matrix.rows as r (r.teacher)}
								{@const tSubj = teacherSubjectMap.get(r.teacher) ?? ''}
								<tr>
									<th
										class="row-header clickable"
										onclick={() => openTeacherDistribution(r.teacher)}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												openTeacherDistribution(r.teacher);
											}
										}}
										role="button"
										tabindex="0"
										title="{r.teacher} 선생님께 신청한 실습생 분포 보기"
									>
										{#if tSubj}
											<span class="row-subject">{tSubj}</span>
										{/if}
										<span class="row-name">{r.teacher}</span>
									</th>
									{#each matrix.students as st}
										{@const v = r.cells.get(st) ?? 0}
										<td
											class="cell"
											class:zero={v === 0}
											style="background: {cellColor(v)}; color: {cellTextColor(v)}"
											onclick={() => openDetail(r.teacher, st, v)}
											onkeydown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													openDetail(r.teacher, st, v);
												}
											}}
											role={v > 0 ? 'button' : undefined}
											tabindex={v > 0 ? 0 : -1}
											title={v > 0 ? `${r.teacher} ← ${st}: ${v}건` : ''}
										>
											{v > 0 ? v : ''}
										</td>
									{/each}
									<td class="row-total">{r.total}</td>
								</tr>
							{/each}
							<tr class="footer-row">
								<th class="row-header">합계</th>
								{#each matrix.students as st}
									<td class="col-total">{matrix.colTotals.get(st) ?? 0}</td>
								{/each}
								<td class="grand-total">{summary.total}</td>
							</tr>
						</tbody>
					</table>
				</div>
			</section>
		{/if}
	{/if}
</div>

<!-- 교사 분포 모달: 교사명 클릭 시 그 교사에게 신청한 실습생 분포 막대 -->
{#if selectedRowTeacher}
	<div
		class="modal-overlay"
		onclick={closeTeacherDistribution}
		onkeydown={(e) => e.key === 'Escape' && closeTeacherDistribution()}
		role="presentation"
	>
		<div
			class="modal-content"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			tabindex="-1"
		>
			<div class="modal-header">
				<h3>
					<span class="modal-pair">{selectedRowTeacher} 선생님 신청 실습생</span>
					<span class="modal-count">{teacherDistribution.length}명</span>
				</h3>
				<button class="btn-close" onclick={closeTeacherDistribution} aria-label="닫기">
					<X size={20} />
				</button>
			</div>
			<div class="modal-body distribution-body">
				{#if teacherDistribution.length === 0}
					<div class="empty-distribution">신청 내역이 없습니다.</div>
				{:else}
					{@const max = Math.max(...teacherDistribution.map((s) => s.count))}
					<div class="bar-list distribution-bars">
						{#each teacherDistribution as s (s.name)}
							<div class="bar-row">
								<div class="bar-label">
									{s.name}
									{#if s.subject}<span class="subject-tag">{s.subject}</span>{/if}
								</div>
								<div class="bar-track">
									<div class="bar-fill student" style="width: {(s.count / max) * 100}%"></div>
								</div>
								<div class="bar-count">{s.count}</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- 상세 모달 (.container 외부에 배치하여 부모 stacking context의 영향을 받지 않음) -->
{#if selectedTeacher && selectedStudent}
	<div
		class="modal-overlay"
		onclick={closeDetail}
		onkeydown={(e) => e.key === 'Escape' && closeDetail()}
		role="presentation"
	>
		<div
			class="modal-content"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			tabindex="-1"
		>
			<div class="modal-header">
				<h3>
					<span class="modal-pair">{selectedTeacher} ← {selectedStudent}</span>
					<span class="modal-count">{detailItems.length}건</span>
				</h3>
				<button class="btn-close" onclick={closeDetail} aria-label="닫기">
					<X size={20} />
				</button>
			</div>
			<div class="modal-body">
				<table class="detail-table">
					<thead>
						<tr>
							<th>날짜</th>
							<th>교시</th>
							<th>과목</th>
							<th>학급</th>
							<th class="action-col">관리</th>
						</tr>
					</thead>
					<tbody>
						{#each detailItems as item (item.id)}
							<tr>
								<td>{item.date}</td>
								<td>{item.period}교시</td>
								<td>{item.subject}</td>
								<td>{item.classId}</td>
								<td class="action-cell">
									<button
										class="btn-delete-row"
										onclick={() => deleteApplication(item)}
										disabled={deletingId === item.id}
										title="이 신청을 삭제합니다 (되돌릴 수 없음)"
										aria-label="신청 삭제"
									>
										<Trash2 size={14} />
										{deletingId === item.id ? '삭제 중...' : '삭제'}
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>
{/if}

<style>
	.container {
		max-width: 1280px;
		margin: 0 auto;
		padding: 1.5rem;
		word-break: keep-all;
		overflow-wrap: break-word;
	}

	/* 헤더 */
	.admin-header {
		margin-bottom: 1.5rem;
	}
	.title-group {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		color: var(--header-bg);
		margin-bottom: 0.4rem;
	}
	.title-group h1 {
		margin: 0;
		font-size: 1.8rem;
		font-weight: 900;
	}
	.header-desc {
		margin: 0 0 0.8rem 0;
		color: #475569;
		font-size: 0.9rem;
	}
	.last-fetched {
		color: #94a3b8;
	}
	.header-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.btn-back,
	.btn-refresh {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.5rem 1rem;
		border-radius: 8px;
		font-weight: 700;
		font-size: 0.9rem;
		text-decoration: none;
		border: 2px solid #e2e8f0;
		background: white;
		color: #334155;
		cursor: pointer;
		transition: all 0.15s;
	}
	.btn-back:hover {
		background: #f1f5f9;
	}
	.btn-refresh {
		background: var(--header-bg);
		color: white;
		border-color: var(--header-bg);
	}
	.btn-refresh:hover:not(:disabled) {
		background: #1e255a;
	}
	.btn-refresh:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	:global(.spin) {
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* 카드 공통 */
	.card {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		padding: 1.2rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	}
	.error-banner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #b91c1c;
		border-color: #fca5a5;
		background: #fef2f2;
		margin-bottom: 1rem;
	}
	.loading,
	.empty {
		text-align: center;
		color: #64748b;
		padding: 2rem;
	}
	.error-state {
		text-align: center;
		padding: 3rem 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.8rem;
	}

	/* 요약 카드 */
	.summary-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-bottom: 1.2rem;
	}
	.summary-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		color: var(--header-bg);
	}
	.summary-label {
		font-size: 0.85rem;
		color: #64748b;
		font-weight: 600;
	}
	.summary-value {
		font-size: 1.8rem;
		font-weight: 900;
		color: var(--header-bg);
	}
	.summary-value .unit {
		font-size: 0.95rem;
		font-weight: 700;
		color: #64748b;
		margin-left: 0.2rem;
	}

	/* 섹션 헤더 */
	.section-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		color: var(--header-bg);
		border-bottom: 2px solid #eee; /* 0.8pt 느낌 */
		padding-bottom: 0.6rem;
	}
	.section-header h3 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 800;
	}

	.bar-section {
		margin-bottom: 1.2rem;
	}

	/* 막대 차트 */
	.bar-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.bar-row {
		display: grid;
		grid-template-columns: 140px 1fr 50px;
		align-items: center;
		gap: 0.6rem;
	}
	.bar-label {
		font-size: 0.9rem;
		font-weight: 700;
		color: #1e293b;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.subject-tag {
		display: inline-block;
		font-size: 0.7rem;
		font-weight: 700;
		padding: 0.1rem 0.4rem;
		border-radius: 999px;
		background: #f1f5f9;
		color: #475569;
	}
	.bar-track {
		height: 16px;
		background: #f1f5f9;
		border-radius: 4px;
		overflow: hidden;
		position: relative;
	}
	.bar-fill {
		height: 100%;
		border-radius: 4px;
		transition: width 0.3s ease-out;
	}
	.bar-fill.teacher {
		background: linear-gradient(90deg, var(--header-bg), #4f5dbb);
	}
	.bar-fill.student {
		background: linear-gradient(90deg, #0891b2, #22d3ee);
	}
	.bar-count {
		font-size: 0.95rem;
		font-weight: 800;
		color: #0f172a;
		text-align: right;
	}

	/* 매트릭스 */
	.matrix-section {
		margin-bottom: 1.2rem;
	}
	.matrix-scroll {
		overflow-x: auto;
		max-width: 100%;
	}
	.matrix-table {
		border-collapse: separate;
		border-spacing: 0;
		font-size: 0.85rem;
		min-width: 100%;
		/* 기본 라인 0.4pt 느낌 (CSS 1px 가 가장 가까움) */
	}
	.matrix-table th,
	.matrix-table td {
		border: 1px solid #e2e8f0; /* 기본 라인 */
		padding: 0.4rem 0.5rem;
		text-align: center;
		min-width: 38px;
		white-space: nowrap;
	}
	.matrix-table thead th {
		background: var(--header-bg);
		color: white;
		font-weight: 700;
		font-size: 0.8rem;
		border-color: #1e255a;
		position: sticky;
		top: 0;
	}
	.matrix-table thead .corner {
		border-top-left-radius: 8px; /* 헤더 셀 위쪽 코너 라운드 */
		text-align: left;
		min-width: 140px;
	}
	.matrix-table thead .col-header {
		writing-mode: horizontal-tb;
		max-width: 80px;
		overflow: hidden;
		text-overflow: ellipsis;
		padding: 0.35rem 0.4rem;
	}
	/* 실습생 헤더: 과목(위) + 이름(아래) 두 줄 */
	.col-subject {
		display: block;
		font-size: 0.65rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.65);
		margin-bottom: 0.15rem;
		letter-spacing: -0.02em;
	}
	.col-name {
		display: block;
		font-size: 0.8rem;
	}
	/* 교사 헤더: 과목(왼쪽 고정폭) + 이름(오른쪽) 가로 배치
	   과목명 글자 수가 달라도 이름이 항상 같은 위치에서 시작하도록 width 고정 */
	.row-subject {
		display: inline-block;
		width: 56px;
		box-sizing: border-box;
		font-size: 0.7rem;
		font-weight: 700;
		padding: 0.1rem 0.3rem;
		margin-right: 0.5rem;
		border-radius: 999px;
		background: #e2e8f0;
		color: #475569;
		text-align: center;
		white-space: nowrap;
		vertical-align: middle;
	}
	.row-name {
		vertical-align: middle;
	}
	/* row-header 자체도 col-header와의 정렬을 위해 padding 고정 */
	.matrix-table tbody .row-header {
		padding-left: 0.6rem;
	}
	.matrix-table thead .row-total-header {
		border-top-right-radius: 8px; /* 헤더 셀 위쪽 코너 라운드 */
		background: #1e255a;
	}
	.row-header {
		background: #f8fafc;
		text-align: left !important;
		font-weight: 800;
		color: var(--header-bg);
		position: sticky;
		left: 0;
		min-width: 140px;
		z-index: 1;
	}
	.row-header.clickable {
		cursor: pointer;
		user-select: none;
		transition: background 0.12s;
	}
	.row-header.clickable:hover {
		background: #e0e7ff;
	}
	.row-header.clickable:focus-visible {
		outline: 2px solid var(--header-bg);
		outline-offset: -2px;
	}
	.cell {
		font-weight: 700;
		cursor: pointer;
		transition: filter 0.1s;
		user-select: none;
	}
	.cell:not(.zero):hover {
		filter: brightness(1.1);
		outline: 2px solid var(--header-bg);
		outline-offset: -2px;
	}
	.cell.zero {
		cursor: default;
	}
	.row-total {
		background: #f1f5f9;
		font-weight: 800;
		color: var(--header-bg);
		border-left: 2px solid #cbd5e1; /* 섹션 구분 라인 (0.8pt 느낌) */
	}
	.footer-row td,
	.footer-row th {
		background: #f1f5f9;
		font-weight: 800;
		color: var(--header-bg);
		border-top: 2px solid #cbd5e1; /* 섹션 구분 라인 */
	}
	.grand-total {
		background: var(--header-bg) !important;
		color: white !important;
	}

	/* 상세 모달 (.container 외부 배치 + 강한 z-index + isolation 으로 stacking context 격리) */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: rgba(15, 23, 42, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		isolation: isolate;
		padding: 1rem;
		word-break: keep-all;
	}
	.modal-content {
		background: white;
		border-radius: 12px;
		width: 100%;
		max-width: 560px;
		max-height: 80vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.2rem;
		border-bottom: 2px solid #e2e8f0;
		background: var(--header-bg);
		color: white;
	}
	.modal-header h3 {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 1rem;
	}
	.modal-pair {
		font-weight: 800;
	}
	.modal-count {
		font-size: 0.8rem;
		font-weight: 700;
		background: rgba(255, 255, 255, 0.2);
		padding: 0.15rem 0.6rem;
		border-radius: 999px;
	}
	.btn-close {
		background: transparent;
		border: none;
		color: white;
		cursor: pointer;
		padding: 0.3rem;
		border-radius: 6px;
		display: flex;
	}
	.btn-close:hover {
		background: rgba(255, 255, 255, 0.15);
	}
	.modal-body {
		overflow-y: auto;
		padding: 0.5rem 0;
		/* 다크 모드 시스템 설정 영향으로 흰 배경에 흰 글자가 되는 문제 방지 */
		color: #1e293b;
		background: white;
	}
	.modal-body.distribution-body {
		padding: 1rem 1.2rem;
	}
	.distribution-bars {
		gap: 0.45rem;
	}
	.empty-distribution {
		text-align: center;
		color: #64748b;
		padding: 1.5rem;
	}
	.detail-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
		/* 다크 모드 환경에서도 모달은 흰 배경이므로 텍스트는 어두운 색으로 강제 */
		color: #1e293b;
		background: white;
	}
	.detail-table th,
	.detail-table td {
		padding: 0.5rem 1rem;
		text-align: left;
		border-bottom: 1px solid #f1f5f9;
		color: #1e293b;
	}
	.detail-table thead th {
		background: #f8fafc;
		color: var(--header-bg);
		font-weight: 700;
		font-size: 0.85rem;
	}
	.detail-table .action-col {
		width: 90px;
		text-align: center;
	}
	.detail-table .action-cell {
		text-align: center;
		padding: 0.4rem;
	}
	.btn-delete-row {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem 0.6rem;
		font-size: 0.8rem;
		font-weight: 700;
		background: #fef2f2;
		color: #b91c1c;
		border: 1px solid #fca5a5;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s;
		white-space: nowrap;
	}
	.btn-delete-row:hover:not(:disabled) {
		background: #ef4444;
		color: white;
		border-color: #ef4444;
	}
	.btn-delete-row:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* 반응형 */
	@media (max-width: 768px) {
		.container {
			padding: 1rem;
		}
		.title-group h1 {
			font-size: 1.5rem;
		}
		.bar-row {
			grid-template-columns: 100px 1fr 40px;
			gap: 0.4rem;
		}
		.bar-label {
			font-size: 0.8rem;
		}
		.summary-value {
			font-size: 1.4rem;
		}
	}
</style>
