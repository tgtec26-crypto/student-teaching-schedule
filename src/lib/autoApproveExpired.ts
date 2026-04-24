import { db } from './firebase';
import { doc, runTransaction } from 'firebase/firestore';
import { teacherWebhooks } from './teacherWebhooks';

const GAS_NOTIFY_URL =
	'https://script.google.com/macros/s/AKfycby2kNaGAvgtD36spyTvTlsxwWpFKow5QjiPrIuhJJDUZuLaBxr8iagIzTYhhCnUHORg/exec';
const AUTO_APPROVE_AFTER_MS = 24 * 60 * 60 * 1000;

const processingIds = new Set<string>();

type AppRecord = {
	id: string;
	status?: string;
	timestamp?: { toMillis?: () => number } | null;
	teacher?: string;
	applicantName?: string;
	applicantEmail?: string;
	date?: string;
	period?: string;
	subject?: string;
};

export async function autoApproveExpiredApplications(apps: AppRecord[]): Promise<void> {
	const now = Date.now();
	const candidates = apps.filter((app) => {
		if (app.status !== 'PENDING') return false;
		if (processingIds.has(app.id)) return false;
		const ms = app.timestamp?.toMillis?.();
		if (typeof ms !== 'number') return false;
		return now - ms >= AUTO_APPROVE_AFTER_MS;
	});

	for (const app of candidates) {
		processingIds.add(app.id);
		try {
			const ref = doc(db, 'observation_applications', app.id);
			const didApprove = await runTransaction(db, async (tx) => {
				const snap = await tx.get(ref);
				if (!snap.exists()) return false;
				const data = snap.data();
				if (data.status !== 'PENDING') return false;
				tx.update(ref, {
					status: 'APPROVED',
					autoApprovedAt: new Date(),
					autoApprovedReason: 'TIMEOUT_24H'
				});
				return true;
			});

			if (!didApprove) continue;

			const teacher = app.teacher || '';
			const webhookUrl = teacherWebhooks[teacher];
			if (webhookUrl) {
				const message = [
					`📢 *참관 신청 자동 승인 알림*`,
					'',
					`• *신청자*: ${app.applicantName || ''}`,
					`• *일시*: ${app.date} ${app.period}교시`,
					`• *결과*: ⏰ *24시간 경과로 자동 승인됨*`
				].join('\n');
				fetch(webhookUrl, {
					method: 'POST',
					mode: 'no-cors',
					body: JSON.stringify({ text: message })
				});
			}

			if (app.applicantEmail) {
				fetch(GAS_NOTIFY_URL, {
					method: 'POST',
					mode: 'no-cors',
					body: JSON.stringify({
						email: app.applicantEmail,
						name: app.applicantName,
						date: app.date,
						period: app.period,
						subject: app.subject,
						teacher: app.teacher,
						status: 'APPROVED'
					})
				});
			}
		} catch (err) {
			console.error('auto-approve failed', app.id, err);
		} finally {
			processingIds.delete(app.id);
		}
	}
}
