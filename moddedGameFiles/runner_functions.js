// #NOTE: If you want to see a new function/feature, just request it at: https://github.com/kaansoral/adventureland/issues
// Or at #feedback in Discord: https://discord.gg/4SXJGU

var character = {
    // This object proxies the real parent.character
    // Normal entities have normal coordinates, their {x,y}'s are equal to their {real_x,real_y}'s
    // The character object is special, it's always in the middle of the screen, so it has static {x,y}'s
    // Added this wrapper so instead of using .real_x and .real_y on all entities, .x and .y's can be used uniformly
    "note": "This is a proxy object, the real character is in parent.character",
    "properties": ["x", "y"],
    "read_only": ["x", "y", "real_x", "real_y", "from_x", "from_y", "going_x", "going_y", "moving", "target", "vx", "vy", "move_num", "attack", "speed", "hp", "mp", "xp", "max_hp", "max_mp", "range", "level", "rip", "s", "c", "in", "map", "stand", "items", "slots"],
};

Object.defineProperty(character, 'x', {
    get: function () {
        return parent.character.real_x;
    }, set: function () {
        game_log("You can't set coordinates manually, use the move(x,y) function!");
    }, enumerable: true
});

Object.defineProperty(character, 'y', {
    get: function () {
        return parent.character.real_y;
    }, set: function () {
        game_log("You can't set coordinates manually, use the move(x,y) function!");
    }, enumerable: true
});
for (var p in parent.character)
    proxy(p); // Not all properties are sadly available right away, new properties are captured imperfectly
// var character=parent.character; // Old [25/06/2018]

var G = parent.G; // Game Data - Use show_json(Object.keys(G)); and inspect individual data with show_json(G.skills) and alike
var safeties = true; // Prevents common delay based issues that cause many requests to be sent to the server in a burst that triggers the server to disconnect the character

server = {
    mode: parent.gameplay, // "normal", "hardcore", "test"
    pvp: parent.is_pvp, // true for PVP servers, use is_pvp() for maps
    region: parent.server_region, // "EU", "US", "ASIA"
    id: parent.server_identifier, // "I", "II", "PVP", "TEST"
}

game = {
    platform: parent.is_electron && "electron" || "web", // "electron" for Steam, Mac clients, "web" for https://adventure.land
    graphics: !parent.no_graphics, // if game.graphics is false, don't draw stuff to the game in your Code
    html: !parent.no_html, // if game.html is false, this character is loaded in [CODE] mode
};
character.bot = parent.is_bot;

//#NOTE: Most new features are experimental - for #feedback + suggestions: https://discord.gg/X4MpntA [05/01/18]

function start_character(name, code_slot_or_name) {
    // Loads a character in [CODE] mode
    //TODO implement
    throw new Error("Not supported in ALBot. yet");
    parent.start_character_runner(name, code_slot_or_name)
}

function stop_character(name) {
    throw new Error("Not supported in ALBot. yet");
    parent.stop_character_runner(name)
}

function command_character(name, code_snippet) {
    // Commands the character in [CODE] mode
    throw new Error("Not supported in ALBot. yet");
    parent.character_code_eval(name, code_snippet)
}

function get_active_characters() {
    // States: "self", "starting","loading", "active", "code"
    // Example: {"Me":"self","Protector":"loading"}
    return parent.get_active_characters()
}

function change_server(region, name) // change_server("EU","I") or change_server("ASIA","PVP") or change_server("US","III")
{
    throw new Error("Not supported in ALBot. yet");
    parent.window.location.href = "/character/" + character.name + "/in/" + region + "/" + name + "/";
}

function is_pvp() {
    return G.maps[character.map].pvp || server.pvp;
}

function is_npc(entity) {
    if (entity && (entity.npc || entity.type == "npc")) return true;
}

function is_monster(entity) {
    if (entity && entity.type == "monster") return true;
}

function is_character(entity) {
    if (entity && entity.type == "character" && !entity.npc) return true;
}

function is_player(e) {
    return is_character(e);
} // backwards-compatibility

function activate(num) // activates an item, likely a booster, in the num-th inventory slot
{
    parent.activate(num);
}

function shift(num, name) // shifts an item, likely a booster, in the num-th inventory slot
{
    // shift(0,'xpbooster')
    // shift(0,'luckbooster')
    // shift(0,'goldbooster')
    parent.shift(num, name);
}

function can_use(name) {
    if (G.skills[name] && G.skills[name].class && !in_arr(character.ctype, G.skills[name].class)) return false; // checks the class
    return parent.can_use(name); // checks the cooldown
}

function use(name, target) // a multi-purpose use function, works for skills too
{
    if (isNaN(name)) // if name is not an integer, use the skill
    {
        if (!target) target = get_target();
        parent.use_skill(name, target);
    } else {
        // for example, if there is a potion at the first inventory slot, use(0) would use it
        equip(name);
    }
}

