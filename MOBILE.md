# 知流 · 安卓 App 打包（Capacitor）

把知流做成**真安卓应用**：桌面上一个独立「知流」图标，点开全屏、无浏览器地址栏，体验和普通 App 一样。
本质是 WebView 加载你的 Render 网址（`https://ai-wordbench.onrender.com`），**数据仍在服务器**，所以改前端只需 Render 重新部署，APK 不用重打。

---

## 一、本机前置环境（只需装一次）

1. **Node.js 22**（你已有）
2. **JDK 17**（不是 21，Capacitor 6 认 17）
   - 下载：https://adoptium.net → 选 Temurin 17 LTS，装完 `java -version` 验证
3. **Android Studio + Android SDK**
   - 装 Android Studio（https://developer.android.com/studio）
   - 打开后 SDK Manager 装 **Android 13 (API 33)** 的 SDK Platform + Build-Tools
   - 设置环境变量 `ANDROID_HOME` 指向 SDK 目录（Studio 默认 `C:\Users\你的名\AppData\Local\Android\Sdk`）
   - 把 `%ANDROID_HOME%\platform-tools` 加进 PATH

> 荣耀 90 是 ARM 手机，Windows 是 x86，所以**不能**直接 USB 调试跑（除非开 x86 模拟器）。最稳的是打包成 APK 文件，传到手机安装。

---

## 二、生成安卓工程

项目根目录已配好 `capacitor.config.json`（appId `com.zhiliu.app`，加载远程网址）。

```bash
cd zhiliu
npm install                # 已装好 @capacitor/* 即可跳过
npx cap add android        # 生成 android/ 工程（首次会下载 Gradle 模板，需联网）
npx cap sync               # 同步配置（远程网址已写进壳，无需拷前端）
```

---

## 三、构建 APK

### 方式 A：Debug APK（最快，自己用）
用 Android Studio 打开 `zhiliu/android` 目录：
- **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- 选 **debug**，等右下角完成，点 **locate** 找到 `android/app/build/outputs/apk/debug/app-debug.apk`

### 方式 B：Release APK（分发/正式）
需要签名密钥（一次生成，长期用）：
```bash
keytool -genkey -v -keystore zhiliu-release.keystore -alias zhiliu -keyalg RSA -keysize 2048 -validity 10000
```
把 `zhiliu-release.keystore` 放好（**别传 GitHub**），在 `android/app/build.gradle` 的 `signingConfigs` 里填密码，再 Build APK 选 release。

---

## 四、装到荣耀 90

1. 把 `app-debug.apk`（或 release）传到手机（微信文件传输/数据线/U盘）
2. 荣耀：**设置 → 安全 → 更多安全设置 → 安装未知应用**，允许你用来打开 APK 的 App（如文件管理/微信）
3. 点 APK 安装，桌面出现「知流」图标
4. 首次打开需联网（Render 服务），之后就是全屏 App

---

## 五、日常更新

- **只改了前端（server/public 下）**：在 GitHub 推上去 → Render 自动重新部署 → 手机 App 下次打开就是新版（壳不用动）
- **改了 capacitor 配置 / 升了 Capacitor 版本**：重跑 `npx cap sync` + 重新 Build APK 装一次

---

## 六、常见问题

- **打开白屏几秒**：Render 免费版偶发冷启动，UptimeRobot 已保活基本不会；白屏是加载中，等几秒
- **提示「网络权限」**：android 默认已加 INTERNET 权限，无需处理
- **想加原生能力**（本地通知、后台刷新等）：后续可加 Capacitor 插件，再重新 Build
- **APK 太大**：纯壳约 10–20MB，正常
