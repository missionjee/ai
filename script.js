/**
 * Hiroto Signals — Login Authentication
 */

const elements = {};
let isProcessing = false;

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    checkExistingSession();
    setupEventListeners();
});

function cacheElements() {
    elements.keyInput = document.getElementById('keyInput');
    elements.authBtn = document.getElementById('authBtn');
    elements.btnText = elements.authBtn.querySelector('.btn-text');
    elements.btnLoader = elements.authBtn.querySelector('.btn-loader');
    elements.statusMsg = document.getElementById('statusMsg');
    elements.sessionInfo = document.getElementById('sessionInfo');
    elements.sessStatus = document.getElementById('sessStatus');
    elements.sessExpiry = document.getElementById('sessExpiry');
    elements.sessRemain = document.getElementById('sessRemain');
    elements.toast = document.getElementById('toast');
}

function setupEventListeners() {
    elements.keyInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        let formatted = '';
        
        for (let i = 0; i < value.length && i < 12; i++) {
            if (i > 0 && i % 4 === 0) formatted += '-';
            formatted += value[i];
        }
        
        e.target.value = formatted;
        e.target.classList.remove('error');
    });

    elements.keyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !isProcessing) {
            authenticate();
        }
    });
}

function checkExistingSession() {
    const saved = localStorage.getItem('hiroto_signals_session');
    
    if (saved) {
        try {
            const session = JSON.parse(saved);
            if (new Date(session.expires) > new Date()) {
                showToast('Session active — redirecting...');
                setTimeout(() => {
                    window.location.href = 'd.htm';
                }, 10000);
            } else {
                localStorage.removeItem('hiroto_signals_session');
            }
        } catch (e) {
            localStorage.removeItem('hiroto_signals_session');
        }
    }
}

async function authenticate() {
    if (isProcessing) return;
    
    const input = elements.keyInput.value.trim();
    
    if (input.length < 14) {
        elements.keyInput.classList.add('error');
        showStatus('Invalid access key', 'error');
        return;
    }
    
    setLoading(true);
    
    try {
        const snapshot = await getDocs(collection(window.db, 'keys'));
        const keys = snapshot.docs.map(doc => doc.data());
        const keyData = keys.find(k => k.key === input);
        
        if (!keyData) {
            handleError('Invalid access key');
            return;
        }
        
        if (new Date() > new Date(keyData.expires)) {
            handleError('Access key expired');
            return;
        }
        
        handleSuccess(keyData);
        
    } catch (error) {
        console.error(error);
        handleError('Connection failed');
    }
}

function handleSuccess(keyData) {
    const days = Math.ceil((new Date(keyData.expires) - new Date()) / 86400000);
    
    localStorage.setItem('hiroto_signals_session', JSON.stringify(keyData));
    
    showStatus('Access granted', 'success');
    
    elements.sessStatus.textContent = 'Active';
    elements.sessExpiry.textContent = new Date(keyData.expires).toLocaleDateString();
    elements.sessRemain.textContent = days + ' days';
    elements.sessionInfo.classList.add('show');
    
    elements.keyInput.style.borderColor = 'var(--success)';
    
    setTimeout(() => {
        window.location.href = 'd.htm';
    }, 1500);
}

function handleError(message) {
    showStatus(message, 'error');
    elements.keyInput.classList.add('error');
    setLoading(false);
    
    setTimeout(() => {
        elements.keyInput.classList.remove('error');
    }, 3000);
}

function setLoading(loading) {
    isProcessing = loading;
    elements.authBtn.disabled = loading;
    
    if (loading) {
        elements.btnText.textContent = 'Verifying...';
        elements.btnLoader.classList.remove('hidden');
    } else {
        elements.btnText.textContent = 'Verify Access';
        elements.btnLoader.classList.add('hidden');
    }
}

function showStatus(message, type) {
    elements.statusMsg.textContent = message;
    elements.statusMsg.className = 'status-msg show ' + type;
    
    if (type === 'error') {
        setTimeout(() => {
            elements.statusMsg.classList.remove('show');
        }, 5000);
    }
}

function showToast(message, type = 'success') {
    elements.toast.textContent = message;
    elements.toast.className = 'toast show ' + (type === 'error' ? 'error' : '');
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}