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
    const code = await request.get(url)
    fs.writeFileSync("CODE/default.js", code)

    const socket = io(`https://${socket_host}/albot?token=${token}`,
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
        if (bots[arg1.char_name]) return;
        if (!httpWrapper) {
            httpWrapper = new HttpWrapper(arg1.auth, arg1.auth.split("-")[1], arg1.auth.split("-")[0]);
            updateCharacters(httpWrapper)
            setInterval(updateCharacters, 20000, httpWrapper);
        }
        const args = [arg1.auth, arg1.auth.split("-")[1], arg1.auth.split("-")[0], arg1.ip, arg1.port, arg1.char_id, "default.js", false];
        startGame(args)
        bots[arg1.char_name] = {enabled: true, name: arg1.char_name,}
        console.log(bots);
        socket.emit("info", {bots})
    });

    socket.on('stop_character', (arg1) => {
        if (!bots[arg1.char_name]) return;
        if (!activeChildren[arg1.char_name]) return;
        activeChildren[arg1.char_name].kill();

        delete activeChildren[arg1.char_name];
        delete bots[arg1.char_name]
        console.log(bots);
        socket.emit("info", {bots})
    });

    socket.on('reload', (data) => {
        socket.emit("info", {bots})
    })
}

var activeChildren = {};
var codeStatus = {};

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

function startGame(args) {
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
            startGame(args);
            updateChildrenData();
        } else if (m.type === "bwiUpdate") {
            // data = m.data;
        } else if (m.type === "bwiPush") {
            // botInterface.pushData(m.name, m.data);
        } else if (m.type === "startupClient") {
            activeChildren[m.characterName] = childProcess;
            codeStatus[m.characterName] = "code";
            updateChildrenData();
            //socket.emit("info", {bots})
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
            let bot = inactiveBots[m.name];
            if (bot && !activeChildren[m.name]) {
                codeStatus[m.name] = "loading";
                if (m.data && inactiveBots[m.name]) inactiveBots[m.name][6] = m.data + ".js";
                startGame(bot);
                updateChildrenData()
                console.log("started", m.name)
            }
        }
    });
}

main()
