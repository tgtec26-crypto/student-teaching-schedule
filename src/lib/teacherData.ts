export const teacherMetadata: Record<string, { name: string; subject: string }> = {
	'7620220@snu-g.ms.kr': { name: '교장 선생님', subject: '' },
	'hellokks@snu-g.ms.kr': { name: '교감 선생님', subject: '' },
	'mismoon32@snu-g.ms.kr': { name: '문인숙', subject: '진로' },
	'bibianna.edu@snu-g.ms.kr': { name: '김민정', subject: '사회' },
	'bohem1223@snu-g.ms.kr': { name: '전태상', subject: '음악' },
	'bomi822@snu-g.ms.kr': { name: '김보미', subject: '한문' },
	'dbwls131@snu-g.ms.kr': { name: '김유진', subject: '국어' },
	'emfrhc@snu-g.ms.kr': { name: '송윤호', subject: '수학' },
	'ghfkd259@snu-g.ms.kr': { name: '서강혁', subject: '정보' },
	'gimmewrong@snu-g.ms.kr': { name: '김일홍', subject: '수학' },
	'hapum411@snu-g.ms.kr': { name: '이지애', subject: '국어' },
	'heav92@snu-g.ms.kr': { name: '최기옥', subject: '기가' },
	'heed.yooli@snu-g.ms.kr': { name: '강율이', subject: '기가' },
	'hgcking@snu-g.ms.kr': { name: '황규창', subject: '체육' },
	'histoedu@snu-g.ms.kr': { name: '정재선', subject: '역사' },
	'izoayuri@snu-g.ms.kr': { name: '노유리', subject: '도덕' },
	'jan422@snu-g.ms.kr': { name: '정안나', subject: '국어' },
	'euijin_lee@snu-g.ms.kr': { name: '이의진', subject: '영어' },
	'sdipietro@snu-g.ms.kr': { name: 'Serena', subject: '영어' },
	'jjy2025@snu-g.ms.kr': { name: '정자연', subject: '영어' },
	'joo0306@snu-g.ms.kr': { name: '주예진', subject: '지구' },
	'joo701@snu-g.ms.kr': { name: '주지원', subject: '체육' },
	'joynobu@snu-g.ms.kr': { name: '김기현', subject: '물리' },
	'jungyeji0902@snu-g.ms.kr': { name: '정예지', subject: '미술' },
	'lhj8631@snu-g.ms.kr': { name: '이현진', subject: '국어' },
	'likejc@snu-g.ms.kr': { name: '이재국', subject: '기가' },
	'luckyk00@snu-g.ms.kr': { name: '이윤경', subject: '음악' },
	'm22m@snu-g.ms.kr': { name: '최미정', subject: '역사' },
	'mint0026@snu-g.ms.kr': { name: '이선미', subject: '수학' },
	'optimist7@snu-g.ms.kr': { name: '유수형', subject: '화학' },
	'peabody@snu-g.ms.kr': { name: '김지영', subject: '수학' },
	'phr3635@snu-g.ms.kr': { name: '박혜리', subject: '영어' },
	'popartry@snu-g.ms.kr': { name: '이경재', subject: '미술' },
	'rapidwing@snu-g.ms.kr': { name: '이정무', subject: '수학' },
	'rockjade@snu-g.ms.kr': { name: '김옥배', subject: '도덕' },
	'rugger8kr@snu-g.ms.kr': { name: '이성운', subject: '체육' },
	'squarelip@snu-g.ms.kr': { name: '김은희', subject: '과학' },
	'terror14@snu-g.ms.kr': { name: '황경진', subject: '사회' },
	'tgtec26@snu-g.ms.kr': { name: '최종훈', subject: '생명' },
	'umbang55@snu-g.ms.kr': { name: '엄인우', subject: '체육' },
	'urimal@snu-g.ms.kr': { name: '최인영', subject: '국어' },
	'waniwh35@snu-g.ms.kr': { name: '강신완', subject: '영어' },
	'mk066541@snu-g.ms.kr': { name: '김미경', subject: '국어' },
	'limjisoo0519@snu-g.ms.kr': { name: '임지수', subject: '스포츠' },
	'kro9299@snu-g.ms.kr': { name: '강라온', subject: '스포츠' },
	'kjm3542@snu-g.ms.kr': { name: '강지민', subject: '스포츠' }
};

export function getStandardizedName(email: string, displayName: string | null): string {
	const meta = teacherMetadata[email];
	if (meta) {
		return meta.subject ? `${meta.name} (${meta.subject})` : meta.name;
	}
	return displayName || '사용자';
}
