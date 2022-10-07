import {Profile} from '.';
import axios from 'axios';
import {client, connection, Message} from 'websocket';
import {appendFileSync, writeFileSync, readFileSync} from 'fs';

const IMITATE_HUMAN = false;

const WebSocketClient = client;

const TIME = new Date().getTime();

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

    /**
     * @param {string} message The message to send
     */
    log(message) {
        const t = new Date().getHours().toString().padStart(2, '0') + ':' +
                new Date().getMinutes().toString().padStart(2, '0') + ':' +
                new Date().getSeconds().toString().padStart(2, '0') + '.' +
                new Date().getMilliseconds().toString().padStart(3, '0');
        appendFileSync(`../logs/${TIME}-${this.game}.log`, `[${t}] ${message}\n`);
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
                if (op === 42) this.op42(json);
                if (op === 430) this.op430(json);
            });
        });

        this.socket.connect(url);
    }

    /** @param {number} op The opcode to send @param {(string | number)[]} data The data to send  */
    send(op: number, ...data: Array<unknown> | undefined) {
        this.bot.log(`↑1 ${op.toString()}${data.length > 0 ? JSON.stringify(data) : ''}`);
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
            nickname: 'Iridium',
            language: 'en-US',
        });

        data;
    }

    /** @param {object} data */
    op42(data) {
        if (data[0] === 'chat') {
            // @TODO Process commands
            const [peer, message] = data.slice(1);
            console.log(message);

            if (message.startsWith('.')) {
                const [command, ...arg] = message.substring(1).split(' ');
                const args: {[key: string]: string} = {}; const flags: string[] = [];

                if (arg && arg.length > 0) {
                    for (let i = 0; i < arg.length; i++) {
                        if (arg[i] === '') arg.splice(i, 1);

                        if (arg[i].startsWith('--')) {
                            flags.push(args[i].substring(2));
                            arg.splice(i, 1);
                        } else if (arg[i].startsWith('-') && arg[i].length > 1 && i !== arg.length - 1) {
                            args[arg[i].substring(1)] = arg[i + 1];
                        }
                    }
                }

                if (command === 'ping') {
                    this.send(42, 'chat', `Pong! ${peer.nickname}`);
                }

                if (command === 'c') {
                    console.log(args, flags);

                    const syl = args.s ? args.s.toLowerCase() : this.bot.gameSocket.syllable;
                    let valid = findWord(syl, words).sort(() => .5 - Math.random()).map((val) => val.toUpperCase());

                    if (!syl) {
                        this.send(42, 'chat', 'No syllable provided!');
                        return;
                    }
                    if (args.sort === 'length') valid = valid.sort((a, b) => b.length - a.length);
                    if (args.sort === 'alphabetical') valid = valid.sort((a, b) => a.localeCompare(b));

                    this.send(42, 'chat', `Words for ${syl.toUpperCase()}: ${valid.slice(0, 10).join(', ')}`.substring(0, 300));
                }
            }
        }
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

    bonus: string[] = 'abcdefghijklmnopqrstuvwy'.split('');
    mybonusletters: string [] = 'abcdefghijklmnopqrstuvwy'.split('');

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
                bot.log(`↓2 ${opcode}${data}`);

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
        this.bot.log(`↑2 ${op.toString()}${data.length > 0 ? JSON.stringify(data) : ''}`);
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
        if (data[0] === 'clearUsedWords') {
            this.currentWords = words.slice();
        }

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
            const {name, currentPlayerPeerId, syllable} = data[1];
            if (name === 'seating') {
                this.send(42, 'joinRound');
                this.currentWords = words.slice();
            }

            if (name === 'round' && currentPlayerPeerId === this.peerId) {
                this.syllable = syllable;
                this.submit();
            }
        }

        if (data[0] === 'correctWord') {
            const {playerPeerId, bonusLetters} = data[1];

            this.currentWords = this.currentWords.filter((word) => word !== this.lastSeenWords[playerPeerId].replace(/[^a-zA-Z-]/g, ''));

            if (!words.includes(this.lastSeenWords[playerPeerId].replace(/[^a-zA-Z-]/g, ''))) {
                console.log(`[!] New word: ${this.lastSeenWords[playerPeerId]}`);
                words.push(this.lastSeenWords[playerPeerId]);

                appendFileSync('../assets/words.txt', `\n${this.lastSeenWords[playerPeerId].replace(/[^a-zA-Z-]/g, '')}`);
            }

            if (playerPeerId === this.peerId) this.mybonusletters = this.bonus.filter((letter) => !bonusLetters.includes(letter));
        }

        if (data[0] === 'failWord') {
            const [peer, reason] = data.slice(1);

            if (reason === 'alreadyUsed') {
                console.log('[!]', this.lastSeenWords[peer].replace(/[^a-zA-Z-]/g, ''), 'was already used');
                this.currentWords = this.currentWords.filter((word) => word !== this.lastSeenWords[peer].replace(/[^a-zA-Z-]/g, ''));
                console.log(this.currentWords.includes(this.lastSeenWords[peer].replace(/[^a-zA-Z-]/g, '')));
            }

            if (reason === 'notInDictionary' && peer === this.peerId) {
                console.log('[!]', this.lastSeenWords[peer].replace(/[^a-zA-Z-]/g, ''), 'is not in the dictionary');
                this.currentWords = this.currentWords.filter((word) => word !== this.lastSeenWords[peer].replace(/[^a-zA-Z-]/g, ''));

                const w = readFileSync('../assets/words.txt', 'utf-8').split('\n').filter((word) => word !== this.lastSeenWords[peer]).map((word) => word.toLowerCase()).join('\n');
                writeFileSync('../assets/words.txt', w);
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

            // const mapped = findWord(syllable, words).map((word) => word.toUpperCase()).slice(0, 10);
            // this.bot.mainSocket.send(42, 'chat', `Words for ${this.syllable}: ${mapped.join(', ')}`);
        }
    }

    /** */
    async submit() {
        const words: string[] = findWord(this.syllable, this.currentWords);

        let max = 0;
        let maxCandidate = [];

        for (const word of words) {
            let score = word.length;
            this.mybonusletters.forEach((letter) => {
                if (word.includes(letter)) score += 5;
            });

            if (score > max) {
                max = score;
                maxCandidate = [word];
            } else if (score === max) {
                maxCandidate.push(word);
            }
        }

        if (maxCandidate.length === 0) {
            this.bot.mainSocket.send(42, 'chat', `No words for ${this.syllable}`);
            this.send(42, 'setWord', '💥', true);

            return;
        }

        const chosenWord = maxCandidate[Math.floor(Math.random() * maxCandidate.length)];

        if (IMITATE_HUMAN) {
            await sleep(200);

            for (let i = 0; i < chosenWord.length; i++) {
                this.send(42, 'setWord', chosenWord.substring(0, i + 1), false);
                await sleep(Math.random() * 20 + 65);
            }

            await sleep(Math.random() * 20 + 40);
        }

        this.send(42, 'setWord', chosenWord, true);
    }
}

/**
 * Finds words that contain a syllable
 * @param {string} syllable The syllable to search for
 * @param {string[]} currentWords The words to search in
 * @return {string[]} The words that start with the syllable
 */
function findWord(syllable, currentWords): string[] {
    return currentWords.filter((word) => word.includes(syllable));
}
