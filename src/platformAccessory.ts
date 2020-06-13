import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicSetCallback,
  CharacteristicGetCallback,
} from 'homebridge';

import * as http from 'http';

import { FloodlightPlatform } from './platform';

interface MediaConfig {
  Light?: number;
  'Light Intensity'?: number;
}

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class FloodlightAccessory {
  private service: Service;
  private mediaConfig: MediaConfig | undefined;

  constructor(
    private readonly platform: FloodlightPlatform,
    private readonly accessory: PlatformAccessory
  ) {
    // set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        'Default-Manufacturer'
      )
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        'Default-Serial'
      );

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service =
      this.accessory.getService(this.platform.Service.Lightbulb) ||
      this.accessory.addService(this.platform.Service.Lightbulb);

    // To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
    // when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
    // this.accessory.getService('NAME') ?? this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE');

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      accessory.context.device.name
    );

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the On/Off Characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .on('set', this.setOn.bind(this)) // SET - bind to the `setOn` method below
      .on('get', this.getOn.bind(this)); // GET - bind to the `getOn` method below

    // register handlers for the Brightness Characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.Brightness)
      .on('set', this.setBrightness.bind(this)) // SET - bind to the 'setBrightness` method below
      .on('get', this.getBrightness.bind(this)); // SET - bind to the 'setBrightness` method below

    this.getMediaConfig()
      .then((mediaConfig) => {
        this.mediaConfig = mediaConfig;
        this.service.updateCharacteristic(
          this.platform.Characteristic.On,
          mediaConfig.Light === 1
        );

        this.service.updateCharacteristic(
          this.platform.Characteristic.Brightness,
          mediaConfig['Light Intensity'] || 0
        );
      })
      .catch((e) => {
        this.platform.log.error('Error ->', e);
      });
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const { log } = this.platform;
    log.debug('Setting Characteristic On ->', value);
    const body = { Light: value ? 1 : 0 };
    this.setMediaConfig(body)
      .then(() => {
        log.debug('Set Characteristic On ->', value);
        callback(null);
      })
      .catch(callback);
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   * 
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   * 
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  getOn(callback: CharacteristicGetCallback) {
    this.getMediaConfig(1500)
      .then(({ Light }) => {
        callback(null, Light === 1);
      })
      .catch((e) => {
        this.platform.log.error(e);
        callback(e);
      });
  }

  getBrightness(callback: CharacteristicGetCallback) {
    this.getMediaConfig(1500)
      .then(({ 'Light Intensity': intensity }) => {
        callback(null, intensity);
      })
      .catch((e) => {
        this.platform.log.error(e);
        callback(e);
      });
  }

  getMediaConfig(timeout = 10 * 1000): Promise<MediaConfig> {
    const { req, send } = this.request<MediaConfig>({
      path: '/API10/getMediaConfig',
      method: 'GET',
    });

    const defaults: MediaConfig = {
      Light: 0,
      'Light Intensity': 0,
    };

    return new Promise((resolve, reject) => {
      let resolved = false;
      req.setTimeout(timeout, () => {
        this.platform.log.debug(
          'timeout getting Media Config. Reusing last known value.'
        );
        if (!resolved) {
          resolve(this.mediaConfig || defaults);
          resolved = true;
        }
      });

      return send()
        .then((data) => {
          this.mediaConfig = data;
          if (!resolved) {
            resolve(data);
            resolved = true;
          }
        })
        .catch(reject);
    });
  }

  setMediaConfig(mediaConfig: MediaConfig) {
    const { send, req } = this.request<MediaConfig>({
      path: '/API10/setMediaConfig',
      method: 'POST',
    });
    const body = JSON.stringify(mediaConfig);

    req.setHeader('Content-Length', Buffer.byteLength(body));
    req.write(body);

    return send().then((data) => {
      this.mediaConfig = data;
      return data;
    });
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  setBrightness(
    value: CharacteristicValue,
    callback: CharacteristicSetCallback
  ) {
    // implement your own code to set the brightness
    // this.exampleStates.Brightness = value as number;

    const { log } = this.platform;
    log.debug('Setting Characteristic Brightness ->', value);
    const body = { 'Light Intensity': value as number };

    this.setMediaConfig(body)
      .then((mediaConfig) => {
        log.debug('Set Characteristic Brightness ->', value);
        this.mediaConfig = mediaConfig;
        callback(null);
      })
      .catch(callback);
  }

  request<T>(
    opts: http.RequestOptions
  ): { req: http.ClientRequest; send: () => Promise<T> } {
    const { log } = this.platform;
    const { host, port } = this.accessory.context.device;

    const options = {
      host,
      port,
      ...opts,
    };

    const req = http.request(options);

    const send = () => {
      let resolved = false;
      const promise: Promise<T> = new Promise((resolve, reject) => {
        let resBody = '';

        const once = (fn) => {
          if (!resolved) {
            fn();
            resolved = true;
          }
        };

        const rejectOnce = (data) => {
          once(() => {
            reject(data);
          });
        };

        const resolveOnce = (data) => {
          once(() => {
            resolve(data);
          });
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
            resolveOnce(data);
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
