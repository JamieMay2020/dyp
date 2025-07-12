// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCI4uPT5pFpKHUUavGsX5OsmdPc5ovPFVA",
    authDomain: "todd-fc21e.firebaseapp.com",
    projectId: "todd-fc21e",
    storageBucket: "todd-fc21e.firebasestorage.app",
    messagingSenderId: "1049247804525",
    appId: "1:1049247804525:web:834887b062df13b6316364",
    measurementId: "G-BEJPDEKKLR"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();
const auth = firebase.auth();

// Initialize anonymous auth with better error handling
auth.signInAnonymously()
    .then(() => {
        console.log("Anonymous auth successful");
    })
    .catch((error) => {
        console.error("Auth error:", error);
    });

// Global user state
let currentUser = null;
auth.onAuthStateChanged((user) => {
    currentUser = user;
    console.log("Auth state changed:", user ? `User: ${user.uid}` : "No user");
});

// === FIRESTORE FUNCTIONS ===

// Create a new pill in Firestore (using Firebase Storage)
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

        // Upload image to Storage
        const timestamp = Date.now();
        const filename = `${timestamp}_${pillName.replace(/[^a-z0-9]/gi, '_')}.png`;
        const imageRef = storage.ref(`pills/${filename}`);
        
        console.log('Uploading image to Storage...');
        const snapshot = await imageRef.put(imageBlob);
        const imageUrl = await snapshot.ref.getDownloadURL();
        console.log('Image uploaded successfully:', imageUrl);

        // Create pill document in Firestore
        const pillData = {
            name: pillName,
            imageUrl: imageUrl,
            creator: generateWalletAddress(),
            creatorId: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            upvotes: 0
        };

        console.log('Creating pill document in Firestore...');
        const docRef = await db.collection('tods').add(pillData);
        console.log('Pill created successfully with ID:', docRef.id);

        // Track in user activity
        await db.collection('userActivity').doc(currentUser.uid)
            .collection('creations').doc(docRef.id)
            .set({
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                todId: docRef.id
            });

        // Update user's rate limit
        await updateRateLimit();

        return { 
            success: true, 
            pillId: docRef.id,
            pill: { ...pillData, id: docRef.id, imageUrl: imageUrl }
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

        const snapshot = await db.collection('tods')
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
        console.log('Fetching all pills from Firestore...');
        const snapshot = await db.collection('tods')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        console.log('Firestore query complete. Docs found:', snapshot.size);
        
        const pills = snapshot.docs.map(doc => {
            const data = doc.data();
            console.log('Processing pill:', doc.id, data);
            
            // Convert Firestore timestamp to Date
            if (data.createdAt && data.createdAt.toDate) {
                data.createdAt = data.createdAt.toDate();
            }
            
            return {
                id: doc.id,
                ...data
            };
        });
        
        console.log('Processed pills:', pills);
        return pills;
    } catch (error) {
        console.error("Error getting pills:", error);
        
        // If it's a permission error, try without ordering
        if (error.code === 'permission-denied' || error.message.includes('index')) {
            console.log('Trying without orderBy...');
            try {
                const snapshot = await db.collection('pills').limit(50).get();
                return snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            } catch (fallbackError) {
                console.error("Fallback query also failed:", fallbackError);
                return [];
            }
        }
        return [];
    }
}

// Listen to new pills in real-time
function listenToNewPills(callback) {
    console.log('Setting up Firestore listener for pills...');
    
    const unsubscribe = db.collection('tods')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .onSnapshot(
            (snapshot) => {
                console.log('Firestore listener fired. Docs:', snapshot.size);
                const pills = snapshot.docs.map(doc => {
                    const data = doc.data();
                    
                    // Convert Firestore timestamp to Date
                    if (data.createdAt && data.createdAt.toDate) {
                        data.createdAt = data.createdAt.toDate();
                    }
                    
                    return {
                        id: doc.id,
                        ...data
                    };
                });
                callback(pills);
            },
            (error) => {
                console.error('Firestore listener error:', error);
                
                // If orderBy fails, try without it
                if (error.code === 'failed-precondition' || error.message.includes('index')) {
                    console.log('Trying listener without orderBy...');
                    return db.collection('tods')
                        .limit(20)
                        .onSnapshot((snapshot) => {
                            const pills = snapshot.docs.map(doc => ({
                                id: doc.id,
                                ...doc.data()
                            }));
                            callback(pills);
                        });
                }
            }
        );

    return unsubscribe;
}

// Listen to top pills in real-time
function listenToTopPills(callback) {
    const unsubscribe = db.collection('tods')
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

        const snapshot = await db.collection('upvotes')
            .where('userId', '==', currentUser.uid)
            .get();
        
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return data.todId;
        });
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

        const pillRef = db.collection('tods').doc(pillId);
        const upvoteRef = db.collection('upvotes').doc(`${currentUser.uid}_${pillId}`);

        // Use a transaction to ensure consistency
        await db.runTransaction(async (transaction) => {
            const pillDoc = await transaction.get(pillRef);
            
            if (!pillDoc.exists) {
                throw new Error("Pill not found");
            }

            const pillData = pillDoc.data();
            let newUpvotes = pillData.upvotes || 0;

            if (isCurrentlyUpvoted) {
                // Remove upvote
                newUpvotes = Math.max(0, newUpvotes - 1);
                transaction.delete(upvoteRef);
            } else {
                // Add upvote
                newUpvotes += 1;
                transaction.set(upvoteRef, {
                    userId: currentUser.uid,
                    todId: pillId,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            // Update pill upvote count
            transaction.update(pillRef, {
                upvotes: newUpvotes
            });
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
