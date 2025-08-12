// ============================================
// Odliczanie do POWROTU — pełny skrypt JS
// Data końcowa: 17 sierpnia 2025, 21:20 (CEST)
// Ulepszenia:
// - brak starych tekstów typu "Zaraz wylatuję" — wszystko spięte pod MODE='return'
// - natychmiastowy ekran zakończenia, jeśli użytkownik wejdzie po czasie
// - reset startDate gdy zmienia się target/purpose lub poprzednie odliczanie było zakończone
// ============================================

const APP_VERSION = 'return-1.0.1';
const MODE = 'return'; // jeden punkt prawdy na tryb — ogranicza pomyłki w treściach

// Data docelowa powrotu - 17 sierpnia 2025, godzina 21:20 czasu polskiego (CEST)
const targetDate = new Date('2025-08-17T21:20:00+02:00');

// Użytkownik (zachowuję jak w poprzedniej wersji)
const username = 'Piotr20111';

// Słowniki treści (centralizacja, by nie doszło do rozjazdu tekstów)
const TEXTS = {
    return: {
        finalSecondsLabel: 'SEKUND DO POWROTU!',
        progress: {
            titleBase: 'Pozostało do powrotu',
            closeA: '🔥🔥🔥 SEKUNDY DO POWROTU!',
            closeB: '🔥 OSTATNIE CHWILE! Pozostało:',
            soon:   '🌟 Już niedługo! Pozostało:',
            closer: '☀️ Coraz bliżej! Pozostało:'
        },
        completion: {
            title: '🎉 Czas na powrót! ✈️',
            subtitle: 'Witaj z powrotem i miłego lądowania!'
        }
    }
};

let startDate;
let firebaseDb, firebaseRef, firebaseSet, firebaseGet;
let countdownInterval = null;
let finalCountdownInterval = null;
let liveStatusInterval = null;

let lastSecond = -1;
let lastPercentage = -1;
let finalCountdownActive = false;
let lastMilliseconds = -1;

// Czekamy na przekazanie referencji do Firebase z index.html
window.addEventListener('firebaseReady', () => {
    firebaseDb = window.firebaseDb;
    firebaseRef = window.firebaseRef;
    firebaseSet = window.firebaseSet;
    firebaseGet = window.firebaseGet;

    initializeCountdown();
});

// Inicjalizacja odliczania
async function initializeCountdown() {
    const userRef = firebaseRef(firebaseDb, `users/${username}`);
    const currentTargetISO = targetDate.toISOString();

    try {
        const snapshot = await firebaseGet(userRef);
        const data = snapshot.val();

        // Resetuj start gdy:
        // - brak danych
        // - brak startDate
        // - zmienił się target
        // - poprzednie odliczanie zakończone
        // - zmienił się "purpose" (teraz 'return')
        const shouldReset =
            !data ||
            !data.startDate ||
            data.targetDate !== currentTargetISO ||
            data.completed === true ||
            data.purpose !== MODE;

        if (shouldReset) {
            startDate = new Date();
            await firebaseSet(userRef, {
                username,
                startDate: startDate.toISOString(),
                targetDate: currentTargetISO,
                hotelName: 'Kamelya Fulya',
                purpose: MODE,
                completed: false,
                firstVisit: data && data.firstVisit ? data.firstVisit : new Date().toISOString(),
                appVersion: APP_VERSION
            });
            console.log('🆕 Nowe odliczanie do powrotu od:', startDate);
        } else {
            startDate = new Date(data.startDate);
            console.log('📅 Kontynuuję zapisany start:', startDate);
        }

        // Ustaw daty w UI
        setTextById('start-date', formatDate(startDate));
        setTextById('end-date', formatDate(targetDate));

        updateSyncStatus(true);

        // Jeśli już po czasie — pokaż ekran zakończenia od razu
        if (Date.now() >= targetDate.getTime()) {
            showCompletionScreen(); // poprawny ekran powrotu
            return;
        }

        // Start live sync i odliczania
        startRealtimeUpdates();
        startCountdownLoops();
    } catch (error) {
        console.error('Firebase error:', error);
        updateSyncStatus(false);

        // Fallback: ustaw start teraz
        startDate = new Date();
        setTextById('start-date', formatDate(startDate));
        setTextById('end-date', formatDate(targetDate));

        // Jeśli już po czasie — pokaż ekran zakończenia
        if (Date.now() >= targetDate.getTime()) {
            showCompletionScreen();
            return;
        }

        startCountdownLoops();
    }
}

