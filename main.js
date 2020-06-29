process.on('uncaughtException', function (exception) {
    console.log(exception);
    console.log(exception.stack);
});
var child_process = require("child_process");

var HttpWrapper = require("./app/httpWrapper");
const request = require("request-promise-native");
const fs = require('fs');

var bots = {}
var inactiveBots = {};
var httpWrapper = undefined;
var activeChildren = {};
var codeStatus = {};
var config = {};

const io = require('socket.io-client');

async function main() {
    const token = process.env.TOKEN;
    const host = process.env.HOST;
    const socket_host = process.env.SOCKET_HOST || host;

    if (!token || !host) {
        console.warn("missing host or token")
        process.exit()
    }

    const url = `https://${host}/api/code/cli.js?token=${token}`
    console.log(`fetching script ${url}`)
    const code = await request.get(url)
    fs.writeFileSync("CODE/default.js", code)

    const socket_url = `https://${socket_host}/albot?token=${token}`
    console.log("connecting socket:" + socket_url)
    const socket = io(socket_url,
        {transport: ['websocket']})
    socket.on('connect', (d) => {
        console.log("socket.io connected", socket_host);
    });

    socket.on('connect_error', (d) => {
        console.log("socket.io error", socket, d);
    });

    socket.on('connect_timeout', (d) => {
        console.log("socket.io timeout", d);
    });

    socket.on('start_character', (arg1) => {
        if (bots[arg1.char_name] && bots[arg1.char_name].status !== "off") return;
        if (!httpWrapper) {
            httpWrapper = new HttpWrapper(arg1.auth, arg1.auth.split("-")[1], arg1.auth.split("-")[0]);
            updateCharacters(httpWrapper)
            setInterval(updateCharacters, 20000, httpWrapper);
        }
        config['auth'] = arg1.auth;

        bots[arg1.char_name] = {
            status: "start",
            charName: arg1.char_name,
            ip: arg1.ip,
            port: arg1.port,
            charId: arg1.char_id
        }
    });

    socket.on('stop_character', (arg1) => {
        if (!bots[arg1.char_name] || bots[arg1.char_name].status === "off") return;
        bots[arg1.char_name].stop = true;
    });

    socket.on('reload', (data) => {
        socket.emit("info", {bots})
    })

    setInterval(() => {
        console.log("----");
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
            console.log(bot.charName, bot.status)
        }
        socket.emit("info", {bots})
    }, 1000)
}


function updateChildrenData() {
    for (var i in activeChildren) {
        // wo dont send active clients to code started bots to imitate web client
        if (!inactiveBots[i]) activeChildren[i].send({
            type: "active_characters",
            data: codeStatus
        })
    }
}

async function updateCharacters(httpWrapper) {
    if (!httpWrapper) return;
    let response = await httpWrapper.getServersAndCharacters();
    for (var i in activeChildren) {
        if (activeChildren.hasOwnProperty(i)) {
            try {
                activeChildren[i].send({type: "api_response", data: response});
            } catch (e) {

            }
        }
    }
}

function startGame(charName, args) {
    let childProcess = child_process.fork("./app/game", args, {
        stdio: [0, 1, 2, 'ipc'],
        execArgv: [
            // '--inspect=' + (9000 + Math.floor(Math.random() * 1000)),
            //'--inspect-brk',
            //"--max_old_space_size=4096",
        ]
    });

    childProcess.on('message', (m) => {
        // console.log("MESSAGE INFO", m);
        if (m.type === "status" && m.status === "disconnected") {
            childProcess.kill();
            for (var i in activeChildren) {
                if (activeChildren.hasOwnProperty(i) && activeChildren[i] === childProcess) {
                    activeChildren[i] = null;
                    codeStatus[i] = "loading"
                }
            }
            // BotWebInterface.SocketServer.getPublisher().removeInterface(botInterface);
            startGame(charName, args);
            updateChildrenData();
        } else if (m.type === "bwiUpdate") {
            bots[charName].bwi = m.data;
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
                childProcess.send({
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
        }
    });
}

main()
