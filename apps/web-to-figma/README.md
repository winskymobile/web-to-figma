# web-to-figma

本地 HTML → Figma 轻量工具。顶部状态栏 + 全屏预览；在预览区选择 / 拖入 HTML，若检测到本地资源引用会弹出询问。

转换在浏览器内通过 `@figit/dom-to-figma` 完成；Docker 仅托管静态前端。

## 开发

```sh
pnpm install
pnpm --filter web-to-figma dev
# http://localhost:4177
```

## 构建

```sh
pnpm --filter web-to-figma build
pnpm --filter web-to-figma preview
```

## Docker（推荐）

仓库根目录：

```sh
docker compose -f apps/web-to-figma/docker-compose.yml up --build -d
# http://localhost:8080

docker compose -f apps/web-to-figma/docker-compose.yml down
```

## 使用

1. 点击预览区（或拖入）选择 HTML
2. 若 HTML 含相对路径 CSS/图片，弹窗询问是否添加资源文件夹
3. 顶部下拉可查看资源状态、更换 HTML / 资源文件夹
4. 预览无误后点「复制到 Figma」→ 在 Figma 粘贴（⌘V / Ctrl+V）
