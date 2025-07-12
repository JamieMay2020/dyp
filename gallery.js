// Gallery Variables
let userPills = [];
let unsubscribe = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Gallery page loaded, waiting for auth...');
    
    // Wait for auth to be ready
    auth.onAuthStateChanged((user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'No user');
        if (user) {
            loadUserPills();
        } else {
            console.log('Waiting for anonymous auth...');
            setTimeout(() => {
                loadUserPills();
            }, 2000);
        }
    });
});

// Load pills from Firebase
async function loadUserPills() {
    try {
        console.log('Loading pills from Firebase...');
        
        // First, get pills from Firebase
        const firebasePills = await getAllPills();
        console.log('Firebase pills loaded:', firebasePills);
        
        // Also check localStorage for offline pills
        const localPills = JSON.parse(localStorage.getItem('userPills') || '[]');
        console.log('Local pills:', localPills);
        
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
        console.log('Total pills to display:', userPills.length);
        displayPills();
        
        // Set up real-time listener
        if (unsubscribe) {
            unsubscribe();
        }
        
        console.log('Setting up real-time listener...');
        unsubscribe = listenToNewPills((pills) => {
            console.log('Real-time update - pills:', pills);
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

// Create pill card with upvote functionality
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
            <div class="pill-actions">
                <button class="upvote-btn" data-pill-id="${pill.id}" data-upvoted="false">
                    <span class="upvote-icon">▲</span>
                    <span class="upvote-count">${pill.upvotes || 0}</span>
                </button>
            </div>
        </div>
    `;
    
    // Add upvote functionality
    const upvoteBtn = card.querySelector('.upvote-btn');
    if (upvoteBtn && pill.id) {
        setupUpvoteButton(upvoteBtn, pill);
    }
    
    return card;
}

// Setup upvote button
async function setupUpvoteButton(button, pill) {
    // Check if user has already upvoted
    try {
        const userUpvotes = await getUserUpvotes();
        if (userUpvotes.includes(pill.id)) {
            button.dataset.upvoted = 'true';
            button.classList.add('upvoted');
        }
    } catch (error) {
        console.error('Error checking upvotes:', error);
    }
    
    // Add click handler
    button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const isUpvoted = button.dataset.upvoted === 'true';
        
        // Optimistic UI update
        const countSpan = button.querySelector('.upvote-count');
        const currentCount = parseInt(countSpan.textContent) || 0;
        
        if (isUpvoted) {
            button.dataset.upvoted = 'false';
            button.classList.remove('upvoted');
            countSpan.textContent = Math.max(0, currentCount - 1);
        } else {
            button.dataset.upvoted = 'true';
            button.classList.add('upvoted');
            countSpan.textContent = currentCount + 1;
        }
        
        // Update in Firebase
        try {
            const result = await toggleUpvoteFirebase(pill.id, isUpvoted);
            if (!result.success) {
                // Revert on error
                if (isUpvoted) {
                    button.dataset.upvoted = 'true';
                    button.classList.add('upvoted');
                    countSpan.textContent = currentCount;
                } else {
                    button.dataset.upvoted = 'false';
                    button.classList.remove('upvoted');
                    countSpan.textContent = currentCount;
                }
            }
        } catch (error) {
            console.error('Error toggling upvote:', error);
        }
    });
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

// CSS Animation and Styles - Fixed to avoid duplicate declaration
if (!document.querySelector('style[data-gallery-styles]')) {
    const style = document.createElement('style');
    style.setAttribute('data-gallery-styles', 'true');
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
        
        .pill-actions {
            margin-top: 12px;
        }
        
        .upvote-btn {
            background: var(--bg-tertiary);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 6px 12px;
            color: var(--text-secondary);
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;
            font-size: 14px;
        }
        
        .upvote-btn:hover {
            background: var(--hover-bg);
            color: var(--text-primary);
            transform: translateY(-1px);
        }
        
        .upvote-btn.upvoted {
            background: var(--accent-green);
            color: var(--bg-primary);
            border-color: var(--accent-green);
        }
        
        .upvote-icon {
            font-size: 12px;
        }
        
        .pill-time {
            color: var(--text-tertiary);
            font-size: 12px;
        }
    `;
    document.head.appendChild(style);
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (unsubscribe) {
        unsubscribe();
    }
});
