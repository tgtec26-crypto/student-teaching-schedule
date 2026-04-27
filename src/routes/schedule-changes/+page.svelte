<script lang="ts">
	import { timetableData, scheduleOverrides } from '$lib/timetableData';
	import { Replace, ArrowRight, ArrowLeft, CalendarRange } from 'lucide-svelte';

	type ChangeRow = {
		date: string;
		classId: string;
		period: string;
		fromTeacher: string;
		fromSubject: string;
		toTeacher: string;
		toSubject: string;
	};

	const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

	const subjectColors: Record<string, string> = {
		국어: '#fecaca', 한문: '#fecaca', 수학: '#bbf7d0', 도덕: '#e9d5ff', 사회: '#e9d5ff',
		역사: '#e9d5ff', 과학: '#fef08a', 물리: '#fef08a', 화학: '#fef08a', 생명: '#fef08a',
		지구: '#fef08a', 영어: '#bfdbfe', 기가: '#e2e8f0', 기술: '#e2e8f0', 가정: '#e2e8f0',
		체육: '#fed7aa', 음악: '#deb887', 미술: '#fbcfe8', 진로: '#f3e8ff', 정보: '#a7f3d0',
		스포츠: '#cffafe'
	};

	function getSubjectColor(s: string) {
		if (!s) return '#f3f4f6';
		return subjectColors[s.substring(0, 2)] || '#f3f4f6';
	}

	function formatDate(d: string) {
		const dt = new Date(d);
		const month = parseInt(d.split('-')[1]);
		const day = parseInt(d.split('-')[2]);
		return `${month}/${day}(${weekDays[dt.getDay()]})`;
	}

	function classLabel(cid: string) {
		return `${cid[0]}-${parseInt(cid.substring(2))}반`;
	}

	function getBaseSlot(classId: string, dateStr: string, period: string) {
		const day = new Date(dateStr).getDay();
		return timetableData[classId]?.[`2026-05-${10 + day}`]?.[period];
	}

	const changes: ChangeRow[] = [];
	for (const [classId, dates] of Object.entries(scheduleOverrides)) {
		for (const [date, periods] of Object.entries(dates)) {
			for (const [period, slot] of Object.entries(periods)) {
				const base = getBaseSlot(classId, date, period);
				if (!base) continue;
				if (base.teacher === slot.teacher && base.subject === slot.subject) continue;
				changes.push({
					date,
					classId,
					period,
					fromTeacher: base.teacher,
					fromSubject: base.subject,
					toTeacher: slot.teacher,
					toSubject: slot.subject
				});
			}
		}
	}

	changes.sort((a, b) => {
		if (a.date !== b.date) return a.date.localeCompare(b.date);
		if (a.classId !== b.classId) return a.classId.localeCompare(b.classId);
		return parseInt(a.period) - parseInt(b.period);
	});

	const groupedByDate = changes.reduce<Record<string, ChangeRow[]>>((acc, row) => {
		(acc[row.date] ||= []).push(row);
		return acc;
	}, {});
	const sortedDates = Object.keys(groupedByDate).sort();
</script>