function use_skill(name, target) {
    // for blink: use_skill("blink",[x,y])
    if (!target) target = get_target();
    parent.use_skill(name, target);
}

function reduce_cooldown(name, ms) {
    // parent.next_skill contains Date objects of when the skills will be available next
    // show_json(parent.next_skill) to get a better idea
    // reduce_cooldown("attack",100) would cause the attack cooldown to reduce by 100 ms
    // If your ping is 100+ms - this would ~correct/improve/adjust the cooldown
    // attack(target).then(function(data){ reduce_cooldown("attack",character.ping*0.95); });
    // Above call is likely the ideal usage
    if (parent.next_skill[name])
        parent.skill_timeout(name, -mssince(parent.next_skill[name]) - ms);
}

function bank_deposit(gold) {
    if (!character.bank)
        return game_log("Not inside the bank");
    parent.socket.emit("bank", {operation: "deposit", amount: gold});
}

function bank_withdraw(gold) {
    if (!character.bank)
        return game_log("Not inside the bank");
    parent.socket.emit("bank", {operation: "withdraw", amount: gold});
}

function bank_store(num, pack, pack_slot) {
    // bank_store(0) - Stores the first item in inventory in the first/best spot in bank
    // parent.socket.emit("bank",{operation:"swap",pack:pack,str:num,inv:num});
    // Above call can be used manually to pull items, swap items and so on - str is from 0 to 41, it's the storage slot #
    // parent.socket.emit("bank",{operation:"swap",pack:pack,str:num,inv:-1}); <- this call would pull an item to the first inventory slot available
    // pack is one of ["items0","items1","items2","items3","items4","items5","items6","items7"]
    if (!character.bank) return game_log("Not inside the bank");
    if (!character.items[num]) return game_log("No item in that spot");
    if (!pack_slot) pack_slot = -1; // the server interprets -1 as first slot available
    if (!pack) {
        var cp = undefined, cs = undefined;
        bank_packs.forEach(function (cpack) {
            if (!character.bank[cpack]) return;
            for (var i = 0; i < 42; i++) {
                if (pack) return;
                if (can_stack(character.bank[cpack][i], character.items[num])) // the item we want to store and this bank item can stack - best case scenario
                {
                    pack = cpack;
                }
                if (!character.bank[cpack][i] && !cp) {
                    cp = cpack;
                }
            }
        });
        if (!pack && !cp) return game_log("Bank is full!");
        if (!pack) pack = cp;
    }
    parent.socket.emit("bank", {operation: "swap", pack: pack, str: -1, inv: num});
}

function swap(a, b) // inventory move/swap
{
    parent.socket.emit("imove", {a: a, b: b});
}

function locate_item(name) {
    for (var i = 0; i < character.items.length; i++) {
        if (character.items[i] && character.items[i].name == name) return i;
    }
    return -1;
}

function quantity(name) {
    var q = 0;
    for (var i = 0; i < character.items.length; i++) {
        if (character.items[i] && character.items[i].name == name) q += character.items[i].q || 1;
    }
    return q;
}

function item_properties(item) // example: item_properties(character.items[0])
{
    if (!item || !item.name) return null;
    return calculate_item_properties(G.items[item.name], item);
}

function item_grade(item) // example: item_grade(character.items[0])
{
    // 0 Normal
    // 1 High
    // 2 Rare
    if (!item || !item.name) return -1;
    return calculate_item_grade(G.items[item.name], item);
}

function item_value(item) // example: item_value(character.items[0])
{
    if (!item || !item.name) return 0;
    return calculate_item_value(item);
}

function transport(map, spawn) {
    parent.socket.emit("transport", {to: map, s: spawn});
}

function is_paused() {
    return true;
}

function pause() // Pauses the Graphics
{
    //Well what did you expect, there is nothing to pause here
}

function get_socket() {
    return parent.socket;
}

function get_map() {
    return parent.G.maps[parent.current_map];
}

function set_message(text, color) {
    //TODO implement transfer to BWI
}

function game_log(message, color) {
    parent.add_log(message);
}

function log(message, color) {
    if (is_object(message)) message = JSON.stringify(message);
    game_log(message, color);
}

function get_target_of(entity) // .target is a Name for Monsters and `id` for Players - this function return whatever the entity in question is targeting
{
    if (!entity || !entity.target) return null;
    if (character.id == entity.target) return character;
    for (var id in parent.entities) {
        var e = parent.entities[id];
        if (e.id == entity.target) return e;
    }
    return null;
}

function get_target() {
    if (parent.ctarget && !parent.ctarget.dead) return parent.ctarget;
    return null;
}

function get_targeted_monster() {
    if (parent.ctarget && !parent.ctarget.dead && parent.ctarget.type == 'monster') return parent.ctarget;
    return null;
}

