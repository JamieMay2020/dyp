// Canvas and Drawing Variables
let canvas, ctx;
let drawingCanvas, drawingCtx; // Canvas for user drawings only
let isDrawing = false;
let currentColor = '#000000';
let currentSize = 5;
let currentTool = 'brush';
let drawingHistory = [];
let historyStep = -1;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupCanvas();
    setupDrawingTools();
    setupColorPalette();
    setupFormHandling();
    updateCoordinates();
    loadPillBase();
});

// Setup Canvas
function setupCanvas() {
    // Main display canvas
    canvas = document.getElementById('drawingCanvas');
    ctx = canvas.getContext('2d');
    canvas.width = 500;
    canvas.height = 500;
    
    // Create a separate canvas for drawings only (not visible)
    drawingCanvas = document.createElement('canvas');
    drawingCtx = drawingCanvas.getContext('2d');
    drawingCanvas.width = 500;
    drawingCanvas.height = 500;

    // Event listeners on the main canvas
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('mousemove', updateCoordinates);
    
    // Touch events
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    
    // Initialize drawing canvas as transparent
    drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    
    // Save initial empty state
    saveState();
}

// Load and display the pill base
function loadPillBase() {
    const baseImage = new Image();
    
    baseImage.onload = function() {
        // Always render the composite when base loads
        renderComposite();
    };
    
    baseImage.src = 'images/pill-base.png';
    
    // Store the image for reuse
    window.pillBaseImage = baseImage;
    
    // If image fails, create default
    baseImage.onerror = function() {
        console.log('Failed to load pill image, creating default');
        createDefaultPill();
    };
}

// Create default pill shape
function createDefaultPill() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 500;
    tempCanvas.height = 500;
    const tempCtx = tempCanvas.getContext('2d');
    
    // White background
    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, 500, 500);
    
    // Draw pill shape
    tempCtx.strokeStyle = '#000000';
    tempCtx.lineWidth = 3;
    tempCtx.fillStyle = '#f0f0f0';
    
    const centerX = 250;
    const centerY = 250;
    const width = 300;
    const height = 150;
    const radius = height / 2;
    
    // Draw capsule
    tempCtx.beginPath();
    tempCtx.arc(centerX - width/2 + radius, centerY, radius, Math.PI/2, Math.PI*1.5);
    tempCtx.lineTo(centerX + width/2 - radius, centerY - radius);
    tempCtx.arc(centerX + width/2 - radius, centerY, radius, Math.PI*1.5, Math.PI/2);
    tempCtx.lineTo(centerX - width/2 + radius, centerY + radius);
    tempCtx.closePath();
    
    tempCtx.fill();
    tempCtx.stroke();
    
    // Convert to image
    const defaultImage = new Image();
    defaultImage.onload = function() {
        window.pillBaseImage = defaultImage;
        renderComposite();
    };
    defaultImage.src = tempCanvas.toDataURL();
}

// Render the composite of base + drawings
function renderComposite() {
    // Clear main canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw base pill if available
    if (window.pillBaseImage && window.pillBaseImage.complete) {
        // Scale to fit
        const maxSize = canvas.width * 0.8;
        const scale = Math.min(maxSize / window.pillBaseImage.width, maxSize / window.pillBaseImage.height);
        const scaledWidth = window.pillBaseImage.width * scale;
        const scaledHeight = window.pillBaseImage.height * scale;
        const x = (canvas.width - scaledWidth) / 2;
        const y = (canvas.height - scaledHeight) / 2;
        
        ctx.drawImage(window.pillBaseImage, x, y, scaledWidth, scaledHeight);
    }
    
    // Draw user drawings on top
    ctx.drawImage(drawingCanvas, 0, 0);
}

// Save current state to history
function saveState() {
    historyStep++;
    if (historyStep < drawingHistory.length) {
        drawingHistory.length = historyStep;
    }
    
    drawingHistory.push(drawingCtx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height));
}

// Update coordinates
function updateCoordinates(e) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e ? Math.floor(e.clientX - rect.left) : 0;
    const y = e ? Math.floor(e.clientY - rect.top) : 0;
    document.getElementById('coordinates').textContent = `${x}, ${y}`;
}