function startCountdownLoops() {
    // Normalny tryb: co 100 ms (wystarczająco płynnie)
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 100);
}

// Synchronizacja w czasie rzeczywistym do Firebase
function startRealtimeUpdates() {
    const statusRef = firebaseRef(firebaseDb, `users/${username}/liveStatus`);

    liveStatusInterval = setInterval(() => {
        const now = new Date();
        const difference = targetDate - now;

        if (difference > 0) {
            const remainingPercentage = calculateRemainingPercentage();

            firebaseSet(statusRef, {
                currentTime: now.toISOString(),
                remainingTime: difference,
                remainingPercentage,
                remainingDays: Math.floor(difference / (1000 * 60 * 60 * 24)),
                remainingHours: Math.floor(difference / (1000 * 60 * 60)),
                remainingMinutes: Math.floor(difference / (1000 * 60)),
                remainingSeconds: Math.floor(difference / 1000),
                remainingMilliseconds: difference,
                isLive: true,
                mode: MODE,
                appVersion: APP_VERSION
            });
        } else {
            clearInterval(liveStatusInterval);
        }
    }, 1000);
}

// Procent pozostałego czasu
function calculateRemainingPercentage() {
    const now = new Date();
    const totalTime = targetDate.getTime() - startDate.getTime();
    const remainingTime = targetDate.getTime() - now.getTime();
    let percentage = (remainingTime / totalTime) * 100;
    return Math.min(Math.max(percentage, 0), 100);
}

// Kolor paska postępu
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

