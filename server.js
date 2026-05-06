const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Supabase Setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ==========================================
// 1. Прием телеметрии от ESP32
// ==========================================
app.post('/api/telemetry', async (req, res) => {
  try {
    const { device_id, event_type, sensor, message } = req.body;

    if (!device_id || !event_type) {
      return res.status(400).json({ error: 'device_id и event_type обязательны' });
    }

    console.log(`[Telemetry] Device: ${device_id}, Event: ${event_type}, Sensor: ${sensor}`);

    // 1. Записываем событие в лог
    const { error: eventError } = await supabase
      .from('events')
      .insert([{ device_id, event_type, sensor, message }]);

    if (eventError) throw eventError;

    // 2. Обновляем текущий режим в настройках
    const { error: settingsError } = await supabase
      .from('settings')
      .upsert({ 
        device_id, 
        current_mode: event_type
      }, { onConflict: 'device_id' });

    if (settingsError) throw settingsError;

    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Ошибка телеметрии:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 2. Получение статуса для Web UI и ESP32
// ==========================================
app.get('/api/status', async (req, res) => {
  try {
    const { device_id } = req.query;

    if (!device_id) {
      return res.status(400).json({ error: 'device_id обязателен' });
    }

    // 1. Получаем текущий режим
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('current_mode')
      .eq('device_id', device_id)
      .single();

    // 2. Получаем последние 10 событий
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('device_id', device_id)
      .order('created_at', { ascending: false })
      .limit(10);

    res.status(200).json({
      mode: settings ? settings.current_mode : 'DISARMED',
      events: events || []
    });
  } catch (error) {
    console.error('Ошибка получения статуса:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 3. Отправка команд с Web UI
// ==========================================
app.post('/api/command', async (req, res) => {
  try {
    const { device_id, command } = req.body;

    if (!device_id || !command) {
      return res.status(400).json({ error: 'device_id и command обязательны' });
    }

    console.log(`[Command] Device: ${device_id}, Action: ${command}`);

    // 1. Обновляем режим в БД. ESP32 увидит это при следующем GET запросе к /api/status
    const { error: settingsError } = await supabase
      .from('settings')
      .upsert({ 
        device_id, 
        current_mode: command
      }, { onConflict: 'device_id' });

    if (settingsError) throw settingsError;

    // 2. Записываем команду в журнал событий, чтобы пользователь видел её на сайте
    const { error: eventError } = await supabase
      .from('events')
      .insert([{ 
        device_id, 
        event_type: 'COMMAND', 
        sensor: 'WEB_UI', 
        message: `Выполнена команда: ${command}` 
      }]);

    if (eventError) throw eventError;

    res.status(200).json({ status: 'command_received' });
  } catch (error) {
    console.error('Ошибка команды:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Локальный сервер сигнализации запущен на http://localhost:${PORT}`);
});
