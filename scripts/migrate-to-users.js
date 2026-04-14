import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

/**
 * Firestore Migration Script: settings/admin_whitelist -> users collection
 *
 * Usage:
 * 1. Download service account key from Firebase Console.
 * 2. Save it as 'serviceAccountKey.json' in the project root.
 * 3. Run: node scripts/migrate-to-users.js
 */

const SERVICE_ACCOUNT_PATH = path.resolve(process.cwd(), 'serviceAccountKey.json');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
	console.error('Error: serviceAccountKey.json not found in project root.');
	console.log('Please download it from Firebase Console -> Project Settings -> Service Accounts.');
	process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrate() {
	console.log('Starting migration...');

	try {
		// 1. Read existing whitelist
		const whitelistDoc = await db.collection('settings').doc('admin_whitelist').get();
		let emails = [];

		if (whitelistDoc.exists) {
			emails = whitelistDoc.data().emails || [];
			console.log(`Found ${emails.length} emails in whitelist.`);
		} else {
			console.log('No whitelist found in settings/admin_whitelist.');
		}

		// 2. Ensure mandatory admin is included
		const mandatoryAdmin = 'tgtec26@snu-g.ms.kr';
		if (!emails.includes(mandatoryAdmin)) {
			emails.push(mandatoryAdmin);
			console.log(`Added mandatory admin: ${mandatoryAdmin}`);
		}

		// 3. Migrate to 'users' collection
		const batch = db.batch();
		const now = admin.firestore.FieldValue.serverTimestamp();

		for (const email of emails) {
			const userRef = db.collection('users').doc(email);
			batch.set(
				userRef,
				{
					email: email,
					role: 'ADMIN',
					updatedAt: now
				},
				{ merge: true }
			);
			console.log(`Queued migration for: ${email}`);
		}

		await batch.commit();
		console.log('Migration completed successfully!');
	} catch (error) {
		console.error('Migration failed:', error);
	}
}

migrate();