// Główna pętla odliczania
function updateCountdown() {
    const now = new Date();
    const difference = targetDate - now;

    // Koniec odliczania
    if (difference <= 0) {
        showCompletionScreen(); // poprawny ekran "powrót"
        return;
    }

    // Składniki czasu
    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);
    const milliseconds = difference % 1000;
    const totalSeconds = Math.floor(difference / 1000);

    // Ostatnie 60 sekund — przełącz na 10 ms
    if (totalSeconds <= 60 && !finalCountdownActive) {
        finalCountdownActive = true;
        activateFinalCountdown();

        if (countdownInterval) clearInterval(countdownInterval);
        finalCountdownInterval = setInterval(updateCountdown, 10);
    }

    if (finalCountdownActive) {
        const preciseSeconds = difference / 1000;
        const displaySeconds = Math.floor(preciseSeconds);
        const displayMilliseconds = Math.floor((preciseSeconds - displaySeconds) * 1000);

        const countdownEl = document.getElementById('countdown');
        if (countdownEl) {
            countdownEl.innerHTML = `
                <div class="final-seconds-container">
                    <div class="final-seconds-box" id="final-box">
                        <span class="final-seconds-number" id="final-seconds">${displaySeconds}</span>
                        <span class="final-milliseconds">.${String(displayMilliseconds).padStart(3, '0')}</span>
                        <span class="final-seconds-label">${TEXTS[MODE].finalSecondsLabel}</span>
                    </div>
                    <div class="final-countdown-effects">
                        <div class="pulse-ring"></div>
                        <div class="pulse-ring"></div>
                        <div class="pulse-ring"></div>
                    </div>
                    <div class="sparkles-container" id="sparkles"></div>
                </div>
            `;

            // Dynamiczny kolor pudełka
            const finalBox = document.getElementById('final-box');
            const hue = (displaySeconds / 60) * 120; // czerwony -> zielony
            if (finalBox) {
                finalBox.style.background = `linear-gradient(135deg, hsl(${hue}, 100%, 50%), hsl(${hue + 30}, 100%, 40%))`;
                if (displaySeconds <= 10) {
                    finalBox.classList.add('shake-animation');
                    createContinuousSparkles();
                }
                if (displaySeconds <= 5) {
                    createIntenseFireworks();
                }
            }

            // Mini "wybuchy" co nową sekundę
            if (milliseconds !== lastMilliseconds && milliseconds < 100) {
                createBurstEffect();
            }
            lastMilliseconds = milliseconds;
        }
    } else {
        // Widok standardowy — aktualizuj raz na sekundę
        if (seconds !== lastSecond) {
            setTextById('days', String(days).padStart(2, '0'));
            setTextById('hours', String(hours).padStart(2, '0'));
            setTextById('minutes', String(minutes).padStart(2, '0'));
            setTextById('seconds', String(seconds).padStart(2, '0'));

            const secondsBox = document.getElementById('seconds');
            if (secondsBox && secondsBox.parentElement) animateTimeBox(secondsBox.parentElement);
            lastSecond = seconds;
        }
    }

    // Procenty
    const remainingPercentage = calculateRemainingPercentage();
    const usedPercentage = 100 - remainingPercentage;

    const progressFill = document.getElementById('progress-fill');
    if (progressFill) {
        progressFill.style.width = usedPercentage + '%';
        progressFill.style.transition = 'width 0.1s linear';
        progressFill.style.background = getProgressColor(remainingPercentage);
    }

    const progressBar = document.querySelector('.progress-bar');
    const progressText = document.getElementById('progress-text');
    if (progressText && progressBar) {
        let displayText = '';

        if (remainingPercentage < 0.0001) {
            displayText = remainingPercentage.toFixed(7) + '%';
            progressBar.classList.add('pulse-bar');
            progressText.style.fontSize = '1.5rem';
        } else if (remainingPercentage < 0.001) {
            displayText = remainingPercentage.toFixed(6) + '%';
            progressBar.classList.add('pulse-bar');
        } else if (remainingPercentage < 0.01) {
            displayText = remainingPercentage.toFixed(5) + '%';
            progressBar.classList.add('pulse-bar');
        } else if (remainingPercentage < 0.1) {
            displayText = remainingPercentage.toFixed(4) + '%';
            progressBar.classList.add('pulse-bar');
        } else if (remainingPercentage < 1) {
            displayText = remainingPercentage.toFixed(3) + '%';
        } else if (remainingPercentage < 10) {
            displayText = remainingPercentage.toFixed(2) + '%';
        } else {
            displayText = remainingPercentage.toFixed(2) + '%';
            progressBar.classList.remove('pulse-bar');
            progressText.style.fontSize = '1.2rem';
        }

        progressText.textContent = displayText;

        // Tytuł postępu
        const progressTitle = document.querySelector('.progress-title');
        if (progressTitle) {
            if (remainingPercentage < 0.1) {
                progressTitle.innerHTML = `${TEXTS[MODE].progress.closeA} ${remainingPercentage.toFixed(4)}% 🔥🔥🔥`;
                progressTitle.style.color = '#ff0000';
                progressTitle.style.animation = 'glow 0.2s ease-in-out infinite alternate';
            } else if (remainingPercentage < 1) {
                progressTitle.innerHTML = `${TEXTS[MODE].progress.closeB} ${remainingPercentage.toFixed(3)}%`;
                progressTitle.style.color = '#ff1744';
                progressTitle.style.animation = 'glow 0.5s ease-in-out infinite alternate';
            } else if (remainingPercentage < 5) {
                progressTitle.textContent = `${TEXTS[MODE].progress.soon} ${remainingPercentage.toFixed(2)}%`;
                progressTitle.style.color = '#ff5722';
                progressTitle.style.animation = 'none';
            } else if (remainingPercentage < 10) {
                progressTitle.textContent = `${TEXTS[MODE].progress.closer} ${remainingPercentage.toFixed(2)}%`;
                progressTitle.style.color = '#ff8a65';
                progressTitle.style.animation = 'none';
            } else {
                progressTitle.textContent = `${TEXTS[MODE].progress.titleBase}: ${remainingPercentage.toFixed(2)}%`;
                progressTitle.style.color = '#667eea';
                progressTitle.style.animation = 'none';
            }
        }
    }

    // Zmiana koloru boxów przy <10%
    if (remainingPercentage < 10 && !finalCountdownActive) {
        document.querySelectorAll('.time-box').forEach(box => {
            box.style.background = getProgressColor(remainingPercentage);
        });
    }

    // Konfetti przy przekroczeniu pełnego procenta w końcówce
    const currentWholePercent = Math.floor(remainingPercentage);
    const lastWholePercent = Math.floor(lastPercentage);

    if (lastPercentage !== -1 && currentWholePercent < lastWholePercent && remainingPercentage < 10) {
        createMiniConfetti();
    }

    lastPercentage = remainingPercentage;
}

