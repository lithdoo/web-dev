# FSDB 文件存储数据库完整规范

## 1. 系统概述

FSDB（File Store Database）是一种基于文件系统的轻量级数据存储方案。该系统将数据以文件形式存储，通过特定的目录结构和元数据文件来组织和管理数据。FSDB 适用于需要轻量级数据存储、强调数据可移植性、或希望避免传统数据库复杂性的应用场景。

### 1.1 核心特性

- **轻量级**：无需安装数据库服务，仅依赖文件系统
- **可移植**：数据以标准 JSON 格式存储，易于备份和迁移
- **结构化**：通过 JSON Schema 定义数据结构，保证数据一致性
- **可扩展**：支持基础表、拓展表和资源表三种类型
- **关联性**：拓展表支持引用基础表，实现数据关联

### 1.2 适用场景

- 小型应用的数据存储
- 配置文件和元数据管理
- 原型和快速迭代项目
- 需要人工阅读或编辑数据的场景
- 分布式系统中的共享配置存储

### 1.3 不适用场景

- 高并发写入场景
- 大规模数据存储（GB 级以上）
- 需要复杂查询能力的应用
- 对性能要求极高的实时系统

## 2. 目录结构规范

### 2.1 命名约定

所有 FSDB 数据目录均以特定前缀开头，用于标识目录类型。目录名称格式为：`[<类型>]<名称>/`

### 2.2 前缀定义

| 前缀 | 名称 | 用途 | 必需文件 |
|------|------|------|----------|
| `[struct]` | 基础表 | 存储核心业务实体 | `.info.meta` |
| `[extend]` | 拓展表 | 存储关联扩展数据 | `.info.meta`, `.extend.meta` |
| `[resource]` | 资源表 | 存储非结构化资源 | `.desc.meta` |

### 2.3 目录层级

```
[FSDB]<数据库名>/
├── [struct]<基础表名1>/
│   ├── {key1}.json
│   ├── {key2}.json
│   └── .info.meta
├── [struct]<基础表名2>/
│   └── ...
├── [extend]<拓展表名1>/
│   ├── {key1}.json
│   ├── {key2}.json
│   ├── .info.meta
│   └── .extend.meta
└── [resource]<资源表名1>/
    ├── {key1}.{ext1}
    ├── {key2}.{ext2}
    └── .desc.meta
```

## 3. 基础表详细规范

### 3.1 定义与用途

基础表是 FSDB 系统的核心数据存储单元。每个基础表对应一个独立的业务概念或数据实体，如用户、订单、产品等。基础表之间相互独立，不直接关联。

### 3.2 目录结构

```
[struct]<数据名>/
├── {key1}.json
├── {key2}.json
├── {key3}.json
└── .info.meta
```

### 3.3 数据文件规范

**文件格式**：独立的 JSON 文件

**文件命名**：`{key}.json`

- `key` 必须是唯一的字符串标识符
- key 应具有可读性，建议使用有意义的名称
- key 可以包含字母、数字、下划线、连字符
- 避免使用特殊字符

**数据内容**：每条数据以 JSON 对象形式存储

**示例**（`users/user001.json`）：

```json
{
  "id": "user001",
  "username": "zhangsan",
  "email": "zhangsan@example.com",
  "full_name": "张三",
  "status": "active",
  "created_at": "2024-01-15T10:30:00Z",
  "roles": ["user", "editor"]
}
```

### 3.4 元数据文件（.info.meta）

#### 3.4.1 文件格式

`.info.meta` 文件采用 JSON Schema 格式，用于描述该目录下所有 JSON 数据文件的结构。

#### 3.4.2 必需字段

| 字段 | 说明 |
|------|------|
| `$schema` | JSON Schema 版本声明 |
| `type` | 对象类型（固定为 "object"） |
| `properties` | 字段定义对象 |
| `required` | 必填字段数组 |

