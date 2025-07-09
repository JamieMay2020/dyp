// Canvas and Drawing Variables
let canvas, ctx;
let baseCanvas, baseCtx;
let isDrawing = false;
let currentColor = '#000000';
let currentSize = 5;
let currentTool = 'brush';
let drawingHistory = [];
let currentPath = [];
let baseImageData = null;

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

// Setup Canvas
function setupCanvas() {
    canvas = document.getElementById('drawingCanvas');
    ctx = canvas.getContext('2d');
    baseCanvas = document.getElementById('baseCanvas');
    baseCtx = baseCanvas.getContext('2d');

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('mousemove', updateCoordinates);

    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
}

// Load pill base image
function loadPillBase() {
    baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);

    const baseImage = new Image();
    baseImage.onload = function () {
        baseCtx.fillStyle = 'white';
        baseCtx.fillRect(0, 0, baseCanvas.width, baseCanvas.height);

        const maxSize = baseCanvas.width * 0.8;
        const scale = Math.min(maxSize / baseImage.width, maxSize / baseImage.height);
        const scaledWidth = baseImage.width * scale;
        const scaledHeight = baseImage.height * scale;
        const x = (baseCanvas.width - scaledWidth) / 2;
        const y = (baseCanvas.height - scaledHeight) / 2;

        baseCtx.drawImage(baseImage, x, y, scaledWidth, scaledHeight);
    };

    baseImage.onerror = function () {
        drawDefaultPillShape();
    };

    baseImage.src = 'images/pill-base.png';
}

// Fallback: draw pill if image doesn't load
function drawDefaultPillShape() {
    baseCtx.fillStyle = 'white';
    baseCtx.fillRect(0, 0, baseCanvas.width, baseCanvas.height);
    baseCtx.strokeStyle = '#000000';
    baseCtx.lineWidth = 3;

    const centerX = baseCanvas.width / 2;
    const centerY = baseCanvas.height / 2;
    const width = 300;
    const height = 150;
    const radius = height / 2;

    baseCtx.beginPath();
    baseCtx.arc(centerX - width/2 + radius, centerY, radius, Math.PI/2, Math.PI*1.5);
    baseCtx.lineTo(centerX + width/2 - radius, centerY - radius);
    baseCtx.arc(centerX + width/2 - radius, centerY, radius, Math.PI*1.5, Math.PI/2);
    baseCtx.lineTo(centerX - width/2 + radius, centerY + radius);
    baseCtx.closePath();
    baseCtx.stroke();
}

// Update coordinates display
function updateCoordinates(e) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e ? Math.floor(e.clientX - rect.left) : 0;
    const y = e ? Math.floor(e.clientY - rect.top) : 0;
    document.getElementById('coordinates').textContent = `${x}, ${y}`;
}

// Drawing Tools Setup
function setupDrawingTools() {
    const brushTool = document.getElementById('brushTool');
    const fillTool = document.getElementById('fillTool');
    const eraserTool = document.getElementById('eraserTool');

    brushTool.addEventListener('click', () => selectTool('brush'));
    fillTool.addEventListener('click', () => selectTool('fill'));
    eraserTool.addEventListener('click', () => selectTool('eraser'));

    const brushSize = document.getElementById('brushSize');
    const sizeDisplay = document.getElementById('sizeDisplay');

    brushSize.addEventListener('input', (e) => {
        currentSize = parseInt(e.target.value);
        sizeDisplay.textContent = `${currentSize}px`;
    });

    document.getElementById('undoBtn').addEventListener('click', undo);
    document.getElementById('clearBtn').addEventListener('click', clearCanvas);
    document.getElementById('completeBtn').addEventListener('click', completePill);
}

// Tool selection
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

// Color palette
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

// Drawing handlers
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

    ctx.globalCompositeOperation = (currentTool === 'eraser') ? 'destination-out' : 'source-over';
    ctx.strokeStyle = currentColor;

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

// Undo/clear
function undo() {
    if (drawingHistory.length > 0) {
        drawingHistory.pop();
        redrawCanvas();
    }
}

function clearCanvas() {
    if (confirm('Are you sure you want to clear everything?')) {
        drawingHistory = [];
        redrawCanvas();
    }
}

