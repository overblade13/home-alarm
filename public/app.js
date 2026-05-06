const DEVICE_ID = 'c4957cfd-0a7e-4c37-8053-f9621610048e';
const API_URL = 'http://localhost:3000/api';

const statusBadge = document.getElementById('status-badge');
const eventsBody = document.getElementById('events-body');

// Кнопки
const btnArm = document.getElementById('btn-arm');
const btnDisarm = document.getElementById('btn-disarm');
const btnReset = document.getElementById('btn-reset');
const btnTest = document.getElementById('btn-test');
const alarmSound = document.getElementById('alarm-sound');

// ==========================================
// 1. Логика управления
// ==========================================

async function sendCommand(command) {
    try {
        const response = await fetch(`${API_URL}/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_id: DEVICE_ID, command })
        });
        const result = await response.json();
        console.log('Команда отправлена:', command, result);
        
        // Для немедленного обновления UI после нажатия
        updateStatus();
    } catch (err) {
        console.error('Ошибка отправки команды:', err);
    }
}

btnArm.addEventListener('click', () => sendCommand('ARM'));
btnDisarm.addEventListener('click', () => sendCommand('DISARM'));
btnReset.addEventListener('click', () => sendCommand('DISARM'));
btnTest.addEventListener('click', () => sendCommand('ALARM'));

// ==========================================
// 2. Логика обновления статуса
// ==========================================

async function updateStatus() {
    try {
        const response = await fetch(`${API_URL}/status?device_id=${DEVICE_ID}`);
        const data = await response.json();
        
        renderStatus(data.mode);
        renderEvents(data.events);
    } catch (err) {
        console.error('Ошибка получения статуса:', err);
    }
}

function renderStatus(mode) {
    statusBadge.className = ''; // Сброс классов
    
    switch(mode) {
        case 'ARMED':
        case 'ARM':
            statusBadge.innerText = 'СИСТЕМА НА ОХРАНЕ';
            statusBadge.classList.add('status-armed');
            alarmSound.pause();
            alarmSound.currentTime = 0;
            break;
        case 'ALARM':
            statusBadge.innerText = 'ТРЕВОГА! ВЗЛОМ!';
            statusBadge.classList.add('status-alarm');
            if (alarmSound.paused) {
                alarmSound.play().catch(e => console.log("Нужно взаимодействие с пользователем для звука"));
            }
            break;
        default:
            statusBadge.innerText = 'СИСТЕМА СНЯТА С ОХРАНЫ';
            statusBadge.classList.add('status-disarmed');
            alarmSound.pause();
            alarmSound.currentTime = 0;
    }
}

function renderEvents(events) {
    eventsBody.innerHTML = '';
    
    events.forEach(event => {
        const row = document.createElement('tr');
        const date = new Date(event.created_at).toLocaleString('ru-RU');
        
        row.innerHTML = `
            <td>${date}</td>
            <td><strong>${event.event_type}</strong></td>
            <td>${event.sensor}</td>
            <td>${event.message}</td>
        `;
        eventsBody.appendChild(row);
    });
}

// Запуск поллинга
setInterval(updateStatus, 2000);
updateStatus();
