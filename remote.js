const {workerData, parentPort} = require('worker_threads');
const io = require('socket.io-client');

const socket = io(`${workerData.host}/albot?token=${workerData.token}`, {transport: ['websocket']})

socket.on('connect', (d) => {
    console.log("socket.io connected", workerData.host);
});

socket.on('connect_error', (d) => {
    console.log("socket.io error", socket, d);
});

socket.on('connect_timeout', (d) => {
    console.log("socket.io timeout", d);
});

socket.on('kill_albot', () => {
    console.log("exiting albot...")
    parentPort.postMessage({type: "exit"})
});

socket.on('start_character', (arg1) => {
    console.log("start_character", arg1)
    parentPort.postMessage({
        type: "startCharacter",
        charId: arg1['char_id'],
        charName: arg1['char_name'],
        addr: arg1.ip,
        port: arg1.port
    })
});

socket.on('stop_character', (arg1) => {
    console.log("stop_character", arg1)
    parentPort.postMessage({
        type: "stopCharacter",
        id: arg1['char_id'],
        name: arg1['char_name'],
    })
});
