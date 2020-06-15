import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicSetCallback,
  CharacteristicGetCallback,
} from 'homebridge';

import FloodlightAPI, { Floodlight, Device } from './api';
import { FloodlightPlatform } from './platform';

/**
 * Floodlight Accessory
 */
export class FloodlightAccessory {
  private service: Service;
  private api: FloodlightAPI;

  constructor(
    private readonly platform: FloodlightPlatform,
    private readonly accessory: PlatformAccessory
  ) {
    const {
      platform: { log },
      accessory: { context },
    } = this;
    const {
      device: { host, port },
    } = context;
    log.debug('context ->', context);
    this.api = new FloodlightAPI({ log, host, port });

    this.service =
      this.accessory.getService(this.platform.Service.Lightbulb) ||
      this.accessory.addService(this.platform.Service.Lightbulb);

    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      accessory.context.device.name
    );

    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .on('set', this.setOn.bind(this))
      .on('get', this.getOn.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.Brightness)
      .on('set', this.setBrightness.bind(this))
      .on('get', this.getBrightness.bind(this));

    this.api.getLight().then((light) => {
      Object.assign(this.accessory.context, light);

      this.service.updateCharacteristic(
        this.platform.Characteristic.On,
        light.on
      );

      this.service.updateCharacteristic(
        this.platform.Characteristic.Brightness,
        light.brightness
      );
    });

    if (context.manufacturer && context.model && context.serial) {
      this.updateDeviceInfo(context as Device);
    } else {
      this.api
        .getDeviceInfo()
        .then((deviceInfo) => {
          Object.assign(context, deviceInfo);
          this.updateDeviceInfo(deviceInfo);
        })
        .catch((e) => {
          log.error('Error ->', e);
        });
    }
  }

  updateDeviceInfo({ manufacturer, model, serial }) {
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .updateCharacteristic(
        this.platform.Characteristic.Manufacturer,
        manufacturer
      )
      .updateCharacteristic(this.platform.Characteristic.Model, model)
      .updateCharacteristic(this.platform.Characteristic.SerialNumber, serial);
  }

  getOn(callback: CharacteristicGetCallback) {
    this.getLight({ timeout: 1000 })
      .then(({ on }) => {
        callback(null, on);
      })
      .catch(callback);
  }

  setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    return this.handleSet(
      this.api.setLightOn(value as boolean),
      'on',
      callback
    );
  }

  getBrightness(callback: CharacteristicGetCallback) {
    this.getLight({ timeout: 1000 })
      .then(({ brightness }) => {
        callback(null, brightness);
      })
      .catch(callback);
  }

  setBrightness(
    value: CharacteristicValue,
    callback: CharacteristicSetCallback
  ) {
    return this.handleSet(
      this.api.setLightBrightness(value as number),
      'brightness',
      callback
    );
  }

  getLight({ timeout }): Promise<Floodlight> {
    return new Promise((resolve, reject) => {
      this.api
        .getLight({ timeout })
        .catch((e) => {
          if (e === 'timeout') {
            return {
              on: this.accessory.context.on || false,
              brightness: this.accessory.context.brightness || 0,
            };
          } else {
            reject(e);
          }
        })
        .then((light) => {
          Object.assign(this.accessory.context, light);
          resolve(light);
        })
        .catch(reject);
    });
  }

  async handleSet(
    lightPromise: Promise<number | boolean>,
    attr: keyof Floodlight,
    callback: CharacteristicSetCallback
  ) {
    return lightPromise
      .then((val) => {
        this.accessory.context[attr] = val;
        callback(null);
      })
      .catch(callback);
  }
}
