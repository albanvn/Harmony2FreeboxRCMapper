# Harmony2FreeboxRCMapper - Developer Documentation

A Node.js server that allows you to control your Freebox via a **Logitech Harmony remote and its Hub** by emulating a Roku device.

## 🙏 Acknowledgments

This project is inspired by [EcpEmuServer](https://github.com/logantgt/EcpEmuServer) for Roku ECP protocol emulation.

## 📋 Prerequisites

- Node.js (version 18 or higher)
- A Freebox with remote control API enabled
- A Logitech Harmony Hub (**does not work with standalone Harmony remotes**)
- Your Freebox remote control code

## 🏗️ Project Structure

```
Harmony2FreeboxRCMapper/
├── src/                          # Backend (Node.js)
│   ├── server.js                 # Main Express server
│   ├── ruleManager.js            # Button mapping execution
│   ├── ssdpManager.js            # SSDP discovery protocol
│   ├── logger.js                 # Centralized logging system
│   ├── constants.js              # Application constants
│   └── markdownConverter.js      # README.md to HTML converter
├── public/                       # Static frontend resources
│   ├── js/
│   │   └── main.js              # Frontend JavaScript
│   ├── css/
│   │   └── main.css             # Styles
│   └── edit.html                # Configuration page
├── templates/
│   ├── main.html                # Main page (logs)
│   └── header.html              # Common header
├── rules.json                    # Current configuration
├── rules_default.json            # Default configuration
├── package.json                  # Dependencies
└── README.md                     # User documentation
```

## 🎯 Features

- ✅ Emulates a Roku device detectable by Harmony Hub
- ✅ Translates Roku commands to Freebox commands
- ✅ Web interface for button mapping configuration
- ✅ Real-time logs with filtering
- ✅ Default configuration reset
- ✅ Individual button testing

## 🚀 Installation

1. **Clone or download the project**
   ```bash
   git clone <repository-url>
   cd Harmony2FreeboxRCMapper
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Get your Freebox remote control code**
   - Connect to your Freebox: https://mafreebox.freebox.fr
   - Go to **Settings** → **Network Remote Control**
   - Enable network remote control if not already done
   - Note the **remote control code** (8 digits)

4. **Start the server**
   ```bash
   npm start
   ```

   Server starts on `http://0.0.0.0:8042`

   > **Note:** If you have multiple network interfaces, you can specify the IP address to use:
   ```bash
   node src/server.js 192.168.1.100
   ```

## 🔧 Architecture

### Backend Components

#### `src/server.js`
Main Express application server:
- Serves static files (public/)
- Provides REST API endpoints
- Handles Roku ECP protocol
- Manages configuration persistence

**Key endpoints:**
- `GET /` - Main page with logs
- `GET /edit` - Configuration interface
- `GET /help` - Dynamic documentation from README.md
- `GET /device-desc.xml` - SSDP device description
- `POST /keypress/:btn` - Roku button press handler
- `GET /api/logs` - Get application logs
- `GET /api/rules` - Get current configuration
- `POST /api/rules` - Save configuration
- `POST /api/reset-rules` - Reset to default config
- `POST /api/toggle` - Enable/disable rule execution
- `POST /api/test-rule` - Test a single button
- `GET /api/freebox-keys` - Get available Freebox keys
- `GET /api/roku-buttons` - Get available Roku buttons

#### `src/ssdpManager.js`
SSDP (Simple Service Discovery Protocol) implementation:
- Listens for M-SEARCH requests on multicast 239.255.255.250:1900
- Responds with device information (Roku emulation)
- Provides device description XML

**Key methods:**
- `SSDPManager.startSSDP()` - Initialize SSDP server
- `SSDPManager.getLocalIPAddress()` - Get network interface IP
- `SSDPMessages.getEcpDeviceNotifyMessage()` - NOTIFY message
- `SSDPMessages.getEcpDeviceOKMessage()` - M-SEARCH response
- `SSDPMessages.getEcpDeviceRootResponse()` - Device description XML

#### `src/ruleManager.js`
Button mapping execution engine:
- Loads rules from rules.json
- Executes HTTP GET requests to Freebox API
- Maps Roku buttons to Freebox keys

**Key methods:**
- `RuleManager.loadRules()` - Load configuration from file
- `RuleManager.execute(button)` - Execute rule for button press

#### `src/logger.js`
Centralized logging system:
- Maintains a circular buffer of logs (max 500 entries)
- Severity levels: INFO, WARN, ERROR, SUCCESS
- Exposes logs via API for real-time display

**Key exports:**
- `Logger.log(severity, message)` - Log a message
- `Logger.error(message)` - Log an error
- `logBuffer` - Array of log entries

#### `src/constants.js`
Application-wide constants:
- `FBX_RC_URL` - Freebox remote control API endpoint
- `FREEBOX_KEYS` - Available Freebox buttons
- `ROKU_BUTTONS` - Roku button names
- `DEFAULT_HOST`, `DEFAULT_PORT` - Server configuration
- `SSDP_*` - SSDP protocol constants
- `MAX_LOGS` - Maximum log buffer size

#### `src/markdownConverter.js`
Converts README.md to HTML on-the-fly:
- Custom Markdown parser (no external dependencies)
- Generates styled HTML page for /help endpoint
- Supports: headers, code blocks, tables, lists, links

### Frontend Components

#### `public/edit.html`
Configuration interface:
- Freebox remote control code input
- Roku → Freebox button mapping
- Individual button testing
- Save/reset functionality

#### `templates/main.html`
Main monitoring page:
- Real-time log display with filtering (All/Info/Warning/Error)
- Copy logs to clipboard
- Clear logs
- Enable/disable rule execution
- JSON configuration viewer with copy/export/import

#### `public/js/main.js`
Frontend JavaScript:
- Fetches logs every 2 seconds
- Implements log filtering
- Handles configuration import/export
- Manages UI state

#### `public/css/main.css`
Shared styles for all pages

## 🔌 API Reference

### Button Press
```
POST /keypress/:btn
```
Triggers a button press (Roku ECP protocol)

**Example:**
```bash
curl -X POST http://localhost:8042/keypress/Home
```

### Get Logs
```
GET /api/logs
```
Returns application logs and execution status

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2025-11-17T10:30:00.000Z",
      "severity": "INFO",
      "message": "Button press received"
    }
  ],
  "enabled": true
}
```

### Get Configuration
```
GET /api/rules
```
Returns current button mapping configuration

**Response:**
```json
{
  "success": true,
  "rules": [
    { "Button": "Home", "Key": "home" }
  ],
  "remoteControlId": "12345678"
}
```

### Save Configuration
```
POST /api/rules
Content-Type: application/json

