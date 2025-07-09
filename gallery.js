// Gallery Variables
let userPills = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadUserPills();
});

// Load pills from Firebase (or localStorage for demo)
async function loadUserPills() {
    // In real implementation, this would fetch from Firebase
    // For now, we'll check localStorage for any saved pills
    const savedPills = localStorage.getItem('userPills');
    if (savedPills) {
        userPills = JSON.parse(savedPills);
        displayPills();
    } else {
        // Show empty state
        displayEmptyState();
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
    
    card.innerHTML = `
        <img src="${pill.imageUrl}" alt="${pill.name}" class="pill-image">
        <div class="pill-info">
            <div class="pill-name">${pill.name}</div>
            <div class="pill-meta">
                <span class="pill-creator">created by ${pill.creator}</span>
                <span class="pill-time">${formatTime(pill.createdAt)}</span>
            </div>
        </div>
    `;
    
    return card;
}

// Format time
function formatTime(timestamp) {
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
`;
document.head.appendChild(style);