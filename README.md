<div align="center">

# 词光 · Word Atlas（fork）

**一词一画，点亮雅思词汇。**

[**打开本 fork →**](https://words.quickform.cc/) &nbsp;·&nbsp; [原项目演示 →](https://0xlei.tech/words/) &nbsp;·&nbsp; [原项目仓库 →](https://github.com/designfuchen/word-atlas)

</div>

---

这是 [designfuchen/word-atlas](https://github.com/designfuchen/word-atlas)（词光）的 fork 版本。

关于词光本身——7,298 个雅思核心词、每个词一幅原创插画与两条原创例句、英音美音发音、FSRS 间隔重复算法——请阅读[原项目 README](https://github.com/designfuchen/word-atlas#readme)，词库内容与素材均来自原项目，致谢原作者。

## 本 fork 的改动

### ☁️ QuickForm 云端进度备份

借助 [QuickForm](https://quickform.cc/)，增加了用户学习进度的云端存取：

- 在「我的 → 数据（QuickForm）」中，用自己的邮箱地址作为 id，写一句进度说明，即可把学习进度保存到云端；
- 换设备时读取进度，选择任意一次保存导入，本地记录随即恢复。

### 🔊 音频精简，改用 TTS

为了部署在 Cloudflare 上（控制网站文件数量），精简了读音文件：

- 保留 A1/A2 词（共 1,824 个）的英音、美音录音；
- 其余单词与全部例句改由浏览器语音（TTS）朗读。

## 本地运行

```bash
git clone https://github.com/xiezuoru/word-atlas.git
cd word-atlas
npm install
npm run dev
```

## 许可

代码 MIT，内容 CC BY 4.0，均继承自原项目。
