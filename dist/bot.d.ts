import { Profile } from '.';
import { client, connection } from 'websocket';
export declare const words: string[];
export declare class BotInstance {
    mainSocket: MainSocket;
    gameSocket: GameSocket;
    game: string;
    profile: Profile;
    language: 'English' | 'Spanish';
    constructor(gameId: string);
}
export declare class MainSocket {
    socket: client | null;
    socketClient: connection;
    bot: BotInstance;
    profile: Profile;
    game: string;
    constructor(url: string, bot: BotInstance);
    send(op: number, ...data: Array<unknown> | undefined): void;
    op0(data: any): void;
    op2(data: any): void;
    op40(data: any): Promise<void>;
    op430(data: any): void;
}
export declare class GameSocket {
    socket: client | null;
    socketClient: connection;
    bot: BotInstance;
    profile: Profile;
    game: string;
    peerId: number;
    lastSeenWords: {
        [key: string]: string;
    };
    currentWords: string[];
    syllable: string;
    constructor(url: string, bot: BotInstance);
    send(op: number, ...data: Array<unknown> | undefined): void;
    op0(data: any): void;
    op2(data: any): void;
    op40(data: any): void;
    op42(data: any): void;
    submit(): Promise<void>;
}
