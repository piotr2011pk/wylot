// Chat functionality
let currentUser = null;
let messagesListener = null;
let presenceRef = null;
let isOnline = true;
let unreadCount = 0;

// Initialize chat when Firebase is ready
window.addEventListener('firebaseReady', () => {
    initializeChat();
});

function initializeChat() {
    const auth = window.firebaseAuth;
    const chatToggle = document.getElementById('chat-toggle');
    const chatWindow = document.getElementById('chat-window');
    const chatClose = document.getElementById('chat-close');
    const googleLoginBtn = document.getElementById('google-login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const sendBtn = document.getElementById('send-btn');
    const messageInput = document.getElementById('message-input');
    const onlineIndicator = document.getElementById('online-indicator');
    
    // Toggle chat window
    chatToggle.addEventListener('click', () => {
        chatWindow.classList.toggle('active');
        if (chatWindow.classList.contains('active')) {
            resetUnreadCount();
            messageInput.focus();
        }
    });
    
    // Close chat window
    chatClose.addEventListener('click', () => {
        chatWindow.classList.remove('active');
    });
    
    // Google login
    googleLoginBtn.addEventListener('click', async () => {
        const provider = new window.firebaseGoogleAuthProvider();
        try {
            const result = await window.firebaseSignInWithPopup(auth, provider);
            console.log('Logged in:', result.user.displayName);
        } catch (error) {
            console.error('Login error:', error);
            alert('Błąd logowania: ' + error.message);
        }
    });
    
    // Logout
    logoutBtn.addEventListener('click', async () => {
        try {
            await window.firebaseSignOut(auth);
            console.log('Logged out');
        } catch (error) {
            console.error('Logout error:', error);
        }
    });
    
    // Send message
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Monitor auth state
    window.firebaseOnAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            showChatContent();
            setupPresence();
            listenToMessages();
        } else {
            currentUser = null;
            showLoginScreen();
            if (messagesListener) {
                messagesListener();
                messagesListener = null;
            }
            if (presenceRef) {
                presenceRef.off();
            }
        }
    });
    
    // Monitor online/offline status
    window.addEventListener('online', () => {
        isOnline = true;
        onlineIndicator.classList.remove('offline');
        updatePresence(true);
    });
    
    window.addEventListener('offline', () => {
        isOnline = false;
        onlineIndicator.classList.add('offline');
        updatePresence(false);
    });
}

function showChatContent() {
    document.getElementById('chat-login').style.display = 'none';
    document.getElementById('chat-content').style.display = 'flex';
    
    // Update user info
    document.getElementById('user-avatar').src = currentUser.photoURL || '';
    document.getElementById('user-name').textContent = currentUser.displayName || 'Użytkownik';
}

function showLoginScreen() {
    document.getElementById('chat-login').style.display = 'flex';
    document.getElementById('chat-content').style.display = 'none';
    document.getElementById('messages-container').innerHTML = '';
}

function setupPresence() {
    const userStatusRef = window.firebaseRef(window.firebaseDb, `presence/${currentUser.uid}`);
    const isOfflineForDatabase = {
        state: 'offline',
        lastSeen: window.firebaseServerTimestamp()
    };
    
    const isOnlineForDatabase = {
        state: 'online',
        lastSeen: window.firebaseServerTimestamp(),
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL
    };
    
    // Firebase Realtime Database presence system
    presenceRef = window.firebaseRef(window.firebaseDb, '.info/connected');
    window.firebaseOnValue(presenceRef, (snapshot) => {
        if (snapshot.val() === false) {
            return;
        }
        
        window.firebaseOnDisconnect(userStatusRef).set(isOfflineForDatabase).then(() => {
            window.firebaseSet(userStatusRef, isOnlineForDatabase);
        });
    });
}

function updatePresence(online) {
    if (!currentUser) return;
    
    const userStatusRef = window.firebaseRef(window.firebaseDb, `presence/${currentUser.uid}`);
    const status = {
        state: online ? 'online' : 'offline',
        lastSeen: window.firebaseServerTimestamp(),
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL
    };
    
    window.firebaseSet(userStatusRef, status);
}