function change_target(target, public) {
    parent.ctarget = target;
    if (!public) //no need to send the target on default for CODE, some people are using change_target 5-6 times in an interval
    {
        // user change_target(target,true) from now on to send the target to the server explicitly [23/10/16]
        if (target) parent.last_id_sent = target.id;
        else parent.last_id_sent = '';
    }
    parent.send_target_logic();
}

function can_move_to(x, y) {
    if (is_object(x)) y = x.real_y, x = x.real_x;
    return can_move({
        map: character.map,
        x: character.real_x,
        y: character.real_y,
        going_x: x,
        going_y: y,
        base: character.base
    });
}

function xmove(x, y) {
    if (can_move_to(x, y)) move(x, y);
    else smart_move({x: x, y: y});
}

function in_attack_range(target) // also works for priests/heal
{
    if (!target) return false;
    if (parent.distance(character, target) <= character.range) return true;
    return false;
}

function is_in_range(target, skill) {
    // Valid usages: is_in_range(target), is_in_range(target,"attack"), is_in_range(target,"heal"), is_in_range(target,"mentalburst")
    if (!target) return false;
    // NOTE: visible flag removed for this bot
    var range_multiplier = 1, range_bonus = 0;
    if (G.skills[skill] && G.skills[skill].range_multiplier) range_multiplier = G.skills[skill].range_multiplier;
    if (G.skills[skill] && G.skills[skill].range_bonus) range_bonus = G.skills[skill].range_bonus;
    if (parent.distance(character, target) <= character.range * range_multiplier + range_bonus) return true;
    return false;
}


function can_attack(target) // also works for priests/heal
{
    // is_disabled function checks .rip and .stunned
    if (!target) return false;
    if (!parent.is_disabled(character) && is_in_range(target) && new Date() >= parent.next_skill.attack) return true;
    return false;
}

function can_heal(t) {
    if (is_monster(t)) return false; // ?? :D [11/10/18]
    return can_attack(t);
}

function is_moving(entity) {
    if (entity.me && smart.moving) return true;
    if (entity.moving) return true;
    return false;
}

function is_transporting(entity) {
    if (entity.c.town) return true;
    if (entity.me && parent.transporting) return true;
    return false;
}

function attack(target) {
    if (!target) {
        game_log("Nothing to attack()", "gray");
        return rejecting_promise({reason: "not_found"});
    }
    if (target.type == "character")
        return parent.player_attack.call(target);
    else
        return parent.monster_attack.call(target);
}

function heal(target) {
    if (safeties && mssince(last_attack) < 400) return;
    if (!target) {
        game_log("No one to heal()", "gray");
        return rejecting_promise({reason: "not_found"});
    }
    return parent.player_heal.call(target);
}

function buy(name, quantity) //item names can be spotted from show_json(character.items) - they can be bought only if an NPC sells them
{
    return parent.buy(name, quantity); // returns a Promise
}

function buy_with_gold(name, quantity) {
    return parent.buy_with_gold(name, quantity); // returns a Promise
}

function buy_with_shells(name, quantity) {
    parent.buy_with_shells(name, quantity);
}

function sell(num, quantity) //sell an item from character.items by it's order - 0 to N-1
{
    parent.sell(num, quantity);
}

function equip(num, slot) // slot is optional
{
    parent.socket.emit("equip", {num: num, slot: slot});
}

function unequip(slot) // show_json(character.slots) => to see slot options
{
    parent.socket.emit("unequip", {slot: slot});
}

function trade(num, trade_slot, price, quantity) // where trade_slot is 1 to 16 - example, trade(0,4,1000) puts the first item in inventory to the 4th trade slot for 1000 gold [27/10/16]
{
    if (!is_string(trade_slot) || !trade_slot.startsWith("trade")) trade_slot = "trade" + trade_slot;
    parent.trade(trade_slot, num, price, quantity || 1);
}

function trade_buy(target, trade_slot) // target needs to be an actual player
{
    parent.trade_buy(trade_slot, target.id, target.slots[trade_slot].rid); // the .rid changes when the item in the slot changes, it prevents swap-based frauds [22/11/16]
}

function upgrade(item_num, scroll_num, offering_num) //number of the item and scroll on the show_json(character.items) array - 0 to N-1
{
    return parent.upgrade(item_num, scroll_num, offering_num);
}

function compound(item0, item1, item2, scroll_num, offering_num) // for example -> compound(0,1,2,6) -> 3 items in the first 3 slots, scroll at the 6th spot
{
    return parent.compound(item0, item1, item2, scroll_num, offering_num);
}

function craft(i0, i1, i2, i3, i4, i5, i6, i7, i8)
// for example -> craft(null,0,null,null,1,null,null,2,null)
// sends 3 items to be crafted, the 0th, 1st, 2nd items in your inventory, and it places them all in the middle column of crafting
{
    parent.craft(i0, i1, i2, i3, i4, i5, i6, i7, i8);
}

function dismantle(item_num) {
    parent.dismantle(item_num);
}

function exchange(item_num) {
    parent.exchange(item_num, 1);
}

