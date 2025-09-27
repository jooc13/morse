#include <Arduino.h>
#include <driver/i2s.h>
#include <SD.h>
#include <SPI.h>
#include <WiFi.h>
#include <HTTPClient.h>
#define I2S_WS 25
#define I2S_SCK 26
#define I2S_SD 22
#define BUTTON_PIN 4
#define SD_CS 5
#define I2S_SAMPLE_RATE 16000
#define I2S_BITS_PER_SAMPLE I2S_BITS_PER_SAMPLE_32BIT
#define I2S_CHANNEL I2S_CHANNEL_FMT_ONLY_LEFT
// WiFi credentials
const char* ssid = "Hillcrest";
const char* password = "Ernie244!";
// Server details
const char* serverUrl = "http://3.134.105.86:32531/api/upload";
File file;
bool isRecording = false;
int fileIndex = 0;
char filename[16];
void setup() {
  Serial.begin(115200);
  while (!Serial);
  // Initialize button
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  // Initialize SD card
  if (!SD.begin(SD_CS)) {
    Serial.println("SD card initialization failed!");
    while (true);
  }
  Serial.println("SD card initialized.");
  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Connected! IP: ");
  Serial.println(WiFi.localIP());
  // Test basic connectivity
  testConnection();
  // Initialize I2S
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = I2S_SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format = I2S_CHANNEL,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = 0,
    .dma_buf_count = 16,
    .dma_buf_len = 1024,
    .use_apll = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk = 0
  };
  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_SCK,
    .ws_io_num = I2S_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_SD
  };
  if (i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL) != ESP_OK) {
    Serial.println("I2S driver install failed!");
    while (true);
  }
  if (i2s_set_pin(I2S_NUM_0, &pin_config) != ESP_OK) {
    Serial.println("I2S pin set failed!");
    while (true);
  }
  Serial.println("I2S initialized.");
}
void testConnection() {
  Serial.println("Testing basic connectivity...");
  HTTPClient http;
  http.begin("http://3.134.105.86:32531/");
  int httpCode = http.GET();
  Serial.printf("HTTP GET response: %d\n", httpCode);
  if (httpCode > 0) {
    String response = http.getString();
    Serial.printf("Response: %s\n", response.c_str());
  }
  http.end();
}
void writeWavHeader(File file, uint32_t sampleRate) {
  uint32_t fileSize = 44;
  uint32_t dataSize = 0;
  uint16_t channels = 1;
  uint16_t bitsPerSample = 16;
  uint32_t byteRate = sampleRate * channels * (bitsPerSample / 8);
  uint16_t blockAlign = channels * (bitsPerSample / 8);
  file.write((uint8_t*)"RIFF", 4);
  file.write((uint8_t*)&fileSize, 4);
  file.write((uint8_t*)"WAVE", 4);
  file.write((uint8_t*)"fmt ", 4);
  file.write((uint8_t[]){16, 0, 0, 0}, 4);
  file.write((uint8_t[]){1, 0}, 2);
  file.write((uint8_t*)&channels, 2);
  file.write((uint8_t*)&sampleRate, 4);
  file.write((uint8_t*)&byteRate, 4);
  file.write((uint8_t*)&blockAlign, 2);
  file.write((uint8_t*)&bitsPerSample, 2);
  file.write((uint8_t*)"data", 4);
  file.write((uint8_t*)&dataSize, 4);
}
void updateWavHeader(File file, uint32_t dataSize) {
  if (dataSize == 0) {
    Serial.println("No data recorded; skipping header update.");
    return;
  }
  uint32_t fileSize = dataSize + 44;
  file.seek(4);
  file.write((uint8_t*)&fileSize, 4);
  file.seek(40);
  file.write((uint8_t*)&dataSize, 4);
}
void uploadFile(const char* filename) {
  Serial.printf("=== Starting upload of %s ===\n", filename);
  // Reconnect WiFi if needed
  if (WiFi.status() != WL_CONNECTED) {
    Serial.print("WiFi disconnected, reconnecting...");
    WiFi.reconnect();
    for (int i = 0; i < 10 && WiFi.status() != WL_CONNECTED; i++) {
      delay(500);
      Serial.print(".");
    }
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("Failed to reconnect; skipping upload.");
      return;
    }
    Serial.println("Reconnected.");
  }
  File uploadFile = SD.open(filename, FILE_READ);
  if (!uploadFile) {
    Serial.println("Failed to open file for upload.");
    return;
  }
  size_t fileSize = uploadFile.size();
  Serial.printf("File size: %d bytes\n", fileSize);
  if (fileSize == 0) {
    Serial.println("File is empty, skipping upload.");
    uploadFile.close();
    return;
  }
  // Parse server URL
  String url = String(serverUrl);
  int port = 32531;
  String host = url.substring(7, url.indexOf(":", 7));
  String path = url.substring(url.indexOf("/", url.indexOf(":", 7)));
  Serial.printf("Host: %s, Port: %d, Path: %s\n", host.c_str(), port, path.c_str());
  WiFiClient client;
  Serial.println("Attempting to connect to server...");
  if (!client.connect(host.c_str(), port)) {
    Serial.println("Connection to server failed.");
    uploadFile.close();
    return;
  }
  Serial.println("Connected to server successfully.");
  String boundary = "----ESP32Boundary";
  String head = "--" + boundary + "\r\nContent-Disposition: form-data; name=\"audio\"; filename=\"" + String(filename) + "\"\r\nContent-Type: audio/wav\r\n\r\n";
  String tail = "\r\n--" + boundary + "--\r\n";
  size_t totalSize = head.length() + fileSize + tail.length();
  Serial.printf("Total content length: %d\n", totalSize);
  // Send HTTP headers
  String request = String("POST ") + path + " HTTP/1.1\r\n";
  request += String("Host: ") + host + ":" + port + "\r\n";
  request += "Content-Type: multipart/form-data; boundary=" + boundary + "\r\n";
  request += "Content-Length: " + String(totalSize) + "\r\n";
  request += "Connection: close\r\n\r\n";
  Serial.println("Sending HTTP headers:");
  Serial.print(request);
  client.print(request);
  // Send head
  Serial.println("Sending multipart header:");
  Serial.print(head);
  client.print(head);
  // Send file in chunks
  const size_t chunkSize = 512;
  uint8_t buffer[chunkSize];
  size_t totalSent = 0;
  Serial.println("Sending file data...");
  while (totalSent < fileSize) {
    size_t bytesToRead = min(chunkSize, fileSize - totalSent);
    size_t bytesRead = uploadFile.read(buffer, bytesToRead);
    if (bytesRead == 0) {
      Serial.println("Error reading file.");
      break;
    }
    size_t bytesWritten = client.write((const char*)buffer, bytesRead);
    if (bytesWritten != bytesRead) {
      Serial.printf("Write error: expected %d, wrote %d\n", bytesRead, bytesWritten);
    }
    totalSent += bytesRead;
    if (totalSent % 2048 == 0) { // Log every 2KB
      Serial.printf("Sent %d/%d bytes\n", totalSent, fileSize);
    }
  }
  uploadFile.close();
  // Send tail
  Serial.println("Sending multipart tail:");
  Serial.print(tail);
  client.print(tail);
  // Read response with timeout
  Serial.println("Waiting for server response...");
  unsigned long timeout = millis() + 15000; // 15s timeout
  String response;
  bool responseStarted = false;
  while (client.connected() && millis() < timeout) {
    if (client.available()) {
      String line = client.readStringUntil('\n');
      response += line + "\n";
      if (!responseStarted) {
        Serial.println("Response started:");
        responseStarted = true;
      }
      Serial.println(line);
    }
    delay(10);
  }
  if (!responseStarted) {
    Serial.println("No response received from server!");
  }
  client.stop();
  Serial.println("=== Upload complete ===");
}
void loop() {
  static bool lastButtonState = HIGH;
  bool buttonState = digitalRead(BUTTON_PIN);
  if (buttonState == LOW && lastButtonState == HIGH) {
    delay(10);
    do {
      sprintf(filename, "/rec%d.wav", fileIndex % 1000);
      fileIndex++;
    } while (SD.exists(filename));
    fileIndex--;
    file = SD.open(filename, FILE_WRITE);
    if (file) {
      writeWavHeader(file, I2S_SAMPLE_RATE);
      isRecording = true;
      Serial.printf("Recording to %s\n", filename);
    } else {
      Serial.println("Failed to open file!");
    }
  } else if (buttonState == HIGH && lastButtonState == LOW && isRecording) {
    delay(10);
    isRecording = false;
    uint32_t dataSize = file.size() - 44;
    updateWavHeader(file, dataSize);
    file.flush();
    file.close();
    Serial.printf("Recording stopped. File size: %d bytes\n", file.size());
    uploadFile(filename);
  }
  lastButtonState = buttonState;
  if (isRecording) {
    int32_t sample;
    size_t bytes_read;
    if (i2s_read(I2S_NUM_0, &sample, sizeof(sample), &bytes_read, 0) == ESP_OK && bytes_read == sizeof(sample)) {
      int16_t sample16 = sample >> 16;
      file.write((uint8_t*)&sample16, 2);
    }
  }
}



