// Canvas and Drawing Variables
let canvas, ctx;
let baseCanvas, baseCtx; // Separate canvas for the base image
let isDrawing = false;
let currentColor = '#000000';
let currentSize = 5;
let currentTool = 'brush';
let drawingHistory = [];
let currentPath = [];
let baseImageLoaded = false;

// Rate Limiting
let createdPills = [];
const RATE_LIMIT = 3;
const RATE_LIMIT_WINDOW = 60000;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupCanvas();
    setupDrawingTools();
    setupColorPalette();
    setupFormHandling();
    updateCoordinates();
    loadPillBase();
});

// Load pill base image
function loadPillBase() {
    const baseImage = new Image();
    baseImage.onload = function() {
        // Clear base canvas
        baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
        
        // Calculate scaling to fit image within canvas
        const maxSize = baseCanvas.width * 0.8; // Use 80% of canvas size for padding
        const scale = Math.min(maxSize / baseImage.width, maxSize / baseImage.height);
        
        // Calculate new dimensions
        const scaledWidth = baseImage.width * scale;
        const scaledHeight = baseImage.height * scale;
        
        // Center the image
        const x = (baseCanvas.width - scaledWidth) / 2;
        const y = (baseCanvas.height - scaledHeight) / 2;
        
        // Draw the scaled image on BASE canvas
        baseCtx.drawImage(baseImage, x, y, scaledWidth, scaledHeight);
        
        baseImageLoaded = true;
        
        // Initial composite
        compositeCanvases();
    };
    
    // Set the path to your pill base image
    baseImage.src = 'images/pill-base.png';
    
    // If image fails to load, draw a simple pill shape
    baseImage.onerror = function() {
        console.log('Failed to load pill base image, drawing default shape');
        drawDefaultPillShape();
    };
}

// Fallback function to draw a pill shape if image doesn't load
function drawDefaultPillShape() {
    // Clear base canvas
    baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
    
    // Draw pill outline on base canvas
    baseCtx.strokeStyle = '#000000';
    baseCtx.lineWidth = 3;
    
    const centerX = baseCanvas.width / 2;
    const centerY = baseCanvas.height / 2;
    const width = 300;
    const height = 150;
    const radius = height / 2;
    
    // Draw capsule shape
    baseCtx.beginPath();
    baseCtx.arc(centerX - width/2 + radius, centerY, Math.PI/2, Math.PI*1.5);
    baseCtx.lineTo(centerX + width/2 - radius, centerY - radius);
    baseCtx.arc(centerX + width/2 - radius, centerY, Math.PI*1.5, Math.PI/2);
    baseCtx.lineTo(centerX - width/2 + radius, centerY + radius);
    baseCtx.closePath();
    baseCtx.stroke();
    
    baseImageLoaded = true;
    
    // Initial composite
    compositeCanvases();
}

// Setup Canvas
function setupCanvas() {
    canvas = document.getElementById('drawingCanvas');
    ctx = canvas.getContext('2d');
    canvas.width = 500;
    canvas.height = 500;
    
    // Create a separate canvas for the base image
    baseCanvas = document.createElement('canvas');
    baseCtx = baseCanvas.getContext('2d');
    baseCanvas.width = 500;
    baseCanvas.height = 500;
    
    // Clear main canvas with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Event listeners
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('mousemove', updateCoordinates);
    
    // Touch events
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
}

// Composite the base and drawing layers
function compositeCanvases() {
    // Save current drawing state
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);
    
    // Clear main canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw base layer first
    if (baseImageLoaded) {
        ctx.drawImage(baseCanvas, 0, 0);
    }
    
    // Draw user drawings on top
    ctx.drawImage(tempCanvas, 0, 0);
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
    const brushTool = document.getElementById('brushTool');
    const fillTool = document.getElementById('fillTool');
    const eraserTool = document.getElementById('eraserTool');
    
    brushTool.addEventListener('click', () => selectTool('brush'));
    fillTool.addEventListener('click', () => selectTool('fill'));
    eraserTool.addEventListener('click', () => selectTool('eraser'));
    
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
    
    if (tool === 'brush') {
        document.getElementById('brushTool').classList.add('active');
        canvas.style.cursor = 'crosshair';
    } else if (tool === 'fill') {
        document.getElementById('fillTool').classList.add('active');
        canvas.style.cursor = 'pointer';
    } else if (tool === 'eraser') {
        document.getElementById('eraserTool').classList.add('active');
        canvas.style.cursor = 'grab';
    }
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
    const pillDescription = document.getElementById('pillDescription');
    
    // Enable/disable complete button based on name input
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
    currentPath = [];
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    currentPath.push({x, y, color: currentColor, size: currentSize, tool: currentTool});
}

