#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ==========================================
// 1. Настройки сети и сервера
// ==========================================
const char* ssid = "Wokwi-GUEST";
const char* password = "";
const char* serverUrl = "http://192.168.0.103:3000/api"; // Замените на IP вашего ПК
const String deviceId = "c4957cfd-0a7e-4c37-8053-f9621610048e";

// ==========================================
// 2. Настройки пинов
// ==========================================
const int PIN_PIR = 13;      // Датчик движения
const int PIN_DOOR = 12;     // Датчик двери (Геркон)
const int PIN_BTN = 14;      // Кнопка управления
const int PIN_LED_RED = 27;    // Тревога
const int PIN_LED_YELLOW = 26; // Охрана
const int PIN_LED_GREEN = 25;  // Снято
const int PIN_BUZZER = 33;    // Зуммер

// ==========================================
// 3. Состояния системы
// ==========================================
enum SystemState { DISARMED, ARMED, ALARM };
SystemState currentState = DISARMED;

// Переменные для millis()
unsigned long lastPollTime = 0;
const unsigned long pollInterval = 3000; // Опрос сервера каждые 3 сек

unsigned long lastBlinkTime = 0;
bool ledState = false;

// Дебаунс кнопки
unsigned long lastBtnPress = 0;
bool lastBtnState = HIGH;

// ==========================================
// 4. Прототипы функций
// ==========================================
void sendTelemetry(String type, String sensor, String msg);
void fetchStatus();
void updateHardware();

// ==========================================
// 5. Инициализация
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(1000); // Даем время на инициализацию
  
  pinMode(PIN_PIR, INPUT);
  pinMode(PIN_DOOR, INPUT_PULLUP);
  pinMode(PIN_BTN, INPUT_PULLUP);
  
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  
  digitalWrite(PIN_BUZZER, LOW); // Гарантированное выключение без вызова драйвера LEDC

  // WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");
  
  // Начальное состояние
  updateHardware();
}

// ==========================================
// 6. Основной цикл
// ==========================================
void loop() {
  unsigned long now = millis();

  // 1. Опрос кнопки (Дебаунс)
  bool btnState = digitalRead(PIN_BTN);
  if (btnState == LOW && lastBtnState == HIGH && (now - lastBtnPress > 200)) {
    lastBtnPress = now;
    if (currentState == ALARM) {
      currentState = DISARMED;
      sendTelemetry("DISARM", "BUTTON", "Alarm reset via button");
    } else if (currentState == DISARMED) {
      currentState = ARMED;
      sendTelemetry("ARM", "BUTTON", "System armed via button");
    } else {
      currentState = DISARMED;
      sendTelemetry("DISARM", "BUTTON", "System disarmed via button");
    }
    updateHardware();
  }
  lastBtnState = btnState;

  // 2. Логика охраны
  if (currentState == ARMED) {
    bool pirTrigger = digitalRead(PIN_PIR);
    bool doorTrigger = digitalRead(PIN_DOOR); // LOW = Открыто

    if (pirTrigger == HIGH) {
      currentState = ALARM;
      sendTelemetry("ALARM", "MOTION", "Intrusion detected! (PIR)");
      updateHardware();
    } else if (doorTrigger == LOW) {
      currentState = ALARM;
      sendTelemetry("ALARM", "DOOR", "Door opened!");
      updateHardware();
    }
  }

  // 3. Эффекты тревоги (Мигание и писк)
  if (currentState == ALARM) {
    if (now - lastBlinkTime > 500) {
      lastBlinkTime = now;
      ledState = !ledState;
      digitalWrite(PIN_LED_RED, ledState);
      if (ledState) {
        tone(PIN_BUZZER, 1000); // Пищим 1 кГц
      } else {
        noTone(PIN_BUZZER);
      }
    }
  }

  // 4. Периодический опрос сервера
  if (now - lastPollTime > pollInterval) {
    lastPollTime = now;
    fetchStatus();
  }
}

// ==========================================
// 7. Функции работы с сетью
// ==========================================

void sendTelemetry(String type, String sensor, String msg) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(String(serverUrl) + "/telemetry");
    http.addHeader("Content-Type", "application/json");
    
    StaticJsonDocument<200> doc;
    doc["device_id"] = deviceId;
    doc["event_type"] = type;
    doc["sensor"] = sensor;
    doc["message"] = msg;
    
    String json;
    serializeJson(doc, json);
    int httpCode = http.POST(json);
    http.end();
  }
}

void fetchStatus() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(String(serverUrl) + "/status?device_id=" + deviceId);
    int httpCode = http.GET();
    
    if (httpCode == 200) {
      String payload = http.getString();
      StaticJsonDocument<512> doc;
      deserializeJson(doc, payload);
      
      String serverMode = doc["mode"];
      SystemState newState = currentState;
      
      if (serverMode == "ARM") newState = ARMED;
      else if (serverMode == "DISARM") newState = DISARMED;
      else if (serverMode == "ALARM") newState = ALARM;
      
      if (newState != currentState) {
        currentState = newState;
        updateHardware();
        Serial.println("State updated from server: " + serverMode);
      }
    }
    http.end();
  }
}

// ==========================================
// 8. Управление железом
// ==========================================
void updateHardware() {
  // Сброс всех LED и зуммера
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_LED_YELLOW, LOW);
  digitalWrite(PIN_LED_GREEN, LOW);
  
  // Выключаем звук только через digitalWrite. 
  // Это предотвращает ошибки драйвера LEDC (ШИМ) в консоли.
  digitalWrite(PIN_BUZZER, LOW);
  
  switch (currentState) {
    case DISARMED:
      digitalWrite(PIN_LED_GREEN, HIGH);
      break;
    case ARMED:
      digitalWrite(PIN_LED_YELLOW, HIGH);
      break;
    case ALARM:
      // В режиме ALARM логика мигания в loop()
      break;
  }
}
