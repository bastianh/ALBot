const {Telegraf, Telegram} = require('telegraf')
const axios = require('axios');
var {workerData, parentPort} = require('worker_threads');
const extra = require('telegraf/extra')
const markup = extra.markdown()

axios.defaults.headers.common['Authorization'] = process.env.TOKEN;
axios.defaults.baseURL = process.env.HOST;

let chatId = null;

async function main() {
    let botToken = process.env.BOT_TOKEN
    if (botToken) {
        setupBot(botToken)
    } else {
        const request = await axios.get("/api/albot/telegram")
        if (request.status === 200) {
            chatId = request.data.chat_id;
            const token = request.data.bot_token;
            if (token) {
                setupBot(token)
            } else {
                console.warn("missing telegram bot token!")
            }
        }
    }
}

async function setupBot(token) {
    const bot = new Telegraf(token)
    const telegram = new Telegram(token)

    async function sendMessage(text) {
        if (chatId) telegram.sendMessage(chatId, text, markup)
        else console.log("Telegram (no chatId", text);
    }

    parentPort.on("message", async function (data) {
        console.log("got message", data)
        switch (data.type) {
            case "log_message":
                await sendMessage(`${data.name}: ${data.message}`)
                break;
            case "send_code":
                await sendMessage("```\n"+data.text+"\n```")
                break; 
        }
    });

    bot.start(async (ctx) => {
        parentPort.postMessage({type: "start"});
        chatId = ctx.update.message.chat.id;
        axios.post("/api/albot/telegram", {chat_id: chatId}).then(d => console.log("updated chat_id", d.statusText), e => console.error("update chat_id error", e))
        ctx.reply(`Set chatId to ${chatId}`);
    })

    bot.help((ctx) => {
        return ctx.reply('Send me a sticker');
    })

    bot.on('sticker', (ctx) => {
        return ctx.reply('👍');
    })

    bot.command('info', ctx => {
        parentPort.postMessage({type: "info"});
    })
    bot.command('config', ctx => {
        parentPort.postMessage({type: "config"});
    })
    bot.command('c', ctx => {
        parentPort.postMessage({type: "hi"});
        return ctx.reply('Hey there c');
    })

    bot.launch()
    sendMessage("ALBot started!")
}

main()