function say(message) // please use MORE responsibly, thank you! :)
{
    parent.say(message, 1);
}

function pm(name, message) // please use responsibly, thank you! :)
{
    parent.private_say(name, message, 0)
}

function move(x, y) {
    if (!can_walk(character)) return;
    parent.move(x, y);
}

function cruise(speed) {
    parent.socket.emit("cruise", speed);
}

function show_json(e) // renders the object as json inside the game
{
    parent.show_json(parent.game_stringify(e, 2));
}

function get_player(name) // returns the player by name, if the player is within the vision area
{
    var target = null, entities = parent.entities;
    if (character && name == character.name)
        target = character;
    for (let i in entities)
        if (entities[i] && entities[i].type == "character" && entities[i].name == name)
            target = entities[i];
    return target;
}

function get_nearest_monster(args) {
    //args:
    // max_att - max attack
    // min_xp - min XP
    // target: Only return monsters that target this "name" or player object
    // no_target: Only pick monsters that don't have any target
    // path_check: Checks if the character can move to the target
    // type: Type of the monsters, for example "goo", can be referenced from `show_json(G.monsters)` [08/02/17]
    var min_d = 999999, target = null;

    if (!args) args = {};
    if (args && args.target && args.target.name) args.target = args.target.name;
    if (args && args.type == "monster") game_log("get_nearest_monster: you used monster.type, which is always 'monster', use monster.mtype instead");
    if (args && args.mtype) game_log("get_nearest_monster: you used 'mtype', you should use 'type'");

    for (var id in parent.entities) {
        var current = parent.entities[id];
        if (current.type != "monster" || current.dead) continue;
        if (args.type && current.mtype != args.type) continue;
        if (args.min_xp && current.xp < args.min_xp) continue;
        if (args.max_att && current.attack > args.max_att) continue;
        if (args.target && current.target != args.target) continue;
        if (args.no_target && current.target && current.target != character.name) continue;
        if (args.path_check && !can_move_to(current)) continue;
        var c_dist = parent.distance(character, current);
        if (c_dist < min_d) min_d = c_dist, target = current;
    }
    return target;
}

function get_nearest_hostile(args) // mainly as an example [08/02/17]
{
    var min_d = 999999, target = null;

    if (!args) args = {};
    if (args.friendship === undefined && character.owner) args.friendship = true;

    for (var id in parent.entities) {
        var current = parent.entities[id];
        if (current.type != "character" || current.rip || current.invincible || current.npc) continue;
        if (current.party && character.party == current.party) continue;
        if (current.guild && character.guild == current.guild) continue;
        if (args.friendship && in_arr(current.owner, parent.friends)) continue;
        if (args.exclude && in_arr(current.name, args.exclude)) continue; // get_nearest_hostile({exclude:["Wizard"]}); Thanks
        var c_dist = parent.distance(character, current);
        if (c_dist < min_d) min_d = c_dist, target = current;
    }
    return target;
}

function use_hp_or_mp() {
    if (safeties && mssince(last_potion) < min(200, character.ping * 3)) return;
    var used = false;
    if (new Date() < parent.next_skill.use_hp) return;
    if (character.mp / character.max_mp < 0.2) use('use_mp'), used = true;
    else if (character.hp / character.max_hp < 0.7) use('use_hp'), used = true;
    else if (character.mp / character.max_mp < 0.8) use('use_mp'), used = true;
    else if (character.hp < character.max_hp) use('use_hp'), used = true;
    else if (character.mp < character.max_mp) use('use_mp'), used = true;
    if (used) last_potion = new Date();
}

// loot(true) allows code characters to make their commanders' loot instead, extremely useful [14/01/18]
function loot(commander) {
    if (commander) {
        console.log("Commander looting is not supported in this version")
    }
    var looted = 0;
    if (safeties && mssince(last_loot) < min(300, character.ping * 3)) return;
    last_loot = new Date();
    for (let id in parent.chests) {
        var chest = parent.chests[id];
        if (safeties && (chest.items > character.esize || chest.last_loot && mssince(chest.last_loot) < 1600))
            continue;
        chest.last_loot = last_loot;
        parent.open_chest(id);
        // parent.socket.emit("open_chest",{id:id}); old version [02/07/18]
        looted++;
        if (looted == 2) break;
    }
}

function send_gold(receiver, gold) {
    if (!receiver) return game_log("No receiver sent to send_gold");
    if (receiver.name) receiver = receiver.name;
    parent.socket.emit("send", {name: receiver, gold: gold});
}

function send_item(receiver, num, quantity) {
    if (!receiver) return game_log("No receiver sent to send_item");
    if (receiver.name) receiver = receiver.name;
    parent.socket.emit("send", {name: receiver, num: num, q: quantity || 1});
}

function destroy_item(num) // num: 0 to 41
{
    parent.socket.emit("destroy", {num: num});
}

