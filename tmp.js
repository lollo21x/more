
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
        import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
        import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

        const firebaseConfig = {
            apiKey: "AIzaSyA27qqn90L4cs21nnlk9v3Erf6Svo82lQY",
            authDomain: "doot-inc.firebaseapp.com",
            projectId: "doot-inc",
            storageBucket: "doot-inc.firebasestorage.app",
            messagingSenderId: "361145205770",
            appId: "1:361145205770:web:728036d27c84429b05cbf3",
            measurementId: "G-E0DLQJPS1J"
        };

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);
        const googleProvider = new GoogleAuthProvider();

        window.firebaseApp = { auth, db, googleProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, doc, setDoc, getDoc, serverTimestamp };
    
