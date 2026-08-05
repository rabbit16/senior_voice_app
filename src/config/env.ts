import apiConfig from '../../config/api.json';

/**
 * 应用运行时配置。
 * 改后端地址：编辑项目根目录 `config/api.json` 的 `apiBaseUrl`，然后重新打包。
 * 也可在打包时用环境变量覆盖：`API_BASE_URL=http://x.x.x.x:8000 npm run build:android`
 */
export const env = {
  apiBaseUrl: apiConfig.apiBaseUrl.replace(/\/$/, ''),
  apiPrefix: apiConfig.apiPrefix || '/api/v1',
  timeoutMs: apiConfig.timeoutMs ?? 30000,
} as const;

/** 完整 API 根路径，例如 http://192.168.1.100:8000/api/v1 */
export function getApiRoot(): string {
  return `${env.apiBaseUrl}${env.apiPrefix}`;
}