function send_party_invite(name, is_request) // name could be a player object, name, or id
{
    if (is_object(name)) name = name.name;
    parent.socket.emit('party', {event: is_request && 'request' || 'invite', name: name});
}

function send_party_request(name) {
    send_party_invite(name, 1);
}

function accept_party_invite(name) {
    parent.socket.emit('party', {event: 'accept', name: name});
}

function accept_party_request(name) {
    parent.socket.emit('party', {event: 'raccept', name: name});
}

function leave_party() {
    parent.socket.emit("party", {event: "leave"});
}

function accept_magiport(name) {
    parent.socket.emit('magiport', {name: name});
}

function unfriend(name) // instead of a name, an owner id also works, this is currently the only way to unfriend someone [20/08/18]
{
    parent.socket.emit('friend', {event: 'unfriend', name: name});
}

function respawn() {
    parent.socket.emit('respawn');
}

function handle_command(command, args) // command's are things like "/party" that are entered through Chat - args is a string
{
    // game_log("Command: /"+command+" Args: "+args);
    // return true;
    return -1;
}

function send_cm(to, data) {
    // to: Name or Array of Name's
    // data: JSON object
    process.send({
        type: "send_cm",
        characterName: to,
        data: data,
        from: character.name,
    })
}

process.on("message", function (m) {
    if (m.type === "send_cm_failed") {
        parent.send_code_message(m.characterName, m.data);
    }
})

function on_cm(name, data) {
    game_log("Received a code message from: " + name);
}

function on_disappear(entity, data) {
    // game_log("disappear: "+entity.id+" "+JSON.stringify(data));
}

function on_party_invite(name) // called by the inviter's name
{
    // accept_party_invite(name)
}

function on_party_request(name) // called by the inviter's name - request = someone requesting to join your existing party
{
    // accept_party_request(name)
}

function on_magiport(name) // called by the mage's name in PVE servers, in PVP servers magiport either succeeds or fails without consent
{
    // accept_magiport(name)
}

function on_map_click(x, y) {
    // if true is returned, the default move is cancelled
    // xmove(x,y);
    // return true;
}

function on_destroy() // called just before the CODE is destroyed
{
    clear_drawings();
    clear_buttons();
}

function on_draw() // the game calls this function at the best place in each game draw frame, so if you are playing the game at 60fps, this function gets called 60 times per second
{

}

function on_game_event(event) {
    if (event.name == "pinkgoo") {
        // start searching for the "Love Goo" of the Valentine's Day event
    }
    if (event.name == "goblin") {
        // start searching for the "Sneaky Goblin"
    }
}

//var PIXI=parent.PIXI; // for drawing stuff into the game
//var drawings=parent.drawings;
//var buttons=parent.code_buttons;

//Documentation: https://pixijs.github.io/docs/PIXI.Graphics.html
function draw_line(x, y, x2, y2, size, color) {
}

// Example: draw_circle(character.real_x,character.real_y,character.range) :) [22/10/16]
function draw_circle(x, y, radius, size, color) {
}

function clear_drawings() {
}

function add_top_button(id, value, fn) {
}

function add_bottom_button(id, value, fn) {
}

function set_button_value(id, value) {
}

function set_button_color(id, color) {
}

function set_button_onclick(id, fn) {
    buttons[id].fn = fn;
}

function clear_buttons() {
}

character.listeners = [];
character.all = function (f) {
    var def = {f: f, id: randomStr(30), event: "all"};
    character.listeners.push(def);
    return def.id;
};
character.one = function (event, f) { // gets overwritten if another handler comes along
    var def = {f: f, id: randomStr(30), event: event, one: true};
    character.listeners.push(def);
    return def.id;
};
character.on = function (event, f) {
    var def = {f: f, id: randomStr(30), event: event}, handled = false;
    for (var i = 0; i < character.listeners.length; i++)
        if (character.listeners[i].one && character.listeners[i].event == event)
            character.listeners[i] = def, handled = true;
    if (!handled) character.listeners.push(def);
    return def.id;
};
character.trigger = function (event, args) {
    var to_delete = [];
    for (var i = 0; i < character.listeners.length; i++) {
        var l = character.listeners[i];
        if (l.event == event || l.event == "all") {
            try {
                if (l.event == "all") l.f(event, args)
                else l.f(args, event);
            } catch (e) {
                game_log("Listener Exception (" + l.event + ") " + e, colors.code_error);
            }
            if (l.once || l.f && l.f.delete) to_delete.push(l.id);
        }
    }
    // game_log(to_delete);
};

