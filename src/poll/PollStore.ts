import type { WAMessage } from "baileys";

type PollKey = string; // `${remoteJid}|${pollMsgId}`

const pollStore = new Map<PollKey, WAMessage>();

export function makePollKey(remoteJid: string, pollMsgId: string) {
    return `${remoteJid}|${pollMsgId}`;
}

export function savePollMessage(remoteJid: string, pollMsgId: string, msg: WAMessage) {
    pollStore.set(makePollKey(remoteJid, pollMsgId), msg);
}

export function getPollMessage(remoteJid: string, pollMsgId: string) {
    return pollStore.get(makePollKey(remoteJid, pollMsgId));
}
