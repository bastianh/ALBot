process.on('uncaughtException', function (exception) {
    console.log(exception);
    console.log(exception.stack);
});

const {Worker, SHARE_ENV} = require('worker_threads');
const child_process = require("child_process");

const HttpWrapper = require("./app/httpWrapper");
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

var bots = {}
var inactiveBots = {};
var httpWrapper = undefined;
var activeChildren = {};
var codeStatus = {};
var config = {};
var started = new Date().getTime()
socket = undefined

const io = require('socket.io-client');

function startCharacter(charId, charName, ip, port) {
    console.log('start_character', charName, ip, port);
    if (bots[charName] && bots[charName].status !== "off") return;
    bots[charName] = {
        status: "start",
        charName: charName,
        ip: ip,
        port: port,
        charId: charId
    }
}

async function main() {
    config.manager = process.env.HOST;
    config.manager_token = process.env.TOKEN;
    const socket_host = process.env.SOCKET_HOST || config.manager;
    let initialCharacterConfig = undefined
    if (!config.manager_token || !config.manager) {
        console.warn("missing host or token")
        process.exit()
    }
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

    httpWrapper = new HttpWrapper(config.auth, config.auth.split("-")[1], config.auth.split("-")[0]);
    setInterval(updateCharacters, 30000);

    const socket_url = `${socket_host}/albot?token=${config.manager_token}`

    console.log("connecting socket:" + socket_url)

    const socket = io(socket_url, {transport: ['websocket']})

    socket.on('connect', (d) => {
        console.log("socket.io connected", socket_host);
    });

    socket.on('connect_error', (d) => {
        console.log("socket.io error", socket, d);
    });

    socket.on('connect_timeout', (d) => {
        console.log("socket.io timeout", d);
    });

    socket.on('kill_albot', () => {
        console.log("exiting albot...")
        process.exit()
    });

    socket.on('start_character', (arg1) => {
        startCharacter(arg1['char_id'], arg1['char_name'], arg1.ip, arg1.port)
    });

    socket.on('stop_character', (arg1) => {
        console.log("stop character", arg1)
        if (!bots[arg1.char_name] || bots[arg1.char_name].status === "off") return;
        bots[arg1.char_name].stop = true;
    });

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
                    startGame( {
                        name: bot.charName,
                        auth: config.auth,
                        ip: bot.ip,
                        port: bot.port,
                        charid: bot.charId,
                        script: "default.js"
                    });
                    break
            }
            // console.log(bot.charName, bot.status)
        }
        const time = new Date().getTime();
        const upTime = time - started;
        socket.emit("info", {bots, time, upTime})
    }, 2500)

    // autostart
    setTimeout(autoConnect, 5000, initialCharacterConfig);
    startTelegramBot("1470949361:AAFBYV2Q5mCs7GhxT4oAR_gHFzh1akhPg8o")
}

function startTelegramBot(token) {
    return new Worker('./bot.js', {env: SHARE_ENV, argv: [token]})
        .on('message', function (data) {
            console.log("M", data)
        })
        .on('exit', () => {
            console.log("telegram bot exit");
        });
}

function autoConnect(initialCharacterConfig) {
    for (const cdata of initialCharacterConfig) {
        if (cdata.autoconnect) {
            const server = config.servers[cdata.autoconnect];
            if (!server) {
                console.warn("autostart " + cdata.name + " server " + cdata.autoconnect + "not found!")
                continue;
            }
            startCharacter(cdata.id, cdata.name, server.addr, server.port)
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

function startGame(args) {
    let childProcess = new Worker("./app/game_worker.js", {workerData: args});

    childProcess.on('message', (m) => {
        // console.log("MESSAGE INFO", m);
        if (m.type === "status" && m.status === "error") {
            bots[args.name].status = "error";
            childProcess.terminate().then(e => {
                console.log("CHILDPROCESS TERMINATED!");
                for (var i in activeChildren) {
                    if (activeChildren.hasOwnProperty(i) && activeChildren[i] === childProcess) {
                        activeChildren[i] = null;
                        codeStatus[i] = "loading"
                    }
                }
            })
        } else if (m.type === "status" && m.status === "initialized") {
            activeChildren[args.name] = childProcess;
            bots[args.name].status = "initialized";
            bots[args.name].pid = childProcess.pid;
        } else if (m.type === "status" && m.status === "disconnected") {
            childProcess.terminate().then(e => {
                console.log("CHILDPROCESS TERMINATED!");
                for (var i in activeChildren) {
                    if (activeChildren.hasOwnProperty(i) && activeChildren[i] === childProcess) {
                        activeChildren[i] = null;
                        codeStatus[i] = "loading"
                    }
                }
                startGame( args);
                updateChildrenData();
            })
            // BotWebInterface.SocketServer.getPublisher().removeInterface(botInterface);
        } else if (m.type === "bwiUpdate") {
            bots[args.name].bwi = m.data;
        } else if (m.type === "bwiPush") {
            // botInterface.pushData(m.name, m.data);
        } else if (m.type === "startupClient") {
            activeChildren[m.characterName] = childProcess;
            bots[m.characterName].status = "running"
            bots[m.characterName].lastConnect = new Date().getTime();
            codeStatus[m.characterName] = "code";
            updateChildrenData();
        } else if (m.type === "send_cm") {
            if (activeChildren[m.characterName]) {
                activeChildren[m.characterName].send({
                    type: "on_cm",
                    from: m.from,
                    data: m.data,
                })
            } else {
                childProcess.postMessage({
                    type: "send_cm_failed",
                    characterName: m.characterName,
                    data: m.data,
                });
            }
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
                childProcess.postMessage({
                    type: "api_response",
                    data: data,
                });
            }, error => {
            })
        }
    });
}

main().then()