game.listeners = [];
game.all = function (f) {
    var def = {f: f, id: randomStr(30), event: "all"};
    game.listeners.push(def);
    return def.id;
};
game.on = function (event, f) {
    var def = {f: f, id: randomStr(30), event: event};
    game.listeners.push(def);
    return def.id;
};
game.once = function (event, f) {
    var def = {f: f, id: randomStr(30), event: event, once: true};
    game.listeners.push(def);
    return def.id;
};
game.remove = function (id) {
    for (var i = 0; i < game.listeners.length; i++) {
        if (game.listeners[i].id == id) {
            game.listeners.splice(i, 1);
            break;
        }
    }
};
game.trigger = function (event, args) {
    var to_delete = [];
    for (var i = 0; i < game.listeners.length; i++) {
        var l = game.listeners[i];
        if (l.event == event || l.event == "all") {
            try {
                if (l.event == "all") l.f(event, args)
                else l.f(args, event);
            } catch (e) {
                game_log("Listener Exception (" + l.event + ") " + e, colors.code_error);
            }
            if (l.once || l.f && l.f.delete) to_delete.push(l.id);
        }
    }
    // game_log(to_delete);
};

function trigger_character_event(name, data) {
    character.trigger(name, data);
}

function trigger_event(name, data) {
    game.trigger(name, data);
}

function preview_item(def, args) {
}

function set_skillbar() // example: set_skillbar("1","2","3","4","R") or set_skillbar(["1","2","3","4","R"])
{
}

function set_keymap(keymap) // example: {"1":{"name":"use_mp"},"2":{"name":"use_hp"}}
{
}

function map_key(key, skill, code) // example: map_key("1","use_hp") or map_key("2","snippet","say('OMG')") or map_key("1","esc") or map_key("ESC","up")
{
}

function unmap_key(key) {
}

function reset_mappings() {
}

function send_local_cm(name, data) {
}

function is_character_local(name) {
}

function pset(name, value) {
    // on Web, window.localStorage is used, on Steam/Mac, the electron-store package is used for persistent storage
    return parent.storage_set(name, value);
}

function pget(name) {
    // on Web, window.localStorage is used, on Steam/Mac, the electron-store package is used for persistent storage
    return parent.storage_get(name);
}

function load_code(name, onerror) // onerror can be a function that will be executed if load_code fails
{
    console.log("Loading code '" + name + "'");
    var res = request('GET', "http://adventure.land/code.js?name=" + encodeURIComponent(name) + "&timestamp=" + (new Date().getTime()), {
        'headers': {
            'user-agent': "AdventureLandBot: (v1.0.0)",
            'cookie': "auth=" + parent.game.httpWrapper.sessionCookie
        }
    });

    try {
        (1, eval)(res.getBody("utf8"));
    } catch (error) {
        (onerror || function () {
            console.log(error)
        })(error);
    }

}

var smart = {
    moving: false,
    map: "main", x: 0, y: 0,
    on_done: function () {
    },
    plot: null,
    edge: 20, // getting 20px close to the target is enough
    baby_edge: 80, // start treading lightly when 60px close to the target or starting point
    try_exact_spot: false,
    use_town: false,
    prune: {
        smooth: true,
        map: true,
    },
    flags: {}
};

function smart_move(destination, on_done) // despite the name, smart_move isn't very smart or efficient, it's up to the players to implement a better movement method [05/02/17]
{
    smart.map = "";
    if (is_string(destination)) destination = {to: destination};
    if (is_number(destination)) destination = {x: destination, y: on_done}, on_done = null;
    if ("x" in destination) {
        smart.map = destination.map || character.map;
        smart.x = destination.x;
        smart.y = destination.y;
    } else if ("to" in destination || "map" in destination) {
        if (destination.to == "town") destination.to = "main";
        if (G.monsters[destination.to]) {
            for (var name in G.maps)
                (G.maps[name].monsters || []).forEach(function (pack) {
                    if (pack.type != destination.to || G.maps[name].ignore || G.maps[name].instance) return;
                    if (pack.boundaries) // boundaries: for phoenix, mvampire
                    {
                        pack.last = pack.last || 0;
                        var boundary = pack.boundaries[pack.last % pack.boundaries.length];
                        pack.last++;
                        smart.map = boundary[0];
                        smart.x = (boundary[1] + boundary[3]) / 2;
                        smart.y = (boundary[2] + boundary[4]) / 2;
                    } else if (pack.boundary) {
                        var boundary = pack.boundary;
                        smart.map = name;
                        smart.x = (boundary[0] + boundary[2]) / 2;
                        smart.y = (boundary[1] + boundary[3]) / 2;
                    }
                });
        } else if (G.maps[destination.to || destination.map]) {
            smart.map = destination.to || destination.map;
            smart.x = G.maps[smart.map].spawns[0][0];
            smart.y = G.maps[smart.map].spawns[0][1];
        } else if (destination.to == "upgrade" || destination.to == "compound") smart.map = "main", smart.x = -204, smart.y = -129;
        else if (destination.to == "exchange") smart.map = "main", smart.x = -26, smart.y = -432;
        else if (destination.to == "potions" && character.map == "halloween") smart.map = "halloween", smart.x = 149, smart.y = -182;
        else if (destination.to == "potions" && in_arr(character.map, ["winterland", "winter_inn", "winter_cave"])) smart.map = "winter_inn", smart.x = -84, smart.y = -173;
        else if (destination.to == "potions") smart.map = "main", smart.x = 56, smart.y = -122;
        else if (destination.to == "scrolls") smart.map = "main", smart.x = -465, smart.y = -71;
    }
    if (!smart.map) {
        game_log("Unrecognized", "#CF5B5B");
        return;
    }
    smart.moving = true;
    smart.plot = [];
    smart.flags = {};
    smart.searching = smart.found = false;
    if (destination.return) {
        var cx = character.real_x, cy = character.real_y, cmap = character.map;
        smart.on_done = function () {
            if (on_done) on_done();
            smart_move({map: cmap, x: cx, y: cy});
        }
    } else smart.on_done = on_done || function () {
    };
    console.log(smart.map + " " + smart.x + " " + smart.y);
}

