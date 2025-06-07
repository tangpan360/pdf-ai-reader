# PDF 处理与展示系统

这是一个基于 Web 的 PDF 处理系统，可以上传 PDF 文件，将其转换为 Markdown 格式，并在网页上展示处理结果。系统支持文件管理、历史记录查看和内容展示等功能。

## 功能特点

- **PDF 文件上传**：支持拖拽或点击上传 PDF 文件
- **自动处理**：调用 Python 环境中的 magic-pdf 工具进行 PDF 到 Markdown 的转换
- **内容展示**：
  - 正确显示 Markdown 内容，包括图片、公式和表格
  - 支持 HTML 表格的渲染
  - 支持数学公式的显示
- **历史记录管理**：
  - 查看已处理的文件列表
  - 显示处理时间
  - 支持删除文件及其处理结果
- **用户友好界面**：
  - 响应式设计，适配不同设备
  - 处理状态实时反馈
  - 支持上传新文件
  - 文件名超长时显示省略号，鼠标悬停显示完整名称

## 技术栈

- **前端**：
  - React.js：用于构建用户界面
  - Next.js：React 框架，提供服务端渲染和 API 路由
  - TailwindCSS：用于样式设计
  - react-markdown：用于渲染 Markdown 内容
  - react-dropzone：处理文件拖拽上传
  - rehype-katex & remark-math：渲染数学公式
  - rehype-raw：支持 HTML 内容渲染

- **后端**：
  - Next.js API Routes：处理 HTTP 请求
  - Node.js 子进程：执行 Python 脚本
  - fs 模块：文件系统操作

- **数据存储**：
  - localStorage：保存处理状态
  - JSON 文件：存储处理历史记录
  - 文件系统：存储上传的 PDF 和处理结果

## 项目结构

```

pdf-processor/
├── public/                 # 静态资源
├── src/
│   ├── components/         # React 组件
│   │   ├── FileUploader.js # 文件上传组件
│   │   ├── MarkdownViewer.js # Markdown 渲染组件
│   │   ├── ProcessingStatus.js # 处理状态组件
│   ├── pages/              # Next.js 页面
│   │   ├── index.js        # 主页
│   │   ├── history.js      # 历史记录页面
│   │   ├── view/[filename].js # 文件查看页面
│   │   ├── _app.js         # 应用入口
│   │   └── api/            # API 路由
│   │       ├── upload.js   # 处理文件上传
│   │       ├── process.js  # 处理 PDF 文件
│   │       ├── content.js  # 获取 Markdown 内容
│   │       ├── history.js  # 获取历史记录
│   │       ├── delete.js   # 删除文件
│   │       └── static/[...path].js # 静态文件服务
│   ├── styles/             # 样式文件
│   └── utils/              # 工具函数
│       ├── fileSystem.js   # 文件系统操作
│       ├── processRunner.js # 运行处理脚本
│       └── historyManager.js # 历史记录管理
├── uploads/                # 上传的 PDF 文件
├── output/                 # 处理结果输出
├── history.json            # 历史记录文件
├── package.json            # 项目依赖
└── next.config.js          # Next.js 配置
```

## 安装与使用

### 前提条件

- Node.js 14.x 或更高版本
- Python 环境（已安装 magic-pdf 工具）
- Conda（用于激活 Python 环境）
- 已部署 MinerU 并创建名为 "mineru" 的 conda 环境，并且确保能够成功运行 ``magic-pdf -p "input_name.pdf" -o output -m auto`` 命令（[安装指南](https://github.com/opendatalab/MinerU.git)）

### 安装步骤

1. 克隆仓库
```

git clone https://github.com/tangpan360/pdf-ai-reader.git
cd pdf-processor
```

2. 安装依赖
```

npm install
```

3. 创建必要的目录
```

mkdir -p uploads output
```

4. 启动开发服务器
```
# 默认端口（3000）启动
npm run dev

# 或在3010端口启动
PORT=3010 npm run dev
```

5. 访问应用
打开浏览器，访问 http://localhost:3000 或 http://localhost:3010（如果使用3010端口）

## 使用方法

### 上传和处理 PDF

1. 在主页上传 PDF 文件（拖拽或点击上传按钮）
2. 系统会自动处理 PDF 文件，并显示处理状态
3. 处理完成后，Markdown 内容会显示在页面上
4. 点击右上角的 "上传新文件" 按钮可以上传新的 PDF 文件

### 查看历史记录

1. 点击右上角的 "查看历史记录" 按钮
2. 在历史记录页面可以查看所有已处理的文件
3. 点击文件名或 "查看" 按钮可以查看文件内容
4. 点击 "删除" 按钮可以删除文件及其处理结果

### 查看文件内容

1. 在历史记录页面点击文件名或 "查看" 按钮
2. 系统会显示文件的 Markdown 内容
3. 支持显示图片、公式和表格等内容

## 后续开发计划

- 实现 PDF 原始内容与识别结果的对比显示
- 添加文本选择和 AI 问答功能
- 支持自定义大模型和中转 API
- 增强编辑功能，支持直接修改识别内容

## 贡献

欢迎提交问题和改进建议。如果您想贡献代码，请先创建一个 issue 讨论您想要改变的内容。
