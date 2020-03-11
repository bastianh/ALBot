# ALBot

## Installation Debian 8
1. Update system
    ```
    sudo apt update
    sudo apt upgrade
    ```
2. Install packages
    ```
    sudo apt install git nano screen curl
    ```
3. Install nvm
    ```
    curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash
    ```
4. Use nvm to install node 7.9.0
    ```
    nvm install 7.9.0
    ```
5. Download ALBot
    ```
    git clone https://github.com/NexusNull/ALBot.git
    ```
6. Install package dependencies
    ```
    cd ALBot
    npm install 
    ```
7. Rename copy config file and enter credentials. If you don't know how refer to Section [Understanding userdata.json](#Understanding-userdata.json) 
    ```
    cp userdata.json-example userdata.json
    nano userdata.json
    ```
8. Run the bot once with
    ```
    node main
    ```
    The bot will then try to login to your account and save your character ids to userdata.json
9. Open userdata.json again and delete all the character objects you don't want to run.
Currently there is no client side check for character limitations, if you forget this your bot will keep disconnecting.

10. Congratulations you now have a working copy of ALBot, if you experience unexpected behavior please raise an issue.

## Installation Windows
#TODO

## Understanding userdata.json
Rename `userData.json-example` to `userData.json`, and change the data to your own.


### Config 
With on going updates the properties of config are becoming more and more complex so I want to take some time to explain them in detail here.

#### fetch
The fetch property sets the bot up in a way that it will discard any existing data about characters and then try to fetch them from the server. This is set to true when ever you recieve a fresh copy of ALBot simply because ALBot needs to get this information first before anything else can be done. The fetched data is then put into the the `"bots"` array ready for editing.

#### botKey
An old property used for testing in different envirmoments, as of late it is no longer in use and can be removed.

#### botWebInterface
Bot-web-interface or BWI is another module that I developed which displays data in a neat format.
Granted it doesn't look as fancy as I would like it to but it does it's job. BWI offers a simple to setup web interface that can display all kinds of data, ALBot uses it to display basic information about the running chracters.

![Screenshot](http://pwellershaus.com/uploads/original/2624373efc03b0dc3de8ea1594601dac.png)

As you can see it contains the name and level but also TLU which stands for 'time to level up', besides that the rest should be self explenatory.  

BWI can be enabled/disabled by setting the start property, by default this is set to false. One thing to note is that BWI uses 2 consecutive ports meaning with you want to expose BWI to the internet by port forwarding you will have to port forward the port listed here and one higher. If need be I can change that behaviour but as long as nobody complains it's staying that way.
If you do decide to open BWI to the internet that is still the option to protect it with a password so only you can access it. Such a setup can be usefull if you have it running on a server but want to check up on it from work.

First a word of caution, the mini map is a nice little feature that has been added recently and is still not as polished as I want it to be. The way the mini map is implemented is very hacky, it works by sending data url converted PNG images to the client, high frame rates can cause many issues such as high cpu usage on the server side and GPU crashes on the client side. I recommend a frame rate of 1.

If you want to enable the mini map set enable to true. The speed property determines the interval in which images are generated and send to the client, you can make it faster by decreasing the speed value.
Size controls the resolution of the generated image.



```code
{
    "config": {
        "fetch": true,
        "botKey": 1,
        "botWebInterface": {
            "start": false,
            "port": 2080,
            "password": "",
            "minimap": {
                "enable": false,
                "speed": 1000,
                "size": {
                    "height": 200,
                    "width": 376
                }
            }
        }
    },
    "login": {
        "email": "random@example.com",
        "password": "password123456"
    },
    "bots": []
}
```





If you have questions and/or suggestions please refer to [repo](https://github.com/NexusNull/bot-web-interface).
If fetch is set to true it will fetch your character data on the next run. This means previous entries in bots will be overwritten.

By default the bot will connect to the server, fetch the data for all available characters and then close again.
After the fetch is complete, you can edit the CODE script that is run for each character and the server it should connect to.

The character name is irrelevant when running ALBot. The bot will use the character id to identify the character and only refer to its name if the id is missing.
    The `runScript` entry must contain a relative path to the script that should be run for the character. `server` is the server name the character should connect to, the possible servers are "US I", "US PVP".
    There used to be more but sadly they were taken down.


## Running your own code
The default code located at `./CODE/default.js`, the runScript entry in `userData.json` corresponds with the name of the script that should be run for the character. The environment is fundamentally the same as a browser with some exceptions, for example references to window, document, and PIXI are not supported.  Every character can run a different file, the default.js script will send characters to farm tiny crabs on the main beach.

## Differences to the original runner

### game_log
log messages are send as the game event `game_log` with data `{message: <text>}` to reduce spam to the console

### game.platform
this value is usually `electron` for Steam, Mac clients, `web` for https://adventure.land. When running code in ALBot it is set to `albot`

## Contributing
Feel free to make contributions, they are always welcome!

