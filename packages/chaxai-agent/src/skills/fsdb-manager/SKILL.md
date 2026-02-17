---
name: "fsdb-manager"
description: "管理 FSDB（文件存储数据库）系统，包括基础表、拓展表和资源表的创建、读取、更新和删除操作。当用户需要操作文件系统数据库、管理数据表结构或处理非结构化资源时调用此技能。"
---

# FSDB 文件存储数据库管理技能

本技能提供对 FSDB（File Store Database）文件存储数据库的全面管理能力。FSDB 是一种基于文件系统的轻量级数据存储方案，通过特定目录结构和元数据文件来组织和管理数据。

## 目录结构规范

FSDB 数据目录使用特定前缀标识表类型：

| 前缀 | 表类型 | 用途 |
|------|--------|------|
| `[struct]` | 基础表 | 存储核心业务实体数据 |
| `[extend]` | 拓展表 | 存储关联扩展数据 |
| `[resource]` | 资源表 | 存储非结构化文件资源 |

### 完整目录层级

```
[FSDB]<数据库名>/
├── [struct]<基础表名1>/
│   ├── {key1}.json
│   ├── {key2}.json
│   └── .info.meta
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

## 基础表操作

### 用途与场景

基础表是 FSDB 系统的核心数据存储单元，用于存储系统中最基础、最核心的数据实体。每个基础表对应一个独立的业务概念或数据实体，例如用户、订单、产品等。

### 目录结构

```
[struct]<数据名>/
├── {key1}.json
├── {key2}.json
├── {key3}.json
└── .info.meta
```

### 创建基础表

```bash
# 创建基础表目录
mkdir "[struct]users"

# 创建元数据文件 .info.meta（JSON Schema 格式）
```

### 元数据文件（.info.meta）

`.info.meta` 文件采用 JSON Schema 格式，描述数据结构：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "用户唯一标识符"
    },
    "name": {
      "type": "string",
      "description": "用户姓名"
    },
    "email": {
      "type": "string",
      "format": "email",
      "description": "用户邮箱"
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "description": "创建时间"
    }
  },
  "required": ["id", "name", "email"]
}
```

### 数据文件规范

- **文件格式**：独立的 JSON 文件
- **文件命名**：`{key}.json`，其中 key 是唯一标识符
- **数据内容**：每条数据以 JSON 对象形式存储

**示例数据文件**（`user001.json`）：

```json
{
  "id": "user001",
  "name": "张三",
  "email": "zhangsan@example.com",
  "created_at": "2024-01-15T10:30:00Z"
}
```

## 拓展表操作

### 用途与场景

拓展表用于存储与基础表相关联的扩展数据。通过引用字段连接基础表，实现表之间的关联和数据扩展，适用于订单详情、用户评论、日志记录等场景。

### 目录结构

```
[extend]<数据名>/
├── {key1}.json
├── {key2}.json
├── {key3}.json
├── .info.meta
└── .extend.meta
```

### 创建拓展表

```bash
# 创建拓展表目录
mkdir "[extend]orders"

# 创建元数据文件 .info.meta
# 创建引用定义文件 .extend.meta
```

### 元数据文件

#### .info.meta 文件

与基础表相同，采用 JSON Schema 格式描述数据结构。**重要约束**：在 `.extend.meta` 中声明的引用字段，在 `.info.meta` 中必须定义为 `string` 类型。

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
      "description": "关联用户ID"
    },
    "product_id": {
      "type": "string",
      "description": "关联产品ID"
    },
    "quantity": {
      "type": "integer",
      "description": "购买数量"
    },
    "total_price": {
      "type": "number",
      "description": "订单总价"
    }
  },
  "required": ["order_id", "user_id", "product_id"]
}
```

#### .extend.meta 文件

采用 JSONL（JSON Lines）格式，每行一个 JSON 对象声明引用关系：

```json
{"field": "user_id", "struct": "users", "desc": "关联下单用户"}
{"field": "product_id", "struct": "products", "desc": "关联购买产品"}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| field | string | 是 | 拓展表中存储引用关系的字段名 |
| struct | string | 是 | 被引用的基础表名称 |
| desc | string | 否 | 引用关系的业务描述 |

