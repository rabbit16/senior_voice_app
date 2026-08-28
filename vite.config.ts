import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import type {ProxyOptions} from 'vite';
import {env} from './src/config/env';

function sseProxy(target: string, extra: ProxyOptions = {}): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    secure: false,
    timeout: 120000,
    proxyTimeout: 120000,
    configure: proxy => {
      proxy.on('proxyRes', (proxyRes, _req, res) => {
        const contentType = String(proxyRes.headers['content-type'] || '');
        if (contentType.includes('text/event-stream')) {
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('X-Accel-Buffering', 'no');
        }
      });
    },
    ...extra,
  };
}

export default defineConfig({
  plugins: [
    react(),
    // 开启 HTTPS，使局域网 IP（如 https://10.6.64.31:5173）也能调用麦克风
    basicSsl(),
  ],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
    },
  },
  server: {
    host: '0.0.0.0',
    // HTTPS 页面只访问本站；下面代理再转到 http 后端，避免混合内容
    proxy: {
      '/rag': sseProxy(env.ragBaseUrl, {
        rewrite: (path: string) => path.replace(/^\/rag/, ''),
      }),
      '/api': sseProxy(env.apiBaseUrl),
    },
  },
});