// Tryb finału (ostatnie 60 s)
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
        .pulse-ring:nth-child(2) { animation-delay: 0.5s; }
        .pulse-ring:nth-child(3) { animation-delay: 1s; }
        @keyframes finalPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes finalGlow {
            from { box-shadow: 0 0 30px rgba(255, 0, 0, 0.5); }
            to   { box-shadow: 0 0 60px rgba(255, 0, 0, 0.8), 0 0 100px rgba(255, 100, 0, 0.5); }
        }
        @keyframes pulseRing {
            0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
        }
        .shake-animation { animation: shake 0.1s ease-in-out infinite !important; }
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px) rotate(-1deg); }
            75% { transform: translateX(5px) rotate(1deg); }
        }
        .sparkles-container {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            pointer-events: none; overflow: visible;
        }
        .sparkle {
            position: absolute; width: 4px; height: 4px;
            background: radial-gradient(circle, rgba(255,255,255,1) 0%, transparent 70%);
            border-radius: 50%; pointer-events: none;
        }
        @keyframes sparkleMove {
            0% { transform: translate(0, 0) scale(0); opacity: 1; }
            50% { opacity: 1; }
            100% { transform: translate(var(--dx), var(--dy)) scale(1.5); opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    createFinalCountdownParticles();
}

// Efekty wizualne
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

        particle.animate(
            [
                { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                {
                    transform: `translate(${Math.cos(angle) * velocity}px, ${Math.sin(angle) * velocity}px) scale(0)`,
                    opacity: 0
                }
            ],
            { duration: 1500, easing: 'cubic-bezier(0, 0, 0.2, 1)' }
        ).onfinish = () => particle.remove();
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

                particle.animate(
                    [
                        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                        {
                            transform: `translate(${Math.cos(angle) * velocity}px, ${Math.sin(angle) * velocity + 50}px) scale(0)`,
                            opacity: 0
                        }
                    ],
                    { duration: lifetime, easing: 'cubic-bezier(0, 0, 0.2, 1)' }
                ).onfinish = () => particle.remove();
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

            confetti.animate(
                [
                    { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                    {
                        transform: `translate(${(Math.random() - 0.5) * 200}px, ${-Math.random() * 200}px) scale(0)`,
                        opacity: 0
                    }
                ],
                { duration: 1500, easing: 'ease-out' }
            ).onfinish = () => confetti.remove();
        }, i * 50);
    }
}

