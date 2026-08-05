import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

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
    // HTTPS 由 @vitejs/plugin-basic-ssl 注入，局域网 IP 下也可使用麦克风
    proxy: {
      '/api': {
        target: 'http://10.6.64.31:8000',
        changeOrigin: true,
      },
    },
  },
});
