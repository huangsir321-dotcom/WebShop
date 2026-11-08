# 部署到 GitHub / 云端（中文指南）

这份文档回答两件事：

1. **把代码放到 GitHub 上**（代码托管、备份、版本历史）
2. **让网站能从公网访问**（真正上线）

两件事是分开的：GitHub 只存代码，网站要跑起来还得有台云主机和数据库。

---

## 你需要准备什么

| 要准备的东西 | 说明 | 必需吗 |
|---|---|---|
| GitHub 账号 | 免费注册，github.com/signup | 必需 |
| 一个仓库 | 放代码的地方，可以是空仓库 | 必需 |
| 浏览器 | push 的时候用它登录 GitHub | 必需 |
| 信用卡 | 只有想用付费版数据库时才需要 | 免费版不用 |

**不用准备的东西：**

- 不用装 Git —— 这台机器上已经有了（Git Bash 自带，2.47）
- 不用装 GitHub CLI（`gh`）—— 用不上
- 不用生成 Token 给我 —— 推送时会自动弹出浏览器让你登录，
  密码只进浏览器，**不经过聊天窗口，也不写进任何文件**
- 不用花钱 —— 免费版够演示

---

## 方案 A：把代码推到 GitHub（5 分钟，不花钱）

### 第 1 步：在 GitHub 上建一个空仓库

打开 <https://github.com/new>：

- Repository name：填 `forme-commerce-platform`
- 选择 **Public**（公开）
- **不要**勾 "Add a README file"、".gitignore"、"License"
- 点 **Create repository**

建好之后 GitHub 会显示一个空仓库页面，上面有仓库地址。

### 第 2 步：告诉我你的 GitHub 用户名

在 GitHub 右上角头像旁就是你的用户名，告诉我即可。
（我需要它来拼出远程仓库地址。）

### 第 3 步：我来准备本地仓库

我会在项目目录里做这些事，**全部在 F: 盘，不碰 C: 盘**：

```bash
git init                              # 在项目里建 .git/（在 F:）
git config user.name "你的名字"       # 只写进本仓库的 .git/config
git config user.email "你的邮箱"      # 不写全局配置，C: 盘不产生任何文件
git config core.autocrlf false       # 保持文件原样，不做换行符转换
git add -A
git commit -m "..."
```

### 第 4 步：推送

```bash
git remote add origin https://github.com/<你的用户名>/forme-commerce-platform.git
git push -u origin main
```

推送时 Windows 会自动弹出**浏览器登录窗口**，你正常登录 GitHub
并授权即可。密码不会离开浏览器。

### 第 5 步：确认

打开你的仓库页面，能看到代码、提交记录、图片文件。
README 里的 "Deploy to Render" 按钮这时也能用了。

### 推上去的是什么

```
52 个文件，1.3 MB
├── public/          前台 + 后台的页面、样式、图片
├── server/          接口代码、Prisma schema、种子脚本、单元测试
├── .github/         CI 工作流（每次 push 自动跑测试 + 构建 Docker）
├── Dockerfile       生产环境镜像
├── docker-compose.yml
├── render.yaml      一键部署到 Render 的配置
└── .env.example     配置模板（不含任何密钥）
```

**不包含**：`.env`（你的真实密钥，被 `.gitignore` 挡住了）、
`node_modules/`（600MB 依赖，重新 `npm install` 就有）。

---

## 方案 B：一键部署，让公网能访问

代码推上去以后，仓库里的 `render.yaml` 已经写好了 Render 蓝图。

### 部署步骤

1. 打开仓库首页，点 **Deploy to Render** 按钮
   （README.md 最上面）
2. 用 GitHub 账号登录 Render
3. Render 会建好：
   - 一个 PostgreSQL 数据库（免费版）
   - 一个 web 服务（免费版），跑 Dockerfile
