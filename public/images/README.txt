FORME · 操作与使用手册
================================================================
本文件有两个身份：
  1) 它就放在 public/images/ 里，是这个"图片仓库"的说明；
  2) 它同时是整个项目的操作手册 —— 启动、改图、改首页、
     命令速查、常见问题都在这里。

目录
----------------------------------------------------------------
  一、这个项目是什么
  二、启动和停止
  三、登录管理台
  四、图片：放哪、路径怎么写、尺寸建议
  五、改商品（价格 / 图片 / 排序）
  六、改首页（Hero 大图 + 品牌故事图 + 首页文字）
  七、数据存在哪
  八、命令速查
  九、常见问题
  十、两个坑


一、这个项目是什么
----------------------------------------------------------------
  一个服装电商的完整原型，三个部分在同一个仓库里：

  前台商城   public/          顾客看到的页面（首页、商品、购物车）
  管理后台   public/admin/    店主用的后台（商品、订单、首页设置…）
  接口服务   server/src/      Express 5 + Prisma + PostgreSQL

  关键点：商品和首页内容都存在数据库里，
          后台是唯一的数据源，前台只是读接口显示。
          所以改东西都在后台改，前台不用动。

  访问地址：
      前台商城   http://localhost:4100
      管理后台   http://localhost:4100/admin/
      接口健康   http://localhost:4100/health

  全部文件都在 F: 盘，C: 盘什么都没动（Node、PostgreSQL、
  npm 缓存、数据库文件、日志、浏览器配置全在 F: 下）。


二、启动和停止
----------------------------------------------------------------
  启动（项目根目录）：
      Git Bash:  ./start.sh
      CMD:       start.cmd

  停止：
      Git Bash:  ./stop.sh
      CMD:       stop.cmd

  start.sh 会先看 v3 自己的 PostgreSQL（在 F:/tools/pgdata，
  端口 5433）在不在跑，不在就启动它，然后跑接口和前台。
  关掉终端窗口就会停掉服务。

  端口：
      4100   v3（就是这个项目）
      5433   v3 自己的数据库
      4000 / 5432 / 8080  是本机上另一个老项目，别去动它们。

  想让服务在关掉终端后还活着，可以用 F:/WebShop/.toolchain/deploy/
  forme-v3/launch.mjs 启动、stop.mjs 停止（会写日志到 logs/）。


三、登录管理台
----------------------------------------------------------------
  1. 浏览器打开 http://localhost:4100/admin/
  2. 账号是 ADMIN_EMAIL，密码是 ADMIN_PASSWORD
     —— 这两个值在项目根目录的 .env 文件里。
     （开发环境的默认值同时也预填在登录框里，可以直接点登录。）
  3. 左侧是功能菜单：

     Overview    概览（销售额、订单数、商品数、顾客数）
     Products    商品（增删改、传图、改价、改排序）
     Homepage    首页设置（首页大图、品牌故事图、首页文字）★ 新增
     Orders      订单（改状态、填快递单号、加备注）
     Inventory   库存（调整数量，会记流水）
     Customers   顾客名单
     Coupons     优惠券
     Reports     报表（按状态统计、热销商品）

  注意：后台是给店主用的，正式对外前记得先把 .env 里的
  ADMIN_PASSWORD 和 JWT_SECRET 改掉。

  后台登不上时先看日志：
      F:/WebShop/.toolchain/deploy/forme-v3/logs/api.log


四、图片：放哪、路径怎么写、尺寸建议
----------------------------------------------------------------
  所有图片文件都放这个文件夹：public/images/
  把文件丢进去就行，不用改配置、不用重启服务，刷新就生效
  （因为 express.static 直接把 public/ 当静态目录伺服）。

  路径写法：
      /images/文件名.jpg          ← 本文件夹里的文件（推荐）
      https://...                 ← 外部链接（也支持）

  尺寸建议：
      商品图    宽 700 左右，卡片是 3:4 的比例（高度约 933）
      首页大图  宽 1500 左右
      故事图    宽 1200 左右

  文件名不要用中文和空格，用英文加短横线更稳。


五、改商品（价格 / 图片 / 排序）
----------------------------------------------------------------
  管理台 -> Products -> 点 + Add product 新建，
  或在列表里点 Edit 修改。表单里几个要紧的字段：

  Name        商品名
  Slug        网址用的短名，只能小写字母、数字、短横线
  Category    分类
  Price       价格（美元基准）
  Position    前台显示顺序，越小越靠前，默认 9999
  Image       图片路径，填 /images/文件名.jpg
  Description 描述

  改完点 Save product，前台刷新就变。
  想换分类顺序，就改各分类里商品的 Position。

  商品删除是"归档"（软删除），不真删数据。


