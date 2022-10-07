import {BotInstance} from './bot';
import {randomInt} from 'crypto';

const gc = process.argv[2];

/**
 * Profile information for JKLM
 */
export class Profile {
    _token = '';

    /**
     * Generates a secure token for the user
     * @return {string} The randomly generated user token
     */
    getToken(): string {
        if (this._token != null && this._token.length === 16) return this._token;

        let token = '';
        const digits = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-';
        for (let i = 0; i < 16; i++) {
            token += digits.charAt(randomInt(0, digits.length));
        }

        this._token = token;

        return token;
    }
}


new BotInstance(gc);
