/**
 * Created by nexus on 15/05/17.
 */
var fs = require("fs");
try {
    var config = require("../conf/userData").config;
} catch {
    fs.copyFile('../userData.example.json', '../conf/userData.json', (err) => {
        if (err) throw err;
        console.log("Example userdata copied to conf folder.");
        process.exit()
    });
    return
}

const request = require("request-promise-native");
const vm = require('vm');
/**
 *
 * @constructor
 */
var HttpWrapper = function (sessionCookie) {
    if (sessionCookie && sessionCookie.split("-").length === 2) {
        this.sessionCookie = sessionCookie;
        this.userId = sessionCookie.split("-")[0];
        this.userAuth = sessionCookie.split("-")[1];
    } else {
        this.sessionCookie = "";
        this.userId = 0;
        this.userAuth = "";
    }
};

/**
 *
 * @param email
 * @param password
 * @return {Object}
 */
HttpWrapper.prototype.login = async function (email, password) {
    console.log("Logging in.");
    var self = this;
    return new Promise(async function (resolve, reject) {
        try {
            await request({url: "https://adventure.land"});
        } catch (err) {
            reject("could not fetch index.html on login." + err);
        }
        try {
            await request.post(
                {
                    url: "https://adventure.land/api/signup_or_login",
                    formData: {
                        arguments: '{"email":"' + email + '","password":"' + password + '","only_login":true}',
                        method: "signup_or_login"
                    },
                    headers: {
                        "x-requested-with": "XMLHttpRequest",
                        "Accept": "application/json, text/javascript, */*; q=0.01",
                        "user-agent": config.browserUserAgent,
                    }
                }, function (err, response, html) {
                    if (err) {
                        console.error("Error login in:");
                        console.error(err);
                        process.exit(1)
                    } else {
                        var data = JSON.parse(html);
                        var loginSuccessful = false;
                        for (let i = 0; i < data.length; i++) {
                            if (typeof data[i].type === "string") {
                                if (data[i].type === "message") {
                                    if (typeof data[i].message === "string") {
                                        if (data[i].message === "Logged In!") {
                                            console.log("Login successful.");
                                            loginSuccessful = true;
                                        }
                                    }
                                } else if (data[i].type === "ui_error") {
                                    if (typeof data[i].message === "string") {
                                        console.log(data[i].message);
                                        loginSuccessful = false;
                                    }
                                }
                            }
                        }
                        if (loginSuccessful) {
                            let cookies = response.headers["set-cookie"];
                            for (let i = 0; i < cookies.length; i++) {
                                var match = /auth=([0-9]+-[a-zA-Z0-9]+)/g.exec(cookies[i]);
                                if (match) {
                                    self.sessionCookie = match[1];
                                    self.userId = match[1].split("-")[0];
                                }
                            }
                        } else {
                            process.exit(0)
                        }
                        resolve(loginSuccessful);
                    }
                });
        } catch (e) {
            reject(e);
        }
    });
};

HttpWrapper.prototype.getCharacters = async function () {
    var self = this;
    return new Promise(async function (resolve) {
        var html = await request.post({
            url: "https://adventure.land/api/servers_and_characters",
            headers: {cookie: "auth=" + self.sessionCookie, "user-agent": config.browserUserAgent,},
            formData: {method: "servers_and_characters", arguments: "{}"}
        });
        let data = JSON.parse(html)[0];
        resolve(data.characters);
    })
};

HttpWrapper.prototype.getServersAndCharacters = async function () {
    var self = this;
    return new Promise(async function (resolve) {
        var html = await request.post({
            url: "https://adventure.land/api/servers_and_characters",
            headers: {cookie: "auth=" + self.sessionCookie, "user-agent": config.browserUserAgent,},
            formData: {method: "servers_and_characters", arguments: "{}"}
        });
        let data = JSON.parse(html)[0];
        resolve(data);
    })
};


HttpWrapper.prototype.getServerList = async function () {
    var self = this;
    return new Promise(async function (resolve, reject) {
        var options = {
            url: "https://adventure.land/api/get_servers",
            method: "POST",
            headers: {
                "user-agent": config.browserUserAgent,
                "x-requested-with": "XMLHttpRequest",
                cookie: "auth=" + self.sessionCookie
            },
            form: {
                method: "get_servers"
            }
        };

        let data = JSON.parse(await request(options));

        if (data[0].type === "success")
            resolve(data[0].message);
        else
            reject();
    })
};

HttpWrapper.prototype.checkLogin = async function () {
    var self = this;
    return new Promise(async function (resolve) {
        console.log("check Login:");
        var html = await request.post({
            url: "https://adventure.land/api/servers_and_characters",
            headers: {cookie: "auth=" + self.sessionCookie, "user-agent": config.browserUserAgent,},
            formData: {method: "servers_and_characters", arguments: "{}"}
        });
        let data = JSON.parse(html)[0];
        if (data.args && data.args[0] === "Not logged in.") {
            console.log("not logged in");
            resolve(false);
        } else if (data.type && data.type === "servers_and_characters") {
            console.log("logged in");
            resolve(true);
        }
        resolve(false);
    })
};

HttpWrapper.prototype.getGameData = async function () {
    var self = this;
    return new Promise(async function (resolve, reject) {
        try {
            let code = await request({
                url: "https://adventure.land/data.js",
                headers: {
                    "x-requested-with": "XMLHttpRequest",
                    "Accept": "application/json, text/javascript, */*; q=0.01",
                    "user-agent": config.browserUserAgent,
                    "cookie": "auth=" + self.sessionCookie,
                }
            });
            let sandbox = {};
            let context = vm.createContext(sandbox);
            vm.runInContext(code, context);
            resolve(sandbox.G)
        } catch (e) {
            reject("Could not retrieve game data");
        }
    });
};

HttpWrapper.prototype.getGameVersion = async function () {
    var self = this;
    return new Promise(async function (resolve) {
        var html = await request({
            url: "https://adventure.land/",
            headers: {
                "x-requested-with": "XMLHttpRequest",
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "user-agent": config.browserUserAgent,
                "cookie": "auth=" + self.sessionCookie,
            }
        });
        var match = /src="\/js\/game\.js\?v=([0-9]+)"/.exec(html);
        resolve(match[1]);
    });
};

HttpWrapper.prototype.getUserAuth = async function () {
    var self = this;
    return new Promise(async function (resolve) {
        var html = await request({
            url: "https://adventure.land/",
            headers: {
                "x-requested-with": "XMLHttpRequest",
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "user-agent": config.browserUserAgent,
                "cookie": "auth=" + self.sessionCookie,
            }
        });
        var match = /user_auth="([a-zA-Z0-9]+)"/.exec(html);
        self.userAuth = match[1];
        resolve(match[1]);
    });
};

module.exports = HttpWrapper;
