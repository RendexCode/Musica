const dropZone = document.getElementById('dropZone');
const audioInput = document.getElementById('audioInput');
const uploadBtn = document.getElementById('uploadBtn');
const toggleHudBtn = document.getElementById('toggleHudBtn');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const timeDisplay = document.getElementById('timeDisplay');
const currentDuration = document.getElementById('currentDuration');
const totalDuration = document.getElementById('totalDuration');
const playhead = document.getElementById('playhead');
const trackWrapper = document.querySelector('.timeline-track-wrapper');
const videoViewport = document.getElementById('videoViewport');
const canvas = document.getElementById('visualizerCanvas');
const ctx = canvas.getContext('2d');

const waveformCanvas = document.getElementById('waveformCanvas');
const wCtx = waveformCanvas.getContext('2d');

let audioCtx;
let audio;
let audioSource;
let analyser;
let bufferLength;
let dataArray;
let animationId;
let rotationAngle = 0;

// Presets and Themes state
let activeMode = 'bars';
let activeTheme = 'blue';

// Particle system variables
let particles = [];
const maxParticles = 80;

// Resize canvas inside viewport
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Set up Waveform Track seekbar sizing
function resizeWaveformCanvas() {
    waveformCanvas.width = trackWrapper.clientWidth;
    waveformCanvas.height = trackWrapper.clientHeight;
    drawWaveform();
}
window.addEventListener('resize', resizeWaveformCanvas);
setTimeout(resizeWaveformCanvas, 200);

// Draw mock waveform inside seekbar
function drawWaveform() {
    wCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    wCtx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    const barWidth = 3;
    const gap = 2;
    const totalBars = Math.floor(waveformCanvas.width / (barWidth + gap));
    
    // Draw pseudo random lines for the track waveform
    for (let i = 0; i < totalBars; i++) {
        // Create a wave shape (high in middle, low at sides)
        const factor = Math.sin((i / totalBars) * Math.PI);
        const height = (Math.random() * 20 + 5) * factor;
        const x = i * (barWidth + gap);
        const y = (waveformCanvas.height - height) / 2;
        wCtx.fillRect(x, y, barWidth, height);
    }
}

// Particle Class for Cosmos style
class Particle {
    constructor(x, y) {
        this.x = x || Math.random() * canvas.width;
        this.y = y || Math.random() * canvas.height;
        this.size = Math.random() * 2 + 1;
        this.vx = (Math.random() - 0.5) * 1.2;
        this.vy = (Math.random() - 0.5) * 1.2;
        this.hue = Math.random() * 360;
        this.alpha = Math.random() * 0.4 + 0.6;
    }

    update(intensity) {
        const speedMultiplier = 1 + (intensity * 0.05);
        this.x += this.vx * speedMultiplier;
        this.y += this.vy * speedMultiplier;

        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
        this.hue = (this.hue + 0.5) % 360;
    }

