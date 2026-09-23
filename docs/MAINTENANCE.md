# 语音问答助手 — 交付维护文档

面向接手人员：如何配置环境、改后端地址、重新打包，以及代码该从哪里改。

| 项 | 值 |
|---|---|
| 产品名 | 语音问答助手 |
| 工程名 | `SeniorVoiceApp`（`app.json`） |
| npm 包名 | `senior-voice-app` `0.1.0` |
| Android 包名 / applicationId | `com.seniorvoiceapp` |
| versionName / versionCode | `1.0` / `1` |
| 技术栈 | React Native **0.86.0** + React **19.2.3** + TypeScript |
| 交付平台 | **Android**（iOS 目录仅脚手架，未作为交付目标） |
| 附带能力 | Vite 网页预览（`npm run web`），便于电脑联调 |

配套契约（接口与库表，不在本文展开）：

- 主后端：[`docs/API.md`](./API.md)、[`docs/openapi.yaml`](./openapi.yaml)
- RAG 就医推荐：[`docs/API_rag.md`](./API_rag.md)
- 数据库：[`docs/database/README.md`](./database/README.md)

---

## 1. 交付物是什么

这是 **Android App 前端**。真机使用时依赖两套后端：

1. **主后端（FastAPI）**：登录注册、问询 SSE、档案 OCR、个人中心、家属推送。
2. **RAG 服务**：用户点「就医推荐」后，前端直接请求 `POST {ragBaseUrl}/api/v1/queries`，集合名固定 `triage`。

当前正式打包命令生成的是 **Release APK**：

```text
android/app/build/outputs/apk/release/app-release.apk
```

> 注意：Release 目前仍用 **debug 签名**（见第 4.3 节）。上架商店前必须换成自己的 keystore。

---

## 2. 环境配置

换机器后，先对齐这套工具链，再谈打包。

### 2.1 必需版本

| 软件 | 要求 | 说明 |
|---|---|---|
| Node.js | `>= 22.11.0`（见 `package.json` `engines`） | 建议用 nvm 安装 LTS |
| npm | 随 Node 即可 | 本仓库用 `package-lock.json`，不要改用 yarn |
| JDK | **17** | Gradle / Android 编译必须是 17，不要用 21 当默认 |
| Android SDK | Platform 36、Build-Tools 36.0.0、Platform-Tools、NDK **27.1.12297006** | 与 `android/build.gradle` 一致 |
| Python 3 | 系统自带即可 | 打包脚本用它改 `api.json` / Gradle 镜像 |
| adb | SDK Platform-Tools | 真机安装、调试 |

当前开发机上的路径（**换机器必须改**）：

| 变量 | 当前值 |
|---|---|
| `JAVA_HOME` | `$HOME/.local/jdks/jdk17` |
| `ANDROID_HOME` / `ANDROID_SDK_ROOT` | `$HOME/Android/Sdk` |
| Gradle JDK | `android/gradle.properties` 里的 `org.gradle.java.home=/home/westwell/.local/jdks/jdk17` |

### 2.2 换机器时必须改的三处硬编码

脚本和 Gradle 把本机路径写死了，拷贝到另一台电脑后不改会直接编不过。

**① 打包 / 环境检查脚本**（三处相同）：

- `scripts/build_android_apk.sh`
- `scripts/check_android_env.sh`
- `scripts/run_android_device.sh`

把下面两行改成新机器的 JDK 17 与 SDK 路径：

```bash
export JAVA_HOME="$HOME/.local/jdks/jdk17"
export ANDROID_HOME="$HOME/Android/Sdk"
```

**② Gradle JDK**

编辑 `android/gradle.properties`：

```properties
org.gradle.java.home=/绝对路径/到/jdk17
```

没有这行时，Gradle 会用系统默认 Java；若默认不是 17，编译会失败。

**③ Android SDK 定位**

在 `android/` 下创建 `local.properties`（已在 `.gitignore`，不要提交）：

```properties
sdk.dir=/绝对路径/到/Android/Sdk
```

Android Studio 打开工程时会自动生成该文件。

### 2.3 建议写入 shell 配置

把下面内容加入 `~/.bashrc` 或 `~/.zshrc`，保存后重开终端：

```bash
export JAVA_HOME="$HOME/.local/jdks/jdk17"   # 改成你的 JDK 17
export ANDROID_HOME="$HOME/Android/Sdk"      # 改成你的 SDK
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin"
```

