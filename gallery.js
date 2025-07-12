// Gallery Variables
let userPills = [];
let unsubscribe = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Wait for auth to be ready
    setTimeout(() => {
        loadUserPills();
    }, 1000);
});

// Load pills from Firebase
async function loadUserPills() {
    try {
        // First, get pills from Firebase
        const firebasePills = await getAllPills();
        
        // Also check localStorage for offline pills
        const localPills = JSON.parse(localStorage.getItem('userPills') || '[]');
        
        // Merge pills (Firebase takes priority)
        const pillsMap = new Map();
        
        // Add Firebase pills
        firebasePills.forEach(pill => {
            pillsMap.set(pill.id, pill);
        });
        
        // Add local pills that might not be in Firebase yet
        localPills.forEach(pill => {
            if (!pillsMap.has(pill.id)) {
                pillsMap.set(pill.id || `local-${Date.now()}`, pill);
            }
        });
        
        userPills = Array.from(pillsMap.values());
        displayPills();
        
        // Set up real-time listener
        if (unsubscribe) {
            unsubscribe();
        }
        
        unsubscribe = listenToNewPills((pills) => {
            userPills = pills;
            displayPills();
        });
        
    } catch (error) {
        console.error('Error loading pills:', error);
        // Fall back to localStorage
        const savedPills = localStorage.getItem('userPills');
        if (savedPills) {
            userPills = JSON.parse(savedPills);
            displayPills();
        } else {
            displayEmptyState();
        }
    }
}

// Display pills
function displayPills() {
    const pillsGrid = document.getElementById('pillsGrid');
    
    if (userPills.length === 0) {
        displayEmptyState();
        return;
    }
    
    pillsGrid.innerHTML = '';
    
    userPills.forEach((pill, index) => {
        const pillCard = createPillCard(pill);
        pillCard.style.animation = `fadeIn 0.3s ease-out ${index * 0.05}s both`;
        pillsGrid.appendChild(pillCard);
    });
}

// Display empty state
function displayEmptyState() {
    const pillsGrid = document.getElementById('pillsGrid');
    pillsGrid.innerHTML = `
        <div class="empty-state">
            <h3>no pills yet</h3>
            <p>be the first to create a pill!</p>
            <button onclick="window.location.href='index.html'" class="create-first-btn">create pill</button>
        </div>
    `;
}

// Create pill card
function createPillCard(pill) {
    const card = document.createElement('div');
    card.className = 'pill-card';
    
    const timeStr = pill.createdAt ? formatFirebaseTime(pill.createdAt) : formatTime(pill.createdAt);
    
    card.innerHTML = `
        <img src="${pill.imageUrl}" alt="${pill.name}" class="pill-image">
        <div class="pill-info">
            <div class="pill-name">${pill.name}</div>
            <div class="pill-meta">
                <span class="pill-creator">created by ${pill.creator}</span>
                <span class="pill-time">${timeStr}</span>
            </div>
            <div class="pill-stats">
                <span class="upvote-count">${pill.upvotes || 0} upvotes</span>
            </div>
        </div>
    `;
    
    return card;
}

// Format time for local storage items
function formatTime(timestamp) {
    if (!timestamp) return 'just now';
    
    const date = new Date(timestamp);
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

// CSS Animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .pill-stats {
        margin-top: 8px;
        color: var(--accent-green);
        font-size: 13px;
    }
`;
document.head.appendChild(style);

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (unsubscribe) {
        unsubscribe();
    }
});