function draw(e) {
    if (!isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineWidth = currentSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (currentTool === 'eraser') {
        // For eraser, we'll use white color instead of destination-out
        // This preserves the base layer
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'white';
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = currentColor;
    }
    
    ctx.lineTo(x, y);
    ctx.stroke();
    
    currentPath.push({x, y, color: currentColor, size: currentSize, tool: currentTool});
}

function stopDrawing() {
    if (isDrawing && currentPath.length > 0) {
        drawingHistory.push([...currentPath]);
        currentPath = [];
    }
    isDrawing = false;
    ctx.globalCompositeOperation = 'source-over';
}

// Fill tool
function fillArea(e) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(e.clientX - rect.left);
    const y = Math.floor(e.clientY - rect.top);
    
    // Create a temporary canvas to get the current composite view
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Draw current state
    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    if (baseImageLoaded) {
        tempCtx.drawImage(baseCanvas, 0, 0);
    }
    tempCtx.drawImage(canvas, 0, 0);
    
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const pixels = imageData.data;
    const targetColor = getPixelColor(pixels, x, y, tempCanvas.width);
    const fillColor = hexToRgb(currentColor);
    
    // Don't fill if clicking on the same color
    if (colorsMatch(targetColor, fillColor)) return;
    
    // Don't fill if clicking on black (likely the pill outline)
    if (targetColor.r < 50 && targetColor.g < 50 && targetColor.b < 50) return;
    
    // Perform flood fill
    const filled = new Set();
    const stack = [[x, y]];
    
    while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        const key = `${cx},${cy}`;
        
        if (filled.has(key) || cx < 0 || cx >= tempCanvas.width || cy < 0 || cy >= tempCanvas.height) continue;
        
        const idx = (cy * tempCanvas.width + cx) * 4;
        const currentPixelColor = {
            r: pixels[idx],
            g: pixels[idx + 1],
            b: pixels[idx + 2],
            a: pixels[idx + 3]
        };
        
        // Skip if not target color or if it's black (boundary)
        if (!colorsMatch(currentPixelColor, targetColor) || 
            (currentPixelColor.r < 50 && currentPixelColor.g < 50 && currentPixelColor.b < 50)) {
            continue;
        }
        
        filled.add(key);
        
        // Fill pixel
        pixels[idx] = fillColor.r;
        pixels[idx + 1] = fillColor.g;
        pixels[idx + 2] = fillColor.b;
        pixels[idx + 3] = fillColor.a;
        
        // Add neighbors
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    
    // Apply the fill to the main canvas
    ctx.putImageData(imageData, 0, 0);
    
    // Re-composite to ensure base layer is preserved
    compositeCanvases();
    
    // Save to history
    drawingHistory.push({type: 'fill', imageData: ctx.getImageData(0, 0, canvas.width, canvas.height)});
}

// Helper functions for fill
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

