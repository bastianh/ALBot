
process.on('uncaughtException', function (exception) {
    console.log(exception);
    console.log(exception.stack);
    process.exit()
});

const {Worker, SHARE_ENV} = require('worker_threads');
const child_process = require("child_process");

const HttpWrapper = require("./app/httpWrapper");
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

var httpWrapper = undefined;
var config = {};
var bots = {}
var started = new Date().getTime()

let socketRemote = undefined;
let telegramBot = undefined;

function getInfo() {
    let info = {};
    for (let bot in bots) {
        info[bot] = {
            server: bots[bot].server,
            status: bots[bot].status,
            name: bots[bot].name,
            bwi: bots[bot].bwi,
            lastConnect: bots[bot].lastConnect,
        }
    }
    return info
}

async function main() {
    config.manager = process.env.HOST;
    config.manager_token = process.env.TOKEN;
    let initialCharacterConfig = undefined
    if (!config.manager_token || !config.manager) {
        console.warn("missing host or token")
        process.exit()
    }
    socketRemote = new Worker("./remote.js", {
        workerData: {
            token: config.manager_token,
            host: process.env.SOCKET_HOST || config.manager
        }, env: SHARE_ENV
    })
    socketRemote.on('exit', (code) => {
        if (code !== 0) console.log(`Remote stopped with exit code ${code}`);
    });
    socketRemote.on('message', msg => {
        switch (msg.type) {
            case 'startCharacter':
                startGame(msg);
                break;
            case 'exit':
                process.exit();
                break;
            default:
                console.log("unhandled remote", msg);
        }
        console.log("message", msg)
    });

    try {
        const configCall = await axios.get(`${config.manager}/api/info/albot`, {headers: {'Authorization': config.manager_token}})
        fs.writeFileSync("CODE/default.js", configCall.data.code)
        config.auth = configCall.data.auth;
        config.servers = configCall.data.servers
        initialCharacterConfig = configCall.data.chars
        // console.log("X", configCall.data)
        if (!config.auth) {
            console.warn("got no auth");
            process.exit();
        }
    } catch (e) {
        console.warn(e)
        process.exit()
    }

    httpWrapper = new HttpWrapper(config.auth);
    setInterval(updateCharacters, 30000);

    /*
    // starting pathfinding daemon
    let pathfinderProcess = null;
    if (userData.config.pathfinding && userData.config.pathfinding.activate) {
        pathfinderProcess = child_process.fork("./pathfinding/main", [userData.config.pathfinding.daemonPort], {
            stdio: [0, 1, 2, 'ipc'],
            execArgv: [
                //'--inspect-brk',
                //"--max_old_space_size=4096",
            ]
        });
    }
    */

    setInterval(() => {
        for (const bot of Object.values(bots)) {
            if (bot.stop) {
                if (activeChildren[bot.charName]) {
                    activeChildren[bot.charName].kill();
                    delete activeChildren[bot.charName];
                    delete bot.stop
                    bot.status = "off"
                }
            }
            switch (bot.status) {
                case 'start':
                    bot.status = "loading"
                    console.log("starting bot...")
                    startGame(bot.charName, [config.auth, config.auth.split("-")[1], config.auth.split("-")[0], bot.ip, bot.port, bot.charId, "default.js", false]);
                    break
            }
            // console.log(bot.charName, bot.status)
        }
        let info = getInfo();
        const time = new Date().getTime();
        const upTime = time - started;
        if (socketRemote) socketRemote.postMessage({type: "info", info, time, upTime})
    }, 1000)

    // autostart
    setTimeout(autoConnect, 2000, initialCharacterConfig);
    if (!process.env.AUTOCONNECT) telegramBot = startTelegramBot()
}

function startTelegramBot() {
    return new Worker('./bot.js', {env: SHARE_ENV})
        .on('message', function (event) {
            console.log("M", event)
            switch (event.type) {
                case "info":
                    telegramBot.postMessage({type: "send_code", text: JSON.stringify(getInfo(), null, 2)})
                    break;
                case "config":
                    telegramBot.postMessage({type: "send_code", text: JSON.stringify(config, null, 2)})
                    break;
            }
        })
        .on('exit', () => {
            console.log("telegram bot exit");
        });
}

function autoConnect(initialCharacterConfig) {
    for (const cdata of initialCharacterConfig) {
        if (process.env.AUTOCONNECT) {
            cdata.autoconnect = process.env.AUTOCONNECT == cdata.name ? ( process.env.SERVER || "EUII") : undefined;
        }
        if (cdata.autoconnect) {
            const server = config.servers[cdata.autoconnect];
            if (!server) {
                console.warn("autostart " + cdata.name + " server " + cdata.autoconnect + "not found!")
                continue;
            }
            startGame({
                charId: cdata.id,
                charName: cdata.name,
                server: cdata.autoconnect
            })
        }
    }
}

function updateChildrenData() {
    for (const i in activeChildren) {
        // wo dont send active clients to code started bots to imitate web client
        if (!inactiveBots[i]) activeChildren[i].send({
            type: "active_characters",
            data: codeStatus
        })
    }
}