function listenToMessages() {
    const messagesRef = window.firebaseRef(window.firebaseDb, 'messages');
    const messagesContainer = document.getElementById('messages-container');
    
    // Clear existing messages
    messagesContainer.innerHTML = '';
    
    // Listen to new messages
    messagesListener = window.firebaseOnValue(messagesRef, (snapshot) => {
        const messages = [];
        snapshot.forEach((childSnapshot) => {
            messages.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        
        // Sort by timestamp
        messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        
        // Display messages
        messagesContainer.innerHTML = '';
        messages.forEach(message => {
            displayMessage(message);
        });
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Update unread count if chat is closed
        if (!document.getElementById('chat-window').classList.contains('active')) {
            const newMessages = messages.filter(m => 
                m.userId !== currentUser.uid && 
                m.timestamp > (parseInt(localStorage.getItem('lastReadTimestamp') || '0'))
            );
            if (newMessages.length > 0) {
                unreadCount = newMessages.length;
                updateUnreadBadge();
            }
        }
    });
}

function displayMessage(message) {
    const messagesContainer = document.getElementById('messages-container');
    const isOwn = message.userId === currentUser.uid;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'own' : ''}`;
    
    const time = message.timestamp ? new Date(message.timestamp).toLocaleTimeString('pl-PL', { 
        hour: '2-digit', 
        minute: '2-digit' 
    }) : '';
    
    messageDiv.innerHTML = `
        <img class="message-avatar" src="${message.userPhoto || ''}" alt="${message.userName}">
        <div class="message-content">
            <div class="message-bubble">${escapeHtml(message.text)}</div>
            <div class="message-info">
                <span>${message.userName}</span>
                <span>${time}</span>
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
}

async function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const text = messageInput.value.trim();
    
    if (!text || !currentUser || !isOnline) return;
    
    const messagesRef = window.firebaseRef(window.firebaseDb, 'messages');
    const newMessageRef = window.firebasePush(messagesRef);
    
    try {
        await window.firebaseSet(newMessageRef, {
            text: text,
            userId: currentUser.uid,
            userName: currentUser.displayName || 'Użytkownik',
            userPhoto: currentUser.photoURL || '',
            timestamp: Date.now()
        });
        
        messageInput.value = '';
        messageInput.focus();
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Nie udało się wysłać wiadomości');
    }
}

function updateUnreadBadge() {
    const badge = document.getElementById('chat-badge');
    if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.style.display = 'block';
    } else {
        badge.style.display = 'none';
    }
}

function resetUnreadCount() {
    unreadCount = 0;
    updateUnreadBadge();
    localStorage.setItem('lastReadTimestamp', Date.now().toString());
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Notification sound for new messages (optional)
function playNotificationSound() {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmFwU7k9n1138xBSl+zPLaizsKGGS56+mjUBELTKXi8L5tIAU5k9n1yHUtBCh+zPDaizsIG2m98OScTgwOUarm7blmFwU7k9n1138xBSl+zPLaizsKGGS56+mjUBELTKXi8L5tIAU5k9n1yHUtBCh+zPDaizsIG2m98OScTgwOUarm7blmFwU7k9n1138xBSl+zPLaizsKGGS56+mjUBELTKXi8L5tIAU5k9n1yHUtBCh+zPDaizsIG2m98OScTgwOUarm7blmFwU7k9n1138xBSl+zPLaizsKGGS56+mjUBELTKXi8L5tIAU5k9n1yHUtBCh+zPDaizsIG2m98OScTgwOUarm7blmFwU7k9n1138xBSl+zPLaizsKGGS56+mjUBELTKXi8L5tIAU5k9n1yHUtBCh+zPDaizsIG2m98OScTgwOUarm7blmFwU7k9n1138xBSl+zPLaizsKGGS56+mjUBELTKXi8L5tIAU5k9n1yHUtBCh+zPDaizsIG2m98OScTgwOUarm7blmFwU7k9n1138xBSl+zPLaizsKGGS56+mjUBELTKXi8L5tIAU5k9n1yHUtBCh+zPDaizsIG2m98OScTgwOUarm7blmFwU7k9n1138xBSl+zPLaizsKGGS56+mjUBELTKXi8L5tIAU5k9n1yHUtBCh+zPDaizsIG2m98OScTgwOUarm7blmFwU7k9n1138xBSl+zPLaizsKGGS56+mjUBELTKXi8L5tIAU5k9n1yHUtBCh+zPDaizsIG2m98OScTgwOUarm7blmFwU7k9n1138xBSl+zPLaizsKGGS56+mjUBELTKXi8L5tIAU5k9n1yHUtBCh+zPDaizsIG2m98OScTgwOUarm7blmFwU7k9n1138xBSl+zPLaizsKGGS56+mjUBELTKXi8L5tIAU5k9n1yHUtBCh+zPDaizsIG2m98OScTgwOUarm7blmFwU7k9n1138xBSl+zPLaizsKGGS56+mjUBELTKXi8L5tIAU5k9n1yHUtBCh+zPDaizsI');
    audio.volume = 0.3;
    audio.play().catch(e => console.log('Audio play failed:', e));
}

// Add notification for new messages when chat is closed
let lastMessageCount = 0;
setInterval(() => {
    if (!document.getElementById('chat-window').classList.contains('active') && messagesListener) {
        const messagesRef = window.firebaseRef(window.firebaseDb, 'messages');
        window.firebaseGet(messagesRef).then(snapshot => {
            const count = snapshot.size || 0;
            if (count > lastMessageCount && lastMessageCount > 0) {
                playNotificationSound();
            }
            lastMessageCount = count;
        });
    }
}, 5000);