#### 3.4.3 完整示例

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "用户信息",
  "description": "系统用户的基础信息",
  "properties": {
    "id": {
      "type": "string",
      "title": "用户ID",
      "description": "用户的唯一标识符"
    },
    "username": {
      "type": "string",
      "title": "用户名",
      "description": "用户登录名",
      "minLength": 3,
      "maxLength": 20,
      "pattern": "^[a-zA-Z][a-zA-Z0-9_]*$"
    },
    "email": {
      "type": "string",
      "title": "邮箱",
      "format": "email"
    },
    "status": {
      "type": "string",
      "title": "状态",
      "enum": ["active", "inactive", "suspended"]
    },
    "created_at": {
      "type": "string",
      "title": "创建时间",
      "format": "date-time"
    }
  },
  "required": ["id", "username", "email"]
}
```

#### 3.4.4 支持的数据类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `string` | 字符串 | `"hello"` |
| `integer` | 整数 | `42` |
| `number` | 数字 | `3.14` |
| `boolean` | 布尔值 | `true` / `false` |
| `array` | 数组 | `[1, 2, 3]` |
| `object` | 对象 | `{"key": "value"}` |
| `null` | 空值 | `null` |

#### 3.4.5 常用约束

| 约束 | 说明 |
|------|------|
| `minLength` | 最小长度（string） |
| `maxLength` | 最大长度（string） |
| `minimum` | 最小值（number） |
| `maximum` | 最大值（number） |
| `enum` | 枚举值列表 |
| `pattern` | 正则表达式（string） |
| `format` | 格式验证（date-time, email, uri） |
| `items` | 数组元素定义（array） |

## 4. 拓展表详细规范

### 4.1 定义与用途

拓展表用于存储与基础表相关联的扩展数据。通过引用机制，拓展表可以关联一个或多个基础表，实现数据的关系映射。适用于订单明细（关联用户和产品）、评论（关联用户和文章）等场景。

### 4.2 目录结构

```
[extend]<数据名>/
├── {key1}.json
├── {key2}.json
├── {key3}.json
├── .info.meta
└── .extend.meta
```

### 4.3 数据文件规范

与基础表相同，拓展表的每个数据文件也是独立的 JSON 文件，文件命名为 `{key}.json`。

**关键区别**：拓展表的数据中包含引用字段，这些字段存储的是被引用基础表数据的 key 值。

**示例**（`orders/order001.json`）：

```json
{
  "order_id": "order001",
  "user_id": "user001",
  "product_id": "prod001",
  "quantity": 2,
  "price": 99.99,
  "total": 199.98,
  "status": "completed",
  "ordered_at": "2024-01-15T14:30:00Z"
}
```

### 4.4 元数据文件

#### 4.4.1 .info.meta 文件

与基础表的 `.info.meta` 格式相同，采用 JSON Schema 格式。

**重要约束**：在 `.extend.meta` 中声明为引用的字段，在 `.info.meta` 中必须定义为 `string` 类型。

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "order_id": {
      "type": "string",
      "description": "订单唯一标识符"
    },
    "user_id": {
      "type": "string",
      "description": "下单用户ID（引用 users 表）"
    },
    "product_id": {
      "type": "string",
      "description": "产品ID（引用 products 表）"
    },
    "quantity": {
      "type": "integer",
      "description": "购买数量"
    },
    "total": {
      "type": "number",
      "description": "订单总价"
    }
  },
  "required": ["order_id", "user_id", "product_id", "quantity"]
}
```

#### 4.4.2 .extend.meta 文件

`.extend.meta` 文件采用 JSONL（JSON Lines）格式，每行是一个独立的 JSON 对象，用于声明引用关系。

**格式定义**：

```json
{"field": "<字段名>", "struct": "<基础表名>", "desc": "<描述>"}
```

**完整示例**：

```json
{"field": "user_id", "struct": "users", "desc": "关联下单用户"}
{"field": "product_id", "struct": "products", "desc": "关联购买产品"}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| field | string | 是 | 拓展表中存储引用关系的字段名 |
| struct | string | 是 | 被引用的基础表名称（不含前缀） |
| desc | string | 否 | 引用关系的业务描述 |

### 4.5 引用约束

1. 被引用的基础表必须存在
2. 引用字段在数据中存储的是基础表的 key 值
3. 系统不强制检查引用完整性（由应用层处理）
4. 同一个拓展表可以引用多个不同的基础表

## 5. 资源表详细规范

### 5.1 定义与用途

资源表用于存储系统中的非结构化或半结构化数据。这包括但不限于：

- 图片文件（JPG、PNG、GIF、WebP）
- 文档文件（PDF、DOCX、Markdown）
- 音频文件（MP3、WAV、OGG）
- 视频文件（MP4、AVI、MOV）
- 配置文件（YAML、TOML、INI）

### 5.2 目录结构

```
[resource]<数据名>/
├── {key1}.{ext1}
├── {key2}.{ext2}
├── {key3}.{ext3}
└── .desc.meta
```

### 5.3 数据文件规范

**文件格式**：任意类型的文件

**文件命名**：`{key}.{ext}`

- `key`：唯一标识符
- `ext`：文件扩展名，标识文件类型

**示例**：

- `avatar001.jpg` - 用户头像
- `document001.pdf` - PDF 文档
- `audio001.mp3` - 音频文件
- `config001.yaml` - 配置文件

### 5.4 描述文件（.desc.meta）

`.desc.meta` 文件采用 Markdown 格式，用于描述该资源表的用途、存储规范和管理策略。

**示例结构**：

```markdown
# 用户头像资源

## 用途说明
存储系统用户的头像图片，用于用户个人资料展示。

## 支持格式
- JPG/JPEG
- PNG
- GIF（静态）
- WebP

## 存储限制
- 单文件大小：最大 2MB
- 建议尺寸：200x200 像素到 800x800 像素
- 颜色模式：RGB

## 命名规范
使用用户ID作为 key，确保与用户记录一一对应。

## 文件命名示例
- `user001.jpg`
- `user002.png`

## 管理策略
1. 新用户默认不创建头像文件
2. 用户上传后使用 `user{id}.{ext}` 格式保存
3. 删除用户时同步删除头像文件
4. 建议按用户ID首字母分组存储（可选）

