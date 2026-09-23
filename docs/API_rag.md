# rag-sys 接入文档

给其它系统对接用。本服务**不是** OpenAI Chat Completions 兼容接口，路径和字段见本文。机器可读契约：同目录 [openai.yaml](./openai.yaml)（OpenAPI 3.0）。

在线试调：本机 `http://127.0.0.1:8001/docs`，Docker 网关 `http://127.0.0.1:8000/docs`。

开发部署见 [GUIDE.md](./GUIDE.md)。

---

## 1. 地址与鉴权

| 环境 | Base URL |
|------|----------|
| 本机 `make local` | `http://127.0.0.1:8001` |
| Docker Compose | `http://127.0.0.1:8000` |

健康检查在根路径，业务接口在 `/api/v1`。

| Header | 说明 |
|--------|------|
| `Content-Type` | JSON 用 `application/json`；文件入库用 `multipart/form-data` |
| `X-API-Key` | 服务端配置了 `API_KEY` 时**必填**，未配置则可不传 |
| `X-Request-ID` | 可选；不传则服务端生成。响应里会带回 |

没有会话、没有 cookie。每次请求自带全部参数。向量和文档在服务端集合里，调用方只需记住 `collection` 和入库返回的 `document_id`。

---

## 2. 统一响应

除流式问答外，HTTP JSON 都是：

```json
{
  "ok": true,
  "data": {},
  "error": null
}
```

失败时 HTTP 状态码仍表示类型，`ok` 为 `false`：

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "not_found",
    "message": "collection 'kb' not found"
  }
}
```

| HTTP | code | 含义 |
|------|------|------|
| 400 | `rag_error` / `unsupported_type` / `empty_document` / `invalid_json` / `invalid_metadata` | 请求或文档无法处理 |
| 401 | `unauthorized` | `X-API-Key` 错误或缺失 |
| 404 | `not_found` | 集合或文档不存在 |
| 409 | `conflict` | 集合已存在且维度不一致 |
| 413 | `payload_too_large` | 单文件超过 `MAX_UPLOAD_MB`（默认 50） |
| 422 | `validation_error` | 字段校验失败 |
| 502 | `backend_error` | Embedding / LLM / 向量库 / 联网失败 |
| 503 | `configuration_error` | 未配置 LLM 却调用了 `/queries` |

---

## 3. 集合名

`collection` 必须匹配：`^[A-Za-z][A-Za-z0-9_]{0,63}$`

合法：`triage`、`kb`、`Demo1`。非法：中文、连字符 `my-docs`。

问诊推荐就医已预置：

| 集合 | 用途 |
|------|------|
| `triage` | 症状 → 科室 / 紧急程度 |
| `shanghai_doctors` | 上海医院与科室（问答时自动附带召回，一般不用你自己查） |

问答请打 `collection: "triage"`。不要自己造中文集合名。

---

## 4. 接口一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/healthz` | 进程存活 |
| GET | `/readyz` | 向量库可访问；附带 embedding / llm / rerank 是否启用 |
| GET | `/api/v1/collections` | 列出集合 |
| POST | `/api/v1/collections` | 创建集合（可不调，首次入库会自动建） |
| GET | `/api/v1/collections/{name}` | 集合信息 |
| DELETE | `/api/v1/collections/{name}` | 删除整个集合 |
| POST | `/api/v1/documents/text` | 纯文本入库 |
| POST | `/api/v1/documents` | 文件入库（multipart） |
| DELETE | `/api/v1/documents/{document_id}?collection=` | 按文档删除其全部切片 |
| POST | `/api/v1/retrievals` | 只检索，不生成 |
| POST | `/api/v1/queries` | 检索 + LLM；`stream=true` 时 SSE |

---

## 5. 健康检查

```http
GET /healthz
GET /readyz
```

无需 API Key。`/readyz` 的 `data.llm` 为 `false` 时不要调 `/queries`。

