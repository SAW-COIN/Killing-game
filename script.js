// استيراد مكتبة Supabase لإنشاء الاتصال بقاعدة البيانات
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './i/Scripts/config.js';

// إنشاء عميل Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// تعريف عناصر واجهة المستخدم
const uiElements = {
    userTelegramIdDisplay: document.getElementById('userTelegramId'),
    userTelegramNameDisplay: document.getElementById('userTelegramName'),
    scoreDisplay: document.getElementById('score'),
    missedCountDisplay: document.getElementById('missedCount'),
    timerDisplay: document.getElementById('timer'),
    retryButton: document.getElementById('retryButton'),
    loadingScreen: document.getElementById('loadingScreen'),
};

let score = 0;
let missedCount = 0;
let timeLeft = 60;
let gameOver = false;
let gameInterval;
let fallingInterval;

// تعريف حالة اللعبة (gameState)
let gameState = {
    balance: 0,       // رصيد المستخدم
};

// جلب بيانات المستخدم من Telegram والتحقق في قاعدة البيانات
async function fetchUserDataFromTelegram() {
    const telegramApp = window.Telegram.WebApp;
    telegramApp.ready();

    const userTelegramId = telegramApp.initDataUnsafe.user?.id;
    const userTelegramName = telegramApp.initDataUnsafe.user?.username;

    if (!userTelegramId || !userTelegramName) {
        console.error("Failed to fetch Telegram user data.");
        return;
    }

    uiElements.userTelegramIdDisplay.innerText = `ID: ${userTelegramId}`;
    uiElements.userTelegramNameDisplay.innerText = `Username: ${userTelegramName}`;

    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('telegram_id', userTelegramId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching user data from Supabase:', error);
            return;
        }

        if (data) {
            gameState = { ...gameState, ...data };  // تحديث gameState باستخدام البيانات الموجودة في Supabase
            updateUI();
        } else {
            await registerNewUser(userTelegramId, userTelegramName);
        }
    } catch (err) {
        console.error('Error while fetching user data:', err);
    }
}

// تسجيل مستخدم جديد
async function registerNewUser(userTelegramId, userTelegramName) {
    try {
        const { data, error } = await supabase
            .from('users')
            .insert([{ telegram_id: userTelegramId, username: userTelegramName, balance: 0 }]);

        if (error) {
            console.error('Error registering new user:', error);
            return;
        }

        gameState = { telegram_id: userTelegramId, username: userTelegramName, balance: 0 };  // تحديث gameState
        updateUI();
    } catch (err) {
        console.error('Unexpected error while registering new user:', err);
    }
}

// تحديث واجهة المستخدم
function updateUI() {
    uiElements.scoreDisplay.innerText = `رصيدك: ${gameState.balance} SP`;
}

// تحديث بيانات المستخدم في قاعدة البيانات بعد الفوز
async function updateGameState() {
    const userId = uiElements.userTelegramIdDisplay.innerText.split(":")[1].trim();

    try {
        const { data, error } = await supabase
            .from('users')
            .update({ balance: gameState.balance })  // تحديث الرصيد في قاعدة البيانات
            .eq('telegram_id', userId);

        if (error) {
            console.error('Error updating game state in Supabase:', error.message);
            return;
        }

        console.log('Game state updated successfully:', data);
    } catch (err) {
        console.error('Unexpected error while updating game state:', err);
    }
}

// بدء اللعبة
function startGame() {
    uiElements.loadingScreen.style.display = 'none';

    gameOver = false;
    score = 0;
    missedCount = 0;
    timeLeft = 60;
    updateUI();
    uiElements.retryButton.style.display = 'none';

    gameInterval = setInterval(() => {
        if (!gameOver) {
            timeLeft--;
            uiElements.timerDisplay.innerText = `الوقت المتبقي: ${timeLeft}`;
            if (timeLeft <= 0) {
                gameOver = true;
                clearInterval(gameInterval);
                clearInterval(fallingInterval);
                showRetryButton();
            }
        }
    }, 1000);

    fallingInterval = setInterval(() => {
        if (!gameOver) {
            createFallingItem();
        }
    }, 1000);
}

// إنشاء العناصر المتساقطة
function createFallingItem() {
    const fallingItem = document.createElement('div');
    fallingItem.classList.add('fallingItem');
    fallingItem.style.left = `${Math.random() * (window.innerWidth - 50)}px`;
    fallingItem.style.top = `-50px`;
    document.body.appendChild(fallingItem);

    let fallingSpeed = 2;
    let fallingItemInterval = setInterval(() => {
        if (!gameOver) {
            fallingItem.style.top = `${fallingItem.offsetTop + fallingSpeed}px`;

            if (fallingItem.offsetTop > window.innerHeight - 60) {
                missedCount++;
                updateMissedCount();
                document.body.removeChild(fallingItem);

                if (missedCount >= 10) {
                    gameOver = true;
                    clearInterval(fallingItemInterval);
                    showRetryButton();
                }
            }
        }
    }, 10);

    fallingItem.addEventListener('click', () => {
        if (!gameOver) {
            fallingItem.classList.add('dead');
            setTimeout(() => {
                document.body.removeChild(fallingItem);
            }, 500);
            score++;
            updateScore();
        }
    });
}

// تحديث الرصيد
function updateScore() {
    gameState.balance = score;
    uiElements.scoreDisplay.innerText = `رصيدك: ${gameState.balance} SP`;
}

// تحديث محاولات الخسارة
function updateMissedCount() {
    uiElements.missedCountDisplay.innerText = `محاولات: ${missedCount}/10`;
}

// إظهار زر إعادة المحاولة
function showRetryButton() {
    uiElements.retryButton.style.display = 'block';
}

uiElements.retryButton.addEventListener('click', () => {
    resetGame();
});

// إعادة تعيين اللعبة
function resetGame() {
    score = 0;
    missedCount = 0;
    timeLeft = 60;
    updateScore();
    updateMissedCount();
    uiElements.retryButton.style.display = 'none';
    startGame();
}

// بدء اللعبة بعد 3 ثواني
window.onload = async function () {
    try {
        await fetchUserDataFromTelegram();
        startGame();
    } catch (err) {
        console.error('Error during game initialization:', err);
    }
};

// تطبيق إعدادات الألوان
window.Telegram.WebApp.setHeaderColor('#000000');
window.Telegram.WebApp.setBackgroundColor('#000000');