{
  "rules": [...],
  "remoteControlId": "12345678"
}
```

### Test Single Button
```
POST /api/test-rule
Content-Type: application/json

{
  "key": "home",
  "remoteControlId": "12345678"
}
```

### Toggle Execution
```
POST /api/toggle
```
Enables or disables rule execution

**Response:**
```json
{
  "success": true,
  "enabled": false
}
```

## 🧪 Development

### Running in Development Mode
```bash
node src/server.js
```

### Specifying IP Address
```bash
node src/server.js 192.168.1.100
```

### Testing SSDP Discovery
Use a tool like `tcpdump` to monitor SSDP traffic:
```bash
sudo tcpdump -i any -n -v udp port 1900
```

### Testing Freebox API
Verify your remote control code:
```bash
curl "http://hd1.freebox.fr/pub/remote_control?code=YOUR_CODE&key=home"
```

## 🔑 Available Freebox Keys

The Freebox API supports the following keys:

- **Navigation**: `up`, `down`, `left`, `right`, `ok`
- **Control**: `power`, `back`, `home`
- **Volume**: `vol_inc`, `vol_dec`, `mute`
- **Channels**: `prgm_inc`, `prgm_dec`
- **Playback**: `play`, `pause`, `fwd`, `bwd`, `rec`
- **Colors**: `red`, `green`, `yellow`, `blue`
- **Other**: `list`, `tv`, `media`, `free`

## 📝 Configuration Files

### `rules.json`
Current active configuration:
```json
{
  "remoteControlId": "12345678",
  "rules": [
    { "Button": "Home", "Key": "home" },
    { "Button": "Back", "Key": "back" },
    { "Button": "Select", "Key": "ok" }
  ]
}
```

### `rules_default.json`
Default configuration template used for reset operations.

## 🛠️ Troubleshooting

### Server doesn't start
- Check if port 8042 is already in use: `lsof -i :8042`
- Verify Node.js installation: `node --version`

### Harmony doesn't detect device
- Ensure server and Harmony Hub are on the same network
- Check SSDP logs for M-SEARCH requests
- Verify firewall allows UDP port 1900
- Try specifying IP address manually when starting server

### Commands don't work
- Verify remote control code is correct (8 digits)
- Test individual buttons using the Test button
- Check real-time logs for errors
- Ensure network remote control is enabled on Freebox

### Device appears but doesn't respond
- Check button mappings in `/edit`
- Verify rules are not disabled (Enable/Disable toggle)
- Test Freebox API directly using curl

## 📝 License

This project is distributed under the MIT License.

Copyright (c) 2025 Harmony2FreeboxRCMapper

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or pull request.

### Development Guidelines
- Follow existing code style
- Add comments for complex logic
- Test changes thoroughly
- Update documentation when adding features

## 📧 Support

For questions or issues:
- Check real-time logs on web interface
- Review server console output
- Open an issue on GitHub
