import {isIP} from 'node:net';
import type {IncomingMessage} from 'node:http';
/** Only trust the private, credential-bearing loopback gateway. */
export function clientAddress(req:IncomingMessage){
 const remote=req.socket.remoteAddress||'unknown',value=req.headers['x-real-ip'];
 return process.env.TRUST_PROXY==='loopback'&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote)&&req.headers.authorization===`Bearer ${process.env.AI_ACCESS_TOKEN}`&&!!process.env.AI_ACCESS_TOKEN&&typeof value==='string'&&isIP(value)?value:remote;
}