<div class="page-wrap">
	<header class="page-header">
		<div class="title-row">
			<Replace size={26} />
			<h1>시간표 변동 현황</h1>
		</div>
		<p class="desc">참관 기간 중 협의된 시간표 변경 내역입니다. 아래 내용 외의 시간표는 기존 그대로 유지됩니다.</p>
		<a href="/" class="btn-back"><ArrowLeft size={16} /> 메인으로</a>
	</header>

	{#if changes.length === 0}
		<div class="empty">
			<CalendarRange size={32} />
			<p>등록된 시간표 변동이 없습니다.</p>
		</div>
	{:else}
		<div class="summary-card">
			<span class="summary-num">{changes.length}</span>
			<span class="summary-text">건의 변동 내역</span>
			<span class="summary-sub">· {sortedDates.length}일에 걸쳐 적용</span>
		</div>

		<div class="table-card">
			<table class="changes-table">
				<thead>
					<tr>
						<th class="th-date">날짜</th>
						<th class="th-class">학급</th>
						<th class="th-period">교시</th>
						<th class="th-from">변경 전</th>
						<th class="th-arrow"></th>
						<th class="th-to">변경 후</th>
					</tr>
				</thead>
				<tbody>
					{#each sortedDates as date}
						{#each groupedByDate[date] as row, i}
							<tr class={i === 0 ? 'date-start' : ''}>
								{#if i === 0}
									<td class="cell-date" rowspan={groupedByDate[date].length}>
										{formatDate(date)}
									</td>
								{/if}
								<td class="cell-class">{classLabel(row.classId)}</td>
								<td class="cell-period">{row.period}교시</td>
								<td class="cell-from">
									<span class="teacher-old">{row.fromTeacher}</span>
									<span class="subj-old" style="background-color: {getSubjectColor(row.fromSubject)}">{row.fromSubject}</span>
								</td>
								<td class="cell-arrow"><ArrowRight size={16} /></td>
								<td class="cell-to">
									<span class="teacher-new">{row.toTeacher}</span>
									<span class="subj-new" style="background-color: {getSubjectColor(row.toSubject)}">{row.toSubject}</span>
								</td>
							</tr>
						{/each}
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.page-wrap {
		max-width: 900px;
		margin: 0 auto;
		padding: 1.2rem 1rem 3rem;
		word-break: keep-all;
		overflow-wrap: break-word;
	}

	.page-header {
		position: relative;
		text-align: center;
		margin-bottom: 1.2rem;
	}

	.title-row {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--header-bg, #283151);
	}

	h1 {
		margin: 0;
		font-size: 1.55rem;
		font-weight: 900;
		letter-spacing: -0.02em;
	}

	.desc {
		margin: 0.6rem auto 0;
		max-width: 640px;
		font-size: 0.92rem;
		color: #475569;
		line-height: 1.5;
	}

	.btn-back {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.82rem;
		font-weight: 700;
		text-decoration: none;
		color: #475569;
		background: #f1f5f9;
		padding: 0.32rem 0.7rem;
		border-radius: 50px;
		margin-top: 0.7rem;
		transition: background 0.15s;
	}
	.btn-back:hover { background: #e2e8f0; }

	.summary-card {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		justify-content: center;
		flex-wrap: wrap;
		background: linear-gradient(135deg, #e0f2fe, #f0f9ff);
		border: 1px solid #bae6fd;
		border-radius: 10px;
		padding: 0.7rem 1.2rem;
		margin: 0 auto 1rem;
		max-width: 480px;
	}
	.summary-num {
		font-size: 1.7rem;
		font-weight: 900;
		color: #0369a1;
		line-height: 1;
	}
	.summary-text {
		font-size: 0.95rem;
		font-weight: 700;
		color: #0f172a;
	}
	.summary-sub {
		font-size: 0.82rem;
		color: #475569;
	}

	.empty {
		text-align: center;
		padding: 3rem 1rem;
		color: #64748b;
	}
	.empty p { margin: 0.6rem 0 0; }

	.table-card {
		background: white;
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid #e2e8f0;
		box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
	}

	.changes-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.changes-table thead {
		background: #283151;
		color: white;
	}
	.changes-table th {
		padding: 0.6rem 0.5rem;
		font-weight: 800;
		font-size: 0.85rem;
		text-align: center;
		border-right: 0.4pt solid rgba(255,255,255,0.15);
	}
	.changes-table th:first-child { border-top-left-radius: 12px; }
	.changes-table th:last-child  { border-top-right-radius: 12px; border-right: none; }

	.changes-table td {
		padding: 0.55rem 0.5rem;
		text-align: center;
		border-top: 0.4pt solid #e2e8f0;
		border-right: 0.4pt solid #e2e8f0;
		vertical-align: middle;
	}
	.changes-table td:last-child { border-right: none; }

	tr.date-start td { border-top: 0.8pt solid #cbd5e1; }
	tbody tr:first-child td { border-top: none; }

	.cell-date {
		background: #f8fafc;
		font-weight: 800;
		color: #0f172a;
		font-size: 0.92rem;
		min-width: 78px;
	}

	.cell-class {
		font-weight: 700;
		color: #1e293b;
	}

	.cell-period {
		font-weight: 600;
		color: #475569;
	}

	.cell-from, .cell-to {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		min-width: 110px;
	}
	.teacher-old, .teacher-new {
		font-weight: 800;
		font-size: 0.95rem;
	}
	.teacher-old { color: #94a3b8; text-decoration: line-through; text-decoration-color: #cbd5e1; }
	.teacher-new { color: #0369a1; }

	.subj-old, .subj-new {
		font-size: 0.78rem;
		font-weight: 800;
		padding: 0.1rem 0.55rem;
		border-radius: 50px;
		color: #1e293b;
	}

	.cell-arrow {
		color: #94a3b8;
		min-width: 24px;
	}

	@media (max-width: 600px) {
		.page-wrap { padding: 0.8rem 0.5rem 2rem; }
		h1 { font-size: 1.2rem; }
		.desc { font-size: 0.82rem; }

		.changes-table { font-size: 0.78rem; }
		.changes-table th { padding: 0.45rem 0.25rem; font-size: 0.74rem; }
		.changes-table td { padding: 0.4rem 0.25rem; }
		.cell-date { font-size: 0.78rem; min-width: 56px; }
		.teacher-old, .teacher-new { font-size: 0.82rem; }
		.subj-old, .subj-new { font-size: 0.66rem; padding: 0.05rem 0.35rem; }
		.cell-from, .cell-to { min-width: 70px; }
		.cell-arrow :global(svg) { width: 12px; height: 12px; }
	}

	@media (prefers-color-scheme: dark) {
		.desc { color: #cbd5e1; }
		.btn-back { background: rgba(255,255,255,0.08); color: #e2e8f0; }
		.btn-back:hover { background: rgba(255,255,255,0.15); }
		.title-row { color: #e0f2fe; }
		.summary-card {
			background: linear-gradient(135deg, rgba(56,189,248,0.18), rgba(56,189,248,0.08));
			border-color: rgba(56,189,248,0.3);
		}
		.summary-num { color: #7dd3fc; }
		.summary-text { color: #f8fafc; }
		.summary-sub { color: #cbd5e1; }
		.table-card { background: #1e293b; border-color: rgba(255,255,255,0.08); }
		.changes-table td { border-color: rgba(255,255,255,0.08); }
		tr.date-start td { border-top-color: rgba(255,255,255,0.18); }
		.cell-date { background: rgba(255,255,255,0.04); color: #f8fafc; }
		.cell-class { color: #f1f5f9; }
		.cell-period { color: #cbd5e1; }
		.teacher-old { color: #64748b; }
		.teacher-new { color: #ffffff; }
		.subj-old, .subj-new { color: #1e293b; }
	}
</style>