async function updateCharacters() {
    if (!config.auth) return;
    const form = new FormData();
    form.append('method', 'servers_and_characters');
    form.append('arguments', "{}");
    const headers = form.getHeaders();
    headers.cookie = "auth=" + config.auth;
    axios.post("https://adventure.land/api/servers_and_characters", form, {headers}).then(response => {
        let data = response.data[0];
        servers = data.servers;
        config.servers = {}
        for (let server of data.servers) {
            config.servers[server.key] = server;
        }
        axios.post(`${config.manager}/api/albot/update_servers_and_characters`, {
            characters: data.characters,
            servers: data.servers
        }, {headers: {'Authorization': config.manager_token}}).then(data => {
            console.log("update character&servers to manager", data.data)
        }, error => {
            console.error("update character&servers to manager (ERROR)", error)
        })
    }, error => {
        console.warn("error updating characters&servers", error)
    })


    /*
    let response = await httpWrapper.getServersAndCharacters();
    for (var i in activeChildren) {
        if (activeChildren.hasOwnProperty(i)) {
            try {
                activeChildren[i].send({type: "api_response", data: response});
            } catch (e) {

            }
        }
    }
    */
}

function restartGame(args) {
    const charId = args.charId;
    const charName = args.charName;
    const localBot = bots[charId]
    const elapsed = (new Date().getTime()) -  localBot.lastTry
    let nextStart = Math.max(60000 - elapsed, 100)
    console.log("Restart ", args.charName, " elapsed", elapsed/1000, "start in", nextStart/1000)
    localBot['status'] = "off"
    setTimeout(startGame,nextStart, args)
}

function startGame(args) {
    const charId = args.charId;
    const charName = args.charName;
    const localBot = bots[charId] = (bots[charId] || {status: "off", lastTry: new Date().getTime()});
    const server = config.servers[args.server];
    if (!server || localBot.status !== "off") return;
    localBot.status = "starting";
    localBot.name = charName
    localBot.server = server.key;
    const childProcess = child_process.fork("./app/game", [config.auth, server.addr, server.port, charId, process.env.SCRIPT || "default.js"], {
        stdio: [0, 1, 2, 'ipc'],
        execArgv: [
            // '--inspect=' + (9000 + Math.floor(Math.random() * 1000)),
            //'--inspect-brk',
            //"--max_old_space_size=f4096",
        ]
    });
    telegramBot && telegramBot.postMessage({type: "send_code", text: charName + " connect "+childProcess.pid})
    localBot.process = childProcess;
    childProcess.on('message', (m) => {
        // console.log("MESSAGE INFO", m);
        if (m.type === "status" && m.status === "error") {
            localBot.status = "error";
            localBot.process = undefined;
            telegramBot && telegramBot.postMessage({type: "send_code", text: charName + " error:" + JSON.stringify(m)})
            childProcess.kill();
            setTimeout(restartGame, 100, args)
        } else if (m.type === "status" && m.status === "initialized") {
            localBot.status = "initialized";
        } else if (m.type === "status" && m.status === "disconnected") {
            localBot.status = "error";
            localBot.process = undefined;
            telegramBot && telegramBot.postMessage({type: "send_code", text: charName + ": disconnected"})
            childProcess.kill();           
            setTimeout(restartGame, 100, args)
        } else if (m.type === "bwiUpdate") {
            localBot.bwi = m.data;
        } else if (m.type === "startupClient") {
            localBot.status = "running"
            localBot.lastConnect = new Date().getTime();
            // codeStatus[m.characterName] = "code";
            // updateChildrenData();
        } else if (m.type === "send_cm") {
            let sent = false;
            for (let bot in bots) {
                if (bots[bot].name === m.characterName && bots[bot].process) {
                    bots[bot].process.send({
                        type: "on_cm",
                        from: m.from,
                        data: m.data,
                    })
                    sent = true;
                }
            }
            if (!sent) childProcess.send({
                type: "send_cm_failed",
                characterName: m.characterName,
                data: m.data,
            });

        } else if (m.type === "start_character") {
            /*            let bot = inactiveBots[m.name];
                        if (bot && !activeChildren[m.name]) {
                            codeStatus[m.name] = "loading";
                            if (m.data && inactiveBots[m.name]) inactiveBots[m.name][6] = m.data + ".js";
                            startGame(bot);
                            updateChildrenData()
                            console.log("started", m.name)
                        }
             */
        } else if (m.type === "api_call") {
            if (!config.auth) return;
            const form = new FormData();
            form.append('method', m.command);
            form.append('arguments', m.arguments || "{}");
            const headers = form.getHeaders();
            headers.cookie = "auth=" + config.auth;
            axios.post(`https://adventure.land/api/${m.command}`, form, {headers}).then(response => {
                let data = response.data[0];
                childProcess.send({
                    type: "api_response",
                    data: data,
                });
            }, error => {
            })
        } else if (m.type === "log_message") {
            if (telegramBot) telegramBot.postMessage(m);
        } else {
            console.log("unknown call", m)
        }
    });
}

main().then()
