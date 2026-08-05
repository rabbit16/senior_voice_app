# 语音问答助手 Senior Voice App

这是一个面向老年用户的 Android 手机 App 前端项目，基于 React Native 实现。

当前版本是首页 MVP：用户按住大按钮说话，松开后展示模拟结果。项目已整理为可维护结构，方便继续开发前端界面。

## 快速开始

进入项目：

```bash
cd /home/westwell/haolliang.jiang/westwellDoc/app/senior_voice_app
```

检查 Android 环境：

```bash
npm run doctor:android
```

安装依赖（如果 node_modules 不存在）：

```bash
npm install
```

代码检查：

```bash
npm run check
```

一键生成 Android Debug APK：

```bash
npm run build:android
```

APK 输出路径：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## 运行到安卓手机

1. 手机打开开发者选项和 USB 调试。
2. USB 连接电脑。
3. 检查设备：

```bash
adb devices
```

4. 启动 Metro：

```bash
npm start
```

5. 另开终端运行：

```bash
./scripts/run_android_device.sh
```

## 重要文档

换对话或后续维护时，优先阅读：

```text
docs/PROJECT_CONTEXT.md      项目背景和设计目标
docs/DESIGN_SYSTEM.md        适老化设计系统
docs/DEVELOPMENT_GUIDE.md    开发与维护指南
docs/ROADMAP.md              后续开发路线图
```

## 代码结构

```text
src/
  features/
    home/
      HomeScreen.tsx
      components/
        LanguageToggle.tsx
        ResultCard.tsx
        VoiceInputButton.tsx
  shared/
    i18n/
      messages.ts
  theme/
    tokens.ts
scripts/
  build_android_apk.sh
  check_android_env.sh
  run_android_device.sh
docs/
  PROJECT_CONTEXT.md
  DESIGN_SYSTEM.md
  DEVELOPMENT_GUIDE.md
  ROADMAP.md
```

## 维护原则

- 改颜色、字号、间距：优先改 `src/theme/tokens.ts`
- 改中文/英文文案：改 `src/shared/i18n/messages.ts`
- 改首页：改 `src/features/home/HomeScreen.tsx`
- 改首页内组件：改 `src/features/home/components/`
- 改完后运行：`npm run check && npm run build:android`

## 当前限制

- 当前语音识别是模拟结果，还没有接入真实语音服务。
- 当前仅实现首页，没有完整设置页、历史记录页。
- 当前脚本生成的是 Debug APK，正式发布需要配置 release 签名。