// Drawing Tools Setup
function setupDrawingTools() {
    // Tool buttons
    document.getElementById('brushTool').addEventListener('click', () => selectTool('brush'));
    document.getElementById('fillTool').addEventListener('click', () => selectTool('fill'));
    document.getElementById('eraserTool').addEventListener('click', () => selectTool('eraser'));
    
    // Brush size
    const brushSize = document.getElementById('brushSize');
    const sizeDisplay = document.getElementById('sizeDisplay');
    
    brushSize.addEventListener('input', (e) => {
        currentSize = parseInt(e.target.value);
        sizeDisplay.textContent = `${currentSize}px`;
    });
    
    // Action buttons
    document.getElementById('undoBtn').addEventListener('click', undo);
    document.getElementById('clearBtn').addEventListener('click', clearCanvas);
    document.getElementById('completeBtn').addEventListener('click', completePill);
}

// Select tool
function selectTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tool + 'Tool').classList.add('active');
    
    canvas.style.cursor = tool === 'brush' ? 'crosshair' : 
                         tool === 'fill' ? 'pointer' : 'grab';
}

// Color Palette Setup
function setupColorPalette() {
    const colorBoxes = document.querySelectorAll('.color-box');
    const colorPicker = document.getElementById('colorPicker');
    
    colorBoxes.forEach(box => {
        box.addEventListener('click', () => {
            colorBoxes.forEach(b => b.classList.remove('selected'));
            box.classList.add('selected');
            currentColor = box.dataset.color;
            colorPicker.value = currentColor;
        });
    });
    
    colorPicker.addEventListener('change', (e) => {
        currentColor = e.target.value;
        colorBoxes.forEach(b => b.classList.remove('selected'));
    });
}

// Form Handling
function setupFormHandling() {
    const pillNameInput = document.getElementById('pillNameInput');
    
    pillNameInput.addEventListener('input', (e) => {
        const completeBtn = document.getElementById('completeBtn');
        completeBtn.disabled = e.target.value.trim().length === 0;
    });
}

// Drawing functions
function startDrawing(e) {
    if (currentTool === 'fill') {
        fillArea(e);
        return;
    }
    
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    drawingCtx.beginPath();
    drawingCtx.moveTo(x, y);
}

function draw(e) {
    if (!isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    drawingCtx.lineWidth = currentSize;
    drawingCtx.lineCap = 'round';
    drawingCtx.lineJoin = 'round';
    
    if (currentTool === 'eraser') {
        drawingCtx.globalCompositeOperation = 'destination-out';
    } else {
        drawingCtx.globalCompositeOperation = 'source-over';
        drawingCtx.strokeStyle = currentColor;
    }
    
    drawingCtx.lineTo(x, y);
    drawingCtx.stroke();
    
    // Update display
    renderComposite();
}

function stopDrawing() {
    if (isDrawing) {
        isDrawing = false;
        drawingCtx.globalCompositeOperation = 'source-over';
        saveState();
    }
}

// Fill area
function fillArea(e) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(e.clientX - rect.left);
    const y = Math.floor(e.clientY - rect.top);
    
    // Get the composite image data to check boundaries
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    // Get target color at click point
    const targetColor = getPixelColor(pixels, x, y, canvas.width);
    const fillColor = hexToRgb(currentColor);
    
    // Don't fill if clicking on black (outline) or same color
    if ((targetColor.r < 50 && targetColor.g < 50 && targetColor.b < 50) ||
        colorsMatch(targetColor, fillColor)) {
        return;
    }
    
    // Get drawing canvas data for the actual fill
    const drawingData = drawingCtx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height);
    const drawingPixels = drawingData.data;
    
    // Flood fill algorithm
    const stack = [[x, y]];
    const filled = new Set();
    
    while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        const key = `${cx},${cy}`;
        
        if (filled.has(key) || cx < 0 || cx >= canvas.width || cy < 0 || cy >= canvas.height) {
            continue;
        }
        
        const idx = (cy * canvas.width + cx) * 4;
        const currentColor = {
            r: pixels[idx],
            g: pixels[idx + 1],
            b: pixels[idx + 2],
            a: pixels[idx + 3]
        };
        
        // Check if we should fill this pixel
        if (!colorsMatch(currentColor, targetColor) || 
            (currentColor.r < 50 && currentColor.g < 50 && currentColor.b < 50)) {
            continue;
        }
        
        filled.add(key);
        
        // Fill on the drawing canvas
        drawingPixels[idx] = fillColor.r;
        drawingPixels[idx + 1] = fillColor.g;
        drawingPixels[idx + 2] = fillColor.b;
        drawingPixels[idx + 3] = 255;
        
        // Add neighbors
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    
    // Apply the fill
    drawingCtx.putImageData(drawingData, 0, 0);
    renderComposite();
    saveState();
}

