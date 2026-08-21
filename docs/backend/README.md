# 后端实现参考（档案页）

本目录放**可拷贝**的后端示例，供 FastAPI 项目对照实现。正式代码应落在后端仓库。

| 文件 | 说明 |
|------|------|
| [`archive_routes_example.py`](./archive_routes_example.py) | 展示页示例：`GET /health-summaries`、`/health-reports`、`/health-reports/{id}`、`/report-glossaries`（就诊列表 `GET /archives` 需按契约补上） |

配套数据：

| 文件 | 说明 |
|------|------|
| [`../database/schema.sql`](../database/schema.sql) | 建表 |
| [`../database/seed_archive.sql`](../database/seed_archive.sql) | 档案页种子数据 |

接口契约：[`../API.md`](../API.md) 第 2.4.0（展示页拼法）及 2.4.1 / 2.4.2 / 2.4 节；机器可读：[`../openapi.yaml`](../openapi.yaml)。

## 最快联调

```bash
# 1) 建表
mysql -u root -p senior_voice < docs/database/schema.sql

# 2) 改 seed 里的手机号为你登录号，再导入
mysql -u root -p senior_voice < docs/database/seed_archive.sql

# 3) 后端挂载 archive_routes_example.py 中的 router（prefix=/api/v1）
# 4) 前端登录同一手机号 → 打开「档案」页
```
