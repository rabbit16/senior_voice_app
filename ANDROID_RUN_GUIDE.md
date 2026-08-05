# Android 运行与打包指南

## 当前已修复

- React Native 项目已生成：`MobileMvp`
- 首页 Demo 代码已接入
- `npm install` 已完成
- TypeScript / lint / test 已通过
- Gradle 下载地址已从官方源切换为腾讯云镜像，避免官方源超时
- Gradle 下载超时时间已从 10 秒提高到 120 秒

## 当前机器还缺少的环境

执行检查脚本显示：

- `adb`: NOT FOUND
- `emulator`: NOT FOUND
- `sdkmanager`: NOT FOUND
- `ANDROID_HOME`: 未配置
- `ANDROID_SDK_ROOT`: 未配置

这说明 Android SDK 没有安装，或 Android SDK 没有加入 PATH。

## 推荐安装/配置方式

1. 安装 Android Studio。
2. 打开 Android Studio。
3. 进入 SDK Manager。
4. 至少安装：
   - Android SDK Platform-Tools
   - Android SDK Build-Tools
   - Android Emulator
   - Android SDK Platform 36
5. 打开 Device Manager，创建并启动一个 Android 模拟器。
6. 配置环境变量。

如果你的 SDK 在默认位置，加入下面内容到 `~/.bashrc` 或 `~/.zshrc`：

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin"
```

保存后重新打开终端，检查：

```bash
adb devices
emulator -list-avds
```

## 构建 APK

进入项目目录：

```bash
cd /home/westwell/haolliang.jiang/westwellDoc/app/mobile_home_mvp_template/MobileMvp
```

构建 Debug APK：

```bash
./build_debug_apk.sh
```

APK 输出路径：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## 运行到手机或模拟器

先启动 Metro：

```bash
npm start
```

另开一个终端运行：

```bash
npm run android
```

## 如果只是想先看 APK

不一定需要模拟器，但仍然需要 Android SDK 才能编译 APK。

如果已经有真机：

1. 手机开启开发者选项。
2. 开启 USB 调试。
3. USB 连接电脑。
4. 运行：

```bash
adb devices
npm run android
```
