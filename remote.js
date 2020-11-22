const {workerData, parentPort} = require('worker_threads');
const io = require('socket.io-client');

const socket = io(`${workerData.host}/albot?token=${workerData.token}`, {transport: ['websocket']})
let connected = false;

socket.on('connect', d => {
    console.log("socket.io connected", workerData.host);
    connected = true;
});

socket.on('connect_error', d => {
    console.log("socket.io error", socket, d);
    connected = false;
});

socket.on('connect_timeout', d => {
    console.log("socket.io timeout", d);
    connected = false;
});

socket.on('kill_albot', () => {
    parentPort.postMessage({type: "exit"})
});

socket.on('start_character', arg1 => {
    parentPort.postMessage({
        type: "startCharacter",
        charId: arg1['char_id'],
        charName: arg1['char_name'],
        server: arg1.server
    })
});

socket.on('stop_character', arg1 => {
    parentPort.postMessage({
        type: "stopCharacter",
        charId: arg1['char_id'],
    })
});

parentPort.on("message", data => {
    if (connected) socket.emit("info", data)
})