## 访问方式
通过 key 访问资源：`/resources/avatars/{key}.{ext}`
```

## 6. 数据关联与引用

### 6.1 引用工作流程

1. **定义阶段**：在拓展表的 `.extend.meta` 中声明引用关系
2. **存储阶段**：拓展表数据中，引用字段存储被引用基础表的 key 值
3. **查询阶段**：通过 key 值关联查询基础表数据

### 6.2 查询示例

假设有以下数据结构：

```
[FSDB]shop/
├── [struct]users/
│   ├── user001.json
│   └── .info.meta
├── [struct]products/
│   ├── prod001.json
│   └── .info.meta
└── [extend]orders/
    ├── order001.json
    ├── .info.meta
    └── .extend.meta
```

**orders/order001.json**：
```json
{
  "order_id": "order001",
  "user_id": "user001",
  "product_id": "prod001",
  "quantity": 1
}
```

**查询用户信息**：
1. 从 orders 数据中读取 `user_id` 字段
2. 在 `[struct]users/` 目录下查找 `user001.json`
3. 读取并返回用户数据

### 6.3 多级引用

一个拓展表可以引用多个基础表：

```json
{"field": "user_id", "struct": "users", "desc": "下单用户"}
{"field": "shipping_address_id", "struct": "addresses", "desc": "收货地址"}
{"field": "billing_address_id", "struct": "addresses", "desc": "账单地址"}
```

### 6.4 引用完整性策略

由于 FSDB 是文件系统存储，不自动强制引用完整性。建议应用层实现以下策略：

- **级联删除**：删除基础表数据时，同时删除引用它的拓展表数据
- **软删除**：标记数据为已删除而非物理删除
- **定期清理**：定期扫描并清理无效引用
- **查询时验证**：在查询拓展表时，检查引用是否存在

## 7. 最佳实践

### 7.1 命名规范

**目录命名**：
- 使用清晰的业务含义名称
- 使用英文命名（避免中文路径兼容性问题）
- 使用复数形式（如 `users` 而非 `user`）

**key 命名**：
- 使用有意义的标识符
- 保持一致性（如全部使用 UUID 或全部使用业务 ID）
- 避免使用特殊字符

### 7.2 结构设计

**基础表设计**：
- 每个基础表应代表一个独立的业务实体
- 避免在一个基础表中存储过多字段
- 相关字段归类到同一基础表

**拓展表设计**：
- 拓展表应专注于特定关联场景
- 避免在拓展表中重复存储基础表已有数据
- 引用字段命名应清晰表明引用关系

### 7.3 元数据编写

**编写原则**：
- 完整描述所有字段的含义和用途
- 明确标注必填字段
- 提供合理的约束条件
- 添加业务场景说明

### 7.4 性能优化

**目录结构**：
- 大型资源表可按类型或日期进一步分组
- 示例：`[resource]avatars/2024/01/user001.jpg`

**文件数量**：
- 单个表目录下建议不超过 10000 个文件
- 超过时考虑分表策略

### 7.5 数据备份

**备份策略**：
- 使用标准文件系统备份工具
- 保持目录结构完整性
- 定期验证备份数据可恢复性

## 8. 常见问题

### Q1: 如何处理并发写入？

FSDB 本身不提供并发控制。在高并发场景下，建议：
- 使用文件锁机制
- 通过应用层实现队列
- 考虑使用传统数据库

### Q2: 如何迁移到其他存储系统？

1. 编写脚本读取所有 JSON 文件
2. 转换数据格式
3. 导入目标数据库
4. 验证数据完整性

### Q3: 能否在云存储上使用 FSDB？

可以。FSDB 兼容支持文件系统的存储服务：
- AWS S3（通过 s3fs 等工具）
- Azure Blob Storage
- Google Cloud Storage
- NFS 共享存储

### Q4: 如何处理大文件？

对于大文件（>100MB）：
- 考虑使用专门的存储服务
- 在资源表中仅存储文件引用
- 实现分块存储机制

## 9. 工具支持

### 9.1 配套脚本

本技能提供以下脚本支持：

| 脚本 | 功能 |
|------|------|
| `create-table.sh` | 创建 FSDB 表结构 |
| `manage-data.sh` | 数据的增删改查操作 |
| `validate-schema.sh` | 验证表结构合规性 |

### 9.2 使用方法

```bash
# 创建基础表
./scripts/create-table.sh "/path/to/fsdb" struct users

# 创建拓展表
./scripts/create-table.sh "/path/to/fsdb" extend orders

# 数据操作
./scripts/manage-data.sh create "[struct]users" "user001" '{"id":"user001","name":"张三"}'
./scripts/manage-data.sh read "[struct]users" "user001"

# 验证结构
./scripts/validate-schema.sh "/path/to/fsdb/[struct]users"
```

## 10. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2024-01-15 | 初始规范发布 |
| 1.1.0 | 2024-03-20 | 增加资源表类型 |
| 1.2.0 | 2024-06-10 | 完善引用机制说明 |