验证：

```bash
node -v          # >= 22.11.0
java -version    # 17.x
echo "$ANDROID_HOME"
adb version
```

### 2.4 一键体检

```bash
cd /path/to/senior_voice_app
npm run doctor:android
```

应能看到 Node、Java 17、`ANDROID_HOME`、`adb`。缺 SDK 时按 Android Studio → SDK Manager 安装：

- Android SDK Platform-Tools
- Android SDK Build-Tools 36.0.0
- Android SDK Platform 36
- NDK 27.1.12297006（与 `android/build.gradle` 的 `ndkVersion` 一致）

### 2.5 国内网络

`scripts/build_android_apk.sh` 会把 Gradle 发行包改成腾讯云镜像：

```text
https://mirrors.cloud.tencent.com/gradle/gradle-9.3.1-bin.zip
```

超时已提到 120 秒。首次构建会拉 Gradle 9.3.1 和依赖，时间较长属正常。

---

## 3. 项目构建

### 3.1 安装依赖

```bash
cd /path/to/senior_voice_app
npm install
```

不要删除 `package-lock.json`。`node_modules` 未提交，每台机器都要装一次。

### 3.2 代码检查（改代码后建议必跑）

```bash
npm run check
```

等价于：ESLint + `tsc --noEmit` + Jest。

### 3.3 开发运行（真机 / 模拟器）

1. 手机打开「开发者选项」和 USB 调试，USB 连接电脑。
2. `adb devices` 能看到设备。
3. 终端 1：

```bash
npm start
```

4. 终端 2：

```bash
./scripts/run_android_device.sh
```

或 `npm run android`。这是 **Debug** 安装，JS 走 Metro，改前端代码可热更新；**不会**把 `config/api.json` 固化进独立 APK（独立安装包请走第 4 节）。

地址注意：

| 运行环境 | `apiBaseUrl` 怎么填 |
|---|---|
| 电脑浏览器 `npm run web` | `http://127.0.0.1:8000` 即可 |
| Android 模拟器 | 本机后端用 `http://10.0.2.2:8000`（模拟器里的 127.0.0.1 是模拟器自己） |
| 真机 | 电脑局域网 IP，如 `http://10.6.64.31:8000`，或内网穿透域名 |
| 已打包 APK | 必须能从手机访问的地址（公网 / 穿透 / 同一 Wi-Fi 的局域网 IP） |

### 3.4 网页预览（电脑联调）

```bash
npm run web
```

Vite 默认 `https://0.0.0.0:5173`（开了 basic-ssl，方便浏览器调麦克风）。

- HTTPS 页面通过同源代理转发：`/api` → 主后端，`/rag` → RAG，避免混合内容。
- 改完 `config/api.json` 后必须 **重启** `npm run web`，代理目标才会更新。

生产安装包 **没有 Vite**，手机 APK 直连 `api.json` 里的地址。

---

## 4. 重新打包（交付 / 换后端地址）

### 4.1 打包前改配置：`config/api.json`

这是 **唯一** 需要按部署环境改的前端配置。改完必须重新打 APK，旧包里的地址不会变。

字段说明：

| 字段 | 作用 |
|---|---|
| `apiBaseUrl` | 主后端根地址，不要末尾 `/`。完整 API 为 `{apiBaseUrl}{apiPrefix}` |
| `apiPrefix` | 一般保持 `/api/v1` |
| `timeoutMs` | 普通请求超时；问询 SSE / OCR / RAG 在代码里还会再拉长 |
| `ragBaseUrl` | RAG 根地址。**填了则忽略 `ragPort`**。natapp 这类无端口域名必须填这个 |
| `ragPort` | 仅当主后端是 `localhost` / 局域网 IP 时，用同一主机换端口（如 `8001`） |
| `ragApiKey` | 仅当 RAG 服务开了 HTTP `API_KEY` 才填；**模型密钥不要放进 App** |
| `ragCity` | 就医推荐城市，默认 `上海` |

模板见 `config/api.example.json`。当前仓库里的 `config/api.json` 若仍是 natapp 临时域名，**交付前务必改成稳定地址**，隧道一过期 App 会全部连不上。

示例（局域网）：

