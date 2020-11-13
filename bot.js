const {Telegraf} = require('telegraf')
var {workerData, parentPort} = require('worker_threads');

const bot = new Telegraf(process.argv[2])

parentPort.on("message", function (data) {
    console.log("got message", data)
});

bot.start((ctx) => {
    parentPort.postMessage({type: "start"});
    ctx.reply('Welcome');
})
bot.help((ctx) => {
    return ctx.reply('Send me a sticker');
})
bot.on('sticker', (ctx) => {
    return ctx.reply('👍');
})
bot.hears('hi', (ctx) => {
    parentPort.postMessage({type: "hi"});
    return ctx.reply('Hey there');
})
bot.launch()