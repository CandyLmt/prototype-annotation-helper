# Supabase 数据库配置指南

## 第一步：创建 Supabase 项目

1. 访问 https://supabase.com/ 并注册/登录
2. 点击 "New Project" 创建新项目
3. 填写项目名称、密码等信息，点击 "Create new project"
4. 等待项目初始化完成（约1分钟）

## 第二步：创建数据库表

1. 在左侧菜单点击 "SQL Editor"
2. 创建一个新的 SQL 查询
3. 执行以下 SQL 语句创建 `annotations` 表：

```sql
CREATE TABLE annotations (
  id BIGSERIAL PRIMARY KEY,
  page_url TEXT NOT NULL,
  selector TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_annotations_page_url ON annotations(page_url);
```

## 第三步：获取 API 密钥

1. 在左侧菜单点击 "Settings"
2. 点击 "API" 选项卡
3. 复制以下信息：
   - **URL**: 在 "Project URL" 下方
   - **anon key**: 在 "anon public" 下方

## 第四步：配置扩展

打开以下文件，将 `YOUR_SUPABASE_URL` 和 `YOUR_SUPABASE_ANON_KEY` 替换为您的实际值：

### 1. content.js

找到以下代码并替换：
```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

### 2. popup.js

找到以下代码并替换：
```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

### 3. supabase.js（可选）

如果使用独立的 supabase.js 文件，同样替换：
```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

## 第五步：配置 Row Level Security

为了确保数据安全，建议启用 Row Level Security：

1. 在左侧菜单点击 "Authentication" → "Policies"
2. 点击 "Create Policy"
3. 为 `annotations` 表创建策略：

```sql
-- 允许所有人读取注释
CREATE POLICY "Allow read access to annotations"
ON annotations
FOR SELECT
TO public
USING (true);

-- 允许所有人创建注释
CREATE POLICY "Allow insert access to annotations"
ON annotations
FOR INSERT
TO public
WITH CHECK (true);

-- 允许所有人更新自己创建的注释
CREATE POLICY "Allow update access to annotations"
ON annotations
FOR UPDATE
TO public
USING (true);

-- 允许所有人删除注释
CREATE POLICY "Allow delete access to annotations"
ON annotations
FOR DELETE
TO public
USING (true);
```

4. 启用 RLS：
```sql
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
```

## 数据库表结构说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL | 主键，自增 ID |
| page_url | TEXT | 页面 URL |
| selector | TEXT | CSS 选择器 |
| text | TEXT | 注释内容 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

## 测试连接

1. 安装扩展到 Chrome
2. 打开任意网页
3. 点击扩展图标添加注释
4. 在 Supabase 的 "Table Editor" 中查看 `annotations` 表，确认数据已保存

## 常见问题

### Q: 数据保存失败？
A: 检查：
- Supabase URL 和 ANON KEY 是否正确
- 网络连接是否正常
- 表是否创建成功
- RLS 策略是否正确配置

### Q: 如何跨设备同步？
A: 数据存储在 Supabase 云端，只要使用相同的配置，在任何设备上都可以访问

### Q: 如何备份数据？
A: 在 Supabase 控制台可以导出数据为 CSV 或 JSON 格式

### Q: 可以自定义表名吗？
A: 可以，但需要同步修改代码中的表名

## 示例数据

插入示例数据：
```sql
INSERT INTO annotations (page_url, selector, text)
VALUES 
('https://example.com', '.button-submit', '点击此按钮提交表单'),
('https://example.com', '#username', '用户名输入框，支持中英文');
```

## API 端点

扩展使用以下 Supabase REST API 端点：
- `GET /annotations?page_url=eq.{url}` - 获取页面注释
- `POST /annotations` - 创建新注释
- `PATCH /annotations?id=eq.{id}` - 更新注释
- `DELETE /annotations?id=eq.{id}` - 删除单个注释
- `DELETE /annotations?page_url=eq.{url}` - 删除页面所有注释