    draw(intensity) {
        const dynamicSize = this.size + (intensity * 0.03);
        ctx.beginPath();
        ctx.arc(this.x, this.y, dynamicSize, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 95%, 70%, ${this.alpha})`;
        ctx.fill();
    }
}

function initParticles() {
    particles = [];
    for (let i = 0; i < maxParticles; i++) {
        particles.push(new Particle());
    }
}

// Format duration to MM:SS
function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// Track seekbar interaction
trackWrapper.addEventListener('click', (e) => {
    if (!audio) return;
    const rect = trackWrapper.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percent * audio.duration;
    updateSeekhead();
});

function updateSeekhead() {
    if (!audio) return;
    const percent = (audio.currentTime / audio.duration) * 100;
    playhead.style.left = `${percent}%`;
    if (timeDisplay) {
        timeDisplay.textContent = formatTime(audio.currentTime);
    }
    currentDuration.textContent = formatTime(audio.currentTime);
}

// Theme toggles listener
document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        const newTheme = e.target.getAttribute('data-theme');
        videoViewport.className = `video-viewport theme-${newTheme}`;
        activeTheme = newTheme;
    });
});

// HUD Toggle listener
let hudHidden = false;
toggleHudBtn.addEventListener('click', () => {
    hudHidden = !hudHidden;
    const mainPreview = document.querySelector('.main-preview');
    if (hudHidden) {
        mainPreview.classList.add('hud-hidden');
        toggleHudBtn.classList.add('active');
        toggleHudBtn.querySelector('span').textContent = 'Mostrar Info';
    } else {
        mainPreview.classList.remove('hud-hidden');
        toggleHudBtn.classList.remove('active');
        toggleHudBtn.querySelector('span').textContent = 'Ocultar Info';
    }
});

// Preset switching listener
document.querySelectorAll('.preset-card').forEach(card => {
    card.addEventListener('click', (e) => {
        const target = e.currentTarget;
        document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
        target.classList.add('active');
        activeMode = target.getAttribute('data-style');
        
        if (activeMode === 'particles') {
            initParticles();
        }
    });
});

// Native HTML label triggers audioInput click automatically

// Click viewport to load music (highly useful on mobile devices)
videoViewport.addEventListener('click', () => {
    audioInput.click();
});

window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
});

window.addEventListener('dragover', (e) => e.preventDefault());

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        handleAudioFile(e.dataTransfer.files[0]);
    }
});

audioInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleAudioFile(e.target.files[0]);
    }
});

function handleAudioFile(file) {
    if (!file.type.startsWith('audio/')) {
        alert('Por favor, selecciona un archivo de audio compatible.');
        return;
    }

    // Set Track info
    trackTitle.textContent = file.name.replace(/\.[^/.]+$/, ""); // Name without extension
    trackArtist.textContent = 'Música Importada';

    const fileURL = URL.createObjectURL(file);

    if (audio) {
        audio.pause();
    }

    audio = new Audio();
    audio.src = fileURL;
    audio.crossOrigin = "anonymous";
    audio.loop = true;

    // Remove disabled state from timeline play button
    playBtn.classList.remove('disabled');
    playBtn.removeAttribute('disabled');
    
    audio.addEventListener('loadedmetadata', () => {
        totalDuration.textContent = formatTime(audio.duration);
    });

    audio.addEventListener('timeupdate', updateSeekhead);

    playBtn.classList.add('hidden');
    pauseBtn.classList.remove('hidden');

    setupAudioContext();
    audio.play();
}

function setupAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioSource) {
        audioSource.disconnect();
    }

    analyser = audioCtx.createAnalyser();
    audioSource = audioCtx.createMediaElementSource(audio);

    audioSource.connect(analyser);
    analyser.connect(audioCtx.destination);

    analyser.fftSize = 256;
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    if (animationId) cancelAnimationFrame(animationId);
    draw();
}

// Play / Pause triggers
playBtn.addEventListener('click', () => {
    if (audio) {
        audioCtx.resume();
        audio.play();
        playBtn.classList.add('hidden');
        pauseBtn.classList.remove('hidden');
    }
});

pauseBtn.addEventListener('click', () => {
    if (audio) {
        audio.pause();
        playBtn.classList.remove('hidden');
        pauseBtn.classList.add('hidden');
    }
});

// Render loop containing multiple visual presets
function draw() {
    animationId = requestAnimationFrame(draw);

    if (!analyser) return;

    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
    }
    const average = sum / bufferLength;

    // Pulse the center time circle with the beat
    const timeCircle = document.querySelector('.time-circle');
    if (timeCircle) {
        const scaleVal = 1 + (average / 255) * 0.12;
        timeCircle.style.transform = `scale(${scaleVal})`;
    }

    // Cycle color shift
    if (!window.colorShift) window.colorShift = 0;
    window.colorShift = (window.colorShift + 0.4) % 360;

    const halfWidth = canvas.width / 2;
    const barWidth = Math.ceil(halfWidth / bufferLength);

    if (activeMode === 'bars') {
        const maxBarHeight = canvas.height * 0.65;
        for (let i = 0; i < bufferLength; i++) {
            const value = dataArray[i];
            const boost = Math.pow(i / bufferLength, 0.4) * 1.3;
            const barHeight = Math.max(2, (value / 255) * maxBarHeight * (0.1 + boost * 0.9));

            const xRight = halfWidth + (i * barWidth);
            const xLeft = halfWidth - (i * barWidth) - barWidth;
            const y = canvas.height - barHeight;

            const gradient = ctx.createLinearGradient(0, canvas.height, 0, y);
            const hueStart = (i / bufferLength) * 100 + window.colorShift;
            const hueEnd = hueStart + 80;

            gradient.addColorStop(0, `hsla(${hueStart}, 95%, 50%, 0.05)`);
            gradient.addColorStop(0.5, `hsla(${hueStart + 40}, 95%, 60%, 0.6)`);
            gradient.addColorStop(1, `hsla(${hueEnd}, 95%, 70%, 0.95)`);

            ctx.fillStyle = gradient;
            const drawWidth = Math.max(1, barWidth - 1);
            ctx.fillRect(xRight, y, drawWidth, barHeight);
            ctx.fillRect(xLeft, y, drawWidth, barHeight);
        }
    } 
    else if (activeMode === 'double') {
        const centerY = canvas.height * 0.5;
        const maxBarHeight = canvas.height * 0.35;
        for (let i = 0; i < bufferLength; i++) {
            const value = dataArray[i];
            const boost = Math.pow(i / bufferLength, 0.4) * 1.3;
            const barHeight = (value / 255) * maxBarHeight * (0.1 + boost * 0.9);

            const xRight = halfWidth + (i * barWidth);
            const xLeft = halfWidth - (i * barWidth) - barWidth;

            const hue = (i / bufferLength) * 180 + window.colorShift;
            ctx.fillStyle = `hsla(${hue}, 95%, 60%, ${0.5 + (value / 255) * 0.5})`;

            const drawWidth = Math.max(1, barWidth - 1);
            ctx.fillRect(xRight, centerY - barHeight, drawWidth, barHeight * 2);
            ctx.fillRect(xLeft, centerY - barHeight, drawWidth, barHeight * 2);
        }
    } 
    else if (activeMode === 'line') {
        const centerY = canvas.height * 0.5;
        const maxWaveHeight = canvas.height * 0.35;
        
        // Jitter scales up with volume for a violent electric reaction
        const volumeFactor = average / 255;
        const baseJitter = 3 + volumeFactor * 25; 
        
        const numPoints = bufferLength;
        const segmentWidth = halfWidth / (numPoints - 1);
        
        ctx.lineCap = 'round';
        ctx.lineJoin = 'miter'; // Jagged sharp corners for lightning bolts
        
        // Symmetrical electric height points calculator
        const getLightningPoints = () => {
            const pts = [];
            for (let i = 0; i < numPoints; i++) {
                const value = dataArray[i];
                const boost = Math.pow(i / numPoints, 0.4) * 1.3;
                
                // Rapid electric jitter noise
                const jitter = (Math.random() - 0.5) * baseJitter;
                const height = ((value / 255) * maxWaveHeight * (0.1 + boost * 0.9)) + jitter;
                pts.push(height);
            }
            return pts;
        };
        
        const leftPoints = getLightningPoints();
        
        // Helper to draw a single lightning path
        const drawLightningPath = () => {
            ctx.beginPath();
            ctx.moveTo(0, centerY);
            
            // Left side jagged line
            for (let i = numPoints - 1; i >= 0; i--) {
                const x = halfWidth - (i * segmentWidth);
                const y = centerY - leftPoints[i];
                ctx.lineTo(x, y);
            }
            
            // Right side jagged line (mirrored)
            for (let i = 0; i < numPoints; i++) {
                const x = halfWidth + (i * segmentWidth);
                const y = centerY - leftPoints[i];
                ctx.lineTo(x, y);
            }
            
            ctx.lineTo(canvas.width, centerY);
        };
        
        // Fast electrical flicker
        const flicker = Math.random() > 0.15 ? 1.0 : 0.4;
        const hue = window.colorShift;
        
        // Layer 1: Thick Outer Electric Aura (Cyan/Blue/Purple)
        ctx.strokeStyle = `hsla(${hue}, 95%, 60%, ${0.35 * flicker})`;
        ctx.lineWidth = 8 + volumeFactor * 12;
        ctx.shadowBlur = 25 * flicker;
        ctx.shadowColor = `hsla(${hue}, 95%, 65%, 1)`;
        drawLightningPath();
        ctx.stroke();
        
        // Layer 2: Medium Inner Plasma Core
        ctx.strokeStyle = `hsla(${hue + 30}, 95%, 75%, ${0.7 * flicker})`;
        ctx.lineWidth = 3 + volumeFactor * 5;
        ctx.shadowBlur = 10;
        drawLightningPath();
        ctx.stroke();
        
        // Layer 3: Thin Hot-White Lightning Core
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.95 * flicker})`;
        ctx.lineWidth = 1.2;
        ctx.shadowBlur = 0;
        drawLightningPath();
        ctx.stroke();
        
        // Layer 4: Occasional vertical spark discharges shooting outward from high energy nodes
        for (let i = 0; i < numPoints; i += 6) {
            const value = dataArray[i];
            if (value > 150 && Math.random() > 0.85) {
                const side = Math.random() > 0.5 ? 1 : -1;
                const x = halfWidth + (i * segmentWidth) * side;
                const yStart = centerY - leftPoints[i];
                
                ctx.beginPath();
                ctx.moveTo(x, yStart);
                
                let cx = x;
                let cy = yStart;
                const steps = 4;
                const dischargeLength = (value / 255) * 45;
                const direction = Math.random() > 0.5 ? 1 : -1;
                
                for (let s = 0; s < steps; s++) {
                    cx += (Math.random() - 0.5) * 15;
                    cy += direction * (dischargeLength / steps) + (Math.random() - 0.5) * 5;
                    ctx.lineTo(cx, cy);
                }
                
                ctx.strokeStyle = `hsla(${hue + 60}, 95%, 85%, ${0.75 * flicker})`;
                ctx.lineWidth = 1.0;
                ctx.stroke();
            }
        }
    } 
    else if (activeMode === 'circle') {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const baseRadius = 52 + (average * 0.15);
        const maxBarHeight = 40;

        rotationAngle += 0.003;

        // Draw symmetrical circle
        for (let i = 0; i < bufferLength; i++) {
            const value = dataArray[i];
            const barHeight = (value / 255) * maxBarHeight;

            const angleRight = (i / bufferLength) * Math.PI + rotationAngle;
            const angleLeft = - (i / bufferLength) * Math.PI + rotationAngle;

            const drawBar = (angle) => {
                const xStart = centerX + Math.cos(angle) * baseRadius;
                const yStart = centerY + Math.sin(angle) * baseRadius;
                const xEnd = centerX + Math.cos(angle) * (baseRadius + barHeight);
                const yEnd = centerY + Math.sin(angle) * (baseRadius + barHeight);

                const hue = (i / bufferLength) * 180 + window.colorShift;
                ctx.strokeStyle = `hsla(${hue}, 95%, 65%, 0.8)`;
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(xStart, yStart);
                ctx.lineTo(xEnd, yEnd);
                ctx.stroke();
            };

            drawBar(angleRight);
            drawBar(angleLeft);
        }
    } 
    else if (activeMode === 'particles') {
        // Render reactive particle space (Cosmos style)
        particles.forEach(p => {
            p.update(average);
            p.draw(average);
        });

        // Constellation lines
        const maxDist = 70 + (average * 0.1);
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < maxDist) {
                    const alpha = (1 - (dist / maxDist)) * (0.15 + (average / 255) * 0.45);
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `hsla(${particles[i].hue}, 95%, 70%, ${alpha})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }
    } 
    else if (activeMode === 'blocks') {
        const maxBarHeight = canvas.height * 0.65;
        const blockSize = 6;
        const blockGap = 3;

        for (let i = 0; i < bufferLength; i++) {
            const value = dataArray[i];
            const boost = Math.pow(i / bufferLength, 0.4) * 1.3;
            const barHeight = (value / 255) * maxBarHeight * (0.1 + boost * 0.9);

            const xRight = halfWidth + (i * barWidth);
            const xLeft = halfWidth - (i * barWidth) - barWidth;
            const drawWidth = Math.max(1, barWidth - 1);

            const numBlocks = Math.floor(barHeight / (blockSize + blockGap));
            const hue = (i / bufferLength) * 240 + window.colorShift;
            ctx.fillStyle = `hsla(${hue}, 95%, 65%, 0.9)`;

            for (let b = 0; b < numBlocks; b++) {
                const y = canvas.height - (b * (blockSize + blockGap)) - blockSize;
                ctx.fillRect(xRight, y, drawWidth, blockSize);
                ctx.fillRect(xLeft, y, drawWidth, blockSize);
            }
        }
    }
}
