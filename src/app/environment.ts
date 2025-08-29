export const environment = {
    production: false,
    firebaseConfig: {
        apiKey: process.env['NG_APP_FIREBASE_API_KEY'] || "AIzaSyB2e36wu47-6DOc2_rAuHfiFTq9vm6GBD0",
        authDomain: process.env['NG_APP_FIREBASE_AUTH_DOMAIN'] || "cabbingo-db.firebaseapp.com",
        databaseURL: process.env['NG_APP_FIREBASE_DATABASE_URL'] || "https://cabbingo-db-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: process.env['NG_APP_FIREBASE_PROJECT_ID'] || "cabbingo-db",
        storageBucket: process.env['NG_APP_FIREBASE_STORAGE_BUCKET'] || "cabbingo-db.firebasestorage.app",
        messagingSenderId: process.env['NG_APP_FIREBASE_MESSAGING_SENDER_ID'] || "684304316440",
        appId: process.env['NG_APP_FIREBASE_APP_ID'] || "1:684304316440:web:0660b0d72a68752cadeb6d"
    }
};