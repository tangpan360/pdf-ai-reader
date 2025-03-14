# PDF处理与展示系统

这是一个基于Web的PDF处理系统，可以上传PDF文件，将其转换为Markdown格式，并在网页上展示处理结果。系统支持文件管理、历史记录查看和内容展示等功能。

## 功能特点

- **PDF文件上传**：支持拖拽或点击上传PDF文件
- **自动处理**：调用Python环境中的magic-pdf工具进行PDF到Markdown的转换
- **内容展示**：
  - 正确显示Markdown内容，包括图片、公式和表格
  - 支持HTML表格的渲染
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
  - Next.js：React框架，提供服务端渲染和API路由
  - TailwindCSS：用于样式设计
  - react-markdown：用于渲染Markdown内容
  - react-dropzone：处理文件拖拽上传
  - rehype-katex & remark-math：渲染数学公式
  - rehype-raw：支持HTML内容渲染

- **后端**：
  - Next.js API Routes：处理HTTP请求
  - Node.js子进程：执行Python脚本
  - fs模块：文件系统操作

- **数据存储**：
  - localStorage：保存处理状态
  - JSON文件：存储处理历史记录
  - 文件系统：存储上传的PDF和处理结果

## 项目结构

```
pdf-processor/
├── public/                 # 静态资源
├── src/
│   ├── components/         # React组件
│   │   ├── FileUploader.js # 文件上传组件
│   │   ├── MarkdownViewer.js # Markdown渲染组件
│   │   ├── ProcessingStatus.js # 处理状态组件
│   ├── pages/              # Next.js页面
│   │   ├── index.js        # 主页
│   │   ├── history.js      # 历史记录页面
│   │   ├── view/[filename].js # 文件查看页面
│   │   ├── _app.js         # 应用入口
│   │   └── api/            # API路由
│   │       ├── upload.js   # 处理文件上传
│   │       ├── process.js  # 处理PDF文件
│   │       ├── content.js  # 获取Markdown内容
│   │       ├── history.js  # 获取历史记录
│   │       ├── delete.js   # 删除文件
│   │       └── static/[...path].js # 静态文件服务
│   ├── styles/             # 样式文件
│   └── utils/              # 工具函数
│       ├── fileSystem.js   # 文件系统操作
│       ├── processRunner.js # 运行处理脚本
│       └── historyManager.js # 历史记录管理
├── uploads/                # 上传的PDF文件
├── output/                 # 处理结果输出
├── history.json            # 历史记录文件
├── package.json            # 项目依赖
└── next.config.js          # Next.js配置
```

## 安装与使用

### 前提条件

- Node.js 14.x 或更高版本
- Python 环境（已安装magic-pdf工具）
- Conda（用于激活Python环境）

### 安装步骤

1. 克隆仓库
```bash
git clone https://github.com/tangpan360/pdf-ai-reader.git
cd pdf-processor
```

2. 安装依赖
```bash
npm install
```

3. 创建必要的目录
```bash
mkdir -p uploads output
```

4. 启动开发服务器
```bash
npm run dev
```

5. 访问应用
打开浏览器，访问 http://localhost:3000

## 使用方法

### 上传和处理PDF

1. 在主页上传PDF文件（拖拽或点击上传按钮）
2. 系统会自动处理PDF文件，并显示处理状态
3. 处理完成后，Markdown内容会显示在页面上
4. 点击右上角的"上传新文件"按钮可以上传新的PDF文件

### 查看历史记录

1. 点击右上角的"查看历史记录"按钮
2. 在历史记录页面可以查看所有已处理的文件
3. 点击文件名或"查看"按钮可以查看文件内容
4. 点击"删除"按钮可以删除文件及其处理结果

### 查看文件内容

1. 在历史记录页面点击文件名或"查看"按钮
2. 系统会显示文件的Markdown内容
3. 支持显示图片、公式和表格等内容

## 后续开发计划

- 实现PDF原始内容与识别结果的对比显示
- 添加文本选择和AI问答功能
- 支持自定义大模型和中转API
- 增强编辑功能，支持直接修改识别内容

## 贡献

欢迎提交问题和改进建议。如果您想贡献代码，请先创建一个issue讨论您想要改变的内容。
