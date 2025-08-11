// Data docelowa powrotu - 17 sierpnia 2025, godzina 21:20 czasu polskiego (CEST)
const targetDate = new Date('2025-08-17T21:20:00+02:00');
const username = 'Piotr20111';

// Data startowa - ustawiana przy rozpoczęciu danego odliczania
let startDate;
let firebaseDb, firebaseRef, firebaseSet, firebaseGet, firebaseOnValue;
let countdownInterval;
let finalCountdownInterval;
let liveStatusInterval;

// Poczekaj na gotowe Firebase
window.addEventListener('firebaseReady', () => {
    firebaseDb = window.firebaseDb;
    firebaseRef = window.firebaseRef;
    firebaseSet = window.firebaseSet;
    firebaseGet = window.firebaseGet;
    firebaseOnValue = window.firebaseOnValue;
    
    initializeCountdown();
});

// Inicjalizacja odliczania z Firebase
async function initializeCountdown() {
    const userRef = firebaseRef(firebaseDb, `users/${username}`);
    const currentTargetISO = targetDate.toISOString();
    
    try {
        // Pobierz istniejące dane użytkownika
        const snapshot = await firebaseGet(userRef);
        const data = snapshot.val();
        
        // Ustal czy resetować startDate (nowe odliczanie do powrotu)
        const shouldReset = !data ||
                            !data.startDate ||
                            data.targetDate !== currentTargetISO ||
                            data.completed === true;
        
        if (shouldReset) {
            // Nowe odliczanie - ustawiamy start na TERAZ
            startDate = new Date();
            await firebaseSet(userRef, {
                username: username,
                startDate: startDate.toISOString(),
                targetDate: currentTargetISO,
                hotelName: 'Kamelya Fulya',
                purpose: 'return',
                completed: false,
                firstVisit: data && data.firstVisit ? data.firstVisit : new Date().toISOString()
            });
            console.log('🆕 Nowe odliczanie do powrotu od:', startDate);
        } else {
            // Kontynuuj istniejące odliczanie
            startDate = new Date(data.startDate);
            console.log('📅 Kontynuuję zapisany start:', startDate);
        }
        
        // Uaktualnij daty w UI
        document.getElementById('start-date').textContent = formatDate(startDate);
        document.getElementById('end-date').textContent = formatDate(targetDate);
        
        // Uaktualnij nagłówek z czytelną datą
        const dateInfo = document.querySelector('.date-info');
        if (dateInfo) dateInfo.textContent = formatDateLongPL(targetDate);
        
        updateSyncStatus(true);
        
        // Start aktualizacji live
        startRealtimeUpdates();
        
    } catch (error) {
        console.error('Firebase error:', error);
        updateSyncStatus(false);
        // Jeśli błąd Firebase - użyj bieżącej daty jako start
        startDate = new Date();
        document.getElementById('start-date').textContent = formatDate(startDate);
        document.getElementById('end-date').textContent = formatDate(targetDate);
    }
    
    // Start odliczania - aktualizacja co 10ms (dokładne animacje)
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 10); // 100 odświeżeń na sekundę
}

// Synchronizacja w czasie rzeczywistym
function startRealtimeUpdates() {
    const statusRef = firebaseRef(firebaseDb, `users/${username}/liveStatus`);
    
    // Zapisuj status co sekundę
    liveStatusInterval = setInterval(() => {
        const now = new Date();
        const difference = targetDate - now;
        
        if (difference > 0) {
            const remainingPercentage = calculateRemainingPercentage();
            
            firebaseSet(statusRef, {
                currentTime: now.toISOString(),
                remainingTime: difference,
                remainingPercentage: remainingPercentage,
                remainingDays: Math.floor(difference / (1000 * 60 * 60 * 24)),
                remainingHours: Math.floor(difference / (1000 * 60 * 60)),
                remainingMinutes: Math.floor(difference / (1000 * 60)),
                remainingSeconds: Math.floor(difference / 1000),
                remainingMilliseconds: difference,
                isLive: true
            });
        } else {
            // Po zakończeniu - zatrzymaj synchronizację
            clearInterval(liveStatusInterval);
        }
    }, 1000);
}

