export const PACKET_EXAMPLE = `{
  "hb": 1,
  "mode": "manual",
  "drive": { "steering": 0.0, "throttle": 0.0 },
  "sensors": { "pitch": 0.0, "roll": 0.0 }
}`;

export const SAX_HEADER = String.raw`// SaX.h
// Reads the packets the SaX app sends over USB (115200 baud).
// The app only forwards the controls and the phone's tilt.
// Every decision is made here, in your firmware.
//
// A packet is one line of JSON, sent every 100 ms:
// {"hb":1,"mode":"manual","drive":{"steering":0,"throttle":0},"sensors":{"pitch":0,"roll":0}}

#ifndef SAX_H
#define SAX_H

#include <Arduino.h>
#include <stdlib.h>
#include <string.h>

class SaXLink {
 public:
  bool autoMode = false;  // true when the app is in Autonomous mode
  float steering = 0;     // -1.0 (left) to +1.0 (right)
  float throttle = 0;     // -1.0 (reverse) to +1.0 (forward)
  float pitch = 0;        // phone tilt in degrees
  float roll = 0;         // phone tilt in degrees

  void begin(unsigned long baud = 115200) {
    Serial.begin(baud);
  }

  // Call this at the top of loop(). Returns true when a new packet arrived.
  bool update() {
    bool gotPacket = false;
    while (Serial.available() > 0) {
      char c = (char)Serial.read();
      if (c == '\n') {
        line[used] = '\0';
        if (parse()) gotPacket = true;
        used = 0;
      } else if (used < sizeof(line) - 1) {
        line[used++] = c;
      } else {
        used = 0;  // line too long, start over
      }
    }
    return gotPacket;
  }

  // False when no packet arrived for timeoutMs. Stop your motors when it is false.
  bool alive(unsigned long timeoutMs = 300) const {
    return lastPacketAt != 0 && millis() - lastPacketAt < timeoutMs;
  }

 private:
  char line[160];
  size_t used = 0;
  unsigned long lastPacketAt = 0;

  bool number(const char* key, float& value) const {
    const char* found = strstr(line, key);
    if (found == nullptr) return false;
    value = (float)atof(found + strlen(key));
    return true;
  }

  bool parse() {
    if (strstr(line, "\"hb\":1") == nullptr) return false;
    autoMode = strstr(line, "\"mode\":\"auto\"") != nullptr;
    number("\"steering\":", steering);
    number("\"throttle\":", throttle);
    number("\"pitch\":", pitch);
    number("\"roll\":", roll);
    steering = constrain(steering, -1.0f, 1.0f);
    throttle = constrain(throttle, -1.0f, 1.0f);
    lastPacketAt = millis();
    Serial.println("{\"hb\":1}");  // tells the app this board is alive
    return true;
  }
};

SaXLink SaX;

#endif
`;

export const SAMPLE_SKETCH = String.raw`// Sample sketch for a two-wheel rover, using Arduino Uno / Nano pins.
// Wire these pins to your motor driver, or change the numbers to match your circuit.
#include "SaX.h"

const int LEFT_SPEED_PIN = 5;   // PWM pin
const int LEFT_DIR_PIN = 4;
const int RIGHT_SPEED_PIN = 6;  // PWM pin
const int RIGHT_DIR_PIN = 7;
const int STATUS_LED_PIN = 13;

unsigned long lastReport = 0;

void setup() {
  SaX.begin();  // 115200 baud, the same as the app
  pinMode(LEFT_SPEED_PIN, OUTPUT);
  pinMode(LEFT_DIR_PIN, OUTPUT);
  pinMode(RIGHT_SPEED_PIN, OUTPUT);
  pinMode(RIGHT_DIR_PIN, OUTPUT);
  pinMode(STATUS_LED_PIN, OUTPUT);
}

// speed runs from -1.0 (full reverse) to +1.0 (full forward)
void setMotor(int speedPin, int dirPin, float speed) {
  speed = constrain(speed, -1.0f, 1.0f);
  digitalWrite(dirPin, speed >= 0 ? HIGH : LOW);
  analogWrite(speedPin, (int)(fabs(speed) * 255));
}

void drive(float left, float right) {
  setMotor(LEFT_SPEED_PIN, LEFT_DIR_PIN, left);
  setMotor(RIGHT_SPEED_PIN, RIGHT_DIR_PIN, right);
}

void loop() {
  SaX.update();  // reads any new packet. Avoid delay() in loop().

  // Failsafe: no packets for 300 ms means the cable, the app, or the phone stopped.
  if (!SaX.alive()) {
    drive(0, 0);
    digitalWrite(STATUS_LED_PIN, LOW);
    return;
  }
  digitalWrite(STATUS_LED_PIN, HIGH);

  if (SaX.autoMode) {
    // Your own autonomous logic goes here.
    // This example drives forward and leans into the phone's tilt.
    float turn = constrain(SaX.roll / 45.0f, -1.0f, 1.0f);
    drive(0.4f + 0.3f * turn, 0.4f - 0.3f * turn);
  } else {
    // Joystick control: mix throttle and steering into left and right wheels.
    drive(SaX.throttle + SaX.steering, SaX.throttle - SaX.steering);
  }

  // Anything you print shows up in the SaX console.
  if (millis() - lastReport > 1000) {
    lastReport = millis();
    Serial.print(SaX.autoMode ? "auto" : "manual");
    Serial.print(" throttle=");
    Serial.println(SaX.throttle);
  }
}
`;
