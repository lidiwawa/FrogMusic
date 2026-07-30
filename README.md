# FrogMusic Desktop

FrogMusic Desktop 是基于 [MusicFreeDesktop](https://github.com/maotoumao/MusicFreeDesktop) 二次修改的桌面音乐播放器。

本项目保留 MusicFreeDesktop 的插件化、主题、自定义歌单、本地数据等基础能力，并在桌面端体验、品牌展示、默认封面、关于页文案、登录和歌单相关体验等方面做了定制调整。

## 来源与致谢

本项目基于以下开源项目修改：

- [MusicFreeDesktop](https://github.com/maotoumao/MusicFreeDesktop)
- [MusicFree](https://github.com/maotoumao/MusicFree)

感谢原作者 [@maotoumao](https://github.com/maotoumao) 以及相关开源社区贡献。

## 开源协议

本仓库保留原项目的 AGPL-3.0 许可文件。使用、修改、分发或公开部署本项目时，请遵守 AGPL-3.0 以及原项目的相关要求。

特别说明：

- 本项目不内置任何音乐平台音源。
- 搜索、播放、歌词、歌单导入等能力依赖用户自行安装和配置的插件。
- 请合法合规使用本项目以及相关插件，不要用于侵犯版权或违反平台规则的用途。
- 如果分发修改版本，请保留原项目来源说明和开源协议。

## 主要修改

- 品牌名称调整为 FrogMusic。
- 更新默认专辑封面为无水印抽象唱片图。
- 修复部分中文文案乱码和关于页说明。
- 优化歌曲详情、默认歌手/专辑兜底文案。
- 调整部分桌面端登录、歌单和播放器体验。
- 增加 NSIS 打包脚本配置，用于生成 Windows 安装包。

## 环境要求

- Node.js
- npm
- Windows 环境下建议安装 NSIS，用于生成 NSIS 安装包

当前项目使用 Electron Forge 构建，依赖版本以 `package-lock.json` 为准。

## 安装依赖

```bash
npm install
```

## 开发运行

```bash
npm start
```

## 类型检查

```bash
npx tsc --noEmit --pretty false
```

## 打包

生成 Electron Forge 默认安装包：

```bash
npm run make
```

生成 NSIS 安装包：

```powershell
& "C:\Program Files (x86)\NSIS\makensis.exe" "build\nsis\FrogMusic.nsi"
```

NSIS 输出路径：

```text
out/make/nsis.windows/x64/
```

## 上传 GitHub 前注意

源码仓库不应提交以下内容：

- `node_modules/`
- `.webpack/`
- `out/`
- `release/`
- `work/`
- `.codex-run-logs/`
- 本地日志文件
- `.exe`、`.nupkg`、`.blockmap` 等打包产物

安装包建议放到 GitHub Releases，不建议提交到源码仓库。

## 截图

原项目截图资源保留在 `.imgs/` 目录中。后续可以替换为 FrogMusic 自己的截图。
