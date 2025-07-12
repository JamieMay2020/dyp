// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAUIRx31KxT-TNL5I_xPOvYDb8xInlXaA8",
    authDomain: "dyp2-63174.firebaseapp.com",
    projectId: "dyp2-63174",
    storageBucket: "dyp2-63174.firebasestorage.app",
    messagingSenderId: "69863725624",
    appId: "1:69863725624:web:09691d193f3b6a5795e4cd",
    measurementId: "G-69DQ7CDYHM"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
// Note: We're not using Firebase Storage to stay on the free plan

// Initialize anonymous auth
auth.signInAnonymously().catch((error) => {
    console.error("Auth error:", error);
});

// Global user state
let currentUser = null;
auth.onAuthStateChanged((user) => {
    currentUser = user;
});

// === FIRESTORE FUNCTIONS ===

// Create a new pill in Firestore (using base64 instead of Storage)
async function createPill(imageBlob, pillName) {
    try {
        if (!currentUser) {
            throw new Error("User not authenticated");
        }

        // Check rate limit
        const canCreate = await checkFirebaseRateLimit();
        if (!canCreate) {
            return { success: false, error: "Rate limit exceeded" };
        }

        // Convert blob to base64
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(imageBlob);
        });

        const base64Image = await base64Promise;

        // Check size (Firestore documents have a 1MB limit)
        const sizeInBytes = new Blob([base64Image]).size;
        if (sizeInBytes > 900000) { // ~900KB to be safe
            return { success: false, error: "Image too large. Please create a smaller drawing." };
        }

        // Create pill document in Firestore with base64 image
        const pillData = {
            name: pillName,
            imageUrl: base64Image, // Store base64 directly
            creator: generateWalletAddress(),
            creatorId: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            upvotes: 0,
            upvotedBy: []
        };

        const docRef = await db.collection('pills').add(pillData);

        // Update user's rate limit
        await updateRateLimit();

        return { 
            success: true, 
            pillId: docRef.id,
            pill: { ...pillData, id: docRef.id }
        };

    } catch (error) {
        console.error("Error creating pill:", error);
        return { success: false, error: error.message };
    }
}

// Get user's created pills
async function getUserPills() {
    try {
        if (!currentUser) return [];

        const snapshot = await db.collection('pills')
            .where('creatorId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("Error getting user pills:", error);
        return [];
    }
}

// Get all pills for gallery
async function getAllPills() {
    try {
        const snapshot = await db.collection('pills')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("Error getting pills:", error);
        return [];
    }
}

// Listen to new pills in real-time
function listenToNewPills(callback) {
    const unsubscribe = db.collection('pills')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .onSnapshot((snapshot) => {
            const pills = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(pills);
        });

    return unsubscribe;
}

// Listen to top pills in real-time
function listenToTopPills(callback) {
    const unsubscribe = db.collection('pills')
        .orderBy('upvotes', 'desc')
        .limit(20)
        .onSnapshot((snapshot) => {
            const pills = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(pills);
        });

    return unsubscribe;
}

// Get user's upvoted pills
async function getUserUpvotes() {
    try {
        if (!currentUser) return [];

        const doc = await db.collection('users').doc(currentUser.uid).get();
        if (doc.exists) {
            return doc.data().upvotedPills || [];
        }
        return [];
    } catch (error) {
        console.error("Error getting user upvotes:", error);
        return [];
    }
}

// Toggle upvote
async function toggleUpvoteFirebase(pillId, isCurrentlyUpvoted) {
    try {
        if (!currentUser) {
            throw new Error("User not authenticated");
        }

        const pillRef = db.collection('pills').doc(pillId);
        const userRef = db.collection('users').doc(currentUser.uid);

        // Use a transaction to ensure consistency
        await db.runTransaction(async (transaction) => {
            const pillDoc = await transaction.get(pillRef);
            
            if (!pillDoc.exists) {
                throw new Error("Pill not found");
            }

            const pillData = pillDoc.data();
            let newUpvotes = pillData.upvotes || 0;
            let upvotedBy = pillData.upvotedBy || [];

            if (isCurrentlyUpvoted) {
                // Remove upvote
                newUpvotes = Math.max(0, newUpvotes - 1);
                upvotedBy = upvotedBy.filter(uid => uid !== currentUser.uid);
            } else {
                // Add upvote
                newUpvotes += 1;
                if (!upvotedBy.includes(currentUser.uid)) {
                    upvotedBy.push(currentUser.uid);
                }
            }

            // Update pill
            transaction.update(pillRef, {
                upvotes: newUpvotes,
                upvotedBy: upvotedBy
            });

            // Update user's upvoted pills
            const userDoc = await transaction.get(userRef);
            let userUpvotes = [];
            
            if (userDoc.exists) {
                userUpvotes = userDoc.data().upvotedPills || [];
            }

            if (isCurrentlyUpvoted) {
                userUpvotes = userUpvotes.filter(id => id !== pillId);
            } else {
                if (!userUpvotes.includes(pillId)) {
                    userUpvotes.push(pillId);
                }
            }

            transaction.set(userRef, {
                upvotedPills: userUpvotes
            }, { merge: true });
        });

        return { success: true };

    } catch (error) {
        console.error("Error toggling upvote:", error);
        return { success: false, error: error.message };
    }
}

// === RATE LIMITING ===

// Check if user can create a pill
async function checkFirebaseRateLimit() {
    try {
        if (!currentUser) return false;

        const userRef = db.collection('users').doc(currentUser.uid);
        const doc = await userRef.get();

        if (!doc.exists) {
            return true; // First pill
        }

        const userData = doc.data();
        const createdPills = userData.createdPills || [];
        const now = Date.now();
        const recentPills = createdPills.filter(timestamp => 
            now - timestamp < 60000 // 1 minute window
        );

        return recentPills.length < 3; // Max 3 pills per minute

    } catch (error) {
        console.error("Error checking rate limit:", error);
        return true; // Allow on error
    }
}

// Update user's rate limit data
async function updateRateLimit() {
    try {
        if (!currentUser) return;

        const userRef = db.collection('users').doc(currentUser.uid);
        const doc = await userRef.get();
        
        let createdPills = [];
        if (doc.exists) {
            createdPills = doc.data().createdPills || [];
        }

        const now = Date.now();
        // Keep only recent timestamps
        createdPills = createdPills.filter(timestamp => 
            now - timestamp < 60000
        );
        createdPills.push(now);

        await userRef.set({
            createdPills: createdPills,
            lastCreated: now
        }, { merge: true });

    } catch (error) {
        console.error("Error updating rate limit:", error);
    }
}

// === UTILITY FUNCTIONS ===

// Generate random wallet address (kept from original)
function generateWalletAddress() {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let address = '';
    for (let i = 0; i < 7; i++) {
        address += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return address;
}

// Format timestamp to relative time
function formatFirebaseTime(timestamp) {
    if (!timestamp) return 'just now';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) {
        return 'just now';
    } else if (diff < 3600000) {
        return `${Math.floor(diff / 60000)}m ago`;
    } else if (diff < 86400000) {
        return `${Math.floor(diff / 3600000)}h ago`;
    } else {
        return `${Math.floor(diff / 86400000)}d ago`;
    }
}
