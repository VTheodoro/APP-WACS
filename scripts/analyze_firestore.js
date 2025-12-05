const { initializeApp } = require('firebase/app');
const {
    getFirestore,
    collection,
    getDocs,
    query,
    limit
} = require('firebase/firestore');
require('dotenv').config();

// Check if env vars are loaded
const requiredVars = [
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_PROJECT_ID'
];

const missing = requiredVars.filter(v => !process.env[v]);
if (missing.length > 0) {
    console.error('Error: Missing environment variables:', missing.join(', '));
    console.log('Ensure .env file exists in the root directory.');
    process.exit(1);
}

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
};

// Initialize Firebase
// Note: We use the Web SDK because it's what's installed in dependencies.
// We need to use 'require' syntax as this is a node script, but the SDK utilizes ES modules.
// However, newer Firebase SDKs (v9+) are modular. Node.js might struggle with direct imports if package.json doesn't say "type": "module".
// The project has "main": "index.js", so likely CommonJS.
// Firebase v9+ in Node via CommonJS requires specific compat imports or just using the modular syntax if supported by the runtime (Node 18+).
// Let's try standard modular syntax but if that fails we might need to use 'firebase/compat/app'.
// Actually, 'firebase' package usually supports require if we use the specific entry points.
// But for safety in a script, let's look at how to run it. 
// A safer bet for a quick script in this repo might be to use the 'firebase-admin' SDK if configured, 
// BUT we don't know if the user has a Service Account JSON. They likely only have API Keys in .env.
// Client SDK with API Key IS capable of reading Firestore if rules allow it (Rules are usually "allow read").

// Let's try to adapt the script to use 'firebase/app' etc. 
// If this fails due to ESM/CJS mismatch, I'll switch to 'cross-fetch' and REST API or similar.
// But node usually handles this if I rename to .mjs?
// Or I can just write it as standard CJS requiring from the compat build if needed.
// Firebase v10 exports CJS.

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function analyzeCollection(name) {
    console.log(`\n--- Analyzing Collection: ${name} ---`);
    try {
        const colRef = collection(db, name);
        const snap = await getDocs(colRef);
        console.log(`Total Documents: ${snap.size}`);

        if (snap.size > 0) {
            const sample = snap.docs[0].data();
            console.log('Sample Document Structure (Keys):', Object.keys(sample).join(', '));
            // console.log('Sample content:', JSON.stringify(sample, null, 2));
        }
    } catch (error) {
        console.error(`Error accessing ${name}:`, error.message);
    }
}

async function run() {
    console.log('Starting Database Analysis...');

    await analyzeCollection('users');
    await analyzeCollection('accessibleLocations');
    await analyzeCollection('reviews');
    await analyzeCollection('posts');
    await analyzeCollection('chats');

    console.log('\nAnalysis Complete.');
    process.exit(0);
}

run();
