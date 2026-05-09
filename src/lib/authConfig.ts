export const ALLOWED_DOMAINS = ['snu-g.ms.kr', 'snu.ms.kr', 'snu.hs.kr'] as const;

export function isAllowedDomain(email: string | null | undefined): boolean {
	if (!email) return false;
	const at = email.lastIndexOf('@');
	if (at < 0) return false;
	const domain = email.slice(at + 1).toLowerCase();
	return (ALLOWED_DOMAINS as readonly string[]).includes(domain);
}

export const ALLOWED_DOMAINS_DISPLAY = ALLOWED_DOMAINS.map((d) => `@${d}`).join(', ');
