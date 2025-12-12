/**
 * Harmony2FreeboxRCMapper - Constants
 *
 * Copyright (c) 2025
 * Licensed under the MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */


// Par défaut, hd1.freebox.fr, mais on veut pouvoir changer (hd1, hd2, hd3...)
const DEFAULT_FBX_HOST = 'hd1.freebox.fr';

function getFreeboxRemoteUrl(host) {
  return `http://${host}/pub/remote_control`;
}

const FREEBOX_KEYS = [
  { value: '', label: '-- Select a key --' },
  { value: 'power', label: 'Power' },
  { value: 'up', label: 'Up' },
  { value: 'down', label: 'Down' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'ok', label: 'OK' },
  { value: 'back', label: 'Back' },
  { value: 'home', label: 'Home' },
  { value: 'vol_inc', label: 'Volume +' },
  { value: 'vol_dec', label: 'Volume -' },
  { value: 'mute', label: 'Mute' },
  { value: 'prgm_inc', label: 'Channel +' },
  { value: 'prgm_dec', label: 'Channel -' },
  { value: 'play', label: 'Play' },
  { value: 'pause', label: 'Pause' },
  { value: 'fwd', label: 'Forward' },
  { value: 'bwd', label: 'Backward' },
  { value: 'rec', label: 'Record' },
  { value: 'list', label: 'List' },
  { value: 'red', label: 'Red' },
  { value: 'green', label: 'Green' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'blue', label: 'Blue' },
  { value: 'tv', label: 'TV' },
  { value: 'media', label: 'Media' },
  { value: 'free', label: 'Free' }
];

const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_PORT = 8042;
const MAX_LOGS = 500;

const SSDP_NAME_DEFAULT = 'Harmony2FreeboxRCMapper';
const SSDP_MULTICAST_ADDR = '239.255.255.250';
const SSDP_MULTICAST_PORT = 1900;

const ROKU_BUTTONS = [
  'Back',
  'ChannelDown',
  'ChannelUp',
  'Down',
  'Fwd',
  'Home',
  'Info',
  'Left',
  'Pause',
  'Play',
  'PowerOff',
  'PowerOn',
  'Rev',
  'Right',
  'Search',
  'Select',
  'Up',
  'VolumeDown',
  'VolumeMute',
  'VolumeUp'
];

const RuleAction = {
  HttpGET: 'HttpGET',
  Debug: 'Debug',
};

module.exports = {
  DEFAULT_FBX_HOST,
  getFreeboxRemoteUrl,
  FREEBOX_KEYS,
  DEFAULT_HOST,
  DEFAULT_PORT,
  MAX_LOGS,
  SSDP_NAME_DEFAULT,
  SSDP_MULTICAST_ADDR,
  SSDP_MULTICAST_PORT,
  ROKU_BUTTONS,
  RuleAction,
};
