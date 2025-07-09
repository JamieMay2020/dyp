// Notification System - Multiple types with random timing
const walletAddresses = [
    '8vrudPs', '3nK4mx', '7QXp6b', '9hL2vN', '5mK9vL',
    '2qN7xP', '8jH4aS', '6tR3wQ', '9pL2kM', '4xN8vQ',
    '7hK3sT', '1mR6wP', 'Zt4Kx9', 'Hf7Jn3', 'Nm2Ws8',
    'Qp8Hn2', '3nV6Lp', 'E6HjFK', 'BhbC2u', '4LVFui'
];

const notificationTypes = [
    { text: 'created pill', weight: 3 },
    { text: 'upvoted a pill', weight: 2 },
    { text: 'shared a pill', weight: 1 }
];

// Brighter colors
const notificationColors = ['#ff6b6b', '#5ee3df', '#69b3ff', '#90ee90', '#ffd93d', '#ff9ff3'];

let notifications = [];
const MAX_NOTIFICATIONS = 3;

// Initialize notifications
document.addEventListener('DOMContentLoaded', () => {
    createNotificationElements();
    // Start multiple notification streams
    setTimeout(() => showNotification(0), 100);
    setTimeout(() => showNotification(1), 2000);
    setTimeout(() => showNotification(2), 4000);
});

function createNotificationElements() {
    const notificationBar = document.querySelector('.notification-bar');
    notificationBar.innerHTML = '';
    
    // Create multiple notification containers
    for (let i = 0; i < MAX_NOTIFICATIONS; i++) {
        const container = document.createElement('div');
        container.className = 'notification-container';
        container.id = `notification-${i}`;
        notificationBar.appendChild(container);
        notifications.push({ element: container, colorIndex: i * 2 });
    }
}

function getRandomNotificationType() {
    // Weighted random selection
    const totalWeight = notificationTypes.reduce((sum, type) => sum + type.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const type of notificationTypes) {
        random -= type.weight;
        if (random <= 0) {
            return type.text;
        }
    }
    return notificationTypes[0].text;
}

function showNotification(index) {
    const notification = notifications[index];
    const wallet = walletAddresses[Math.floor(Math.random() * walletAddresses.length)];
    const type = getRandomNotificationType();
    const color = notificationColors[notification.colorIndex % notificationColors.length];
    
    // Update container
    notification.element.style.backgroundColor = color;
    notification.element.textContent = `${wallet} ${type}`;
    notification.element.style.opacity = '1';
    
    // Add shake animation
    notification.element.classList.remove('shake');
    void notification.element.offsetWidth; // Force reflow
    notification.element.classList.add('shake');
    
    // Update color index
    notification.colorIndex = (notification.colorIndex + 1) % notificationColors.length;
    
    // Schedule next notification with random delay
    const randomDelay = 2500 + Math.random() * 3500; // Between 2.5 and 6 seconds
    setTimeout(() => showNotification(index), randomDelay);
}

// Add CSS for shake animation and layout
const style = document.createElement('style');
style.textContent = `
    .notification-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 12px;
    }
    
    .notification-container {
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 13px;
        color: #1a1a1a;
        font-weight: 500;
        transition: all 0.3s ease;
        opacity: 0;
        white-space: nowrap;
    }
    
    .shake {
        animation: shake 0.5s ease-in-out;
    }
    
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
        20%, 40%, 60%, 80% { transform: translateX(3px); }
    }
`;
document.head.appendChild(style);