六、改首页（Hero 大图 + 品牌故事图 + 首页文字）
----------------------------------------------------------------
  管理台 -> Homepage（新加的页面，在 Products 下面）

  上半部分 "Hero · 首页大图"，对应前台首页右边那张大图：
      Hero image (首页大图)      图片路径
      Eyebrow (小标题)            大图左边那行小字
      Title line 1                主标题第一行（普通体）
      Title line 2                主标题第二行（斜体）
      Body (正文)                 主标题下面那段话
      Label line 1                大图右下角标第一行
      Label line 2                大图右下角标第二行（加粗）

  下半部分 "Our story · 品牌故事"，对应前台页面下方那块：
      Story image (品牌故事图)    图片路径
      Eyebrow (小标题)
      Title line 1 / Title line 2 (斜体)
      Body (正文)

  底部三个按钮：
      Save homepage      保存
      Restore defaults   恢复默认文案和默认图
      Open storefront    在新标签打开前台对照

  完整操作流程（最常用的一条）：
      1) 把图片文件复制进 public/images/
      2) 管理台 -> Homepage
      3) 在 "Hero image (首页大图)" 里填 /images/你的文件名.jpg
         下面会立刻出现预览图，确认图对了
      4) 点 Save homepage
      5) 刷新 http://localhost:4100 —— 已经变了

  品牌故事图同理，填在 "Story image" 里。

  其它说明：
      * 图片框留空 = 沿用默认图（/images/hero.jpg、/images/story.jpg）
      * 外部链接也可以直接填 https:// 开头的地址
      * Restore defaults 只改数据库里的内容，不会动你放在
        public/images/ 里的文件
      * 前台断网 / 接口挂了也不怕：public/index.html 里写着一份
        静态内容当兜底，首页照样显示（只是不会跟着后台改）


七、数据存在哪
----------------------------------------------------------------
  数据库：PostgreSQL 16，v3 自己的独立实例
          数据文件 F:/tools/pgdata，端口 5433

  主要的表：
      Product            商品（价格、图片、排序、标签都在这）
      ProductVariant     尺码/颜色（SKU）
      Category           分类
      Homepage           首页内容（只有一行，id=1）
      Inventory          库存
      Order / OrderItem  订单和订单行
      Customer           顾客
      Coupon             优惠券
      AuditLog           后台操作日志

  Homepage 表只有一行（id=1），存的就是后台 Homepage 页面里的
  那 12 个字段。

  种子数据（npm run seed）只会**新建** Homepage 那一行，
  不会覆盖你在后台改过的内容，所以重复跑种子是安全的。


八、命令速查
----------------------------------------------------------------
  在项目根目录执行（Git Bash 先 source ./env.sh 把 node 和
  postgres 放进 PATH）：

  npm run dev            前台 + 接口（带热重载，改代码自动重启）
  npm start              前台 + 接口（不热重载）
  npm run prisma:generate  按 schema 重新生成 Prisma 客户端
  npm run db:push        把 schema 同步到数据库（会建表/改表）
  npm run seed           写入 12 个演示商品等初始数据
  npm run seed:demo      可选：写入演示顾客、订单、优惠券
  npm test               跑单元测试（10 个）

  npm run db:push 会改数据库结构，加了新 model 或者改了字段
  之后要跑一次；跑之前先停掉服务（Prisma 的引擎文件被占着时
  会报 EPERM）。


九、常见问题
----------------------------------------------------------------
  前台商品不显示 / 提示"加载失败"
      接口没起来或数据库连不上。看 logs/api.log，或访问
      http://localhost:4100/health 看是不是 {"status":"ok"}。

  图片 404
      路径写错了。应该是 /images/文件名.jpg（斜杠开头），
      不是 images/文件名.jpg，也不是 D:/... 这种绝对路径。
      文件必须真的在 public/images/ 里。

  后台改了但前台没变
      硬刷新一下（Ctrl+F5）。图片和文字都是走接口的，
      正常情况下保存后刷新页面就生效，不需要重启。

  端口 4100 被占用
      本机还有一个老项目在 4000，和这个不冲突。真冲突的话
      先停掉占用进程，或者改 .env 里的 PORT。

  想看后台到底发生了什么
      F:/WebShop/.toolchain/deploy/forme-v3/logs/api.log


十、两个坑
----------------------------------------------------------------
  * 在 Git Bash 里跑带 /images/xxx.jpg 这种参数的命令时，
    bash 会把 /images 当成 Windows 路径转成 D:/GIT/... ，
    前面加 MSYS_NO_PATHCONV=1 或者用 cmd 跑就没问题。

  * .env 里的值不会覆盖已经存在的环境变量。改完 .env 如果
    没生效，先把旧的服务停掉再启动。


附：当前已有的文件
----------------------------------------------------------------
  商品：tee.jpg  linen-shirt.jpg  trouser.jpg  overshirt.jpg
        knit.jpg  jacket.jpg  sneaker.jpg  runner.jpg
        carryall.jpg  crossbody.jpg  cap.jpg  sunglasses.jpg
  首页：hero.jpg        故事：story.jpg
  兜底：placeholder.jpg（商品没设图时显示）

  trouser.jpg 是一张占位图（原代码里的 Unsplash 链接本身是 404），
  换成你自己的长裤照片即可。