---

## 6. 检索（推荐其它系统先接这个）

不依赖 LLM，只要知识库已导入。

```http
POST /api/v1/retrievals
Content-Type: application/json
X-API-Key: <可选>
```

```json
{
  "collection": "triage",
  "query": "胸口痛还出冷汗该去哪个科",
  "top_k": 5,
  "score_threshold": 0.0,
  "filters": {},
  "rerank": null
}
```

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `collection` | string | 必填 | 集合名 |
| `query` | string | 必填 | 用户原话即可 |
| `top_k` | int | 服务端 `DEFAULT_TOP_K`（5），最大 50 | 返回条数 |
| `score_threshold` | float | 0 | 余弦相似度下限，越大越严 |
| `filters` | object | `{}` | metadata **精确匹配**，例如 `{"department":"皮肤科"}` |
| `rerank` | bool / null | 跟服务端开关 | `true`/`false` 临时覆盖 |

成功 `data`：

```json
{
  "collection": "triage",
  "query": "胸口痛还出冷汗该去哪个科",
  "hits": [
    {
      "id": "uuid:0",
      "text": "【导诊主题】胸痛危险征象\n...",
      "score": 0.47,
      "metadata": {
        "document_id": "…",
        "source": "triage_docs.json",
        "department": "急诊科",
        "doc_type": "emergency"
      }
    }
  ],
  "reranked": false
}
```

`score` 为余弦相似度，越大越相关。开启 rerank 后 `score` 是重排分，原向量分在 `metadata.vector_score`。

---

## 7. 问答（非流式）

需要服务端配置了 LLM（`OPENAI_API_KEY` 或 `LLM_API_KEY`）。

```http
POST /api/v1/queries
Content-Type: application/json
```

```json
{
  "collection": "triage",
  "query": "身上起疹子很痒，上海看哪位医生",
  "top_k": 5,
  "stream": false,
  "web_search": true,
  "city": "上海"
}
```

在检索字段之外：

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `stream` | bool / null | `LLM_STREAM_DEFAULT`（false） | `false` 返回 JSON；`true` 见下一节 |
| `web_search` | bool / null | 跟服务端 `WEB_SEARCH_ENABLED` | 是否联网搜上海医生 |
| `city` | string / null | `上海` | 就医城市 |
| `temperature` | float / null | 服务端配置 | GPT-5 类模型可能被忽略 |
| `filters` / `rerank` / `score_threshold` | 同检索 | | |

成功 `data`：

| 字段 | 说明 |
|------|------|
| `answer` | 模型完整回答 |
| `hits` | 导诊知识召回 |
| `doctor_hits` | 上海医院知识召回（集合 `shanghai_doctors`） |
| `web_hits` | 联网结果，含 `title` / `url` / `snippet` |
| `city` | 实际使用的城市 |
| `reranked` | 是否做了 rerank |

未配 LLM 时 HTTP **503**，`error.code` 为 `configuration_error`。

---

## 8. 问答（流式 SSE）

同一 URL，`"stream": true`。响应 `Content-Type: text/event-stream`。服务端需在检索完成后尽快发送 `meta`，模型生成的每个增量立即发送 `delta` 并 flush；不要等全文生成完再转成 SSE。设置 `Cache-Control: no-cache, no-transform`、`X-Accel-Buffering: no`，关闭 gzip/代理缓冲。

客户端必须：

- 不要缓冲整包（curl 用 `-N`）
- 按空行拆 SSE 帧，解析 `data:` 后的 JSON
- 先处理 `meta` 展示依据，再拼接 `delta.text`，以 `done` 或 `error` 结束

```bash
curl -N http://127.0.0.1:8001/api/v1/queries \
  -H 'Content-Type: application/json' \
  -d '{"collection":"triage","query":"胸口痛出冷汗去哪看","stream":true}'
```

事件（每条是一行 `data: {...}`，后空一行）：