```json
{
  "apiBaseUrl": "http://10.0.0.8:8000",
  "apiPrefix": "/api/v1",
  "timeoutMs": 60000,
  "ragPort": 8001,
  "ragBaseUrl": "",
  "ragApiKey": "",
  "ragCity": "上海"
}
```

示例（两套独立公网 / 穿透域名）：

```json
{
  "apiBaseUrl": "https://api.example.com",
  "apiPrefix": "/api/v1",
  "timeoutMs": 60000,
  "ragPort": "",
  "ragBaseUrl": "https://rag.example.com",
  "ragApiKey": "",
  "ragCity": "上海"
}
```

natapp 域名 **不能** 靠 `ragPort` 拼 `:8001`，必须单独填 `ragBaseUrl`。

### 4.2 一键打 Release APK

```bash
cd /path/to/senior_voice_app
npm run build:android
```

脚本会：

1. 若设置了 `API_BASE_URL`，写回 `config/api.json` 的 `apiBaseUrl`
2. 检查 Node / JDK 17 / Android SDK
3. 没有 `node_modules` 时执行 `npm install`
4. 把 Gradle 下载改成腾讯云镜像
5. **删除** `android/app/build/generated/assets/react`（避免沿用旧 JS 包，手机仍打到旧后端导致 404）
6. 执行 `./gradlew assembleRelease`

输出：

```text
android/app/build/outputs/apk/release/app-release.apk
```

临时覆盖主后端地址（仍会改磁盘上的 `api.json`）：

```bash
API_BASE_URL=http://10.0.0.8:8000 npm run build:android
```

`ragBaseUrl` 没有环境变量入口，换 RAG 地址请直接改 `config/api.json`。

### 4.3 签名（上架前必做）

当前 `android/app/build.gradle` 中 **debug / release 都使用 debug.keystore**：

```text
storeFile: android/app/debug.keystore
storePassword / keyPassword: android
keyAlias: androiddebugkey
```

这只适合内测。正式发布：

1. 生成自己的 keystore（妥善保管，丢失无法覆盖安装升级）。
2. 在 `android/app/build.gradle` 的 `signingConfigs.release` 指向该文件。
3. 密码不要写进 Git，用 `android/keystore.properties`（加入 `.gitignore`）或 CI 密钥。
4. 需要时把 `enableProguardInReleaseBuilds` 改为 `true` 并验证混淆后功能。

安装到已装过 debug 包的手机时，签名不一致会失败，先卸载旧包再装。

### 4.4 安装到手机

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

或把 APK 拷到手机直接安装。Release 包 **不依赖** Metro；后端地址以打包当时的 `api.json` 为准。

### 4.5 Debug APK（可选）

根目录 `build_debug_apk.sh` 仍打 Debug：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

交付请用 `npm run build:android` 的 Release 包。

### 4.6 版本号

发新包给用户覆盖安装时，至少增加 `versionCode`：

`android/app/build.gradle` → `defaultConfig`：

```gradle
versionCode 2
versionName "1.1"
```

前端展示用的 npm `version` 在 `package.json`，与 Android 商店版本不是同一套。

---

## 5. 目录与关键代码

### 5.1 该改哪里（速查）

| 需求 | 文件 |
|---|---|
| 换主后端 / RAG 地址 | `config/api.json`，然后重新打包 |
| 读配置、拼 API / RAG 根路径 | `src/config/env.ts` |
| 统一 HTTP、错误码、超时 | `src/services/http.ts` |
| 登录注册、改密、/me | `src/services/authApi.ts`、`src/features/auth/` |
| 文字 / 语音问询 SSE | `src/services/qaApi.ts`、`src/features/home/HomeScreen.tsx` |
| 就医推荐 RAG | `src/services/ragApi.ts` |
| 档案 OCR、列表、推送、PDF | `src/services/archiveApi.ts`、`src/features/archive/` |
| 家属与推送规则 | `src/services/profileApi.ts`、`src/features/profile/ProfileScreen.tsx` |
| 登录态 | `src/services/session.ts`（Web 用 localStorage；**原生 APK 目前是内存，杀进程会丢登录**） |
| 中英文案 | `src/shared/i18n/messages.ts` |
| 颜色 / 字号 / 间距 | `src/theme/tokens.ts`、`src/theme/layout.ts` |
| 底部三 Tab | `src/navigation/MainTabs.tsx` |
| 启动鉴权闸门 | `App.tsx` |
| Android 权限、明文 HTTP | `android/app/src/main/AndroidManifest.xml`、`res/xml/network_security_config.xml` |
| 原生录音 | `WavAudioRecorderModule.kt` + `src/services/voiceRecorder.native.ts` |
| 原生相册 / 拍照 | `ImagePickerModule.kt` + `src/services/pickImage.native.ts` |
| 应用显示名 | `android/app/src/main/res/values/strings.xml`、`app.json` 的 `displayName` |
| 接口契约 | `docs/API.md`、`docs/openapi.yaml`、`docs/API_rag.md` |

