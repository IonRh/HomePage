# 🏠 个人主页项目

交流群聊：https://t.me/IonMagic

一个使用原生 HTML、CSS、JavaScript 构建的个人主页项目，无需任何框架依赖，轻量高效。包含前端展示页面和后台管理系统，让你轻松定制属于自己的个人主页。

## 🌟 项目特色

- 🎨 **简洁美观** - 现代化设计风格，清爽的主页展示界面
- 🔧 **后台管理** - 便捷的数据管理系统，无需修改代码
- 📱 **响应式设计** - 完美适配手机、平板、桌面等各种设备
- ⚡ **极速加载** - 原生代码构建，零依赖，性能优异
- 🌐 **免费部署** - 基于 Cloudflare 免费服务，无需服务器成本

## 🌐 在线演示

- **前端展示页面：** http://home.loadke.tech/
- **后台管理系统：** https://divine-pine-fef2.likhappy.workers.dev/manage

## 🚀 部署教程

### 📋 准备工作

在开始之前，你需要：
- 一个 [Cloudflare](https://dash.cloudflare.com/) 账户（免费）
- 一个 GitHub 账户

### 🔧 第一步：部署后端服务（Cloudflare Workers）

#### 1.1 创建 Worker

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 点击左侧菜单 **"Workers 和 Pages"**
3. 点击 **"创建应用程序"** → **"创建 Worker"**

<img width="1767" alt="创建Worker" src="https://webproxy.badking.pp.ua/https://github.com/user-attachments/assets/15eb903e-e288-409e-8aca-2c7fca57fee1" />

#### 1.2 配置 Worker

1. 为你的 Worker 起一个名称（建议：`your-name-homepage`）
2. 点击 **"部署"**
3. 部署完成后，点击 **"编辑代码"**

<img width="2016" alt="编辑代码" src="https://webproxy.badking.pp.ua/https://github.com/user-attachments/assets/3b4ab43a-abac-4c24-8019-525c294a4cbc" />

#### 1.3 部署代码

1. 将项目中 `worker.js` 文件的完整代码复制到左侧编辑器
2. 点击 **"保存并部署"**
3. 记录下你的 Worker 域名：`https://your-worker-name.your-subdomain.workers.dev`

<img width="2537" alt="部署代码" src="https://webproxy.badking.pp.ua/https://github.com/user-attachments/assets/3de35041-7db2-4297-a6c8-591f3cbdddaf" />

### 💾 第二步：配置数据存储（KV 数据库）

#### 2.1 创建 KV 命名空间

1. 在 Cloudflare Dashboard 中，点击 **"Workers 和 Pages"** → **"KV"**
2. 点击 **"创建命名空间"**
3. 输入命名空间名称：`home_kv`
4. 点击 **"添加"**

<img width="1035" height="414" alt="image" src="https://github.com/user-attachments/assets/2d1a6c10-2a17-4e91-ac9f-a5eaf50baca4" />


#### 2.2 绑定 KV 到 Worker

1. 返回到你的 Worker 页面
2. 点击 **"设置"** → **"变量"**
3. 在 **"KV 命名空间绑定"** 部分，点击 **"添加绑定"**
4. 配置绑定：
   - **变量名：** `MY_HOME_KV`
   - **KV 命名空间：** 选择刚创建的 `home_kv`
5. 点击 **"保存并部署"**

<img width="1071" height="602" alt="image" src="https://github.com/user-attachments/assets/ac657c58-3ff7-4fa8-b355-b4fbd16c9ec8" />

### 🎨 第三步：部署前端页面（Cloudflare Pages）

#### 3.1 Fork 项目

1. 访问本项目的 GitHub 仓库
2. 点击右上角 **"Fork"** 按钮，将项目复制到你的账户

#### 3.2 修改配置文件

1. 在你 Fork 的仓库中，编辑 `static/script.js` 文件
2. 找到以下代码行：
   ```javascript
   const API_BASE = 'https://your-worker-domain.workers.dev';
   ```
3. 将 `your-worker-domain.workers.dev` 替换为你在第一步中获得的 Worker 域名

<img width="2049" alt="修改配置" src="https://webproxy.badking.pp.ua/https://github.com/user-attachments/assets/70c2778d-f84e-46c6-a830-61ee37423f3d" />

#### 3.3 部署到 Cloudflare Pages

1. 在 Cloudflare Dashboard 中，点击 **"Workers 和 Pages"**
2. 点击 **"创建应用程序"** → **"Pages"** → **"连接到 Git"**
3. 选择你 Fork 的仓库
4. 配置构建设置：
   - **框架预设：** 无（或静态站点）
   - **构建命令：** 留空
   - **构建输出目录：** `/` 或留空
5. 点击 **"保存并部署"**

<img width="2538" alt="部署Pages" src="https://webproxy.badking.pp.ua/https://github.com/user-attachments/assets/1decf2ca-3864-4f9f-b308-ee9cdc7a5af3" />

### ✅ 第四步：完成配置

#### 4.1 访问后台管理

1. 在浏览器中访问：`https://your-worker-domain.workers.dev/manage`
2. 使用默认登录信息：
   - **用户名：** `admin`
   - **密码：** `admin123`

<img width="936" alt="登录界面" src="https://webproxy.badking.pp.ua/https://github.com/user-attachments/assets/23975bdb-cc30-47ee-87f7-9fb4bb07d333" />

#### 4.2 修改默认设置

1. **⚠️ 立即修改默认密码** - 这很重要！
2. 更新个人信息、项目展示等数据
3. 保存所有更改

<img width="1766" alt="管理界面" src="https://webproxy.badking.pp.ua/https://github.com/user-attachments/assets/f52ac415-88a6-476f-95e6-1f1099b92591" />

#### 4.3 测试访问

1. 访问你的 Pages 域名，查看个人主页效果
2. 确认数据能正常从后台加载
3. 测试后台管理功能是否正常

## ⚠️ 重要注意事项

- 🔐 **安全第一**：部署完成后立即修改默认管理员密码
- 🔗 **域名配置**：确保 Worker 域名在前端配置中正确设置
- 📱 **移动适配**：项目已内置响应式设计，无需额外配置
- 🌐 **自定义域名**：可在 Cloudflare 中配置自定义域名

本项目采用开源许可证，**修改时请保留原作者信息**。

## 📸 页面预览

![主页截图](https://webproxy.badking.pp.ua/https://github.com/user-attachments/assets/de8bed1f-934e-4fee-958e-298becd5269f)

---

**🎉 恭喜！你的个人主页已经部署完成！**

如果在部署过程中遇到任何问题，欢迎提交 Issue 或寻求帮助。

<a href="https://github.com/IonRh/HomePage/stargazers" target="_blank" style="display: block" align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=IonRh/HomePage&type=Timeline&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=IonRh/HomePage&type=Timeline" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=IonRh/HomePage&type=Timeline" />
  </picture>
</a>