// Oblicz procent pozostałego czasu
function calculateRemainingPercentage() {
    const now = new Date();
    const totalTime = targetDate.getTime() - startDate.getTime();
    const remainingTime = targetDate.getTime() - now.getTime();
    let percentage = (remainingTime / totalTime) * 100;
    return Math.min(Math.max(percentage, 0), 100);
}

// Dynamiczny kolor paska postępu
function getProgressColor(remainingPercentage) {
    if (remainingPercentage < 0.01) {
        const pulse = Math.sin(Date.now() / 100) * 0.5 + 0.5;
        return `linear-gradient(90deg, rgb(255, ${Math.floor(pulse * 50)}, 0), #ff1744, rgb(255, ${Math.floor(pulse * 100)}, 0))`;
    } else if (remainingPercentage < 0.1) {
        return 'linear-gradient(90deg, #ff0000, #ff1744, #ff3333)';
    } else if (remainingPercentage < 1) {
        return 'linear-gradient(90deg, #ff3333, #ff4444, #ff5555)';
    } else if (remainingPercentage < 5) {
        return 'linear-gradient(90deg, #ff5722, #ff6347, #ff7043)';
    } else if (remainingPercentage < 10) {
        return 'linear-gradient(90deg, #ff8a65, #ffa726, #ffb74d)';
    } else if (remainingPercentage < 20) {
        return 'linear-gradient(90deg, #ffb74d, #ffc107, #ffd54f)';
    } else if (remainingPercentage < 30) {
        return 'linear-gradient(90deg, #ffd54f, #ffeb3b, #fff176)';
    } else if (remainingPercentage < 50) {
        return 'linear-gradient(90deg, #aed581, #9ccc65, #8bc34a)';
    } else if (remainingPercentage < 70) {
        return 'linear-gradient(90deg, #4fc3f7, #29b6f6, #03a9f4)';
    } else if (remainingPercentage < 90) {
        return 'linear-gradient(90deg, #42a5f5, #2196f3, #1e88e5)';
    } else {
        return 'linear-gradient(90deg, #667eea, #764ba2, #8e44ad)';
    }
}

// Aktualizacja UI odliczania
let lastSecond = -1;
let lastPercentage = -1;
let finalCountdownActive = false;
let lastMilliseconds = -1;

