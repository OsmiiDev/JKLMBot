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
            yield axios_1.default.get(`https://jklm.fun/${gameId}`);
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
                if (op === 430)
                    this.op430(json);
            });
        });
        this.socket.connect(url);
    }
    send(op, ...data) {
        console.log(`↑1 ${op.toString()}${data.length > 0 ? JSON.stringify(data) : ''}`);
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
                nickname: 'Osmii',
                picture: (0, fs_1.readFileSync)('../assets/profile.txt').toString(),
                language: 'en-US',
            });
            data;
        });
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
                console.log('↓2', `${opcode}${data}`);
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
        console.log(`↑2 ${op.toString()}${data.length > 0 ? JSON.stringify(data) : ''}`);
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
            const { name, currentPlayerPeerId } = data[1];
            if (name === 'seating') {
                this.send(42, 'joinRound');
                this.currentWords = exports.words.slice();
            }
            if (name === 'round' && currentPlayerPeerId === this.peerId) {
                this.submit();
            }
        }
        if (data[0] === 'correctWord') {
            const { playerPeerId } = data[1];
            if (!exports.words.includes(this.lastSeenWords[playerPeerId].replace(/[^a-zA-Z-]/g, ''))) {
                console.log(`[!] New word: ${this.lastSeenWords[playerPeerId]}`);
                exports.words.push(this.lastSeenWords[playerPeerId]);
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
    submit() {
        return __awaiter(this, void 0, void 0, function* () {
            const words = findWord(this.syllable);
            const chosenWord = words[Math.floor(Math.random() * words.length)];
            yield sleep(200);
            chosenWord.split('').forEach((letter, index) => __awaiter(this, void 0, void 0, function* () {
                this.send(42, 'setWord', chosenWord.substring(0, index + 1), false);
                yield sleep(50);
            }));
            this.send(42, 'setWord', chosenWord, true);
        });
    }
}
exports.GameSocket = GameSocket;
function findWord(syllable) {
    return exports.words.filter((word) => word.includes(syllable));
}
//# sourceMappingURL=bot.js.map