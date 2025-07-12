// Hall of Fame Variables
let topPills = [];
let unsubscribe = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Hall of Fame page loaded, waiting for auth...');
    
    // Wait for auth to be ready
    auth.onAuthStateChanged((user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'No user');
        if (user) {
            loadTopPills();
        } else {
            console.log('Waiting for anonymous auth...');
            setTimeout(() => {
                loadTopPills();
            }, 2000);
        }
    });
});

// Load top pills from Firebase
function loadTopPills() {
    try {
        console.log('Setting up listener for top pills...');
        
        // Set up real-time listener for top pills
        if (unsubscribe) {
            unsubscribe();
        }
        
        unsubscribe = listenToTopPills((pills) => {
            console.log('Received top pills:', pills.length);
            topPills = pills;
            if (topPills.length > 0) {
                displayTopPills();
            } else {
                // If no pills from Firebase, check localStorage
                loadLocalTopPills();
            }
        });
        
    } catch (error) {
        console.error('Error loading top pills:', error);
        loadLocalTopPills();
    }
}

// Load top pills from localStorage as fallback
function loadLocalTopPills() {
    const savedPills = localStorage.getItem('userPills');
    
    if (savedPills) {
        const allPills = JSON.parse(savedPills);
        // Sort by upvotes (descending) and take top 20
        topPills = allPills
            .sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0))
            .slice(0, 20);
        
        if (topPills.length > 0) {
            displayTopPills();
        } else {
            displayEmptyState();
        }
    } else {
        displayEmptyState();
    }
}

// Display top pills
function displayTopPills() {
    const topPillsGrid = document.getElementById('topPillsGrid');
    topPillsGrid.innerHTML = '';
    
    topPills.forEach((pill, index) => {
        const pillCard = createTopPillCard(pill, index + 1);
        pillCard.style.animation = `fadeIn 0.3s ease-out ${index * 0.1}s both`;
        topPillsGrid.appendChild(pillCard);
    });
}

// Display empty state
function displayEmptyState() {
    const topPillsGrid = document.getElementById('topPillsGrid');
    topPillsGrid.innerHTML = `
        <div class="empty-state">
            <h3>no pills yet</h3>
            <p>create pills to see them in the hall of fame!</p>
            <button onclick="window.location.href='index.html'" class="create-first-btn">create pill</button>
        </div>
    `;
}

// Create top pill card with upvote functionality
function createTopPillCard(pill, rank) {
    const card = document.createElement('div');
    card.className = 'top-pill-card';
    
    const timeStr = pill.createdAt ? formatFirebaseTime(pill.createdAt) : formatTime(pill.createdAt);
    
    card.innerHTML = `
        <div class="rank-badge">#${rank}</div>
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
    setupUpvoteButton(upvoteBtn, pill);
    
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
if (!document.querySelector('style[data-hall-styles]')) {
    const style = document.createElement('style');
    style.setAttribute('data-hall-styles', 'true');
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