function updateCountdown() {
    const now = new Date();
    const difference = targetDate - now;
    
    // Koniec odliczania
    if (difference <= 0) {
        showVacationMessage(); // teraz: ekran "powrotu"
        return;
    }
    
    // Składniki czasu
    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);
    const milliseconds = difference % 1000;
    const totalSeconds = Math.floor(difference / 1000);
    
    // Ostatnie 60 sekund
    if (totalSeconds <= 60 && !finalCountdownActive) {
        finalCountdownActive = true;
        activateFinalCountdown();
        
        // Szybsze odświeżanie
        clearInterval(countdownInterval);
        finalCountdownInterval = setInterval(updateCountdown, 10);
    }
    
    if (finalCountdownActive) {
        const preciseSeconds = difference / 1000;
        const displaySeconds = Math.floor(preciseSeconds);
        const displayMilliseconds = Math.floor((preciseSeconds - displaySeconds) * 1000);
        
        document.getElementById('countdown').innerHTML = `
            <div class="final-seconds-container">
                <div class="final-seconds-box" id="final-box">
                    <span class="final-seconds-number" id="final-seconds">${displaySeconds}</span>
                    <span class="final-milliseconds">.${String(displayMilliseconds).padStart(3, '0')}</span>
                    <span class="final-seconds-label">SEKUND DO POWROTU!</span>
                </div>
                <div class="final-countdown-effects">
                    <div class="pulse-ring"></div>
                    <div class="pulse-ring"></div>
                    <div class="pulse-ring"></div>
                </div>
                <div class="sparkles-container" id="sparkles"></div>
            </div>
        `;
        
        const finalBox = document.getElementById('final-box');
        const hue = (displaySeconds / 60) * 120; // czerwony -> zielony
        finalBox.style.background = `linear-gradient(135deg, hsl(${hue}, 100%, 50%), hsl(${hue + 30}, 100%, 40%))`;
        
        if (displaySeconds <= 10) {
            finalBox.classList.add('shake-animation');
            createContinuousSparkles();
        }
        
        if (displaySeconds <= 5) {
            createIntenseFireworks();
        }
        
        if (milliseconds !== lastMilliseconds && milliseconds < 100) {
            createBurstEffect();
        }
        
        lastMilliseconds = milliseconds;
        
    } else {
        // Standardowy widok
        if (seconds !== lastSecond) {
            document.getElementById('days').textContent = String(days).padStart(2, '0');
            document.getElementById('hours').textContent = String(hours).padStart(2, '0');
            document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
            document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
            
            animateTimeBox(document.getElementById('seconds').parentElement);
            lastSecond = seconds;
        }
    }
    
    // Procenty
    const remainingPercentage = calculateRemainingPercentage();
    const usedPercentage = 100 - remainingPercentage;
    
    const progressFill = document.getElementById('progress-fill');
    progressFill.style.width = usedPercentage + '%';
    progressFill.style.transition = 'width 0.1s linear';
    progressFill.style.background = getProgressColor(remainingPercentage);
    
    const progressText = document.getElementById('progress-text');
    let displayText = '';
    
    if (remainingPercentage < 0.0001) {
        displayText = remainingPercentage.toFixed(7) + '%';
        document.querySelector('.progress-bar').classList.add('pulse-bar');
        progressText.style.fontSize = '1.5rem';
    } else if (remainingPercentage < 0.001) {
        displayText = remainingPercentage.toFixed(6) + '%';
        document.querySelector('.progress-bar').classList.add('pulse-bar');
    } else if (remainingPercentage < 0.01) {
        displayText = remainingPercentage.toFixed(5) + '%';
        document.querySelector('.progress-bar').classList.add('pulse-bar');
    } else if (remainingPercentage < 0.1) {
        displayText = remainingPercentage.toFixed(4) + '%';
        document.querySelector('.progress-bar').classList.add('pulse-bar');
    } else if (remainingPercentage < 1) {
        displayText = remainingPercentage.toFixed(3) + '%';
    } else if (remainingPercentage < 10) {
        displayText = remainingPercentage.toFixed(2) + '%';
    } else {
        displayText = remainingPercentage.toFixed(2) + '%';
        document.querySelector('.progress-bar').classList.remove('pulse-bar');
        progressText.style.fontSize = '1.2rem';
    }
    
    progressText.textContent = displayText;
    
    const progressTitle = document.querySelector('.progress-title');
    if (remainingPercentage < 0.1) {
        progressTitle.innerHTML = `🔥🔥🔥 SEKUNDY DO POWROTU! ${remainingPercentage.toFixed(4)}% 🔥🔥🔥`;
        progressTitle.style.color = '#ff0000';
        progressTitle.style.animation = 'glow 0.2s ease-in-out infinite alternate';
    } else if (remainingPercentage < 1) {
        progressTitle.innerHTML = `🔥 OSTATNIE CHWILE! Pozostało: ${remainingPercentage.toFixed(3)}%`;
        progressTitle.style.color = '#ff1744';
        progressTitle.style.animation = 'glow 0.5s ease-in-out infinite alternate';
    } else if (remainingPercentage < 5) {
        progressTitle.textContent = `🌟 Już niedługo! Pozostało: ${remainingPercentage.toFixed(2)}%`;
        progressTitle.style.color = '#ff5722';
    } else if (remainingPercentage < 10) {
        progressTitle.textContent = `☀️ Coraz bliżej! Pozostało: ${remainingPercentage.toFixed(2)}%`;
        progressTitle.style.color = '#ff8a65';
    } else {
        progressTitle.textContent = `Pozostało do powrotu: ${remainingPercentage.toFixed(2)}%`;
        progressTitle.style.color = '#667eea';
        progressTitle.style.animation = 'none';
    }
    
    if (remainingPercentage < 10 && !finalCountdownActive) {
        document.querySelectorAll('.time-box').forEach(box => {
            box.style.background = getProgressColor(remainingPercentage);
        });
    }
    
    const currentWholePercent = Math.floor(remainingPercentage);
    const lastWholePercent = Math.floor(lastPercentage);
    
    if (lastPercentage !== -1 && currentWholePercent < lastWholePercent && remainingPercentage < 10) {
        createMiniConfetti();
    }
    
    lastPercentage = remainingPercentage;
}