4. 它会问你三个值，填上：

   | 要填的 | 填什么 |
   |---|---|
   | `ADMIN_EMAIL` | 你的后台登录邮箱，比如 `you@gmail.com` |
   | `ADMIN_PASSWORD` | 一个你自己想好的强密码 |
   | `CORS_ORIGIN` | 部署完成后 Render 给你的网址，比如 `https://forme-storefront.onrender.com` |

   `JWT_SECRET` 不用填，Render 自动生成。
5. 等 3~5 分钟部署完成，点进去就是网站

### 部署完能访问什么

| 地址 | 是什么 |
|---|---|
| `https://<你的服务名>.onrender.com` | 前台商城 |
| `https://<你的服务名>.onrender.com/admin/` | 管理后台 |
| `https://<你的服务名>.onrender.com/health` | 健康检查 |

### 免费版要知道的三件事

1. **服务会休眠**：没人访问约 15 分钟后休眠，下次访问要等
   30~60 秒才醒。演示够用，生产要升级。
2. **免费数据库 30 天到期**：Render 的免费 Postgres 只存活 30 天，
   到期要升级或迁移。想长期用请一开始就选付费版（约 $7/月）。
3. **数据库是空的**：上线后跑一次 `npm run seed` 把 12 个演示商品
   灌进去（Render 的 web service → Shell 里执行）。

### 免费替代方案

| 平台 | 一键吗 | 大概费用 |
|---|---|---|
| Render | 有蓝图，最省事 | 免费 / $7 每月 |
| Railway | `railway init` + `railway up` | $5 信用额度起 |
| Fly.io | 需装 `fly` CLI | 约 $3 每月 |
| 自有 VPS | 需自己装 Docker | 视服务器而定 |

四者的区别只是"数据库和进程谁来管"，代码完全一样 ——
`Dockerfile` 已经把两者都打包好了。

---

## 上线前必须改的 5 个地方

仓库已经是公开的了，所以下面这些要自己检查：

1. **`.env` 里的 `ADMIN_PASSWORD` 换成自己的强密码**
   （本机的 `.env` 没被推上去，但云端要用你自己设的值）
2. **`JWT_SECRET` 用 32 位以上的随机串**
   - 生成方法：PowerShell 里跑
     `[guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()`
   - Render 上会��动生成，不用管
3. **云端的 `DATABASE_URL` 用云端数据库的地址**，不是本机的
   - Render 蓝图已经自动接好了，不用手填
4. **登录页不再预填密码**（已经改好，见 `public/admin/index.html`）
5. **别把 `.env` 提交上去**
   - `.gitignore` 已经挡住；用 `git status` 确认一下再提交

---

## 常见问题

**推送时提示 `remote: Permission denied`**
没登录成功。重新跑 `git push -u origin main`，浏览器弹窗里完成登录。

**推送时提示 `Updates were rejected`**
GitHub 上已经有内容了（建仓库时勾了 README）。两种解法：
删掉 GitHub 上那个 README 再推，或者用
`git pull origin main --allow-unrelated-histories` 先合并。

**Render 部署日志报 `prisma db push` 失败**
多半是 `DATABASE_URL` 没连上。Render 的 web service → Environment
里确认 `DATABASE_URL` 是 `postgresql://...` 开头（不是本地 5433）。

**Render 部署日志报 Prisma 引擎错误**
旧版 Prisma 配 Alpine 会缺 OpenSSL。现在 Dockerfile 已经改成
`node:22-bookworm-slim` 并显式装了 openssl，不会再犯。

**CI 红了**
Actions 页点进去看哪一步失败。单元测试不需要数据库，
Docker 构建也不需要 —— 两者都是纯本地的。

---

## 相关文档

| 文档 | 内容 |
|---|---|
| `SETUP.md` | 本机（F: 盘）怎么跑起来 |
| `public/images/README.txt` | 中文操作手册：启动、改图、改首页、排错 |
| `README.md` | 项目总览（英文） |
| `docs/IMPLEMENTATION-STATUS.md` | 哪些功能还没接真实服务 |