### 数据文件示例

```json
{
  "order_id": "order001",
  "user_id": "user001",
  "product_id": "prod001",
  "quantity": 2,
  "total_price": 199.98
}
```

## 资源表操作

### 用途与场景

资源表用于存储系统中的非结构化或半结构化数据，如图片、音频、视频、文档等二进制或文本资源文件。适用于用户头像、产品图片、附件文档等场景。

### 目录结构

```
[resource]<数据名>/
├── {key1}.{ext1}
├── {key2}.{ext2}
├── {key3}.{ext3}
└── .desc.meta
```

### 创建资源表

```bash
# 创建资源表目录
mkdir "[resource]avatars"

# 创建描述文件 .desc.meta
```

### 数据文件规范

- **文件格式**：任意类型的文件（由扩展名决定）
- **文件命名**：`{key}.{ext}`，其中：
  - key：唯一标识符
  - ext：文件扩展名

**示例**：
- `avatar001.jpg`
- `avatar002.png`
- `doc001.pdf`

### 描述文件（.desc.meta）

采用 Markdown 格式描述资源信息：

```markdown
# 用户头像资源

## 用途
存储系统用户的头像图片。

## 存储规范
- 支持格式：JPG、PNG、GIF
- 文件大小限制：最大 2MB
- 尺寸要求：建议 200x200 像素

## 命名约定
使用用户ID作为 key，确保文件名与用户关联。

## 管理策略
- 定期清理无效引用
- 建议按用户ID子目录分类存储
```

## 数据关联与引用

### 引用规则

拓展表通过 `.extend.meta` 文件声明对基础表的引用关系：

1. 在 `.extend.meta` 中声明引用字段和目标基础表
2. 拓展表 JSON 数据中，该字段存储目标基础表数据的 key 值
3. 系统可通过 key 值查询并关联对应基础表数据

### 多级引用

一个拓展表可以引用多个不同的基础表，在 `.extend.meta` 文件中定义多行 JSON 记录即可。

### 引用完整性约束

- 引用的基础表必须存在
- 引用的 key 值必须在基础表中有对应数据
- 基础表数据删除时，需处理拓展表中的引用（策略由应用层决定）

## 常用操作命令

### 创建 FSDB 数据库

```bash
# 创建 FSDB 根目录
mkdir "[FSDB]mydb"
```

### 创建基础表

```bash
# 创建带元数据的基础表
cd "[FSDB]mydb"
mkdir "[struct]users"
# 编写 .info.meta 文件
```

### 创建拓展表

```bash
# 创建带引用的拓展表
cd "[FSDB]mydb"
mkdir "[extend]user_orders"
# 编写 .info.meta 和 .extend.meta
```

### 创建资源表

```bash
# 创建资源表
cd "[FSDB]mydb"
mkdir "[resource]documents"
# 编写 .desc.meta 文件
# 添加资源文件
```

### 数据操作

```bash
# 读取数据
cat "[struct]users/user001.json"

# 写入数据
echo '{"id":"user002","name":"李四"}' > "[struct]users/user002.json"

# 更新数据
# 直接编辑对应的 .json 文件

# 删除数据
rm "[struct]users/user001.json"
```

## 最佳实践

### 命名规范

- 使用有意义的名称命名数据表
- key 值应具有唯一性和可读性
- 资源文件的扩展名应准确反映文件类型
- 避免使用特殊字符在目录和文件名中

### 元数据编写

- `.info.meta` 应完整描述所有字段
- `.extend.meta` 中的 `desc` 字段应清晰说明业务含义
- `.desc.meta` 应详细说明资源的用途和管理方式

### 数据组织

- 相关的基础表和拓展表应组织在同一个 FSDB 目录下
- 大型资源文件建议按类型或日期进一步子目录分类
- 定期清理无效的 key 和孤立引用

## 调用场景

当用户提出以下需求时，应调用此技能：

- 创建或管理 FSDB 存储结构
- 对基础表、拓展表或资源表进行 CRUD 操作
- 定义数据表结构和元数据
- 管理表之间的引用关系
- 处理非结构化资源文件（图片、文档等）
- 实现轻量级文件数据持久化
- 查询或分析文件系统数据库中的数据

