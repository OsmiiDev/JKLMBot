import {readFileSync} from 'fs';
import {Profile} from '.';
import axios from 'axios';
import {client, connection, Message} from 'websocket';

const WebSocketClient = client;

export const words = readFileSync('../assets/words.txt').toString().split('\n').map((word: string) => word.toLowerCase());

/**
 * @param {number} ms The number of milliseconds to wait
 * @return {Promise<void>} A promise that resolves after the specified number of milliseconds
 */
function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One instance of the JKLM bot
 */
export class BotInstance {
    mainSocket: MainSocket;
    gameSocket: GameSocket;

    game: string;
    profile: Profile;

    language: 'English' | 'Spanish';

    /**
     * Initializes the game
     * @param {string} gameId The ID of the game to join
     */
    constructor(gameId: string) {
        console.info(`Attempting to join room at https://jklm.fun/${gameId}`);
        this.game = gameId;
        this.profile = new Profile();

        (async () => {
            await axios.get(`https://jklm.fun/${gameId}`);
            const response = await axios.post('https://jklm.fun/api/joinRoom', {
                roomCode: gameId,
            });

            let bird = '';
            if (response.data.url.includes('phoenix')) bird = 'phoenix';
            else if (response.data.url.includes('falcon')) bird = 'falcon';


            console.info(`Attempting to connect to primary websocket for https://jklm.fun/${gameId}`);
            this.mainSocket = new MainSocket(`wss://${bird}.jklm.fun/socket.io/?EIO=4&transport=websocket`, this);

            await sleep(1000);
            console.info(`Attempting to connect to game websocket for https://jklm.fun/${gameId}`);
            this.gameSocket = new GameSocket(`wss://${bird}.jklm.fun/socket.io/?EIO=4&transport=websocket`, this);
        })();
    }
}


/**
 * Functions to handle packets from the main socket
 */
export class MainSocket {
    socket: client | null;
    socketClient: connection;

    bot: BotInstance;

    profile: Profile;
    game: string;

    /**
     * Constructor
     * @param {string} url The URL to connect to
     * @param {BotInstance} bot The bot instance
     */
    constructor(url: string, bot: BotInstance) {
        this.game = bot.game;
        this.profile = bot.profile;
        this.bot = bot;

        this.socket = new WebSocketClient();
        this.socket.on('connect', (socketClient: connection) => {
            this.socketClient = socketClient;
            socketClient.on('message', (message: Message) => {
                if (!('utf8Data' in message)) return;

                const [opcode, data] = message.utf8Data.match(/(\d+)(.*)/).slice(1);
                // console.log('↓1', `${opcode}${data}`);

                const op = Number(opcode);
                const json = data ? JSON.parse(`${data}`) : {};

                if (op === 0) this.op0(json);
                if (op === 2) this.op2(json);
                if (op === 40) this.op40(json);
                if (op === 430) this.op430(json);
            });
        });

        this.socket.connect(url);
    }

    /** @param {number} op The opcode to send @param {(string | number)[]} data The data to send  */
    send(op: number, ...data: Array<unknown> | undefined) {
        console.log(`↑1 ${op.toString()}${data.length > 0 ? JSON.stringify(data) : ''}`);
        this.socketClient.send(`${op.toString()}${data && data.length > 0 ? JSON.stringify(data) : ''}`);
    }

    /** @param {object} data */
    op0(data) {
        this.send(40);

        data;
    }

    /** @param {object} data */
    op2(data) {
        this.send(3);

        data;
    }

    /** @param {object} data */
    async op40(data) {
        this.send(420, 'joinRoom', {
            roomCode: this.game,
            userToken: this.profile.getToken(),
            nickname: 'Osmii',
            picture: readFileSync('../assets/profile.txt').toString(),
            language: 'en-US',
        });

        data;
    }

    /** @param {object} data */
    op430(data) {
        this.bot.language = data[0]?.roomEntry?.details;
    }
}

/**
 * Functions to handle packets from the game socket
 */
export class GameSocket {
    socket: client | null;
    socketClient: connection;

    bot: BotInstance;

