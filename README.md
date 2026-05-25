# 原型标注助手

一个 Chrome 浏览器扩展，用于在任意网页上添加功能注释和标注。

## 功能特点

- ✅ **无需修改原页面** - 注释以浮层形式显示，不影响原页面结构
- ✅ **本地存储** - 所有数据保存在浏览器本地，保护隐私
- ✅ **持久保存** - 刷新页面后注释依然存在
- ✅ **快速定位** - 点击注释可快速定位到对应元素
- ✅ **批量管理** - 支持查看和删除本页所有注释
- ✅ **导入/导出** - 支持标注数据的导入和导出
- ✅ **多人协作** - 支持显示标注者信息

## 安装方法

1. 打开 Chrome 浏览器
2. 地址栏输入：`chrome://extensions/`
3. 右上角开启 **开发者模式**
4. 点击 **加载已解压的扩展程序**
5. 选择 `chrome-extension` 文件夹

## 使用说明

详细的使用说明请查看 [安装说明.md](chrome-extension/安装说明.md)

## 项目结构

```
chrome-extension/
├── manifest.json      # 扩展配置文件
├── background.js      # 后台脚本
├── content.js         # 页面内容脚本
├── content.css        # 标注样式
├── popup.html         # 弹窗界面
├── popup.js           # 弹窗逻辑
├── supabase.js        # Supabase 配置
└── icons/             # 图标文件
```

## 技术栈

- Chrome Extension API
- JavaScript (ES6+)
- HTML5 / CSS3
- Supabase (后端存储)

## 许可证

MIT License