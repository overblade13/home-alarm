# Система управления домашней сигнализацией (Home Alarm System)

Интеллектуальная система безопасности и мониторинга жилых помещений, построенная на базе микроконтроллера ESP32, локального сервера Node.js и облачной базы данных Supabase. Проект разработан для эмуляции в среде Wokwi.

## Особенности системы

* **Многорежимная логика охраны:** Поддержка трех состояний конечного автомата — Снято с охраны (`DISARMED`), На охране (`ARMED`) и Тревога (`ALARM`)[cite: 1].
* **Непрерывный мониторинг периметра:** Интеграция виртуальных инфракрасных датчиков движения (PIR) и магнитоконтактных датчиков открытия (геркон)[cite: 1].
* **Аппаратная защита от сбоев:** Программная фильтрация ложных срабатываний (дебаунс тактовой кнопки) и неблокирующая индикация тревоги (зуммер и мигание светодиодов) с использованием системного таймера `millis()`[cite: 1].
* **Сетевое взаимодействие реального времени:** Обмен данными между ESP32 и локальным сервером через HTTP/REST API (POST/GET запросы формата JSON) без использования сторонних брокеров сообщений[cite: 1].
* **Веб-интерфейс (SPA):** Адаптивная панель управления на нативном JavaScript (HTML5/CSS3) для удаленной постановки на охрану, сброса тревоги и просмотра журнала событий[cite: 1].

## Структура проекта

* `/public` — Клиентская часть (Frontend: HTML, CSS, Vanilla JS)[cite: 1].
* `server.js` — Серверная часть (Backend: Node.js, Express) работающая на `localhost:3000`[cite: 1].
* `/src/main.cpp` — Исходный код прошивки микроконтроллера ESP32 (C++, PlatformIO)[cite: 1].
* `diagram.json` — Файл конфигурации топологии схемы для симулятора Wokwi.
* `platformio.ini` — Конфигурация среды сборки и зависимостей проекта (ArduinoJson).

## Требования

* Установленный Node.js (v14+).
* Среда разработки Visual Studio Code с расширением PlatformIO.
* Учетная запись и созданный проект в Supabase.

## Установка и запуск

### 1. Настройка базы данных Supabase
В панели управления Supabase (SQL Editor) выполните следующие запросы для создания необходимых таблиц:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE settings (
    device_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    current_mode TEXT NOT NULL DEFAULT 'DISARMED'
);

INSERT INTO settings (current_mode) VALUES ('DISARMED');

CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    device_id UUID REFERENCES settings(device_id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    sensor TEXT NOT NULL,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
