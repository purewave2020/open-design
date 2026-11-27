# 独立设计工作区

这是从 Open Design 右侧设计区抽出的独立前端工作区。交互逻辑参考原项目的 `FileViewer`、`SketchEditor` 和 `DesignFilesPanel`，通过浏览器本地状态完成文件打开、编辑、预览、草图编辑和导出。

## 本地打开

使用 Node 启动静态服务器：

```bash
cd standalone-design
npm start
```

然后打开 `http://127.0.0.1:8080`。

## 已包含的功能

- HTML 文件的预览与代码模式切换
- 桌面端、平板端和移动端视口
- 50% 到 200% 缩放菜单
- 刷新预览、导出文件、打开独立预览窗口
- 评论工具和评论列表
- 画笔标注工具
- 点击 HTML 元素后的手动文本与颜色编辑
- `.sketch.json` 草图的矩形、椭圆、箭头、自由绘制、文字、橡皮擦、保存和 PNG 导出
- PDF、图片、Markdown、文本和常见文档文件的上传与预览入口
- 拖拽上传和多文件项目文件列表
- 计费周期切换和示例页面交互

页面内的 Flowmark 内容只是首次打开时的示例文件。上传 HTML 后，预览、代码编辑、评论和手动编辑会针对上传的实际文件工作。

原项目的对应实现位于：

- `apps/web/src/components/FileViewer.tsx`
- `apps/web/src/components/SketchEditor.tsx`
- `apps/web/src/components/DesignFilesPanel.tsx`

仓库内还提供了一个直接使用这些 React 组件的页面入口 `apps/web/app/standalone-design/page.tsx`。纯前端 Node 入口适合脱离 daemon 运行，Next 页面入口适合需要完全复用原项目 `FileViewer` 和 `SketchEditor` 行为的环境。

运行原组件页面：

```bash
pnpm --filter @open-design/web dev
```

然后打开 `http://127.0.0.1:3000/standalone-design`。