// Formatowanie dat
function formatDate(date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

// Status synchronizacji
function updateSyncStatus(synced) {
    const indicator = document.getElementById('sync-indicator');
    const text = document.getElementById('sync-text');

    if (!indicator || !text) return;

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

// Prosta pomocnicza do bezpiecznego wpisywania tekstu
function setTextById(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// Animacja pudełka sekund
function animateTimeBox(element) {
    element.classList.add('pulse');
    setTimeout(() => element.classList.remove('pulse'), 300);
}

// Ekran po zakończeniu odliczania — WYŁĄCZNIE "powrót"
function showCompletionScreen() {
    // Wyczyść timery
    if (countdownInterval) clearInterval(countdownInterval);
    if (finalCountdownInterval) clearInterval(finalCountdownInterval);
    if (liveStatusInterval) clearInterval(liveStatusInterval);

    // Schowaj elementy
    const hideSel = ['#countdown', '.progress-section', '.hotel-info', '.title', '.decorations'];
    hideSel.forEach(sel => {
        const el = document.querySelector(sel);
        if (el) el.style.display = 'none';
    });

    // Zbuduj ekran zakończenia dla "powrotu"
    const container = document.querySelector('.content');
    if (container) {
        container.innerHTML = `
            <div class="vacation-celebration">
                <h1 class="vacation-title">${TEXTS[MODE].completion.title}</h1>
                <p class="vacation-subtitle">${TEXTS[MODE].completion.subtitle}</p>
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
                    from { opacity: 0; transform: translateY(20px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .plane-flying {
                    font-size: 5rem;
                    animation: flyAway 4s ease-in-out infinite;
                    margin: 2rem 0;
                }
                @keyframes celebrationPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
                @keyframes flyAway {
                    0%   { transform: translateX(-200px) translateY(0) rotate(-10deg); }
                    50%  { transform: translateX(0) translateY(-30px) rotate(0deg); }
                    100% { transform: translateX(200px) translateY(0) rotate(10deg); }
                }
                .continuous-fireworks {
                    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    pointer-events: none; overflow: hidden;
                }
            </style>
        `;
    }

    // Zapisz zakończenie w Firebase (spójny purpose)
    try {
        const userRef = firebaseRef(firebaseDb, `users/${username}`);
        firebaseSet(userRef, {
            username,
            startDate: startDate ? startDate.toISOString() : new Date().toISOString(),
            targetDate: targetDate.toISOString(),
            hotelName: 'Kamelya Fulya',
            purpose: MODE,
            completed: true,
            completedAt: new Date().toISOString(),
            appVersion: APP_VERSION
        });
    } catch (_) {
        // Ignoruj błąd zapisu końcowego
    }

    // Animacje końcowe
    startContinuousFireworks();
    startConfettiCanvas();
    createMassiveFireworks();
}

// Fajerwerki po zakończeniu
function createMassiveFireworks() {
    setInterval(() => {
        for (let i = 0; i < 3; i++) {
            setTimeout(() => createSpectacularFirework(), i * 300);
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

    trail.animate(
        [
            { transform: 'translateY(0)', opacity: 1 },
            { transform: `translateY(-${window.innerHeight - y}px)`, opacity: 0 }
        ],
        { duration: 1000, easing: 'ease-out' }
    ).onfinish = () => {
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

            particle.animate(
                [
                    { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                    {
                        transform: `translate(${Math.cos(angle) * velocity}px, ${Math.sin(angle) * velocity + 80}px) scale(0)`,
                        opacity: 0
                    }
                ],
                { duration: lifetime, easing: 'cubic-bezier(0, 0, 0.2, 1)' }
            ).onfinish = () => particle.remove();
        }
    };
}

// Konfetti na canvasie
function startConfettiCanvas() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
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

        confettiParticles.forEach((p) => {
            p.x += p.vx;
            p.y += p.vy;
            p.angle += p.angleVelocity;

            if (p.y > canvas.height) {
                p.y = -20;
                p.x = Math.random() * canvas.width;
            }

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle * Math.PI / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
        });

        requestAnimationFrame(animateConfetti);
    }

    animateConfetti();
}

// Ciągłe fajerwerki w tle
function startContinuousFireworks() {
    const fireworksContainer = document.getElementById('fireworks-container');
    if (!fireworksContainer) return;

    setInterval(() => createFireworkBurst(fireworksContainer), 500);

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

        particle.animate(
            [
                { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                {
                    transform: `translate(${Math.cos(angle) * velocity}px, ${Math.sin(angle) * velocity + 30}px) scale(0)`,
                    opacity: 0
                }
            ],
            { duration: lifetime, easing: 'cubic-bezier(0, 0, 0.2, 1)' }
        ).onfinish = () => particle.remove();
    }

    setTimeout(() => burst.remove(), 2000);
}

// Prosty parallax fal (uwaga: nadpisuje transform animacji fal z CSS)
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
        decoration.addEventListener('mouseenter', function () {
            this.style.transform = 'scale(1.5) rotate(360deg)';
        });

        decoration.addEventListener('mouseleave', function () {
            this.style.transform = 'scale(1) rotate(0deg)';
        });
    });
});

// Log pomocniczy
setInterval(() => {
    const now = new Date();
    const remaining = startDate ? calculateRemainingPercentage() : NaN;
    console.log(`⏰ LIVE (${APP_VERSION} / ${MODE}): ${now.toLocaleTimeString()} | Pozostało: ${isNaN(remaining) ? '-' : remaining.toFixed(4) + '%'}`);
}, 5000);
