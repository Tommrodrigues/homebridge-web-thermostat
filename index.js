var Service, Characteristic;
var request = require("request");

module.exports = function(homebridge){
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-web-thermostat", "Thermostat", Thermostat);
};

function Thermostat(log, config) {
	this.log = log;

  this.name = config.name;
  this.manufacturer = config.manufacturer || 'HTTP Manufacturer';
  this.model = config.model || 'homebridge-http-thermostat';
  this.serial = config.serial || 'HTTP Serial Number';

  this.apiroute = config.apiroute
  this.username = config.username || null;
	this.password = config.password || null;
  this.timeout = config.timeout || 5000;
  this.http_method = config.http_method || 'GET';

  this.currentHumidity = config.currentHumidity || false;
  this.targetHumidity = config.targetHumidity || false;

  this.temperatureDisplayUnits = config.temperatureDisplayUnits || 0;
  this.pollInterval = config.pollInterval || 60;
	this.maxTemp = config.maxTemp || 30;
	this.minTemp = config.minTemp || 15;

  if(this.username != null && this.password != null){
    this.auth = {
      user : this.username,
      pass : this.password
    };
  }

  this.log(this.name, this.apiroute);

	this.service = new Service.Thermostat(this.name);
}

Thermostat.prototype = {

	identify: function(callback) {
		this.log("Identify requested!");
		callback();
	},

  _httpRequest: function (url, body, method, callback) {
      request({
          url: url,
          body: body,
          method: this.http_method,
          timeout: this.timeout,
          rejectUnauthorized: false,
          auth: this.auth
      },
          function (error, response, body) {
              callback(error, response, body);
          });
  },

  _getStatus: function(callback) {
    this.log("[+] Getting status from:", this.apiroute+"/status");
    var url = this.apiroute+"/status";
    this._httpRequest(url, '', 'GET', function (error, response, responseBody) {
        if (error) {
          this.log("[!] Error getting status: %s", error.message);
  				callback(error);
        } else {
  				var json = JSON.parse(responseBody);
          // Update Characteristics
          this.log("[*] Thermostat response: ", responseBody);
          this.service.getCharacteristic(Characteristic.TargetTemperature).updateValue(json.targetTemperature);
          this.service.getCharacteristic(Characteristic.CurrentTemperature).updateValue(json.currentTemperature);
          this.service.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(json.targetHeatingCoolingState);
          this.service.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(json.currentHeatingCoolingState);
          if (this.currentHumidity) {
            this.service.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(json.currentRelativeHumidity);
          }
          if (this.targetHumidity) {
            this.service.getCharacteristic(Characteristic.TargetRelativeHumidity).updateValue(json.targetRelativeHumidity);
          }
  				callback();
    }}.bind(this));
  },

  setTargetHeatingCoolingState: function(value, callback) {
    this.log("[+] setTargetHeatingCoolingState to %s", value);
    url = this.apiroute + '/targetHeatingCoolingState/' + value;
    this._httpRequest(url, '', 'GET', function (error, response, responseBody) {
        if (error) {
          this.log("[!] Error setting targetHeatingCoolingState: %s", error.message);
					callback(error);
        } else {
          this.log("[*] Sucessfully set targetHeatingCoolingState to %s", value);
          this.service.setCharacteristic(Characteristic.CurrentHeatingCoolingState, value);
          callback();
        }
    }.bind(this));
  },

  setTargetTemperature: function(value, callback) {
    this.log("[+] setTargetTemperature to %s", value);
    var url = this.apiroute+"/targetTemperature/"+value;
    this._httpRequest(url, '', 'GET', function (error, response, responseBody) {
        if (error) {
          this.log("[!] Error setting targetTemperature", error.message);
  				callback(error);
        } else {
          this.log("[*] Sucessfully set targetTemperature to %s", value);
  				callback();
        }
    }.bind(this));
  },

  setTargetRelativeHumidity: function(value, callback) {
    this.log("[+] setTargetRelativeHumidity to %s", value);
    var url = this.apiroute+"/targetRelativeHumidity/"+value;
    this._httpRequest(url, '', 'GET', function (error, response, responseBody) {
        if (error) {
          this.log("[!] Error setting targetRelativeHumidity", error.message);
  				callback(error);
        } else {
          this.log("[*] Sucessfully set targetRelativeHumidity to %s", value);
  				callback();
        }
    }.bind(this));
  },

	getName: function(callback) {
		this.log("getName :", this.name);
		callback(null, this.name);
	},

	getServices: function() {

		this.informationService = new Service.AccessoryInformation();
    this.informationService
		  .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
		  .setCharacteristic(Characteristic.Model, this.model)
		  .setCharacteristic(Characteristic.SerialNumber, this.serial);

   this.service.setCharacteristic(Characteristic.TemperatureDisplayUnits, this.temperatureDisplayUnits);

		this.service
			.getCharacteristic(Characteristic.TargetHeatingCoolingState)
			.on('set', this.setTargetHeatingCoolingState.bind(this));

		this.service
			.getCharacteristic(Characteristic.TargetTemperature)
			.on('set', this.setTargetTemperature.bind(this));

    if (this.targetHumidity) {
      this.service
        .getCharacteristic(Characteristic.TargetRelativeHumidity)
        .on('set', this.setTargetRelativeHumidity.bind(this));
    }

		this.service.getCharacteristic(Characteristic.CurrentTemperature)
			.setProps({
				minValue: -100,
				maxValue: 100,
				minStep: 1
			});

		this.service.getCharacteristic(Characteristic.TargetTemperature)
			.setProps({
				minValue: this.minTemp,
				maxValue: this.maxTemp,
				minStep: 1
			});

      // This fills the homebridge cache on startup with current values, so that any request before the first poll has valid values
      this._getStatus(function() {

      }.bind(this));

      // This polls the thermostat device once per minute and updates homebridge with the current values
      setInterval(function() {
        this._getStatus(function() {
        }.bind(this));
      }.bind(this), this.pollInterval * 1000);

		return [this.informationService, this.service];
	}
};