// Aktywuj tryb finałowego odliczania
function activateFinalCountdown() {
    const style = document.createElement('style');
    style.textContent = `
        .final-seconds-container {
            position: relative;
            animation: finalPulse 1s ease-in-out infinite;
        }
        
        .final-seconds-box {
            padding: 3rem 5rem;
            border-radius: 30px;
            box-shadow: 0 0 50px rgba(255, 0, 0, 0.5);
            animation: finalGlow 0.5s ease-in-out infinite alternate;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        
        .final-seconds-box::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: linear-gradient(45deg, transparent, rgba(255,255,255,0.3), transparent);
            animation: shimmer 1s linear infinite;
        }
        
        @keyframes shimmer {
            0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
            100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
        }
        
        .final-seconds-number {
            font-size: 10rem;
            font-weight: 900;
            color: white;
            text-shadow: 0 0 30px rgba(255, 255, 255, 0.8);
            display: inline-block;
            line-height: 1;
        }
        
        .final-milliseconds {
            font-size: 5rem;
            font-weight: 700;
            color: rgba(255, 255, 255, 0.9);
            display: inline-block;
            margin-left: 0.5rem;
        }
        
        .final-seconds-label {
            font-size: 2rem;
            color: white;
            text-transform: uppercase;
            letter-spacing: 3px;
            margin-top: 1rem;
            display: block;
            font-weight: 700;
        }
        
        .final-countdown-effects {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 100%;
            height: 100%;
            pointer-events: none;
        }
        
        .pulse-ring {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 100%;
            height: 100%;
            border: 3px solid rgba(255, 255, 255, 0.5);
            border-radius: 30px;
            animation: pulseRing 1.5s ease-out infinite;
        }
        
        .pulse-ring:nth-child(2) {
            animation-delay: 0.5s;
        }
        
        .pulse-ring:nth-child(3) {
            animation-delay: 1s;
        }
        
        @keyframes finalPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        
        @keyframes finalGlow {
            from { box-shadow: 0 0 30px rgba(255, 0, 0, 0.5); }
            to { box-shadow: 0 0 60px rgba(255, 0, 0, 0.8), 0 0 100px rgba(255, 100, 0, 0.5); }
        }
        
        @keyframes pulseRing {
            0% {
                transform: translate(-50%, -50%) scale(1);
                opacity: 1;
            }
            100% {
                transform: translate(-50%, -50%) scale(1.5);
                opacity: 0;
            }
        }
        
        .shake-animation {
            animation: shake 0.1s ease-in-out infinite !important;
        }
        
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px) rotate(-1deg); }
            75% { transform: translateX(5px) rotate(1deg); }
        }
        
        .sparkles-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            overflow: visible;
        }
        
        .sparkle {
            position: absolute;
            width: 4px;
            height: 4px;
            background: radial-gradient(circle, rgba(255,255,255,1) 0%, transparent 70%);
            border-radius: 50%;
            pointer-events: none;
        }
        
        @keyframes sparkleMove {
            0% {
                transform: translate(0, 0) scale(0);
                opacity: 1;
            }
            50% {
                opacity: 1;
            }
            100% {
                transform: translate(var(--dx), var(--dy)) scale(1.5);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    createFinalCountdownParticles();
}

// Efekty końcówki
function createContinuousSparkles() {
    const sparklesContainer = document.getElementById('sparkles');
    if (!sparklesContainer) return;
    
    for (let i = 0; i < 10; i++) {
        setTimeout(() => {
            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle';
            sparkle.style.left = Math.random() * 100 + '%';
            sparkle.style.top = Math.random() * 100 + '%';
            sparkle.style.setProperty('--dx', (Math.random() - 0.5) * 200 + 'px');
            sparkle.style.setProperty('--dy', (Math.random() - 0.5) * 200 + 'px');
            sparkle.style.animation = 'sparkleMove 1s ease-out forwards';
            sparkle.style.boxShadow = `0 0 ${Math.random() * 10 + 5}px rgba(255, 255, 255, 0.8)`;
            
            sparklesContainer.appendChild(sparkle);
            setTimeout(() => sparkle.remove(), 1000);
        }, i * 100);
    }
}

function createBurstEffect() {
    const colors = ['#fff', '#ffd700', '#ff69b4', '#00ffff', '#ff00ff'];
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'fixed';
        particle.style.width = '6px';
        particle.style.height = '6px';
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        particle.style.borderRadius = '50%';
        particle.style.left = centerX + 'px';
        particle.style.top = centerY + 'px';
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '10000';
        particle.style.boxShadow = `0 0 10px ${particle.style.backgroundColor}`;
        
        document.body.appendChild(particle);
        
        const angle = (i / 20) * Math.PI * 2;
        const velocity = 200 + Math.random() * 200;
        
        particle.animate([
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            { 
                transform: `translate(${Math.cos(angle) * velocity}px, ${Math.sin(angle) * velocity}px) scale(0)`, 
                opacity: 0 
            }
        ], {
            duration: 1500,
            easing: 'cubic-bezier(0, 0, 0.2, 1)'
        }).onfinish = () => particle.remove();
    }
}

function createIntenseFireworks() {
    const colors = ['#ff0000', '#ffd700', '#00ff00', '#00ffff', '#ff00ff', '#ff69b4'];
    
    for (let burst = 0; burst < 3; burst++) {
        setTimeout(() => {
            const x = Math.random() * window.innerWidth;
            const y = Math.random() * window.innerHeight * 0.5;
            
            for (let i = 0; i < 30; i++) {
                const particle = document.createElement('div');
                particle.style.position = 'fixed';
                particle.style.width = '8px';
                particle.style.height = '8px';
                particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                particle.style.borderRadius = '50%';
                particle.style.left = x + 'px';
                particle.style.top = y + 'px';
                particle.style.pointerEvents = 'none';
                particle.style.zIndex = '10000';
                particle.style.boxShadow = `0 0 15px ${particle.style.backgroundColor}`;
                
                document.body.appendChild(particle);
                
                const angle = (i / 30) * Math.PI * 2;
                const velocity = 100 + Math.random() * 200;
                const lifetime = 1000 + Math.random() * 1000;
                
                particle.animate([
                    {
                        transform: 'translate(0, 0) scale(1)',
                        opacity: 1
                    },
                    {
                        transform: `translate(${Math.cos(angle) * velocity}px, ${Math.sin(angle) * velocity + 50}px) scale(0)`,
                        opacity: 0
                    }
                ], {
                    duration: lifetime,
                    easing: 'cubic-bezier(0, 0, 0.2, 1)'
                }).onfinish = () => particle.remove();
            }
        }, burst * 200);
    }
}

function createFinalCountdownParticles() {
    setInterval(() => {
        if (finalCountdownActive) {
            createContinuousSparkles();
        }
    }, 500);
}

function createMiniFireworks() {
    const colors = ['#ff0000', '#ff6347', '#ffd700', '#ff1493', '#00ff00'];
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            const firework = document.createElement('div');
            firework.style.position = 'fixed';
            firework.style.width = '4px';
            firework.style.height = '4px';
            firework.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            firework.style.left = Math.random() * 100 + '%';
            firework.style.top = Math.random() * 50 + '%';
            firework.style.borderRadius = '50%';
            firework.style.pointerEvents = 'none';
            firework.style.zIndex = '10000';
            document.body.appendChild(firework);
            
            const particles = 8;
            for (let j = 0; j < particles; j++) {
                const particle = firework.cloneNode();
                document.body.appendChild(particle);
                const angle = (j / particles) * 360;
                const distance = 50 + Math.random() * 50;
                
                particle.animate([
                    { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                    { 
                        transform: `translate(${Math.cos(angle * Math.PI / 180) * distance}px, 
                                             ${Math.sin(angle * Math.PI / 180) * distance}px) scale(0)`, 
                        opacity: 0 
                    }
                ], {
                    duration: 1000,
                    easing: 'ease-out'
                }).onfinish = () => particle.remove();
            }
            
            firework.remove();
        }, i * 200);
    }
}

// Formatowanie daty krótko
function formatDate(date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

// Formatowanie daty długie po polsku (np. 17 sierpnia 2025 - 21:20)
function formatDateLongPL(date) {
    const months = [
        'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
        'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'
    ];
    const d = date.getDate();
    const m = months[date.getMonth()];
    const y = date.getFullYear();
    const hh = date.getHours().toString().padStart(2, '0');
    const mm = date.getMinutes().toString().padStart(2, '0');
    return `${d} ${m} ${y} - ${hh}:${mm}`;
}

// Status synchronizacji
function updateSyncStatus(synced) {
    const indicator = document.getElementById('sync-indicator');
    const text = document.getElementById('sync-text');
    
    if (synced) {
        indicator.textContent = '✅';
        indicator.classList.add('synced');
        text.textContent = 'Na żywo z Firebase';
    } else {
        indicator.textContent = '❌';
        indicator.classList.remove('synced');
        text.textContent = 'Błąd synchronizacji';
    }
}

// Animacja pudełka czasu
function animateTimeBox(element) {
    element.classList.add('pulse');
    setTimeout(() => {
        element.classList.remove('pulse');
    }, 300);
}

// Ekran po zakończeniu odliczania (powrót)
function showVacationMessage() {
    // Wyczyść timery
    clearInterval(countdownInterval);
    clearInterval(finalCountdownInterval);
    clearInterval(liveStatusInterval);
    
    // Schowaj elementy
    document.getElementById('countdown').style.display = 'none';
    document.querySelector('.progress-section').style.display = 'none';
    document.querySelector('.hotel-info').style.display = 'none';
    document.querySelector('.title').style.display = 'none';
    document.querySelector('.decorations').style.display = 'none';
    
    // Wiadomość finałowa
    const container = document.querySelector('.content');
    container.innerHTML = `
        <div class="vacation-celebration">
            <h1 class="vacation-title">🎉 Czas na powrót! ✈️</h1>
            <p class="vacation-subtitle">Witaj z powrotem i miłego lądowania!</p>
            <div class="plane-flying">✈️</div>
            <div class="continuous-fireworks" id="fireworks-container"></div>
            <canvas id="confetti-canvas" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999;"></canvas>
        </div>
        <style>
            .vacation-celebration {
                padding: 3rem;
                text-align: center;
                position: relative;
                min-height: 400px;
            }
            
            .vacation-title {
                font-size: 4rem;
                color: #ff1744;
                margin-bottom: 1rem;
                animation: celebrationPulse 1s ease-in-out infinite;
                text-shadow: 0 0 20px rgba(255, 23, 68, 0.5);
            }
            
            .vacation-subtitle {
                font-size: 2rem;
                color: #667eea;
                margin-bottom: 2rem;
                font-weight: 600;
                animation: fadeInUp 1s ease-out;
            }
            
            @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .plane-flying {
                font-size: 5rem;
                animation: flyAway 4s ease-in-out infinite;
                margin: 2rem 0;
            }
            
            @keyframes celebrationPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
            
            @keyframes flyAway {
                0% { transform: translateX(-200px) translateY(0) rotate(-10deg); }
                50% { transform: translateX(0) translateY(-30px) rotate(0deg); }
                100% { transform: translateX(200px) translateY(0) rotate(10deg); }
            }
            
            .continuous-fireworks {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                overflow: hidden;
            }
        </style>
    `;
    
    // Zapisz zakończenie w Firebase
    const userRef = firebaseRef(firebaseDb, `users/${username}`);
    firebaseSet(userRef, {
        username: username,
        startDate: startDate.toISOString(),
        targetDate: targetDate.toISOString(),
        hotelName: 'Kamelya Fulya',
        purpose: 'return',
        completed: true,
        completedAt: new Date().toISOString()
    });
    
    // Animacje
    startContinuousFireworks();
    startConfettiCanvas();
    createMassiveFireworks();
}

// Silne fajerwerki po zakończeniu
function createMassiveFireworks() {
    setInterval(() => {
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                createSpectacularFirework();
            }, i * 300);
        }
    }, 1500);
}

function createSpectacularFirework() {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#ff1493', '#ffd700'];
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight * 0.6;
    
    const trail = document.createElement('div');
    trail.style.position = 'fixed';
    trail.style.width = '4px';
    trail.style.height = '40px';
    trail.style.background = 'linear-gradient(to top, transparent, #fff)';
    trail.style.left = x + 'px';
    trail.style.bottom = '0';
    trail.style.zIndex = '10000';
    document.body.appendChild(trail);
    
    trail.animate([
        { transform: 'translateY(0)', opacity: 1 },
        { transform: `translateY(-${window.innerHeight - y}px)`, opacity: 0 }
    ], {
        duration: 1000,
        easing: 'ease-out'
    }).onfinish = () => {
        trail.remove();
        
        const particleCount = 40;
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.style.position = 'fixed';
            particle.style.width = '8px';
            particle.style.height = '8px';
            particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            particle.style.borderRadius = '50%';
            particle.style.left = x + 'px';
            particle.style.top = y + 'px';
            particle.style.pointerEvents = 'none';
            particle.style.zIndex = '10000';
            particle.style.boxShadow = `0 0 20px ${particle.style.backgroundColor}`;
            
            document.body.appendChild(particle);
            
            const angle = (i / particleCount) * Math.PI * 2;
            const velocity = 150 + Math.random() * 150;
            const lifetime = 2000 + Math.random() * 1000;
            
            particle.animate([
                {
                    transform: 'translate(0, 0) scale(1)',
                    opacity: 1
                },
                {
                    transform: `translate(${Math.cos(angle) * velocity}px, ${Math.sin(angle) * velocity + 80}px) scale(0)`,
                    opacity: 0
                }
            ], {
                duration: lifetime,
                easing: 'cubic-bezier(0, 0, 0.2, 1)'
            }).onfinish = () => particle.remove();
        }
    };
}

// Konfetti na canvasie
function startConfettiCanvas() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const confettiParticles = [];
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#ffa500'];
    
    for (let i = 0; i < 150; i++) {
        confettiParticles.push({
            x: Math.random() * canvas.width,
            y: -20,
            vx: (Math.random() - 0.5) * 2,
            vy: Math.random() * 3 + 2,
            size: Math.random() * 10 + 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            angle: Math.random() * 360,
            angleVelocity: (Math.random() - 0.5) * 10
        });
    }
    
    function animateConfetti() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        confettiParticles.forEach((particle) => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.angle += particle.angleVelocity;
            
            if (particle.y > canvas.height) {
                particle.y = -20;
                particle.x = Math.random() * canvas.width;
            }
            
            ctx.save();
            ctx.translate(particle.x, particle.y);
            ctx.rotate(particle.angle * Math.PI / 180);
            ctx.fillStyle = particle.color;
            ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
            ctx.restore();
        });
        
        requestAnimationFrame(animateConfetti);
    }
    
    animateConfetti();
}

// Ciągłe fajerwerki tła
function startContinuousFireworks() {
    const fireworksContainer = document.getElementById('fireworks-container');
    
    setInterval(() => {
        createFireworkBurst(fireworksContainer);
    }, 500);
    
    for (let i = 0; i < 5; i++) {
        setTimeout(() => createFireworkBurst(fireworksContainer), i * 100);
    }
}

function createFireworkBurst(container) {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#ff1493'];
    const x = Math.random() * 100;
    const y = 20 + Math.random() * 60;
    
    const burst = document.createElement('div');
    burst.style.position = 'absolute';
    burst.style.left = x + '%';
    burst.style.top = y + '%';
    burst.style.width = '4px';
    burst.style.height = '4px';
    container.appendChild(burst);
    
    const particleCount = 20;
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.left = '0';
        particle.style.top = '0';
        particle.style.width = '6px';
        particle.style.height = '6px';
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        particle.style.borderRadius = '50%';
        particle.style.boxShadow = `0 0 6px ${particle.style.backgroundColor}`;
        burst.appendChild(particle);
        
        const angle = (i / particleCount) * Math.PI * 2;
        const velocity = 50 + Math.random() * 100;
        const lifetime = 1000 + Math.random() * 1000;
        
        particle.animate([
            {
                transform: 'translate(0, 0) scale(1)',
                opacity: 1
            },
            {
                transform: `translate(${Math.cos(angle) * velocity}px, ${Math.sin(angle) * velocity + 30}px) scale(0)`,
                opacity: 0
            }
        ], {
            duration: lifetime,
            easing: 'cubic-bezier(0, 0, 0.2, 1)'
        }).onfinish = () => particle.remove();
    }
    
    setTimeout(() => burst.remove(), 2000);
}

// Konfetti milestone
function createConfetti() {
    const colors = ['#ff6347', '#32cd32', '#1e90ff', '#ffd700', '#ff1493'];
    const confettiCount = 200;
    
    for (let i = 0; i < confettiCount; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.style.position = 'fixed';
            confetti.style.width = Math.random() * 10 + 5 + 'px';
            confetti.style.height = confetti.style.width;
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.top = '-10px';
            confetti.style.opacity = Math.random();
            confetti.style.transform = 'rotate(' + Math.random() * 360 + 'deg)';
            confetti.style.transition = 'all 3s ease-out';
            confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
            confetti.style.zIndex = '9999';
            document.body.appendChild(confetti);
            
            setTimeout(() => {
                confetti.style.top = '100%';
                confetti.style.transform = 'rotate(' + Math.random() * 720 + 'deg) translateX(' + (Math.random() - 0.5) * 200 + 'px)';
                confetti.style.opacity = '0';
            }, 10);
            
            setTimeout(() => {
                confetti.remove();
            }, 3000);
        }, i * 10);
    }
}

function createMiniConfetti() {
    const colors = ['#ffd700', '#ff6347', '#32cd32'];
    for (let i = 0; i < 10; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.style.position = 'fixed';
            confetti.style.width = '8px';
            confetti.style.height = '8px';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.top = '50%';
            confetti.style.borderRadius = '50%';
            confetti.style.pointerEvents = 'none';
            confetti.style.zIndex = '9999';
            document.body.appendChild(confetti);
            
            confetti.animate([
                { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                { transform: `translate(${(Math.random() - 0.5) * 200}px, ${-Math.random() * 200}px) scale(0)`, opacity: 0 }
            ], {
                duration: 1500,
                easing: 'ease-out'
            }).onfinish = () => confetti.remove();
        }, i * 50);
    }
}

// Parallax myszy na falach (uwaga: nadpisuje transform animacji fal)
document.addEventListener('mousemove', (e) => {
    const waves = document.querySelectorAll('.wave');
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    
    waves.forEach((wave, index) => {
        const speed = (index + 1) * 50;
        wave.style.transform = `translateX(${x * speed}px) translateY(${y * speed / 2}px)`;
    });
});

// Animacje dekoracji
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.decoration').forEach(decoration => {
        decoration.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.5) rotate(360deg)';
        });
        
        decoration.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1) rotate(0deg)';
        });
    });
});

// Zegar live w konsoli (debug)
setInterval(() => {
    const now = new Date();
    const remaining = calculateRemainingPercentage();
    console.log(`⏰ LIVE: ${now.toLocaleTimeString()} | Pozostało: ${remaining.toFixed(4)}%`);
}, 5000);
