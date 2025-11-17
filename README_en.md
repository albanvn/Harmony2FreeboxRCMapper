# Harmony2FreeboxRCMapper

A Node.js server that allows you to control your Freebox via a Logitech Harmony remote by emulating a Roku device.

## 🙏 Acknowledgments

This project is inspired by [EcpEmuServer](https://github.com/logantgt/EcpEmuServer) for Roku ECP protocol emulation.

## 📋 Prerequisites

- Node.js (version 18 or higher)
- A Freebox with remote control API enabled
- A Logitech Harmony Hub (does not work with standalone Harmony remotes)
- Your Freebox remote control code

## 🎯 Features

- ✅ Emulates a Roku device detectable by Harmony Hub
- ✅ Translates Roku commands to Freebox commands
- ✅ Web interface for button mapping configuration
- ✅ Real-time logs
- ✅ Resettable default configuration
- ✅ Live button testing

## 🚀 Installation

1. **Clone or download the project**
   ```bash
   cd Harmony2FreeboxRCMapper
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Get your Freebox remote control code**
   - Connect to your Freebox: https://mafreebox.freebox.fr
   - Go to **Settings** → **Network Remote Control**
   - Enable network remote control if not already active
   - Note the **remote control code** (8 digits)

4. **Start the server**
   ```bash
   npm start
   ```
   
   The server starts on `http://0.0.0.0:8060`

   > **Note:** If you have multiple network interfaces, you can specify the IP address to use:
   ```bash
   node src/server.js 192.168.1.100
   ```

## 🎮 Harmony Configuration

### Step 1: Add Roku Device on Harmony

1. **Open the Harmony app**
   - Launch the Harmony app on your smartphone or tablet
   - Connect to your Hub

2. **Add a new device**
   - Tap **Menu** (☰) → **Harmony Setup** → **Add/Edit Devices & Activities**
   - Select **Devices**
   - Tap **Add Device**

3. **Automatic scan**
   - Select **Scan for devices on your network**
   - Harmony will automatically detect the Harmony2FreeboxRCMapper server emulating a Roku device
   - The device should appear as **"TCL Roku TV"** or similar

4. **Select detected device**
   - Choose the **TCL Roku TV** device from the list
   - Validate and complete the setup

5. **Alternative: Manual addition**
   
   If automatic detection doesn't work:
   - Choose **Add device manually**
   - Manufacturer: `Roku`
   - Model: `Roku 3` or `Roku Streaming Stick`
   - Once added, ensure your Harmony and the server are on the same network

### Step 2: Configure Buttons

1. **Access the web interface**
   
   Open your browser and go to:
   ```
   http://[SERVER_IP]:8060/edit
   ```
   
   Example: `http://192.168.1.100:8060/edit`

2. **Enter Freebox remote control code**
   
   In the **"Freebox Remote Control Code"** field, enter the 8-digit code obtained from your Freebox.

3. **Map Roku → Freebox buttons**
   
   For each Roku button (Back, Home, Play, etc.), select the corresponding Freebox key from the dropdown:
   
   | Roku Button      | Suggested Freebox Key |
   |------------------|----------------------|
   | Back             | back                 |
   | ChannelDown      | prgm_dec             |
   | ChannelUp        | prgm_inc             |
   | Down             | down                 |
   | Fwd              | fwd                  |
   | Home             | home                 |
   | Info             | yellow               |
   | Left             | left                 |
   | Pause            | pause                |
   | Play             | play                 |
   | PowerOff/PowerOn | power                |
   | Rev              | bwd                  |
   | Right            | right                |
   | Select           | ok                   |
   | Up               | up                   |
   | VolumeDown       | vol_dec              |
   | VolumeMute       | mute                 |
   | VolumeUp         | vol_inc              |

4. **Test buttons**
   
   Click the **Test** button next to each key to verify it works correctly with your Freebox.

5. **Save configuration**
   
   Click the green **Save** button to save your changes.

### Step 3: Use with Harmony

Once configured:
- Your Harmony remote buttons will automatically send commands to the Freebox
- You can enable/disable rule execution via the web interface
- Logs are visible in real-time on the main page: `http://[SERVER_IP]:8060`

## 🔧 Web Interface

The server exposes several web pages:

### Main Page - Real-time Logs
```
http://[SERVER_IP]:8060/
```
- Displays real-time logs with filtering (All/Info/Warning/Error)
- Copy logs to clipboard
- Enable/disable rule execution
- Clear logs button
- Current configuration viewer with copy/export/import

### Edit Page - Configuration
```
http://[SERVER_IP]:8060/edit
```
- Freebox remote control code configuration
- Roku → Freebox button mapping
- Individual button testing
- **Reset to Default** button to restore default configuration

### Help Page - Documentation
```
http://[SERVER_IP]:8060/help
```
- Dynamic documentation generated from README.md
- Setup instructions
- Troubleshooting guide

## 📁 Configuration Files

### `rules.json`
Contains current configuration:
```json
{
  "remoteControlId": "12345678",
  "rules": [
    {
      "Button": "Home",
      "Key": "home"
    }
  ]
}
```

### `rules_default.json`
Default configuration, used during reset.

## 🛠️ Troubleshooting

### Server doesn't start
- Check that port 8060 is not already in use
- Verify Node.js is installed: `node --version`

### Harmony doesn't detect device
- Ensure the server and Harmony Hub are on the same local network
- Restart the server and re-run detection
- Check server logs for SSDP requests
- Try manually specifying IP address when starting

### Commands don't work
- Verify the Freebox remote control code is correct
- Test buttons individually via the web interface
- Check real-time logs for errors
- Ensure network remote control is enabled on the Freebox

### Device appears but doesn't respond
- Verify button mappings are correct in `/edit`
- Test with the **Test** button for each key
- Check that rules are not disabled (Enable/Disable button)

## 🔑 Available Freebox Keys

Here is the complete list of keys supported by the Freebox API:

- **Navigation**: `up`, `down`, `left`, `right`, `ok`
- **Control**: `power`, `back`, `home`
- **Volume**: `vol_inc`, `vol_dec`, `mute`
- **Channels**: `prgm_inc`, `prgm_dec`
- **Playback**: `play`, `pause`, `fwd` (fast forward), `bwd` (rewind), `rec` (record)
- **Colors**: `red`, `green`, `yellow`, `blue`
- **Other**: `list`, `tv`, `media`, `free`

## 📝 License

This project is distributed under the MIT License.

### MIT License

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

## 📧 Support

For any questions or issues, check the real-time logs on the web interface or review the server console.