```text
data: {"type":"meta","collection":"triage","query":"…","city":"上海","reranked":false,"hits":[...],"doctor_hits":[...],"web_hits":[...]}

data: {"type":"delta","text":"建议"}

data: {"type":"delta","text":"立即急诊"}

data: {"type":"done","answer":"建议立即急诊……"}
```

| type | 字段 | 含义 |
|------|------|------|
| `meta` | `hits` `doctor_hits` `web_hits` `city` | 检索已完成，尚未开始生成 |
| `delta` | `text` | 增量片段，按顺序拼接即完整回答 |
| `done` | `answer` | 已去首尾空白的全文 |
| `error` | `code` `message` | 生成中途失败；HTTP 状态可能仍是 200 |

Python 示例：

```python
import json
import httpx

url = "http://127.0.0.1:8001/api/v1/queries"
payload = {"collection": "triage", "query": "孩子发烧咳嗽看哪个科", "stream": True}
headers = {"Content-Type": "application/json"}  # 若启用 API_KEY 再加 X-API-Key

with httpx.stream("POST", url, json=payload, headers=headers, timeout=120) as resp:
    resp.raise_for_status()
    answer = []
    for line in resp.iter_lines():
        if not line.startswith("data:"):
            continue
        event = json.loads(line[5:].strip())
        kind = event.get("type")
        if kind == "meta":
            sources = event.get("hits") or []
        elif kind == "delta":
            answer.append(event.get("text") or "")
            print(event["text"], end="", flush=True)
        elif kind == "done":
            break
        elif kind == "error":
            raise RuntimeError(event.get("message"))
```

---

## 9. 入库（其它系统要往知识库加文档时）

### 9.1 文本

```http
POST /api/v1/documents/text
```

```json
{
  "collection": "kb",
  "text": "一段说明",
  "source": "note.txt",
  "metadata": {"lang": "zh"},
  "chunk_size": 512,
  "chunk_overlap": 64
}
```

返回 `document_id`、`chunk_count`、`dim`。删除时用这个 `document_id`。

### 9.2 文件

`multipart/form-data`。支持：`.txt` `.md` `.log` `.pdf` `.docx` `.html` `.csv` `.json`。

```bash
curl -s http://127.0.0.1:8001/api/v1/documents \
  -F collection=kb \
  -F 'metadata={"dept":"nlp"}' \
  -F files=@./readme.md
```

可多次 `-F files=@...`。`metadata` 是 JSON 字符串。JSON 文件可以是：

```json
[
  {"text": "片段一", "metadata": {"source": "a"}},
  {"content": "片段二"}
]
```

扫描版 PDF 没有文字层会失败（`empty_document`）。

### 9.3 删除

```http
DELETE /api/v1/documents/{document_id}?collection=kb
DELETE /api/v1/collections/kb
```

---

## 10. 建议接入方式

1. 探活：`GET /readyz`，确认 `llm` 是否为 true。  
2. 问诊产品：用户输入 → `POST /api/v1/queries`（UI 用 `stream: true`）。  
3. 只要科室线索、不要模型话术：`POST /api/v1/retrievals`。  
4. 展示依据：非流式读 `hits` / `doctor_hits` / `web_hits`；流式读第一帧 `meta`。  
5. 急症：回答和片段里若出现急诊 / 120，产品侧应置顶，不要等专家号。  
6. **不能把本服务输出当作诊断或处方。**

入库和查询必须使用服务端同一个 embedding 模型。换模型后旧向量无效，需要重灌集合。

---

## 11. 代码生成

用 OpenAPI 文件生成客户端：

```bash
# 示例：openapi-generator
openapi-generator-cli generate \
  -i docs/openai.yaml \
  -g python \
  -o ./generated-rag-client
```

规范里 `servers` 默认本机 8001，按环境改 `baseUrl`。启用了 `API_KEY` 时，给生成客户端配置 header `X-API-Key`。