function stop(action) {
    if (!action || action == "move") {
        if (smart.moving) smart.on_done(false);
        smart.moving = false;
        move(character.real_x, character.real_y);
    } else if (action == "invis") {
        parent.socket.emit("stop", {action: "invis"});
    } else if (action == "teleport" || action == "town") {
        parent.socket.emit("stop", {action: "town"});
    } else if (action == "revival") {
        parent.socket.emit("stop", {action: "revival"});
    }
}

var queue = [], visited = {}, start = 0, best = null;
var moves = [[0, 15], [0, -15], [15, 0], [-15, 0]];
var baby_steps = [[0, 5], [0, -5], [5, 0], [-5, 0]];

// baby_steps is a new logic, used just around the target or starting point, to get out of tough spots [08/03/19]

function plot(index) {
    if (index == -1) return;
    plot(queue[index].i); // Recursively back-tracks the path we came from
    smart.plot.push(queue[index]);
}

function qpush(node) {
    // If we haven't visited this location, adds the location to the queue
    if (smart.prune.map && smart.flags.map && node.map != smart.map) return;
    if (visited[node.map + "-" + node.x + "-" + node.y]) return;
    if (!node.i) node.i = start; // set the index, to aid the plot function
    queue.push(node);
    visited[node.map + "-" + node.x + "-" + node.y] = true;
}

function smooth_path() {
    var i = 0, j;
    while (i < smart.plot.length) {
        // Assume the path ahead is [i] [i+1] [i+2] - This routine checks whether [i+1] could be skipped
        // The resulting path is smooth rather than rectangular and bumpy
        // Try adding "function smooth_path(){}" or "smart.prune.smooth=false;" to your Code
        // [06/07/18]: (!smart.plot[i+2] || !smart.plot[i+2].transport) - without this condition, in "winterland", move(-160,-660), smart_move("main") fails
        while (i + 2 < smart.plot.length && smart.plot[i].map == smart.plot[i + 1].map && smart.plot[i].map == smart.plot[i + 1].map && (!smart.plot[i + 2] || !smart.plot[i + 2].transport) &&
        can_move({
            map: smart.plot[i].map,
            x: smart.plot[i].x,
            y: smart.plot[i].y,
            going_x: smart.plot[i + 2].x,
            going_y: smart.plot[i + 2].y,
            base: character.base
        }))
            smart.plot.splice(i + 1, 1);
        i++;
    }
}

