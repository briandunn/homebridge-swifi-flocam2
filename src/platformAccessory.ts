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

    this.initLight();

    if (context.manufacturer && context.model && context.serial) {
      this.updateDeviceInfo(context as Device);
    } else {
      this.getAndUpdateDeviceInfo();
    }
  }

  async getAndUpdateDeviceInfo() {
    try {
      const deviceInfo = await this.api.getDeviceInfo();
      Object.assign(this.accessory.context, deviceInfo);
      this.updateDeviceInfo(deviceInfo);
    } catch (e) {
      this.platform.log.error('Cannot get device info ->', e);
    }
  }

  async initLight() {
    try {
      const light = await this.getLight({ timeout: 10 * 1000 });

      this.service.updateCharacteristic(
        this.platform.Characteristic.On,
        light.on
      );

      this.service.updateCharacteristic(
        this.platform.Characteristic.Brightness,
        light.brightness
      );
    } catch (e) {
      this.platform.log.error('failed to initialize characteristics ->', e);
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

  async getOn(callback: CharacteristicGetCallback) {
    try {
      const light = await this.getLight({ timeout: 1000 });
      callback(null, light.on);
    } catch (e) {
      callback(e);
    }
  }

  async setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    try {
      const on = await this.api.setLightOn(value as boolean);
      this.accessory.context.on = on;
      callback(null, on);
      return on;
    } catch (e) {
      callback(e);
    }
  }

  async getBrightness(callback: CharacteristicGetCallback) {
    try {
      const light = await this.getLight({ timeout: 1000 });
      callback(null, light.brightness);
    } catch (e) {
      callback(e);
    }
  }

  async setBrightness(
    value: CharacteristicValue,
    callback: CharacteristicSetCallback
  ) {
    try {
      const brightness = await this.api.setLightBrightness(value as number);
      this.accessory.context.brightness = brightness;
      callback(null, brightness);
      return brightness;
    } catch (e) {
      callback(e);
    }
  }

  async getLight({ timeout }): Promise<Floodlight> {
    try {
      const light = this.api.getLight({ timeout });
      Object.assign(this.accessory.context, light);
      return light;
    } catch (e) {
      if (e === 'timeout') {
        return {
          on: this.accessory.context.on || false,
          brightness: this.accessory.context.brightness || 0,
        };
      }
      throw e;
    }
  }
}