// Helper functions
function getPixelColor(pixels, x, y, width) {
    const index = (y * width + x) * 4;
    return {
        r: pixels[index],
        g: pixels[index + 1],
        b: pixels[index + 2],
        a: pixels[index + 3]
    };
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
        a: 255
    } : null;
}

function colorsMatch(c1, c2, tolerance = 10) {
    return Math.abs(c1.r - c2.r) < tolerance &&
           Math.abs(c1.g - c2.g) < tolerance &&
           Math.abs(c1.b - c2.b) < tolerance;
}

// Touch handling
function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 
                                     e.type === 'touchmove' ? 'mousemove' : 'mouseup', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}

// Undo
function undo() {
    if (historyStep > 0) {
        historyStep--;
        drawingCtx.putImageData(drawingHistory[historyStep], 0, 0);
        renderComposite();
    }
}

// Clear canvas
function clearCanvas() {
    if (confirm('Are you sure you want to clear your drawing?')) {
        drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        drawingHistory = [];
        historyStep = -1;
        saveState();
        renderComposite();
    }
}

// Complete pill - Updated to use Firebase
async function completePill() {
    const pillName = document.getElementById('pillNameInput').value.trim();
    
    if (!pillName) {
        alert('Please enter a pill name!');
        return;
    }
    
    const completeBtn = document.getElementById('completeBtn');
    completeBtn.disabled = true;
    completeBtn.textContent = 'creating...';
    
    // Convert the displayed canvas to blob
    canvas.toBlob(async (blob) => {
        try {
            // Create pill in Firebase
            const result = await createPill(blob, pillName);
            
            if (result.success) {
                // Also save to localStorage for offline access
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64data = reader.result;
                    const localPill = {
                        ...result.pill,
                        imageUrl: base64data
                    };
                    
                    let userPills = JSON.parse(localStorage.getItem('userPills') || '[]');
                    userPills.unshift(localPill);
                    localStorage.setItem('userPills', JSON.stringify(userPills));
                };
                reader.readAsDataURL(blob);
                
                // Show success modal
                document.getElementById('completionModal').classList.add('active');
                
                // Reset form
                document.getElementById('pillNameInput').value = '';
                completeBtn.disabled = true;
            } else {
                if (result.error === "Rate limit exceeded") {
                    showRateLimitWarning();
                } else {
                    alert('Error creating pill: ' + result.error);
                }
            }
            
        } catch (error) {
            console.error('Error creating pill:', error);
            alert('Error creating pill. Please try again.');
        } finally {
            completeBtn.disabled = false;
            completeBtn.textContent = 'create pill';
        }
    }, 'image/png');
}

// Show rate limit warning
function showRateLimitWarning() {
    const warning = document.getElementById('rateLimitWarning');
    const timeEl = document.getElementById('cooldownTime');
    
    let timeRemaining = 60;
    timeEl.textContent = timeRemaining;
    warning.classList.remove('hidden');
    
    const interval = setInterval(() => {
        timeRemaining--;
        if (timeRemaining <= 0) {
            warning.classList.add('hidden');
            clearInterval(interval);
        } else {
            timeEl.textContent = timeRemaining;
        }
    }, 1000);
}