function bfs() {
    var timer = new Date(), result = null, optimal = true;

    while (start < queue.length) {
        var current = queue[start];
        var map = G.maps[current.map];
        var c_moves = moves;
        if (current.map == smart.map) {
            var c_dist = abs(current.x - smart.x) + abs(current.y - smart.y);
            var s_dist = abs(current.x - smart.start_x) + abs(current.y - smart.start_y);
            smart.flags.map = true;
            if (c_dist < smart.baby_edge || s_dist < smart.baby_edge) c_moves = baby_steps;
            if (c_dist < smart.edge) {
                result = start;
                break;
            } else if (best === null || abs(current.x - smart.x) + abs(current.y - smart.y) < abs(queue[best].x - smart.x) + abs(queue[best].y - smart.y)) {
                best = start;
            }
        } else if (current.map != smart.map) {
            if (smart.prune.map && smart.flags.map) {
                start++;
                continue;
            }
            map.doors.forEach(function (door) {
                // if(simple_distance({x:map.spawns[door[6]][0],y:map.spawns[door[6]][1]},{x:current.x,y:current.y})<30)
                if (is_door_close(current.map, door, current.x, current.y) && can_use_door(current.map, door, current.x, current.y))
                    qpush({
                        map: door[4],
                        x: G.maps[door[4]].spawns[door[5] || 0][0],
                        y: G.maps[door[4]].spawns[door[5] || 0][1],
                        transport: true,
                        s: door[5] || 0
                    });
            });
            map.npcs.forEach(function (npc) {
                if (npc.id == "transporter" && simple_distance({x: npc.position[0], y: npc.position[1]}, {
                    x: current.x,
                    y: current.y
                }) < 75) {
                    for (var place in G.npcs.transporter.places) {
                        qpush({
                            map: place,
                            x: G.maps[place].spawns[G.npcs.transporter.places[place]][0],
                            y: G.maps[place].spawns[G.npcs.transporter.places[place]][1],
                            transport: true,
                            s: G.npcs.transporter.places[place]
                        });
                    }
                }
            });
        }

        if (smart.use_town) qpush({map: current.map, x: map.spawns[0][0], y: map.spawns[0][1], town: true}); // "town"

        shuffle(c_moves);
        c_moves.forEach(function (m) {
            var new_x = current.x + m[0], new_y = current.y + m[1];
            // game_log(new_x+" "+new_y);
            // utilise can_move - game itself uses can_move too - smart_move is slow as can_move checks all the lines at each step
            if (can_move({
                map: current.map,
                x: current.x,
                y: current.y,
                going_x: new_x,
                going_y: new_y,
                base: character.base
            }))
                qpush({map: current.map, x: new_x, y: new_y});
        });

        start++;
    }

    if (result === null) result = best, optimal = false;
    if (result === null) {
        game_log("Path not found!", "#CF575F");
        smart.moving = false;
        smart.on_done(false);
    } else {
        plot(result);
        if (1) // [08/03/19] - to attempt and move to the actual coordinates
        {
            var last = smart.plot[smart.plot.length - 1];
            if (!last) last = {map: character.map, x: character.real_x, y: character.real_y};
            if (smart.x != last.x || smart.y != last.y) {
                smart.try_exact_spot = true;
                smart.plot.push({map: last.map, x: smart.x, y: smart.y});
            }
        }
        smart.found = true;
        if (smart.prune.smooth) smooth_path();
        if (optimal) game_log("Path found!", "#C882D1");
        else game_log("Path found~", "#C882D1");
        // game_log(queue.length);
    }
}

function start_pathfinding() {
    smart.try_exact_spot = false;
    smart.searching = true;
    smart.start_x = character.real_x;
    smart.start_y = character.real_y;
    queue = [], visited = {}, start = 0, best = null;
    qpush({x: character.real_x, y: character.real_y, map: character.map, i: -1});
    game_log("Searching for a path...", "#89D4A2");
    bfs();
}

function continue_pathfinding() {
    setTimeout(bfs, 5);
}

function smart_move_logic() {
    if (!smart.moving) return;
    if (!smart.searching && !smart.found) {
        start_pathfinding();
    } else if (!smart.found) {
        if (Math.random() < 0.1) {
            move(character.real_x + Math.random() * 0.0002 - 0.0001, character.real_y + Math.random() * 0.0002 - 0.0001);
        }
        continue_pathfinding();
    } else if (!character.moving && can_walk(character) && !is_transporting(character)) {
        if (!smart.plot.length) {
            smart.moving = false;
            smart.on_done(true);
            return;
        }
        var current = smart.plot[0];
        smart.plot.splice(0, 1);
        // game_log(JSON.stringify(current));
        if (current.town) {
            use("town");
        } else if (current.transport) {
            parent.socket.emit("transport", {to: current.map, s: current.s});
            // use("transporter",current.map);
        } else if (character.map == current.map && (smart.try_exact_spot && !smart.plot.length || can_move_to(current.x, current.y))) {
            // game_log("S "+current.x+" "+current.y);
            move(current.x, current.y);
        } else {
            game_log("Lost the path...", "#CF5B5B");
            smart_move({map: smart.map, x: smart.x, y: smart.y}, smart.on_done);
        }
    }
}

setInterval(function () {
    smart_move_logic();
}, 80);

function proxy(name) {
    if (in_arr(name, character.properties)) return;
    character.properties.push(name);
    Object.defineProperty(character, name, {
        get: function () {
            return parent.character[name];
        },
        set: function (value) {
            delete this[name];
            if (character.read_only.includes(name)) {
                game_log("You attempted to change the character." + name + " value manually. You have to use the provided functions to control your character!", colors.code_error);
            } else {
                parent.character[name] = value;
            }
        },
        enumerable: true,
    });
}

character.read_only.push(...["on", "once"]);
["bank", "user", "code", "angle", "direction", "target", "from_x", "from_y", "going_x", "going_y", "moving", "vx", "vy", "move_num"].forEach(function (p) {
    proxy(p)
});

function eval_s(code) // this is how snippets are eval'ed if they include "output="/"json_output=" - so if they include these, the scope of eval isn't global - doesn't matter much [13/07/18]
{
    eval(code);
}

function performance_trick() {
    // Just plays an empty sound file, so browsers don't throttle JS, only way to prevent it, interesting cheat [05/07/18]
}

//safety flags
var last_loot = new Date(0);
var last_attack = new Date(0);
var last_potion = new Date(0);
var last_transport = new Date(0);