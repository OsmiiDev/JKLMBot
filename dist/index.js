"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Profile = void 0;
const bot_1 = require("./bot");
const crypto_1 = require("crypto");
const gc = process.argv[2];
class Profile {
    constructor() {
        this._token = '';
    }
    getToken() {
        if (this._token != null && this._token.length === 16)
            return this._token;
        let token = '';
        const digits = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-';
        for (let i = 0; i < 16; i++) {
            token += digits.charAt((0, crypto_1.randomInt)(0, digits.length));
        }
        this._token = token;
        return token;
    }
}
exports.Profile = Profile;
new bot_1.BotInstance('VHCJ');
//# sourceMappingURL=index.js.map