原则：

- **不要**在页面组件里直接 `fetch`。一律走 `src/services/*`。
- **不要**在组件里散写颜色。改 `src/theme/tokens.ts`。
- 适老化：核心按钮不要缩小，保留 `accessibilityLabel`。

### 5.2 运行时结构

```text
index.js                 Android 入口，注册 SeniorVoiceApp
App.tsx                  启动：读 session → GET /auth/me；未登录走登录/注册；已登录进 MainTabs
src/navigation/MainTabs  问询 | 档案 | 我的
src/web/main.tsx         网页入口（Vite）
```

`App.tsx` 流程：

1. `loadSession()` 恢复本地 token。
2. 用 `getMe(access_token)` 校验；失败则清会话。
3. 未登录：`LoginScreen` / `RegisterScreen`。
4. 已登录：`MainTabs`，退出时清本地并尽量调 `POST /auth/logout`。

登录页另有 **演示会话**（`access_token` 以 `demo-` 开头）。各业务页遇到 demo token **不打真实后端**，只走本地演示数据。交付验收请用真实短信/密码登录。

### 5.3 问询页（核心业务）

`src/features/home/HomeScreen.tsx`

| 用户动作 | 调用 |
|---|---|
| 文字提问 | `POST /qa/ask`（SSE：`meta` / `phase` / `token` / `done`）→ `askTextStream` |
| 按住说话 | 原生/Web 录音 WAV → `POST /qa/ask/audio`（multipart + SSE）→ `askAudioStream` |
| 新问题 | `POST /qa/context/clear`，并传 `new_context: true` |
| 就医推荐 | **不走**主后端 recommendations；直接 RAG `requestTriageRecommendation` |

问询阶段 `phase`：`followup`（追问）→ `diagnosis`（初步判断）→ `emergency`（急救）。流式 token 里可能泄漏的 `FOLLOWUP` 等标记由 `sanitizeQaSpokenText` 剥掉。

就医推荐：用整段对话拼查询（`buildTriageQuery`），`collection=triage`，默认 `stream=true`、`web_search=true`、`city=ragCity`。网页走 Vite `/rag` 代理；APK 直连 `ragBaseUrl`。

### 5.4 档案页 / 个人中心

- 拍照或相册 → 原生 `ImagePicker` → `POST /archives/ocr`（超时 ≥ 90s）。后端按类型入库：就诊单 `visit` → `medical_archives`，体检单 `exam` → `health_reports`。
- 列表 / 详情 / 推送子女 / 导出 PDF：见 `archiveApi.ts`，契约见 `docs/API.md` 2.4 节。
- 个人中心：资料、改密、家属联系人、推送规则（`profileApi.ts`）。无真实 token 时用 `familyDemoStore.ts`。

### 5.5 原生模块（Android）

Java 源码目录仍是历史路径 `android/app/src/main/java/com/mobilemvp/`，但 **package 已是 `com.seniorvoiceapp`**。改原生代码不要按文件夹名改包名。

| 模块名（JS `NativeModules`） | 作用 |
|---|---|
| `WavAudioRecorder` | `AudioRecord` 录 16kHz 16-bit 单声道 PCM，写成 WAV，供 `/qa/ask/audio` |
| `ImagePicker` | 相机 / 相册，FileProvider 权威为 `${applicationId}.fileprovider` |

在 `MainApplication.kt` 里手动 `add` 进 `PackageList`。改 Kotlin 后必须重新编译安装，热更新无效。

权限（`AndroidManifest.xml`）：`RECORD_AUDIO`、`CAMERA`、`INTERNET`、`ACCESS_NETWORK_STATE`。开发期 `usesCleartextTraffic=true`，可访问 `http://` 局域网和 natapp。上线 HTTPS 后应关闭明文，并收紧 `network_security_config.xml`。