// Redraw canvas (draw only drawing layer)
function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawingHistory.forEach(item => {
        if (item.type === 'fill') {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imageData.data;

            item.pixels.forEach(([x, y]) => {
                const idx = (y * canvas.width + x) * 4;
                pixels[idx] = item.color.r;
                pixels[idx + 1] = item.color.g;
                pixels[idx + 2] = item.color.b;
                pixels[idx + 3] = 255;
            });

            ctx.putImageData(imageData, 0, 0);
        } else if (item.length > 0) {
            ctx.beginPath();
            ctx.moveTo(item[0].x, item[0].y);
            for (let i = 1; i < item.length; i++) {
                ctx.lineWidth = item[i].size;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.globalCompositeOperation = item[i].tool === 'eraser' ? 'destination-out' : 'source-over';
                ctx.strokeStyle = item[i].color;
                ctx.lineTo(item[i].x, item[i].y);
                ctx.stroke();
            }
        }
    });

    ctx.globalCompositeOperation = 'source-over';
}

// Fill tool
function fillArea(e) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(e.clientX - rect.left);
    const y = Math.floor(e.clientY - rect.top);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const targetColor = getPixelColor(pixels, x, y, canvas.width);
    const fillColor = hexToRgb(currentColor);
    if (colorsMatch(targetColor, fillColor)) return;
    if (targetColor.r < 50 && targetColor.g < 50 && targetColor.b < 50) return;

    const filled = new Set();
    const stack = [[x, y]];

    while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        const key = `${cx},${cy}`;
        if (filled.has(key) || cx < 0 || cx >= canvas.width || cy < 0 || cy >= canvas.height) continue;
        const idx = (cy * canvas.width + cx) * 4;
        const currentColor = {
            r: pixels[idx],
            g: pixels[idx + 1],
            b: pixels[idx + 2],
            a: pixels[idx + 3]
        };
        if (!colorsMatch(currentColor, targetColor) || (currentColor.r < 50 && currentColor.g < 50 && currentColor.b < 50)) continue;
        filled.add(key);
        pixels[idx] = fillColor.r;
        pixels[idx + 1] = fillColor.g;
        pixels[idx + 2] = fillColor.b;
        pixels[idx + 3] = fillColor.a;
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }

    ctx.putImageData(imageData, 0, 0);
    saveCanvasState();
}

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

// Touch support
function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent(
        e.type === 'touchstart' ? 'mousedown' : e.type === 'touchmove' ? 'mousemove' : 'mouseup',
        {
            clientX: touch.clientX,
            clientY: touch.clientY
        }
    );
    canvas.dispatchEvent(mouseEvent);
}

// Save canvas state
function saveCanvasState() {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    drawingHistory.push({ type: 'state', data: imageData });
}

// Create pill
async function completePill() {
    const pillName = document.getElementById('pillNameInput').value.trim();
    if (!pillName) return alert('Please enter a pill name!');
    const completeBtn = document.getElementById('completeBtn');
    completeBtn.disabled = true;
    completeBtn.textContent = 'creating...';
    const now = Date.now();
    createdPills = createdPills.filter(t => now - t < RATE_LIMIT_WINDOW);
    if (createdPills.length >= RATE_LIMIT) {
        showRateLimitWarning();
        completeBtn.disabled = false;
        completeBtn.textContent = 'create pill';
        return;
    }

    canvas.toBlob(async (blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result;
            const newPill = {
                id: `pill-${Date.now()}`,
                name: pillName,
                imageUrl: base64data,
                creator: generateWalletAddress(),
                createdAt: new Date().toISOString(),
                upvotes: 0
            };
            let userPills = JSON.parse(localStorage.getItem('userPills') || '[]');
            userPills.unshift(newPill);
            localStorage.setItem('userPills', JSON.stringify(userPills));
            createdPills.push(now);
            document.getElementById('completionModal').classList.add('active');
            document.getElementById('pillNameInput').value = '';
            completeBtn.disabled = true;
        };
        reader.readAsDataURL(blob);
        completeBtn.disabled = false;
        completeBtn.textContent = 'create pill';
    }, 'image/png');
}

function generateWalletAddress() {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let address = '';
    for (let i = 0; i < 7; i++) {
        address += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return address;
}

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
