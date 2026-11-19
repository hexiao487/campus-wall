# 校园墙 Android 安装包（WebView 壳）

把线上网站 `https://www.abcdabcd.asia` 包成一个原生 Android 应用：打开即进入网站，支持返回键、图片选择（发帖/群聊选图）、外部链接跳浏览器。

## 产物

- 安装包：`public/downloads/campus-wall-v1.5.apk`（站点上通过 `/downloads/campus-wall-v1.5.apk` 下载）
- 包名：`asia.abcdabcd.campuswall`，版本：`1.5`（versionCode 5）
- 最低系统：Android 5.0（API 21），目标：API 34
- 签名：`campuswall.keystore`（别名 `campuswall`，两处密码均为 `campuswall`）

> 这个 keystore 必须保留：以后发新版要用同一个证书签名，否则手机上无法覆盖安装。

## 结构

```
android/
├── AndroidManifest.xml              # 权限、版本号、启动页
├── res/values/strings.xml           # 应用名「校园墙」
├── res/drawable/icon.png            # 图标
├── src/asia/abcdabcd/campuswall/MainActivity.java
├── campuswall.keystore              # 签名证书
└── build-apk.ps1                    # 一键打包脚本
```

## 重新打包

```powershell
# 需要 JDK 17、Android build-tools 34、platform 35
powershell -File android/build-apk.ps1 `
  -BuildTools "C:\path\to\build-tools\34.0.0" `
  -Platform   "C:\path\to\platforms\android-35" `
  -Jdk        "C:\path\to\jdk-17"
```

脚本流程：`aapt2 compile` → `aapt2 link` → `javac` → `d8` → 合并 dex → `zipalign` → `apksigner`，无需 Gradle / Android Studio。

## 说明

- 这是 WebView 壳应用，站点内容更新不需要重新发版；只有改包名、图标、启动页或权限时才需要重新打包。
- 未接入推送、启动图、离线缓存；首次打开需要网络。
- 安装时 Android 会提示「未知来源应用」，属于正常现象（自签名，非应用商店安装）。