function colorsMatch(c1, c2, tolerance = 5) {
    return Math.abs(c1.r - c2.r) < tolerance &&
           Math.abs(c1.g - c2.g) < tolerance &&
           Math.abs(c1.b - c2.b) < tolerance &&
           Math.abs(c1.a - c2.a) < tolerance;
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

// Undo functionality
function undo() {
    if (drawingHistory.length > 0) {
        drawingHistory.pop();
        redrawCanvas();
    }
}

// Clear canvas
function clearCanvas() {
    if (confirm('Are you sure you want to clear everything?')) {
        drawingHistory = [];
        redrawCanvas();
    }
}

// Redraw canvas
function redrawCanvas() {
    // Clear the main canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Always draw base layer first
    if (baseImageLoaded) {
        ctx.drawImage(baseCanvas, 0, 0);
    }
    
    // Redraw all the drawing history on top
    drawingHistory.forEach(item => {
        if (item.type === 'fill' && item.imageData) {
            // For fill operations, we need to extract just the drawing layer
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(item.imageData, 0, 0);
            
            // Clear and redraw
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(tempCanvas, 0, 0);
        } else if (Array.isArray(item) && item.length > 0) {
            // Draw path
            ctx.beginPath();
            ctx.moveTo(item[0].x, item[0].y);
            
            for (let i = 1; i < item.length; i++) {
                ctx.lineWidth = item[i].size;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                if (item[i].tool === 'eraser') {
                    ctx.strokeStyle = 'white';
                } else {
                    ctx.strokeStyle = item[i].color;
                }
                
                ctx.lineTo(item[i].x, item[i].y);
                ctx.stroke();
            }
        }
    });
}

// Complete pill
async function completePill() {
    const pillName = document.getElementById('pillNameInput').value.trim();
    
    if (!pillName) {
        alert('Please enter a pill name!');
        return;
    }
    
    const completeBtn = document.getElementById('completeBtn');
    completeBtn.disabled = true;
    completeBtn.textContent = 'creating...';
    
    // Check rate limit
    const now = Date.now();
    createdPills = createdPills.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
    
    if (createdPills.length >= RATE_LIMIT) {
        showRateLimitWarning();
        completeBtn.disabled = false;
        completeBtn.textContent = 'create pill';
        return;
    }
    
    // Create final composite for saving
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = canvas.width;
    finalCanvas.height = canvas.height;
    const finalCtx = finalCanvas.getContext('2d');
    
    // Draw white background
    finalCtx.fillStyle = 'white';
    finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    
    // Draw base layer
    if (baseImageLoaded) {
        finalCtx.drawImage(baseCanvas, 0, 0);
    }
    
    // Draw user drawings
    finalCtx.drawImage(canvas, 0, 0);
    
    // Convert canvas to blob and save
    finalCanvas.toBlob(async (blob) => {
        try {
            // Convert blob to base64 for localStorage (in real app, upload to Firebase)
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = reader.result;
                
                // Create pill object
                const newPill = {
                    id: `pill-${Date.now()}`,
                    name: pillName,
                    imageUrl: base64data,
                    creator: generateWalletAddress(),
                    createdAt: new Date().toISOString(),
                    upvotes: 0
                };
                
                // Save to localStorage (in real app, save to Firebase)
                let userPills = JSON.parse(localStorage.getItem('userPills') || '[]');
                userPills.unshift(newPill);
                localStorage.setItem('userPills', JSON.stringify(userPills));
                
                createdPills.push(now);
                
                // Show success modal
                document.getElementById('completionModal').classList.add('active');
                
                // Reset form
                document.getElementById('pillNameInput').value = '';
                completeBtn.disabled = true;
            };
            reader.readAsDataURL(blob);
            
        } catch (error) {
            console.error('Error creating pill:', error);
            alert('Error creating pill. Please try again.');
        } finally {
            completeBtn.disabled = false;
            completeBtn.textContent = 'create pill';
        }
    }, 'image/png');
}

// Generate random wallet address
function generateWalletAddress() {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let address = '';
    for (let i = 0; i < 7; i++) {
        address += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return address;
}

// Show rate limit warning
function showRateLimitWarning() {
    const warning = document.getElementById('rateLimitWarning');
    const timeEl = document.getElementById('cooldownTime');
    
    const oldest = Math.min(...createdPills);
    const timeRemaining = Math.ceil((RATE_LIMIT_WINDOW - (Date.now() - oldest)) / 1000);
    
    timeEl.textContent = timeRemaining;
    warning.classList.remove('hidden');
    
    const interval = setInterval(() => {
        const remaining = Math.ceil((RATE_LIMIT_WINDOW - (Date.now() - oldest)) / 1000);
        if (remaining <= 0) {
            warning.classList.add('hidden');
            clearInterval(interval);
        } else {
            timeEl.textContent = remaining;
        }
    }, 1000);
}
