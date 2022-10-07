"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameSocket = exports.MainSocket = exports.BotInstance = exports.words = void 0;
const fs_1 = require("fs");
const _1 = require(".");
const axios_1 = __importDefault(require("axios"));
const websocket_1 = require("websocket");
const fs_2 = require("fs");
const WebSocketClient = websocket_1.client;
exports.words = (0, fs_1.readFileSync)('../assets/words.txt').toString().split('\n').map((word) => word.toLowerCase());
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
class BotInstance {
    constructor(gameId) {
        console.info(`Attempting to join room at https://jklm.fun/${gameId}`);
        this.game = gameId;
        this.profile = new _1.Profile();
        (() => __awaiter(this, void 0, void 0, function* () {
            const response = yield axios_1.default.post('https://jklm.fun/api/joinRoom', {
                roomCode: gameId,
            });
            let bird = '';
            if (response.data.url.includes('phoenix'))
                bird = 'phoenix';
            else if (response.data.url.includes('falcon'))
                bird = 'falcon';
            console.info(`Attempting to connect to primary websocket for https://jklm.fun/${gameId}`);
            this.mainSocket = new MainSocket(`wss://${bird}.jklm.fun/socket.io/?EIO=4&transport=websocket`, this);
            yield sleep(1000);
            console.info(`Attempting to connect to game websocket for https://jklm.fun/${gameId}`);
            this.gameSocket = new GameSocket(`wss://${bird}.jklm.fun/socket.io/?EIO=4&transport=websocket`, this);
        }))();
    }
}
exports.BotInstance = BotInstance;
class MainSocket {
    constructor(url, bot) {
        this.game = bot.game;
        this.profile = bot.profile;
        this.bot = bot;
        this.socket = new WebSocketClient();
        this.socket.on('connect', (socketClient) => {
            this.socketClient = socketClient;
            socketClient.on('message', (message) => {
                if (!('utf8Data' in message))
                    return;
                const [opcode, data] = message.utf8Data.match(/(\d+)(.*)/).slice(1);
                const op = Number(opcode);
                const json = data ? JSON.parse(`${data}`) : {};
                if (op === 0)
                    this.op0(json);
                if (op === 2)
                    this.op2(json);
                if (op === 40)
                    this.op40(json);
                if (op === 42)
                    this.op42(json);
                if (op === 430)
                    this.op430(json);
            });
        });
        this.socket.connect(url);
    }
    send(op, ...data) {
        log(`↑1 ${op.toString()}${data.length > 0 ? JSON.stringify(data) : ''}`);
        this.socketClient.send(`${op.toString()}${data && data.length > 0 ? JSON.stringify(data) : ''}`);
    }
    op0(data) {
        this.send(40);
        data;
    }
    op2(data) {
        this.send(3);
        data;
    }
    op40(data) {
        return __awaiter(this, void 0, void 0, function* () {
            this.send(420, 'joinRoom', {
                roomCode: this.game,
                userToken: this.profile.getToken(),
                nickname: 'Iridium',
                language: 'en-US',
            });
            data;
        });
    }
    op42(data) {
        if (data[0] === 'chat') {
            const [peer, message] = data.slice(1);
            console.log(message);
            if (message.startsWith('.')) {
                const [command, ...arg] = message.substring(1).split(' ');
                const args = {};
                const flags = [];
                if (arg && arg.length > 0) {
                    for (let i = 0; i < arg.length; i++) {
                        if (arg[i] === '')
                            arg.splice(i, 1);
                        if (arg[i].startsWith('--')) {
                            flags.push(args[i].substring(2));
                            arg.splice(i, 1);
                        }
                        else if (arg[i].startsWith('-') && arg[i].length > 1 && i !== arg.length - 1) {
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
                    const valid = findWord(syl, exports.words).sort(() => .5 - Math.random()).map((val) => val.toUpperCase());
                    this.send(42, 'chat', `Words for ${syl.toUpperCase()}: ${valid.slice(0, 10).join(', ')}`.substring(0, 300));
                }
            }
        }
    }
    op430(data) {
        var _a, _b;
        this.bot.language = (_b = (_a = data[0]) === null || _a === void 0 ? void 0 : _a.roomEntry) === null || _b === void 0 ? void 0 : _b.details;
    }
}
exports.MainSocket = MainSocket;
class GameSocket {
    constructor(url, bot) {
        this.lastSeenWords = {};
        this.currentWords = exports.words.slice();
        this.bonus = 'abcdefghijklmnopqrstuvwy'.split('');
        this.mybonusletters = 'abcdefghijklmnopqrstuvwy'.split('');
        this.game = bot.game;
        this.profile = bot.profile;
        this.bot = bot;
        this.socket = new WebSocketClient();
        this.socket.on('connect', (socketClient) => {
            this.socketClient = socketClient;
            socketClient.on('message', (message) => {
                if (!('utf8Data' in message))
                    return;
                const [opcode, data] = message.utf8Data.match(/(\d+)(.*)/).slice(1);
                log(`↓2 ${opcode}${data}`);
                const op = Number(opcode);
                const json = data ? JSON.parse(`${data}`) : {};
                if (op === 0)
                    this.op0(json);
                if (op === 2)
                    this.op2(json);
                if (op === 40)
                    this.op40(json);
                if (op === 42)
                    this.op42(json);
            });
        });
        this.socket.connect(url);
    }
    send(op, ...data) {
        log(`↑2 ${op.toString()}${data.length > 0 ? JSON.stringify(data) : ''}`);
        this.socketClient.send(`${op.toString()}${data.length > 0 ? JSON.stringify(data) : ''}`);
    }
    op0(data) {
        this.send(40);
        data;
    }
    op2(data) {
        this.send(3);
        data;
    }
    op40(data) {
        this.send(42, 'joinGame', 'bombparty', this.game, this.profile.getToken());
        data;
    }
    op42(data) {
        if (data[0] === 'setup') {
            const { milestone, selfPeerId } = data[1];
            this.peerId = selfPeerId;
            if (milestone.name === 'seating') {
                this.send(42, 'joinRound');
                this.currentWords = exports.words.slice();
            }
        }
        if (data[0] === 'setPlayerWord') {
            const [peer, word] = data.slice(1);
            this.lastSeenWords[peer] = word;
        }
        if (data[0] === 'setMilestone') {
            const { name, currentPlayerPeerId, syllable } = data[1];
            if (name === 'seating') {
                this.send(42, 'joinRound');
                this.currentWords = exports.words.slice();
            }
            if (name === 'round' && currentPlayerPeerId === this.peerId) {
                this.syllable = syllable;
                this.submit();
            }
        }
        if (data[0] === 'correctWord') {
            const { playerPeerId, bonusLetters } = data[1];
            if (!exports.words.includes(this.lastSeenWords[playerPeerId].replace(/[^a-zA-Z-]/g, ''))) {
                console.log(`[!] New word: ${this.lastSeenWords[playerPeerId]}`);
                exports.words.push(this.lastSeenWords[playerPeerId]);
                (0, fs_2.appendFileSync)('../assets/words.txt', `\n${this.lastSeenWords[playerPeerId]}`);
            }
            if (playerPeerId === this.peerId)
                this.mybonusletters = this.bonus.filter((letter) => !bonusLetters.includes(letter));
        }
        if (data[0] === 'failWord') {
            const [peer, reason] = data.slice(1);
            if (reason === 'alreadyUsed') {
                console.log(this.lastSeenWords[peer], 'was already used');
                this.currentWords = this.currentWords.filter((word) => word !== this.lastSeenWords[peer]);
            }
            if (reason === 'notInDictionary') {
                console.log(this.lastSeenWords[peer], 'is not in the dictionary');
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
    submit() {
        return __awaiter(this, void 0, void 0, function* () {
            const words = findWord(this.syllable, this.currentWords);
            console.log(this.mybonusletters);
            let max = 0;
            let maxCandidate = [];
            for (const word of words) {
                let score = 0;
                this.mybonusletters.forEach((letter) => {
                    if (word.includes(letter))
                        score++;
                });
                if (score > max) {
                    max = score;
                    maxCandidate = [word];
                }
                else if (score === max) {
                    maxCandidate.push(word);
                }
            }
            if (maxCandidate.length === 0) {
                this.bot.mainSocket.send(42, 'chat', `No words for ${this.syllable}`);
                this.send(42, 'setWord', '💥', true);
                return;
            }
            const chosenWord = maxCandidate[Math.floor(Math.random() * maxCandidate.length)];
            yield sleep(200);
            for (let i = 0; i < chosenWord.length; i++) {
                this.send(42, 'setWord', chosenWord.substring(0, i + 1), false);
                yield sleep(Math.random() * 20 + 65);
            }
            yield sleep(Math.random() * 20 + 40);
            this.send(42, 'setWord', chosenWord, true);
        });
    }
}
exports.GameSocket = GameSocket;
function findWord(syllable, currentWords) {
    return currentWords.filter((word) => word.includes(syllable));
}
const TIME = new Date().getTime();
function log(message) {
    const t = new Date().getHours().toString().padStart(2, '0') + ':' +
        new Date().getMinutes().toString().padStart(2, '0') + ':' +
        new Date().getSeconds().toString().padStart(2, '0') + '.' +
        new Date().getMilliseconds().toString().padStart(3, '0');
    (0, fs_2.appendFileSync)(`../logs/${TIME}.log`, `[${t}] ${message}\n`);
}
//# sourceMappingURL=bot.js.map