## 相关资源

- **参考文档**：`$env:SKILL_DIR/references/fsdb-specification.md` - FSDB 完整规范说明
- **脚本示例**：`$env:SKILL_DIR/scripts/create-table.ts` - 创建/更新 FSDB 表结构脚本（支持 Bun / Node.js）
- **脚本示例**：`$env:SKILL_DIR/scripts/delete-table.ts` - 删除表脚本（支持 Bun / Node.js）
- **脚本示例**：`$env:SKILL_DIR/scripts/manage-data.ts` - 数据管理脚本集合（使用 Bun / Node.js 运行）
- **脚本示例**：`$env:SKILL_DIR/scripts/validate-table.ts` - 数据结构验证脚本（使用 Bun / Node.js 运行）

> **说明**：`create-table.ts` 脚本的 `--force` 参数可用于更新现有表的元数据。

### create-table.ts 使用说明

创建基础表、拓展表或资源表的元数据文件。

**命令参数**：

| 参数 | 说明 |
|------|------|
| `-t, --type <type>` | 表类型：struct、extend、resource（默认：struct） |
| `-d, --db <path>` | FSDB 数据库根路径 |
| `-n, --name <name>` | 表名称（不含前缀） |
| `-s, --schema <json>` | struct/extend 表的 JSON Schema（JSON 字符串） |
| `-e, --extends <json>` | extend 表的引用定义（JSON 数组） |
| `-c, --desc <text>` | resource 表的描述（Markdown 文本或文件路径） |
| `-f, --force` | 覆盖现有表元数据而不提示 |
| `-h, --help` | 显示帮助信息 |

**使用示例**：

```bash
# 创建基础表（users）
cd "[FSDB]mydb"
bun $env:SKILL_DIR/scripts/create-table.ts -d . -n users -t struct \
  -s '{"title":"用户表","properties":{"id":{"type":"string"},"name":{"type":"string"}},"required":["id","name"]}'

# 创建拓展表（orders），包含对 users 表的引用
bun $env:SKILL_DIR/scripts/create-table.ts -d . -n orders -t extend \
  -s '{"title":"订单表","properties":{"order_id":{"type":"string"},"user_id":{"type":"string"}},"required":["order_id","user_id"]}' \
  -e '[{"field":"user_id","struct":"users","desc":"关联下单用户"}]'

# 创建资源表（avatars）
bun $env:SKILL_DIR/scripts/create-table.ts -d . -n avatars -t resource \
  -c '# 用户头像资源\n\n存储用户头像图片。'
```

**验证参数**：

- struct 表：必须提供包含 `$schema`、`type`、`properties`、`required` 的 JSON Schema
- extend 表：必须提供 JSON Schema 和 extends 定义（每个引用包含 `field` 和 `struct`）
- resource 表：必须提供描述文本

**注意事项**：

- 同名表存在时会提示确认，使用 `--force` 参数可跳过确认
- 仅更新元数据文件，不修改原有数据文件

### delete-table.ts 使用说明

删除 FSDB 表及其所有数据文件。

**命令参数**：

| 参数 | 说明 |
|------|------|
| `-d, --db <path>` | FSDB 数据库根路径 |
| `-n, --name <name>` | 表名称（不含前缀） |
| `-f, --force` | 删除表而不提示确认 |
| `-h, --help` | 显示帮助信息 |

**使用示例**：

```bash
# 删除表（需要手动确认）
cd "[FSDB]mydb"
bun $env:SKILL_DIR/scripts/delete-table.ts -d . -n users

# 强制删除（不确认）
bun $env:SKILL_DIR/scripts/delete-table.ts -d . -n users --force
```

**验证参数**：

- 必须提供数据库路径（`--db`）和表名称（`--name`）
- 表必须存在，否则显示可用表列表

**注意事项**：

- 删除操作不可恢复，使用时需谨慎
- 无 `--force` 参数时会要求输入 "yes" 确认
- 会删除表目录下的所有文件和数据
- 仅支持删除完整的表，不支持部分删除
