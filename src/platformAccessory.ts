import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicSetCallback,
  CharacteristicGetCallback,
} from 'homebridge';

import FloodlightAPI, { Floodlight } from './api';
import { FloodlightPlatform } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
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
      accessory: {
        context: { host, port },
      },
    } = this;
    this.api = new FloodlightAPI({ log, host, port });

    this.service =
      this.accessory.getService(this.platform.Service.Lightbulb) ||
      this.accessory.addService(this.platform.Service.Lightbulb);

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

    this.api
      .getDeviceInfo()
      .then(({ manufacturer, model, serial }) => {
        this.accessory
          .getService(this.platform.Service.AccessoryInformation)!
          .updateCharacteristic(
            this.platform.Characteristic.Manufacturer,
            manufacturer
          )
          .updateCharacteristic(this.platform.Characteristic.Model, model)
          .updateCharacteristic(
            this.platform.Characteristic.SerialNumber,
            serial
          );
      })
      .catch((e) => {
        this.platform.log.error('Error ->', e);
      });
  }

  getOn(callback: CharacteristicGetCallback) {
    this.getLight({ timeout: 1000 })
      .then(({ on }) => {
        callback(null, on);
      })
      .catch(callback);
  }

  setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.setLight({ on: value as boolean })
      .then(() => {
        callback(null);
      })
      .catch(callback);
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
    this.setLight(value as number)
      .then(() => {
        callback(null);
      })
      .catch(callback);
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

  setLight(light) {
    return this.api.setLight(light).then((light) => {
      Object.assign(this.accessory.context, light);
      return light;
    });
  }
}
