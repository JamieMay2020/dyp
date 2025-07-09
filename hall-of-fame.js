// Hall of Fame Variables
let topPills = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadTopPills();
});

// Load top pills from user-created pills
function loadTopPills() {
    // Get all user pills from localStorage
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

// Create top pill card
function createTopPillCard(pill, rank) {
    const card = document.createElement('div');
    card.className = 'top-pill-card';
    
    card.innerHTML = `
        <div class="rank-badge">#${rank}</div>
        <img src="${pill.imageUrl}" alt="${pill.name}" class="pill-image">
        <div class="pill-info">
            <div class="pill-name">${pill.name}</div>
            <div class="pill-meta">
                <span class="pill-creator">created by ${pill.creator}</span>
                <span class="pill-stats">${pill.upvotes || 0} upvotes</span>
            </div>
        </div>
    `;
    
    return card;
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