### 5.6 配置如何进包

`src/config/env.ts` 静态 `import '../../config/api.json'`。Metro / Gradle 打包时把 JSON **打进 JS bundle**。所以：

- 只改 `api.json` 却不重新 `assembleRelease`，用户手机上的地址不变。
- 脚本会删 `android/app/build/generated/assets/react`，避免 Gradle 复用旧 bundle。

---

## 6. 后端联调清单（前端视角）

主后端需按 `docs/API.md` 提供（前缀默认 `/api/v1`）：

| 模块 | 关键路径 |
|---|---|
| 健康检查 | `GET /health` |
| 认证 | `POST /auth/sms/send`、`/auth/register`、`/auth/login/sms`、`/auth/login/password`、`/auth/password`、`/auth/logout`、`/auth/refresh`、`GET|PATCH /auth/me` |
| 问询 | `POST /qa/ask`、`POST /qa/ask/audio`、`POST /qa/context/clear` |
| 档案 | `POST /archives/ocr`、就诊单 / 体检报告 CRUD、share、export PDF |
| 家属 | `/family/contacts`、`/family/push-rules` |

RAG（`docs/API_rag.md`）：

- `POST /api/v1/queries`，body 含 `collection: "triage"`、`query`、`top_k`、`stream`、`web_search`、`city`
- 可选请求头 `X-API-Key`（对应 `ragApiKey`）
- 流式为 SSE；若返回 JSON 前端也能解析

CORS：网页联调必须允许前端来源。Android 明文 HTTP 已在清单中打开。

数据库表结构见 `docs/database/schema.sql`，不要在前端仓库里改生产库。

---

## 7. 常见问题

| 现象 | 处理 |
|---|---|
| `Java not found` / Gradle 失败 | 确认 JDK **17**，改脚本里的 `JAVA_HOME` 和 `org.gradle.java.home` |
| `Android SDK not found` | 配 `ANDROID_HOME`，生成 `android/local.properties` |
| 打包成功但手机仍打旧 IP / RAG 404 | 确认改的是 `config/api.json`；删掉 generated assets 后重新 `assembleRelease`；网页则重启 `npm run web` |
| 真机连不上 `localhost` | 改成局域网 IP 或穿透域名后重新打包 |
| 模拟器连不上本机后端 | 用 `http://10.0.2.2:端口` |
| 语音「原生模块未就绪」 | Debug 需完整编译安装，不能只靠 Metro；确认 `WavAudioRecorder` 已注册 |
| HTTPS 网页无法录音 | 使用 `npm run web` 的 HTTPS，或 localhost |
| 登录后杀进程掉线 | 原生存储目前是内存；要持久化需给 `src/services/storage.ts` 接 AsyncStorage |
| 安装失败 `signatures do not match` | 卸载旧包再装；或统一签名 |
| Gradle 下载超时 | 确认 wrapper 已指向腾讯云镜像，可删 `~/.gradle/wrapper/dists` 后重试 |
| natapp 域名突然全挂 | 隧道过期；更新 `api.json` 两个 URL 后重新打包 |

---

## 8. 维护时不要做的事

- 不要把 LLM / 数据库密码写进 `config/api.json` 或客户端。
- 不要在 UI 里复制一套 `fetch`；有新接口加在对应 `*Api.ts`。
- 不要缩小首页语音按钮或去掉无障碍标签。
- 不要用 `git commit --no-verify` 跳过检查来「先把包打出去」。
- 不要对 `main`/`master` 强推。正式签名 keystore 不要提交到 Git（`*.keystore` 已忽略，`debug.keystore` 除外）。

---

## 9. 建议的交接检查单

- [ ] 新机器：Node 22+、JDK 17、Android SDK 36、改掉三处硬编码路径
- [ ] `npm install` && `npm run doctor:android` && `npm run check`
- [ ] `config/api.json` 指向 **稳定** 的主后端和 RAG（不要用过期穿透）
- [ ] `npm run build:android` 得到 `app-release.apk`
- [ ] 真机安装：登录、文字问询、语音问询、就医推荐、档案拍照 OCR、个人中心
- [ ] 若要上架：自有签名、关明文 HTTP、隐私政策与权限文案
