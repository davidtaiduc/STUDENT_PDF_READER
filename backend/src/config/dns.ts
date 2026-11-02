import { setServers } from 'node:dns/promises';
import { isIP } from 'node:net';

// Optional process-only DNS override for networks whose system resolver rejects
// Atlas SRV queries. The operating system's DNS settings remain unchanged.
export function configureDns(value: string | undefined) {
  if (!value?.trim()) return;
  const servers = value.split(',').map(server => server.trim());
  if (servers.some(server => !isIP(server))) throw new Error('MONGODB_DNS_SERVERS phải là các địa chỉ IP DNS, phân cách bằng dấu phẩy.');
  setServers(servers);
}