    profile: Profile;
    game: string;

    peerId: number;
    lastSeenWords: {[key: string]: string} = {};

    currentWords: string[] = words.slice();

    syllable: string;

    /**
     * Constructor
     * @param {string} url The URL to connect to
     * @param {BotInstance} bot The bot instance
    */
    constructor(url: string, bot: BotInstance) {
        this.game = bot.game;
        this.profile = bot.profile;
        this.bot = bot;
        this.socket = new WebSocketClient();

        this.socket.on('connect', (socketClient: connection) => {
            this.socketClient = socketClient;

            socketClient.on('message', (message) => {
                if (!('utf8Data' in message)) return;

                const [opcode, data] = message.utf8Data.match(/(\d+)(.*)/).slice(1);
                console.log('↓2', `${opcode}${data}`);

                const op = Number(opcode);
                const json = data ? JSON.parse(`${data}`) : {};

                if (op === 0) this.op0(json);
                if (op === 2) this.op2(json);
                if (op === 40) this.op40(json);
                if (op === 42) this.op42(json);
            });
        });

        this.socket.connect(url);
    }

    /** @param {number} op The opcode to send @param {(string | number)[]} data The data to send  */
    send(op: number, ...data: Array<unknown> | undefined) {
        console.log(`↑2 ${op.toString()}${data.length > 0 ? JSON.stringify(data) : ''}`);
        this.socketClient.send(`${op.toString()}${data.length > 0 ? JSON.stringify(data) : ''}`);
    }

    /** @param {object} data */
    op0(data) {
        this.send(40);

        data;
    }

    /** @param {object} data */
    op2(data) {
        this.send(3);

        data;
    }

    /** @param {object} data */
    op40(data) {
        this.send(42, 'joinGame', 'bombparty', this.game, this.profile.getToken());

        data;
    }

    /** @param {object} data */
    op42(data) {
        if (data[0] === 'setup') {
            const {milestone, selfPeerId} = data[1];
            this.peerId = selfPeerId;

            if (milestone.name === 'seating') {
                this.send(42, 'joinRound');
                this.currentWords = words.slice();
            }
        }

        if (data[0] === 'setPlayerWord') {
            const [peer, word] = data.slice(1);
            this.lastSeenWords[peer] = word;
        }

        if (data[0] === 'setMilestone') {
            const {name, currentPlayerPeerId} = data[1];
            if (name === 'seating') {
                this.send(42, 'joinRound');
                this.currentWords = words.slice();
            }

            if (name === 'round' && currentPlayerPeerId === this.peerId) {
                this.submit();
            }
        }

        if (data[0] === 'correctWord') {
            const {playerPeerId} = data[1];

            if (!words.includes(this.lastSeenWords[playerPeerId].replace(/[^a-zA-Z-]/g, ''))) {
                console.log(`[!] New word: ${this.lastSeenWords[playerPeerId]}`);
                words.push(this.lastSeenWords[playerPeerId]);
            }
        }

        if (data[0] === 'failWord') {
            const [peer, reason] = data.slice(1);

            if (reason === 'alreadyUsed') {
                this.currentWords = this.currentWords.filter((word) => word !== this.lastSeenWords[peer]);
            }

            if (peer === this.peerId) {
                this.submit();
            }
        }

        if (data[0] === 'nextTurn') {
            const [peer, syllable] = data.slice(1);
            this.syllable = syllable;

            if (peer === this.peerId) {
                this.submit();
            }
        }
    }

    /** */
    async submit() {
        const words: string[] = findWord(this.syllable);

        const chosenWord = words[Math.floor(Math.random() * words.length)];
        await sleep(200);

        for (let i = 0; i < chosenWord.length; i++) {
            this.send(42, 'setWord', chosenWord.substring(0, i + 1), false);
            await sleep(50);
        }

        this.send(42, 'setWord', chosenWord, true);
    }
}

/**
 * Finds words that contain a syllable
 * @param {string} syllable The syllable to search for
 * @return {string[]} The words that start with the syllable
 */
function findWord(syllable) {
    return words.filter((word) => word.includes(syllable));
}
