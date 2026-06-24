# PostureMonitor · 实时坐姿检测

通过摄像头实时检测坐姿，弓腰超过 3 秒自动提醒。

---

## 运行效果

- 🟢 **绿色边框** — 坐姿良好
- 🔴 **红色边框** — 检测到弓腰，持续计时
- 超过 3 秒未纠正 → 终端滚动提示

---

## 快速开始

### 前置要求

| 工具 | 版本 | 安装 |
|---|---|---|
| Python | ≥ 3.10 | [python.org](https://www.python.org) |
| uv | 任意 | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| 摄像头 | — | 内置或外接均可 |

### 所需文件

```
check_posture.py          ← 主程序
pose_landmarker_lite.task ← AI 模型（约 5MB，没有会自动下载）
```

### 运行

```bash
uv run check_posture.py
```

首次运行会自动安装依赖（约 200MB），之后换目录运行直接复用缓存，无需重新下载。

---

## 依赖说明

脚本头部已锁定版本，保证任何时间、任何目录运行结果一致：

```
opencv-python==4.13.0.92   # 摄像头采集 + 画面渲染
mediapipe==0.10.35         # Google 姿态关键点检测
numpy==2.4.6               # 数值计算
```

> **为什么要锁版本？**  
> 不锁版本时，uv 每次都会解析最新版本。如果包发布了新版本，缓存就失效，需要重新下载。锁定版本后，缓存永久命中。

---

## 操作说明

| 操作 | 效果 |
|---|---|
| 摆正坐姿 | 边框变绿 |
| 按 `Q` 或 `ESC` | 退出程序 |
| 点击窗口关闭按钮 | 退出程序 |

确保摄像头能看到你的**头部和肩膀**，检测效果最佳。

---

## 常见问题

**首次运行很慢？**  
正常现象。uv 需要下载并安装依赖包（约 200MB），之后换目录运行瞬间完成。

**提示找不到模型文件？**  
开发模式下会自动从 Google Storage 下载 `pose_landmarker_lite.task`（约 5MB）。  
若网络受限，可手动下载后放在脚本同目录：
```
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task
```

**换了目录，模型文件又要下载？**  
模型文件存在脚本同目录，切换目录时需要一并复制：
```bash
cp /原目录/pose_landmarker_lite.task /新目录/
```

**检测不到人？**  
画面显示 `No person detected`，说明光线不足或摄像头角度问题，调整后自动恢复。

---

## 打包为 macOS App

如需打包成独立 `.app`，参见 [INSTALL.md](INSTALL.md)。

# 提高依赖库下载速度
换清华镜像源

配置文件：~/.config/uv/uv.toml（全局生效，所有项目共享）

[[index]]
url = "https://pypi.tuna.tsinghua.edu.cn/simple"
default = true

---
常用国内镜像对比

┌─────────┬─────────────────────────────────────────────────────┬─────────┐
│  镜像   │                        地址                         │ 推荐程  │
│         │                                                     │   度    │
├─────────┼─────────────────────────────────────────────────────┼─────────┤
│ 清华大  │ https://pypi.tuna.tsinghua.edu.cn/simple            │ ⭐⭐⭐  │
│ 学      │                                                     │ 最稳定  │
├─────────┼─────────────────────────────────────────────────────┼─────────┤
│ 阿里云  │ https://mirrors.aliyun.com/pypi/simple/             │ ⭐⭐⭐  │
│         │                                                     │ 速度快  │
├─────────┼─────────────────────────────────────────────────────┼─────────┤
│ 腾讯云  │ https://mirrors.cloud.tencent.com/pypi/simple/      │ ⭐⭐    │
├─────────┼─────────────────────────────────────────────────────┼─────────┤
│ 华为云  │ https://repo.huaweicloud.com/repository/pypi/simple/ │ ⭐⭐    │
└─────────┴─────────────────────────────────────────────────────┴─────────┘

换镜像只需改那一行 url 即可。

---
其他提速方式

临时指定（不改配置文件，单次生效）：
UV_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/ uv run check_posture.py

项目级配置（只对当前项目生效，放在项目根目录）：
## 在项目目录建 uv.toml，内容同上
echo '[[index]]
url = "https://pypi.tuna.tsinghua.edu.cn/simple"
default = true' > uv.toml