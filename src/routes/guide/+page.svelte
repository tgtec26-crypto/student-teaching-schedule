<script lang="ts">
	import { BookOpen, Calendar, Clock, AlertCircle, UserCheck, Users, Lock, CheckCircle2 } from 'lucide-svelte';
	import { isSupervisor, isAdmin, isStudent } from '$lib/firebase';
</script>

<div class="guide-container">
	<div class="guide-card card">
		<header class="guide-header">
			<BookOpen size={32} />
			<h1>시스템 이용 안내 (참고)</h1>
			<p>서울사대부여중 교육실습생 참관 관리 시스템의 주요 규칙과 이용 방법을 안내합니다.</p>
		</header>

		<section class="guide-section">
			<h2><Calendar size={20} /> 실습 및 참관 일정</h2>
			<div class="grid">
				<div class="info-box">
					<h3>실습 전체 기간</h3>
					<p>2026년 5월 4일(월) ~ 5월 29일(금)</p>
				</div>
				<div class="info-box warning">
					<h3>참관 불가일</h3>
					<p>5/4(첫날), 5/5(어린이날), 5/22(학교행사), 5/25(대체휴일), 5/29(마지막날)</p>
					<small>* 해당 날짜는 시스템에서 신청이 차단됩니다.</small>
				</div>
			</div>
		</section>

		<section class="guide-section">
			<h2><Clock size={20} /> 참관 신청 규칙 (실습생)</h2>
			<div class="steps">
				<div class="step">
					<div class="step-num">1</div>
					<div class="step-content">
						<h3>수업일 기준 3일 전 ~ 1일 전 신청</h3>
						<p>주말과 공휴일을 제외한 <strong>순수 수업일</strong> 기준으로 신청 기간이 계산됩니다.</p>
						<ul>
							<li>월요일 수업: 전주 수요일 ~ 전주 금요일 신청</li>
							<li>화요일 수업: 전주 목요일 ~ 해당 주 월요일 신청</li>
						</ul>
					</div>
				</div>
				<div class="step">
					<div class="step-num">2</div>
					<div class="step-content">
						<h3>일과 시간 내 신청 제한 (08:20 ~ 16:20)</h3>
						<p>교사들의 휴식권 보장을 위해 <strong>매일 오전 8시 20분부터 오후 4시 20분 사이</strong>에만 신청 버튼이 활성화됩니다.</p>
						<p class="negative">저녁, 밤, 새벽 시간에는 신청이 불가능합니다.</p>
					</div>
				</div>
				<div class="step">
					<div class="step-num">3</div>
					<div class="step-content">
						<h3>주말 및 공휴일 시스템 폐쇄</h3>
						<p>토요일, 일요일 및 공휴일(5/5, 5/25)에는 시스템을 통한 신청 행위가 일체 금지됩니다.</p>
					</div>
				</div>
			</div>
		</section>

		<section class="guide-section">
			<h2><UserCheck size={20} /> 지도교사 설정 안내</h2>
			<div class="features">
				<div class="feature">
					<CheckCircle2 size={18} class="icon-green" />
					<div>
						<h3>자동 승인 기능</h3>
						<p>지도교사 페이지 상단의 '자동 승인' 버튼을 ON으로 설정하면 실습생의 신청과 동시에 확정됩니다.</p>
						<p><small>* 5월 1주차(5/6~5/8)는 시스템 적응을 위해 전체 교사 <strong>강제 자동 승인</strong> 기간입니다.</small></p>
					</div>
				</div>
				<div class="feature">
					<AlertCircle size={18} class="icon-blue" />
					<div>
						<h3>안내 메시지 설정</h3>
						<p>기본 안내 메시지를 저장하면 모든 참관 학생에게 공통 전달되며, 수업별로 개별 메시지를 남길 수도 있습니다.</p>
					</div>
				</div>
				<div class="feature">
					<Lock size={18} class="icon-red" />
					<div>
						<h3>참관 차단</h3>
						<p>부득이하게 참관이 어려운 특정 교시가 있다면 해당 슬롯을 클릭하여 '차단' 상태로 변경할 수 있습니다.</p>
					</div>
				</div>
			</div>
		</section>

		<div class="guide-footer">
			<a href="/" class="btn-primary">이해했습니다. 메인으로 돌아가기</a>
		</div>
	</div>
</div>

<style>
	.guide-container { padding: 2rem 1.5rem; max-width: 900px; margin: 0 auto; }
	.guide-card { padding: 3rem; background: white; border-radius: 24px; }
	.guide-header { text-align: center; margin-bottom: 3rem; color: #1e293b; }
	.guide-header h1 { font-size: 2.2rem; font-weight: 900; margin: 1rem 0; letter-spacing: -0.02em; }
	.guide-header p { font-size: 1.1rem; color: #64748b; font-weight: 500; }

	.guide-section { margin-bottom: 3rem; }
	.guide-section h2 { display: flex; align-items: center; gap: 0.6rem; font-size: 1.4rem; font-weight: 800; color: #283151; margin-bottom: 1.5rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.8rem; }
	
	.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
	.info-box { padding: 1.2rem; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; }
	.info-box h3 { font-size: 1rem; font-weight: 800; margin-bottom: 0.5rem; color: #1e293b; }
	.info-box p { font-size: 0.95rem; color: #475569; font-weight: 600; margin: 0; }
	.info-box.warning { background: #fff1f2; border-color: #fecdd3; }
	.info-box.warning h3 { color: #be123c; }
	.info-box.warning p { color: #e11d48; }

	.steps { display: flex; flex-direction: column; gap: 1.2rem; }
	.step { display: flex; gap: 1.2rem; background: #fdfbf2; padding: 1.5rem; border-radius: 16px; border: 1px solid #fef08a; }
	.step-num { background: #283151; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.9rem; flex-shrink: 0; }
	.step-content h3 { font-size: 1.1rem; font-weight: 800; color: #1e293b; margin: 0 0 0.5rem 0; }
	.step-content p { font-size: 0.95rem; color: #475569; margin: 0 0 0.5rem 0; line-height: 1.5; }
	.step-content ul { margin: 0.5rem 0 0 0; padding-left: 1.2rem; color: #64748b; font-size: 0.9rem; font-weight: 600; }
	.negative { color: #e11d48 !important; font-weight: 700; }

	.features { display: flex; flex-direction: column; gap: 1rem; }
	.feature { display: flex; gap: 1rem; padding: 1.2rem; background: white; border: 1px solid #e2e8f0; border-radius: 12px; transition: all 0.2s; }
	.feature:hover { border-color: #cbd5e1; transform: translateX(5px); }
	.feature h3 { font-size: 1rem; font-weight: 800; margin: 0 0 0.3rem 0; }
	.feature p { font-size: 0.9rem; color: #64748b; margin: 0; line-height: 1.4; font-weight: 600; }
	
	.icon-green { color: #22c55e; }
	.icon-blue { color: #3b82f6; }
	.icon-red { color: #ef4444; }

	.guide-footer { text-align: center; margin-top: 4rem; }
	.btn-primary { background: #283151; color: white; padding: 1rem 2rem; border-radius: 50px; font-weight: 800; text-decoration: none; font-size: 1.1rem; transition: all 0.2s; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
	.btn-primary:hover { background: #1e293b; transform: translateY(-3px); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2); }

	@media (max-width: 640px) {
		.grid { grid-template-columns: 1fr; }
		.guide-card { padding: 1.5rem; }
		.guide-header h1 { font-size: 1.8rem; }
	}
</style>
