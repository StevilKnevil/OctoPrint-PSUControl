$(function() {
    function PSUControlViewModel(parameters) {
        var self = this;

        self.settingsViewModel = parameters[0]
        self.loginState = parameters[1];
        
        self.settings = undefined;

        self.sensingPlugin_old = "";
        self.switchingPlugin_old = "";

        self.scripts_gcode_psucontrol_post_on = ko.observable(undefined);
        self.scripts_gcode_psucontrol_pre_off = ko.observable(undefined);

        self.isPSUOn = ko.observable(undefined);

        self.psu_indicator = $("#psucontrol_indicator");

        self.onBeforeBinding = function() {
            self.settings = self.settingsViewModel.settings;

            self.settings.plugins.psucontrol.sensingPlugin.subscribe(function(oldValue) {
                self.sensingPlugin_old = oldValue;
            }, this, 'beforeChange');

            self.settings.plugins.psucontrol.switchingPlugin.subscribe(function(oldValue) {
                self.switchingPlugin_old = oldValue;
            }, this, 'beforeChange');

            self.settings.plugins.psucontrol.sensingPlugin.subscribe(function(newValue) {
                if (newValue === "_GET_MORE_") {
                    self.openGetMore();
                    self.settings.plugins.psucontrol.sensingPlugin(self.sensingPlugin_old);
                }
            });

            self.settings.plugins.psucontrol.switchingPlugin.subscribe(function(newValue) {
                if (newValue === "_GET_MORE_") {
                    self.openGetMore();
                    self.settings.plugins.psucontrol.switchingPlugin(self.switchingPlugin_old);
                }
            });

            self.sensingPlugin_old = self.settings.plugins.psucontrol.sensingPlugin();
            self.switchingPlugin_old = self.settings.plugins.psucontrol.switchingPlugin();
        };

        self.onSettingsShown = function () {
            self.scripts_gcode_psucontrol_post_on(self.settings.scripts.gcode["psucontrol_post_on"]());
            self.scripts_gcode_psucontrol_pre_off(self.settings.scripts.gcode["psucontrol_pre_off"]());
        };

        self.onSettingsHidden = function () {
            self.settings.plugins.psucontrol.scripts_gcode_psucontrol_post_on = null;
            self.settings.plugins.psucontrol.scripts_gcode_psucontrol_pre_off = null;
        };

        self.onSettingsBeforeSave = function () {
            if (self.scripts_gcode_psucontrol_post_on() !== undefined) {
                if (self.scripts_gcode_psucontrol_post_on() != self.settings.scripts.gcode["psucontrol_post_on"]()) {
                    self.settings.plugins.psucontrol.scripts_gcode_psucontrol_post_on = self.scripts_gcode_psucontrol_post_on;
                    self.settings.scripts.gcode["psucontrol_post_on"](self.scripts_gcode_psucontrol_post_on());
                }
            }

            if (self.scripts_gcode_psucontrol_pre_off() !== undefined) {
                if (self.scripts_gcode_psucontrol_pre_off() != self.settings.scripts.gcode["psucontrol_pre_off"]()) {
                    self.settings.plugins.psucontrol.scripts_gcode_psucontrol_pre_off = self.scripts_gcode_psucontrol_pre_off;
                    self.settings.scripts.gcode["psucontrol_pre_off"](self.scripts_gcode_psucontrol_pre_off());
                }
            }
        };

        self.sendPSUCommand = function(command) {
            return $.ajax({
                url: API_BASEURL + "plugin/psucontrol",
                type: "POST",
                dataType: "json",
                data: JSON.stringify({
                    command: command
                }),
                contentType: "application/json; charset=UTF-8"
            });
        };

        self.onStartup = function () {
            self.isPSUOn.subscribe(function() {
                if (self.isPSUOn()) {
                    self.psu_indicator.removeClass("off").addClass("on");
                } else {
                    self.psu_indicator.removeClass("on").addClass("off");
                }   
            });

            self.sendPSUCommand("getPSUState").done(function(data) {
                self.isPSUOn(data.isPSUOn);
            });
        }

        self.onDataUpdaterPluginMessage = function(plugin, data) {
            if (plugin != "psucontrol") {
                return;
            }

            if (data.isPSUOn !== undefined) {
                self.isPSUOn(data.isPSUOn);
            }
        };

        self.showStandardPowerOffWarning = function() {
            showConfirmationDialog({
                message: "You are about to turn off the PSU.",
                onproceed: function() {
                    self.turnPSUOff();
                }
            });
        };

        self.showHighTempPowerOffWarning = function(currentTemp, threshold) {
            showConfirmationDialog({
                title: "Hot extruder detected",
                message: "The extruder is currently at " + currentTemp + "°C, which is above the configured " + threshold + "°C wait temperature.",
                question: "Turning the PSU off now can stop active heating immediately and may damage a print or cause unsafe cooling.",
                cancel: "Keep PSU on",
                proceed: "Turn PSU off now",
                proceedClass: "danger",
                noclose: true,
                onproceed: function() {
                    self.turnPSUOff();
                }
            });
        };

        self.togglePSU = function() {
            if (self.isPSUOn()) {
                if (self.settings.plugins.psucontrol.enablePowerOffWarningDialog()) {
                    if (self.settings.plugins.psucontrol.warnIfPowerOffAboveMaxTemp()) {
                        self.sendPSUCommand("getToolTemperatureState").done(function(data) {
                            var currentTemp = data.highestToolTemperature;
                            var threshold = self.settings.plugins.psucontrol.maxExtruderTemp();
                            var roundedCurrentTemp = Math.round(currentTemp * 10) / 10;
                            var roundedThreshold = Math.round(threshold * 10) / 10;

                            if (currentTemp !== null && currentTemp !== undefined && currentTemp > threshold) {
                                self.showHighTempPowerOffWarning(roundedCurrentTemp, roundedThreshold);
                            } else {
                                self.showStandardPowerOffWarning();
                            }
                        }).fail(function() {
                            self.showStandardPowerOffWarning();
                        });
                    } else {
                        self.showStandardPowerOffWarning();
                    }
                } else {
                    self.turnPSUOff();
                }
            } else {
                self.turnPSUOn();
            }
        };

        self.turnPSUOn = function() {
            self.sendPSUCommand("turnPSUOn");
        };

    	self.turnPSUOff = function() {
            self.sendPSUCommand("turnPSUOff");
        };

        self.subPluginTabExists = function(id) {
            return $('#settings_plugin_' + id).length > 0
        };

        self.openGetMore = function() {
            window.open("https://plugins.octoprint.org/by_tag/#tag-psucontrol-subplugin", "_blank");
        };
    }

    ADDITIONAL_VIEWMODELS.push([
        PSUControlViewModel,
        ["settingsViewModel", "loginStateViewModel"],
        ["#navbar_plugin_psucontrol", "#settings_plugin_psucontrol"]
    ]);
});
