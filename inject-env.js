// Script to inject environment variables into environment.prod.ts
const fs = require('fs');
const path = require('path');

const envProdPath = path.join(__dirname, 'src/app/environment.prod.ts');

const envContent = `export const environment = {
    production: true,
    firebaseConfig: {
        apiKey: "${process.env.FIREBASE_API_KEY}",
        authDomain: "${process.env.FIREBASE_AUTH_DOMAIN}",
        databaseURL: "${process.env.FIREBASE_DATABASE_URL}",
        projectId: "${process.env.FIREBASE_PROJECT_ID}",
        storageBucket: "${process.env.FIREBASE_STORAGE_BUCKET}",
        messagingSenderId: "${process.env.FIREBASE_MESSAGING_SENDER_ID}",
        appId: "${process.env.FIREBASE_APP_ID}"
    }
};`;

fs.writeFileSync(envProdPath, envContent);
