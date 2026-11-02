import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { ProxyOptions } from 'vite'
import { localWebAuthorization } from './backend/src/auth/localWebAccess.ts'
import { readProjectEnvironment } from './backend/src/config/environment.ts'

export default defineConfig(() => {
  // Read only on the Node side; never expose the credential through VITE_*.
  const env = readProjectEnvironment(process.cwd())
  const api: ProxyOptions = {
    target: `http://127.0.0.1:${env.PORT || 3001}`,
    configure(proxy) {
      proxy.on('proxyReq', (upstream, req) => {
        upstream.removeHeader('authorization')
        const authorization = localWebAuthorization(env.AI_ACCESS_TOKEN, req.socket.remoteAddress, req.headers.host, req.headers.origin)
        if (authorization) upstream.setHeader('authorization', authorization)
      })
    },
  }
  const proxy = { '/api': api }
  return {
    plugins: [react()], envDir: false as const, envPrefix: [],
    define: { 'import.meta.env.VITE_AI_API_URL': JSON.stringify(env.VITE_AI_API_URL || '') },
    server: { host: '127.0.0.1', proxy }, preview: { host: '127.0.0.1', proxy },
  }
})
