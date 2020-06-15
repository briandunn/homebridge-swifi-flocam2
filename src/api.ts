import * as http from 'http';
import { Logger } from 'homebridge';

interface MediaConfig {
  'Image Flip': 0;
  'Image Mirror': 0;
  Light: 0;
  'Light Intensity': 3;
  'Light On Motion Duration': 60;
  'Light On Motion': 1;
  'Live Video Quality': 1;
  'Mic Volume': 100;
  Siren: 0;
  'Siren On Motion Duration': 60;
  'Siren On Motion': 0;
  'Speaker Volume': 100;
  'Video Environment Mode': 2;
  'Video Environment': 50;
}
interface DeviceInfo {
  'Current Agent': string;
  'Current FW': string;
  'Device Type': number;
  Factory: string;
  'Factory Region': string;
  Manufacturer: string;
  Model: string;
  'NIC IP': string;
  'NIC MAC': string;
  'Operating Mode': number;
  'P2P Id': string;
  'Production Agent': string;
  'Production FW': string;
  Serial: string;
  'WiFi IP': string;
  'WiFi MAC': string;
  'WiFi SSID': string;
  'WiFi Signal': number;
}

export interface Floodlight {
  on: boolean;
  brightness: number;
}

export interface Device {
  manufacturer: string;
  serial: string;
  model: string;
}

const mediaConfigToLight = (data) => ({
  on: data.Light === 1,
  brightness: data['Light Intensity'],
});

const lightToMediaConfig = (light) => ({
  Light: light.on ? 1 : 0,
  'Light Intensity': light.brightness,
});

export default class API {
  log: Logger;
  port: number;
  host: string;

  constructor({ log, port, host }) {
    this.log = log;
    this.port = port;
    this.host = host;
  }

  async getLight({ timeout = 10 * 1000 } = {}): Promise<Floodlight> {
    const { req, send } = this.request<MediaConfig>({
      path: '/API10/getMediaConfig',
      method: 'GET',
    });

    return new Promise((resolve, reject) => {
      req.setTimeout(timeout, () => {
        this.log.debug('timeout getting Media Config', timeout);
        reject('timeout');
      });

      return send()
        .then((data) => {
          resolve(mediaConfigToLight(data));
        })
        .catch(reject);
    });
  }

  async setLight(light: Floodlight) {
    const { send, req } = this.request<MediaConfig>({
      path: '/API10/setMediaConfig',
      method: 'POST',
    });
    const body = JSON.stringify(lightToMediaConfig(light));
    req.setHeader('Content-Length', Buffer.byteLength(body));
    req.write(body);

    return send().then((data) => mediaConfigToLight(data));
  }

  async getDeviceInfo(): Promise<Device> {
    return this.request<DeviceInfo>({
      method: 'GET',
      path: '/API10/getDeviceInfo',
    })
      .send()
      .then((info) => ({
        manufacturer: info.Manufacturer,
        model: info.Model,
        serial: info.Serial,
      }));
  }

  request<T>(
    opts: http.RequestOptions
  ): { req: http.ClientRequest; send: () => Promise<T> } {
    const { log, host, port } = this;

    const options = {
      host,
      port,
      ...opts,
    };

    const req = http.request(options);

    const send = async () => {
      let rejected = false;

      const promise: Promise<T> = new Promise((resolve, reject) => {
        let resBody = '';

        const rejectOnce = (data) => {
          if (!rejected) {
            reject(data);
            rejected = true;
          }
        };

        const onResponse = (res: http.IncomingMessage) => {
          log.debug('response status ->', res.statusCode);
          if (
            res.statusCode &&
            (res.statusCode < 200 || res.statusCode >= 400)
          ) {
            rejectOnce(res.statusCode);
          }

          res.setEncoding('utf8');

          res.on('data', (chunk) => {
            resBody += chunk;
          });
          res.once('end', () => {
            const data = JSON.parse(resBody);
            log.debug('response body ->', data);
            resolve(data);
          });
        };

        req.once('response', onResponse);
        req.once('error', rejectOnce);
      });
      log.debug('request ->', options);
      req.end();
      return promise;
    };
    return { send, req };
  }
}
