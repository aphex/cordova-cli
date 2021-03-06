/**
    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.
*/
var cordova = require('../cordova'),
    platforms = require('../platforms'),
    shell = require('shelljs'),
    path = require('path'),
    fs = require('fs'),
    hooker = require('../src/hooker'),
    util = require('../src/util');

var supported_platforms = Object.keys(platforms).filter(function(p) { return p != 'www'; });

describe('run command', function() {
    var is_cordova, list_platforms, fire, exec;
    var project_dir = '/some/path';
    var prepare_spy;
    beforeEach(function() {
        is_cordova = spyOn(util, 'isCordova').andReturn(project_dir);
        list_platforms = spyOn(util, 'listPlatforms').andReturn(supported_platforms);
        fire = spyOn(hooker.prototype, 'fire').andCallFake(function(e, opts, cb) {
            cb(false);
        });
        prepare_spy = spyOn(cordova, 'prepare').andCallFake(function(platforms, cb) {
            cb();
        });
        exec = spyOn(shell, 'exec').andCallFake(function(cmd, opts, cb) { cb(0, ''); });
    });
    describe('failure', function() {
        it('should not run inside a Cordova-based project with no added platforms by calling util.listPlatforms', function() {
            list_platforms.andReturn([]);
            expect(function() {
                cordova.run();
            }).toThrow('No platforms added to this project. Please use `cordova platform add <platform>`.');
        });
        it('should not run outside of a Cordova-based project', function() {
            is_cordova.andReturn(false);
            expect(function() {
                cordova.run();
            }).toThrow('Current working directory is not a Cordova-based project.');
        });
        it('should throw if no BlackBerry simulator targets exist and blackberry is to be rund', function() {
            var bb_project = path.join(project_dir, 'platforms', 'blackberry');
            spyOn(platforms.blackberry, 'parser').andReturn({
                has_device_target:function() { return false; }
            });
            expect(function() {
                cordova.run('blackberry');
            }).toThrow('No BlackBerry device targets defined. If you want to run `run` with BB10, please add a device target. For more information run "' + path.join(bb_project, 'cordova', 'target') + '" -h');
        });
    });

    describe('success', function() {
        it('should run inside a Cordova-based project with at least one added platform and call prepare and shell out to the run script', function(done) {
            cordova.run(['android','ios'], function(err) {
                expect(prepare_spy).toHaveBeenCalledWith(['android', 'ios'], jasmine.any(Function));
                expect(exec).toHaveBeenCalledWith('"' + path.join(project_dir, 'platforms', 'android', 'cordova', 'run') + '" --device', jasmine.any(Object), jasmine.any(Function));
                expect(exec).toHaveBeenCalledWith('"' + path.join(project_dir, 'platforms', 'ios', 'cordova', 'run') + '" --device', jasmine.any(Object), jasmine.any(Function));
                done();
            });
        });
        it('should execute a different BlackBerry-specific command to run blackberry', function() {
            var bb_project = path.join(project_dir, 'platforms', 'blackberry');
            spyOn(platforms.blackberry, 'parser').andReturn({
                has_device_target:function() { return true; },
                get_device_targets:function() { return [{name:'fifi'}]; },
                get_cordova_config:function() { return {signing_password:'secret'}; }
            });
            expect(function() {
                cordova.run('blackberry');
                expect(exec.mostRecentCall.args[0]).toMatch(/blackberry.cordova.run" --target=fifi -k secret/gi);
            }).not.toThrow();
        });
    });

    describe('hooks', function() {
        describe('when platforms are added', function() {
            it('should fire before hooks through the hooker module', function() {
                cordova.run(['android', 'ios']);
                expect(fire).toHaveBeenCalledWith('before_run', {platforms:['android', 'ios']}, jasmine.any(Function));
            });
            it('should fire after hooks through the hooker module', function(done) {
                cordova.run('android', function() {
                     expect(fire).toHaveBeenCalledWith('after_run', {platforms:['android']}, jasmine.any(Function));
                     done();
                });
            });
        });

        describe('with no platforms added', function() {
            it('should not fire the hooker', function() {
                list_platforms.andReturn([]);
                expect(function() {
                    cordova.run();
                }).toThrow();
                expect(fire).not.toHaveBeenCalled();
            });
        });
    });
});
