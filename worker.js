addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
  })
  
  async function handleRequest(request) {
    const url = new URL(request.url)
    const path = url.pathname
  
    // 获取KV命名空间
    const kv = MY_HOME_KV // 需在Workers dashboard中绑定
    
    // 检查登录状态（除了登录页面和API接口）
    if (path === '/manage' && !(await checkAuth(request, kv))) {
      return new Response(getLoginPage(), {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      })
    }
    
    // 处理登录请求
    if (path === '/login' && request.method === 'POST') {
      return await handleLogin(request, kv)
    }
    
    // 处理登出请求
    if (path === '/logout') {
      return new Response('', {
        status: 302,
        headers: {
          'Location': '/manage',
          'Set-Cookie': 'auth_token=; Path=/; Max-Age=0'
        }
      })
    }
  
    if (path === '/api/data' && request.method === 'GET') {
      try {
        // 从KV获取数据
        const data = await kv.get('portfolio_data', { type: 'json' })
        if (!data) {
          return new Response(JSON.stringify({ error: 'Data not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        })
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }
  
    if (path === '/api/data' && request.method === 'POST') {
      try {
        const newData = await request.json()
        // 验证数据格式
        if (!newData.data) {
          return new Response(JSON.stringify({ error: 'Invalid data format' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        // 存储到KV
        await kv.put('portfolio_data', JSON.stringify(newData))
        return new Response(JSON.stringify({ message: 'Data updated successfully' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }
  
    // 密码修改API
    if (path === '/api/change-password' && request.method === 'POST') {
      // 检查是否已登录
      if (!(await checkAuth(request, kv))) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      try {
        const { username, password } = await request.json()
        if (!username || !password) {
          return new Response(JSON.stringify({ error: 'Username and password required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        
        // 更新管理员凭证
        const newCreds = { username, password }
        await kv.put('admin_credentials', JSON.stringify(newCreds))
        
        return new Response(JSON.stringify({ message: 'Password updated successfully' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    // IP获取API
    if (path === '/api/visitor-ip' && request.method === 'GET') {
      try {
        // 获取访客真实IP地址
        const clientIP = request.headers.get('CF-Connecting-IP') || 
                        request.headers.get('X-Forwarded-For') || 
                        request.headers.get('X-Real-IP') || 
                        '未知IP';

        // 获取国家信息（Cloudflare提供）
        const country = request.cf?.country || '未知';
        const city = request.cf?.city || '未知';
        const region = request.cf?.region || '未知';

        // 处理IPv6地址显示
        let displayIP = clientIP;
        if (clientIP.includes(':') && clientIP.length > 20) {
          displayIP = clientIP.substring(0, 26) + '...';
        }

        // 构建位置信息
        const locationParts = [country, region, city].filter(part => part && part !== '未知');
        const location = locationParts.length > 0 ? locationParts.join(' ') : '未知位置';

        const response = {
          ip: displayIP,
          fullIP: clientIP,
          country: country,
          region: region,
          city: city,
          location: location,
          displayText: `${displayIP}<br>(${location} 的好友)`
        };

        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache'
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: 'Failed to get IP information',
          ip: '无法获取IP地址',
          displayText: '无法获取IP地址'
        }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }

    // 管理页面
    if (path === '/manage') {
      return new Response(getManagementPage(), {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      })
    }
  
    return new Response('Not found', { status: 404 })
  }
  
  // 检查认证状态
  async function checkAuth(request, kv) {
    const cookieHeader = request.headers.get('Cookie')
    if (!cookieHeader) return false
    
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(cookie => {
        const [key, value] = cookie.trim().split('=')
        return [key, value]
      })
    )
    
    const authToken = cookies.auth_token
    if (!authToken) return false
    
    // 验证token（简单的时间戳验证）
    try {
      const tokenData = JSON.parse(atob(authToken))
      const now = Date.now()
      // token有效期24小时
      return (now - tokenData.timestamp) < 24 * 60 * 60 * 1000
    } catch {
      return false
    }
  }
  
  // 处理登录
  async function handleLogin(request, kv) {
    try {
      const formData = await request.formData()
      const username = formData.get('username')
      const password = formData.get('password')
      
      // 从KV获取管理员凭证，如果不存在则使用默认值
      let adminCreds = await kv.get('admin_credentials', { type: 'json' })
      if (!adminCreds) {
        // 默认账号密码
        adminCreds = {
          username: 'admin',
          password: 'admin123'
        }
        // 保存默认凭证到KV
        await kv.put('admin_credentials', JSON.stringify(adminCreds))
      }
      
      if (username === adminCreds.username && password === adminCreds.password) {
        // 生成简单的认证token
        const token = btoa(JSON.stringify({
          username: username,
          timestamp: Date.now()
        }))
        
        return new Response('', {
          status: 302,
          headers: {
            'Location': '/manage',
            'Set-Cookie': `auth_token=${token}; Path=/; Max-Age=86400; HttpOnly`
          }
        })
      } else {
        return new Response(getLoginPage('用户名或密码错误'), {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        })
      }
    } catch (error) {
      return new Response(getLoginPage('登录失败，请重试'), {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      })
    }
  }
  
  // 登录页面
  function getLoginPage(errorMessage = '') {
    return `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>管理员登录</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-gradient-to-br from-blue-500 to-purple-600 min-h-screen flex items-center justify-center">
    <div class="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-gray-800">管理员登录</h1>
        <p class="text-gray-600 mt-2">Portfolio 数据管理系统</p>
      </div>
      
      ${errorMessage ? `
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          ${errorMessage}
        </div>
      ` : ''}
      
      <form method="POST" action="/login" class="space-y-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">用户名</label>
          <input type="text" name="username" required 
                 class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                 placeholder="请输入用户名">
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">密码</label>
          <input type="password" name="password" required
                 class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                 placeholder="请输入密码">
        </div>
        
        <button type="submit" 
                class="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200">
          登录
        </button>
      </form>
      
      <div class="mt-6 text-center text-sm text-gray-600">
        <p>默认账号：admin</p>
        <p>默认密码：admin123</p>
        <p class="mt-2 text-xs">首次登录后可在管理页面修改密码</p>
      </div>
    </div>
  </body>
  </html>
    `
  }
  
    function getManagementPage() {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Portfolio 数据管理</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    .tab-content { 
      display: none; 
      animation: fadeIn 0.3s ease-in-out;
    }
    .tab-content.active { 
      display: block; 
    }
         .tab-button.active { 
       background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
       color: white; 
       transform: translateY(-1px);
       box-shadow: 0 2px 8px rgba(55, 65, 81, 0.3);
     }
    .tab-button {
      transition: all 0.3s ease;
    }
    .tab-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
         .gradient-bg {
       background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
       border-bottom: 1px solid #e2e8f0;
     }
     .card {
       background: white;
       border-radius: 12px;
       box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
       border: 1px solid #f1f5f9;
       transition: all 0.3s ease;
     }
     .card:hover {
       box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
       transform: translateY(-1px);
     }
     .input-field {
       transition: all 0.3s ease;
       border: 1px solid #d1d5db;
       background: white;
     }
     .input-field:focus {
       border-color: #6b7280;
       box-shadow: 0 0 0 3px rgba(107, 114, 128, 0.1);
       outline: none;
     }
     .btn-primary {
       background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
       transition: all 0.3s ease;
       border: 1px solid #374151;
     }
     .btn-primary:hover {
       transform: translateY(-1px);
       box-shadow: 0 4px 12px rgba(55, 65, 81, 0.3);
       background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
     }
     .btn-success {
       background: linear-gradient(135deg, #059669 0%, #047857 100%);
       border: 1px solid #059669;
     }
     .btn-success:hover {
       background: linear-gradient(135deg, #047857 0%, #065f46 100%);
       transform: translateY(-1px);
       box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
     }
     .btn-danger {
       background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
       border: 1px solid #dc2626;
     }
     .btn-danger:hover {
       background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%);
       transform: translateY(-1px);
       box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
     }
     .btn-warning {
       background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
       border: 1px solid #d97706;
     }
     .btn-warning:hover {
       background: linear-gradient(135deg, #b45309 0%, #92400e 100%);
       transform: translateY(-1px);
       box-shadow: 0 4px 12px rgba(217, 119, 6, 0.3);
     }
    .status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #48bb78;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  </style>
</head>
 <body class="bg-gray-50 min-h-screen">
  <!-- 顶部导航栏 -->
  <nav class="gradient-bg shadow-lg sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
                 <div class="flex items-center">
           <i class="fas fa-chart-line text-gray-700 text-2xl mr-3"></i>
           <h1 class="text-xl font-bold text-gray-800">Portfolio 数据管理中心</h1>
           <div class="status-indicator ml-3"></div>
         </div>
        <div class="flex items-center gap-3">
          <button onclick="showPasswordModal()" class="btn-warning text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:shadow-lg transition-all">
            <i class="fas fa-key"></i>
            <span class="hidden sm:inline">修改密码</span>
          </button>
          <a href="/logout" class="btn-danger text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:shadow-lg transition-all">
            <i class="fas fa-sign-out-alt"></i>
            <span class="hidden sm:inline">登出</span>
          </a>
        </div>
      </div>
    </div>
  </nav>

  <div class="max-w-7xl mx-auto p-4 lg:p-6">
    <!-- 快捷操作面板 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="card p-4">
        <div class="flex items-center">
          <div class="bg-blue-100 p-3 rounded-full">
            <i class="fas fa-database text-blue-600 text-xl"></i>
          </div>
          <div class="ml-4">
            <h3 class="text-sm font-medium text-gray-500">数据状态</h3>
            <p class="text-lg font-semibold text-gray-900" id="dataStatus">等待加载...</p>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center">
          <div class="bg-green-100 p-3 rounded-full">
            <i class="fas fa-clock text-green-600 text-xl"></i>
          </div>
          <div class="ml-4">
            <h3 class="text-sm font-medium text-gray-500">最后更新</h3>
            <p class="text-lg font-semibold text-gray-900" id="lastUpdate">--</p>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <div class="bg-purple-100 p-3 rounded-full">
              <i class="fas fa-save text-purple-600 text-xl"></i>
            </div>
            <div class="ml-4">
              <h3 class="text-sm font-medium text-gray-500">快速保存</h3>
              <p class="text-sm text-gray-600">一键保存所有更改</p>
            </div>
          </div>
          <button onclick="saveAllData()" class="btn-primary text-white px-4 py-2 rounded-lg text-sm font-medium">
            <i class="fas fa-save"></i>
          </button>
        </div>
      </div>
    </div>
    
    <!-- 标签页导航 -->
    <div class="card p-4 mb-6">
      <div class="flex flex-wrap gap-3">
        <button onclick="showTab('basic')" class="tab-button px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium flex items-center gap-2 transition-all">
          <i class="fas fa-user-circle"></i>
          基本信息
        </button>
        <button onclick="showTab('timeline')" class="tab-button px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium flex items-center gap-2 transition-all">
          <i class="fas fa-timeline"></i>
          时间线
        </button>
        <button onclick="showTab('projects')" class="tab-button px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium flex items-center gap-2 transition-all">
          <i class="fas fa-code"></i>
          项目
        </button>
        <button onclick="showTab('sites')" class="tab-button px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium flex items-center gap-2 transition-all">
          <i class="fas fa-globe"></i>
          站点
        </button>
        <button onclick="showTab('skills')" class="tab-button px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium flex items-center gap-2 transition-all">
          <i class="fas fa-tools"></i>
          技能
        </button>
        <button onclick="showTab('social')" class="tab-button px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium flex items-center gap-2 transition-all">
          <i class="fas fa-share-alt"></i>
          社交
        </button>
        <button onclick="showTab('tags')" class="tab-button px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium flex items-center gap-2 transition-all">
          <i class="fas fa-tags"></i>
          标签
        </button>
        <button onclick="showTab('images')" class="tab-button px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium flex items-center gap-2 transition-all">
          <i class="fas fa-image"></i>
          图片
        </button>
        <button onclick="showTab('json')" class="tab-button px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium flex items-center gap-2 transition-all">
          <i class="fas fa-code"></i>
          JSON编辑
        </button>
      </div>
    </div>

    <!-- 基本信息 -->
    <div id="basic" class="tab-content card p-6">
      <div class="flex items-center mb-6">
        <div class="bg-blue-100 p-3 rounded-full mr-4">
          <i class="fas fa-user-circle text-blue-600 text-xl"></i>
        </div>
        <div>
          <h2 class="text-xl font-bold text-gray-900">基本信息</h2>
          <p class="text-sm text-gray-600">配置网站的基础信息和个人资料</p>
        </div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700 flex items-center gap-2">
            <i class="fab fa-github text-gray-500"></i>
            GitHub用户名
          </label>
          <input type="text" id="github" class="input-field w-full p-3 rounded-lg" placeholder="输入GitHub用户名">
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700 flex items-center gap-2">
            <i class="fas fa-globe text-gray-500"></i>
            网站标题
          </label>
          <input type="text" id="webTitle" class="input-field w-full p-3 rounded-lg" placeholder="输入网站标题">
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700 flex items-center gap-2">
            <i class="fas fa-star text-gray-500"></i>
            网站图标URL
          </label>
          <input type="text" id="webIcon" class="input-field w-full p-3 rounded-lg" placeholder="输入网站图标链接">
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700 flex items-center gap-2">
            <i class="fas fa-quote-left text-gray-500"></i>
            个人引言
          </label>
          <textarea id="quote" class="input-field w-full p-3 rounded-lg h-24 resize-none" placeholder="输入个人引言或座右铭"></textarea>
        </div>
      </div>
    </div>

    <!-- 时间线 -->
    <div id="timeline" class="tab-content card p-6">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center">
          <div class="bg-indigo-100 p-3 rounded-full mr-4">
            <i class="fas fa-timeline text-indigo-600 text-xl"></i>
          </div>
          <div>
            <h2 class="text-xl font-bold text-gray-900">时间线管理</h2>
            <p class="text-sm text-gray-600">管理个人经历和重要时间节点</p>
          </div>
        </div>
        <button onclick="addTimelineItem()" class="btn-success text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:shadow-lg transition-all">
          <i class="fas fa-plus"></i>
          添加时间线
        </button>
      </div>
      <div id="timelineList" class="space-y-4"></div>
    </div>

    <!-- 项目 -->
    <div id="projects" class="tab-content card p-6">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center">
          <div class="bg-green-100 p-3 rounded-full mr-4">
            <i class="fas fa-code text-green-600 text-xl"></i>
          </div>
          <div>
            <h2 class="text-xl font-bold text-gray-900">项目管理</h2>
            <p class="text-sm text-gray-600">展示个人项目和作品集</p>
          </div>
        </div>
        <button onclick="addProject()" class="btn-success text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:shadow-lg transition-all">
          <i class="fas fa-plus"></i>
          添加项目
        </button>
      </div>
      <div id="projectsList" class="space-y-4"></div>
    </div>

    <!-- 站点 -->
    <div id="sites" class="tab-content card p-6">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center">
          <div class="bg-purple-100 p-3 rounded-full mr-4">
            <i class="fas fa-globe text-purple-600 text-xl"></i>
          </div>
          <div>
            <h2 class="text-xl font-bold text-gray-900">站点管理</h2>
            <p class="text-sm text-gray-600">管理相关网站和链接</p>
          </div>
        </div>
        <button onclick="addSite()" class="btn-success text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:shadow-lg transition-all">
          <i class="fas fa-plus"></i>
          添加站点
        </button>
      </div>
      <div id="sitesList" class="space-y-4"></div>
    </div>

    <!-- 技能 -->
    <div id="skills" class="tab-content card p-6">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center">
          <div class="bg-yellow-100 p-3 rounded-full mr-4">
            <i class="fas fa-tools text-yellow-600 text-xl"></i>
          </div>
          <div>
            <h2 class="text-xl font-bold text-gray-900">技能管理</h2>
            <p class="text-sm text-gray-600">展示专业技能和能力</p>
          </div>
        </div>
        <button onclick="addSkill()" class="btn-success text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:shadow-lg transition-all">
          <i class="fas fa-plus"></i>
          添加技能
        </button>
      </div>
      <div id="skillsList" class="space-y-4"></div>
    </div>

    <!-- 社交 -->
    <div id="social" class="tab-content card p-6">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center">
          <div class="bg-pink-100 p-3 rounded-full mr-4">
            <i class="fas fa-share-alt text-pink-600 text-xl"></i>
          </div>
          <div>
            <h2 class="text-xl font-bold text-gray-900">社交链接管理</h2>
            <p class="text-sm text-gray-600">管理社交媒体和联系方式</p>
          </div>
        </div>
        <button onclick="addSocial()" class="btn-success text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:shadow-lg transition-all">
          <i class="fas fa-plus"></i>
          添加链接
        </button>
      </div>
      <div id="socialList" class="space-y-4"></div>
    </div>

    <!-- 标签 -->
    <div id="tags" class="tab-content card p-6">
      <div class="flex items-center mb-6">
        <div class="bg-cyan-100 p-3 rounded-full mr-4">
          <i class="fas fa-tags text-cyan-600 text-xl"></i>
        </div>
        <div>
          <h2 class="text-xl font-bold text-gray-900">标签管理</h2>
          <p class="text-sm text-gray-600">管理内容分类标签</p>
        </div>
      </div>
      <div class="flex gap-3 mb-6">
        <input type="text" id="newTag" placeholder="输入新标签" class="input-field flex-1 p-3 rounded-lg">
        <button onclick="addTag()" class="btn-success text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:shadow-lg transition-all">
          <i class="fas fa-plus"></i>
          添加
        </button>
      </div>
      <div id="tagsList" class="flex flex-wrap gap-3"></div>
    </div>

    <!-- 图片 -->
    <div id="images" class="tab-content card p-6">
      <div class="flex items-center mb-6">
        <div class="bg-orange-100 p-3 rounded-full mr-4">
          <i class="fas fa-image text-orange-600 text-xl"></i>
        </div>
        <div>
          <h2 class="text-xl font-bold text-gray-900">图片管理</h2>
          <p class="text-sm text-gray-600">设置头像和背景图片</p>
        </div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700 flex items-center gap-2">
            <i class="fas fa-user-circle text-gray-500"></i>
            头像URL
          </label>
          <input type="text" id="avatar" class="input-field w-full p-3 rounded-lg" placeholder="输入头像图片链接">
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700 flex items-center gap-2">
            <i class="fas fa-image text-gray-500"></i>
            背景图片URL
          </label>
          <input type="text" id="bgImage" class="input-field w-full p-3 rounded-lg" placeholder="输入背景图片链接">
        </div>
      </div>
    </div>

    <!-- JSON编辑 -->
    <div id="json" class="tab-content card p-6">
      <div class="flex items-center mb-6">
        <div class="bg-gray-100 p-3 rounded-full mr-4">
          <i class="fas fa-code text-gray-600 text-xl"></i>
        </div>
        <div>
          <h2 class="text-xl font-bold text-gray-900">JSON编辑器</h2>
          <p class="text-sm text-gray-600">高级用户直接编辑JSON数据</p>
        </div>
      </div>
      <div class="space-y-4">
        <textarea id="dataInput" class="input-field w-full h-96 p-4 rounded-lg font-mono text-sm resize-none" placeholder="请输入或粘贴JSON数据..."></textarea>
        <div class="flex flex-wrap gap-3">
          <button onclick="loadJsonData()" class="btn-primary text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <i class="fas fa-download"></i>
            加载数据
          </button>
          <button onclick="saveJsonData()" class="btn-success text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <i class="fas fa-save"></i>
            保存数据
          </button>
          <button onclick="exportToJson()" class="btn-warning text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <i class="fas fa-file-export"></i>
            从表单导出
          </button>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="card p-6 mt-6">
      <div class="flex flex-col sm:flex-row gap-4 items-center justify-center">
        <button onclick="loadAllData()" class="btn-primary text-white px-8 py-3 rounded-lg font-medium flex items-center gap-2 hover:shadow-lg transition-all w-full sm:w-auto">
          <i class="fas fa-sync-alt"></i>
          重新加载数据
        </button>
        <button onclick="saveAllData()" class="btn-success text-white px-8 py-3 rounded-lg font-medium flex items-center gap-2 hover:shadow-lg transition-all w-full sm:w-auto">
          <i class="fas fa-save"></i>
          保存所有更改
        </button>
      </div>
    </div>
    
    <!-- 密码修改模态框 -->
    <div id="passwordModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all">
                 <div class="bg-gray-100 border-b p-6 rounded-t-xl">
           <div class="flex items-center">
             <div class="bg-gray-200 p-2 rounded-full mr-3">
               <i class="fas fa-key text-gray-600 text-lg"></i>
             </div>
             <div>
               <h2 class="text-xl font-bold text-gray-800">修改管理员凭证</h2>
               <p class="text-sm text-gray-600">更新登录用户名和密码</p>
             </div>
           </div>
         </div>
        <div class="p-6 space-y-4">
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 flex items-center gap-2">
              <i class="fas fa-user text-gray-500"></i>
              新用户名
            </label>
            <input type="text" id="newUsername" class="input-field w-full p-3 rounded-lg" placeholder="输入新的用户名">
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 flex items-center gap-2">
              <i class="fas fa-lock text-gray-500"></i>
              新密码
            </label>
            <input type="password" id="newPassword" class="input-field w-full p-3 rounded-lg" placeholder="输入新密码（至少6位）">
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 flex items-center gap-2">
              <i class="fas fa-check-circle text-gray-500"></i>
              确认密码
            </label>
            <input type="password" id="confirmPassword" class="input-field w-full p-3 rounded-lg" placeholder="再次输入新密码">
          </div>
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div class="flex items-start">
              <i class="fas fa-exclamation-triangle text-yellow-600 mt-0.5 mr-2"></i>
              <div class="text-sm text-yellow-800">
                <p class="font-medium">注意事项：</p>
                <ul class="mt-1 list-disc list-inside space-y-1">
                  <li>密码长度不少于6位</li>
                  <li>修改后需要重新登录</li>
                  <li>请妥善保管新的登录凭证</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div class="p-6 bg-gray-50 rounded-b-xl flex gap-3">
          <button onclick="hidePasswordModal()" class="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-all">
            <i class="fas fa-times mr-2"></i>取消
          </button>
          <button onclick="changePassword()" class="flex-1 btn-primary text-white px-4 py-2 rounded-lg font-medium">
            <i class="fas fa-check mr-2"></i>确认修改
          </button>
        </div>
      </div>
    </div>
  </div>

  <script>
    let currentData = { data: {} };

    // 标签页切换
    function showTab(tabName) {
      // 隐藏所有标签页
      document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
      });
      document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
      });
      
      // 显示当前标签页
      document.getElementById(tabName).classList.add('active');
      event.target.classList.add('active');
    }

    // 加载所有数据
    async function loadAllData() {
      const statusEl = document.getElementById('dataStatus');
      const lastUpdateEl = document.getElementById('lastUpdate');
      
      statusEl.textContent = '加载中...';
      statusEl.className = 'text-lg font-semibold text-yellow-600';
      
      try {
        const response = await fetch('/api/data');
        const data = await response.json();
        currentData = data;
        populateFields(data.data);
        
        statusEl.textContent = '数据已加载';
        statusEl.className = 'text-lg font-semibold text-green-600';
        lastUpdateEl.textContent = new Date().toLocaleString('zh-CN');
        
        // 显示成功提示
        showNotification('数据加载成功！', 'success');
      } catch (error) {
        statusEl.textContent = '加载失败';
        statusEl.className = 'text-lg font-semibold text-red-600';
        showNotification('加载数据失败: ' + error.message, 'error');
      }
    }

    // 填充表单字段
    function populateFields(data) {
      // 基本信息
      document.getElementById('github').value = data.github || '';
      document.getElementById('webTitle').value = data.web_info?.title || '';
      document.getElementById('webIcon').value = data.web_info?.icon || '';
      document.getElementById('quote').value = data.quoteData || '';

      // 图片
      const avatar = data.imagesData?.find(img => img.avatar);
      const bgImage = data.imagesData?.find(img => img.bg_image);
      document.getElementById('avatar').value = avatar?.avatar || '';
      document.getElementById('bgImage').value = bgImage?.bg_image || '';

      // 动态列表
      renderTimeline(data.timelineData || []);
      renderProjects(data.projectsData || []);
      renderSites(data.sitesData || []);
      renderSkills(data.skillsData || []);
      renderSocial(data.socialData || []);
      renderTags(data.tagsData || []);
    }

    // 渲染时间线
    function renderTimeline(timeline) {
      const container = document.getElementById('timelineList');
      container.innerHTML = '';
      timeline.forEach((item, index) => {
        container.innerHTML += \`
          <div class="bg-white border border-gray-200 p-4 rounded-lg hover:shadow-md transition-all">
            <div class="flex items-center mb-3">
              <div class="bg-indigo-100 p-2 rounded-full mr-3">
                <i class="fas fa-calendar text-indigo-600"></i>
              </div>
              <span class="text-sm font-medium text-gray-600">时间线项目 #\${index + 1}</span>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div class="space-y-2">
                <label class="block text-xs font-medium text-gray-500">事件标题</label>
                <input type="text" value="\${item.title}" onchange="updateTimelineTitle(\${index}, this.value)" 
                       placeholder="输入事件标题" class="input-field w-full p-2 rounded-lg text-sm">
              </div>
              <div class="space-y-2">
                <label class="block text-xs font-medium text-gray-500">发生日期</label>
                <input type="date" value="\${item.date}" onchange="updateTimelineDate(\${index}, this.value)" 
                       class="input-field w-full p-2 rounded-lg text-sm">
              </div>
            </div>
            <div class="mt-4 flex justify-end">
              <button onclick="removeTimelineItem(\${index})" 
                      class="btn-danger text-white px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 hover:shadow-lg transition-all">
                <i class="fas fa-trash"></i>
                删除
              </button>
            </div>
          </div>
        \`;
      });
    }

    // 渲染项目
    function renderProjects(projects) {
      const container = document.getElementById('projectsList');
      container.innerHTML = '';
      projects.forEach((item, index) => {
        container.innerHTML += \`
          <div class="bg-white border border-gray-200 p-4 rounded-lg hover:shadow-md transition-all">
            <div class="flex items-center mb-3">
              <div class="bg-green-100 p-2 rounded-full mr-3">
                <i class="fas fa-code text-green-600"></i>
              </div>
              <span class="text-sm font-medium text-gray-600">项目 #\${index + 1}</span>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div class="space-y-2">
                <label class="block text-xs font-medium text-gray-500">项目名称</label>
                <input type="text" value="\${item.name}" onchange="updateProjectName(\${index}, this.value)" 
                       placeholder="输入项目名称" class="input-field w-full p-2 rounded-lg text-sm">
              </div>
              <div class="space-y-2">
                <label class="block text-xs font-medium text-gray-500">项目链接</label>
                <input type="text" value="\${item.url}" onchange="updateProjectUrl(\${index}, this.value)" 
                       placeholder="输入项目URL" class="input-field w-full p-2 rounded-lg text-sm">
              </div>
              <div class="space-y-2">
                <label class="block text-xs font-medium text-gray-500">项目图标</label>
                <input type="text" value="\${item.icon}" onchange="updateProjectIcon(\${index}, this.value)" 
                       placeholder="输入图标类名或URL" class="input-field w-full p-2 rounded-lg text-sm">
              </div>
              <div class="space-y-2">
                <label class="block text-xs font-medium text-gray-500">项目描述</label>
                <textarea onchange="updateProjectDesc(\${index}, this.value)" 
                          placeholder="输入项目描述" class="input-field w-full p-2 rounded-lg text-sm h-20 resize-none">\${item.desc}</textarea>
              </div>
            </div>
            <div class="mt-4 flex justify-end">
              <button onclick="removeProject(\${index})" 
                      class="btn-danger text-white px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 hover:shadow-lg transition-all">
                <i class="fas fa-trash"></i>
                删除
              </button>
            </div>
          </div>
        \`;
      });
    }

    // 渲染站点
    function renderSites(sites) {
      const container = document.getElementById('sitesList');
      container.innerHTML = '';
      sites.forEach((item, index) => {
        container.innerHTML += \`
          <div class="bg-white border border-gray-200 p-4 rounded-lg hover:shadow-md transition-all">
            <div class="flex items-center mb-3">
              <div class="bg-purple-100 p-2 rounded-full mr-3">
                <i class="fas fa-globe text-purple-600"></i>
              </div>
              <span class="text-sm font-medium text-gray-600">站点 #\${index + 1}</span>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div class="space-y-2">
                <label class="block text-xs font-medium text-gray-500">站点名称</label>
                <input type="text" value="\${item.name}" onchange="updateSiteName(\${index}, this.value)" 
                       placeholder="输入站点名称" class="input-field w-full p-2 rounded-lg text-sm">
              </div>
              <div class="space-y-2">
                <label class="block text-xs font-medium text-gray-500">站点链接</label>
                <input type="text" value="\${item.url}" onchange="updateSiteUrl(\${index}, this.value)" 
                       placeholder="输入站点URL" class="input-field w-full p-2 rounded-lg text-sm">
              </div>
              <div class="space-y-2">
                <label class="block text-xs font-medium text-gray-500">站点图标</label>
                <input type="text" value="\${item.icon}" onchange="updateSiteIcon(\${index}, this.value)" 
                       placeholder="输入图标类名或URL" class="input-field w-full p-2 rounded-lg text-sm">
              </div>
              <div class="space-y-2">
                <label class="block text-xs font-medium text-gray-500">站点描述</label>
                <textarea onchange="updateSiteDesc(\${index}, this.value)" 
                          placeholder="输入站点描述" class="input-field w-full p-2 rounded-lg text-sm h-20 resize-none">\${item.desc}</textarea>
              </div>
            </div>
            <div class="mt-4 flex justify-end">
              <button onclick="removeSite(\${index})" 
                      class="btn-danger text-white px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 hover:shadow-lg transition-all">
                <i class="fas fa-trash"></i>
                删除
              </button>
            </div>
          </div>
        \`;
      });
    }

    // 渲染技能
    function renderSkills(skills) {
      const container = document.getElementById('skillsList');
      container.innerHTML = '';
      skills.forEach((item, index) => {
        container.innerHTML += \`
          <div class="bg-white border border-gray-200 p-4 rounded-lg hover:shadow-md transition-all">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center">
                <div class="bg-yellow-100 p-2 rounded-full mr-3">
                  <i class="fas fa-tools text-yellow-600"></i>
                </div>
                <span class="text-sm font-medium text-gray-600">技能 #\${index + 1}</span>
              </div>
              <button onclick="removeSkill(\${index})" 
                      class="btn-danger text-white px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 hover:shadow-lg transition-all">
                <i class="fas fa-trash"></i>
              </button>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div class="space-y-2">
                <label class="block text-xs font-medium text-gray-500">技能名称</label>
                <input type="text" value="\${item.name}" onchange="updateSkillName(\${index}, this.value)" 
                       placeholder="输入技能名称" class="input-field w-full p-2 rounded-lg text-sm">
              </div>
              <div class="space-y-2">
                <label class="block text-xs font-medium text-gray-500">技能图标</label>
                <input type="text" value="\${item.icon}" onchange="updateSkillIcon(\${index}, this.value)" 
                       placeholder="输入图标类名或URL" class="input-field w-full p-2 rounded-lg text-sm">
              </div>
            </div>
          </div>
        \`;
      });
    }

    // 渲染社交链接
    function renderSocial(social) {
      const container = document.getElementById('socialList');
      container.innerHTML = '';
      social.forEach((item, index) => {
        container.innerHTML += \`
          <div class="bg-white border border-gray-200 p-4 rounded-lg hover:shadow-md transition-all">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center">
                <div class="bg-pink-100 p-2 rounded-full mr-3">
                  <i class="fas fa-share-alt text-pink-600"></i>
                </div>
                <span class="text-sm font-medium text-gray-600">社交链接 #\${index + 1}</span>
              </div>
              <button onclick="removeSocial(\${index})" 
                      class="btn-danger text-white px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 hover:shadow-lg transition-all">
                <i class="fas fa-trash"></i>
              </button>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div class="space-y-2">
                <label class="block text-xs font-medium text-gray-500">链接地址</label>
                <input type="text" value="\${item.url}" onchange="updateSocialUrl(\${index}, this.value)" 
                       placeholder="输入社交媒体链接" class="input-field w-full p-2 rounded-lg text-sm">
              </div>
              <div class="space-y-2">
                <label class="block text-xs font-medium text-gray-500">图标类名</label>
                <input type="text" value="\${item.ico}" onchange="updateSocialIcon(\${index}, this.value)" 
                       placeholder="输入Font Awesome图标类名" class="input-field w-full p-2 rounded-lg text-sm">
              </div>
            </div>
          </div>
        \`;
      });
    }

    // 渲染标签
    function renderTags(tags) {
      const container = document.getElementById('tagsList');
      container.innerHTML = '';
      if (tags.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm italic">暂无标签，点击上方按钮添加标签</p>';
        return;
      }
      tags.forEach((tag, index) => {
        container.innerHTML += \`
          <span class="inline-flex items-center bg-gradient-to-r from-cyan-100 to-blue-100 text-cyan-800 px-4 py-2 rounded-full text-sm font-medium border border-cyan-200 hover:shadow-md transition-all">
            <i class="fas fa-tag mr-2 text-xs"></i>
            \${tag}
            <button onclick="removeTag(\${index})" class="ml-3 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full p-1 transition-all">
              <i class="fas fa-times text-xs"></i>
            </button>
          </span>
        \`;
      });
    }

    // 添加函数
    function addTimelineItem() {
      if (!currentData.data.timelineData) currentData.data.timelineData = [];
      currentData.data.timelineData.push({ title: '新时间线项目', date: new Date().toISOString().split('T')[0] });
      renderTimeline(currentData.data.timelineData);
    }

    function addProject() {
      if (!currentData.data.projectsData) currentData.data.projectsData = [];
      currentData.data.projectsData.push({ name: '新项目', url: '', desc: '', icon: '' });
      renderProjects(currentData.data.projectsData);
    }

    function addSite() {
      if (!currentData.data.sitesData) currentData.data.sitesData = [];
      currentData.data.sitesData.push({ name: '新站点', url: '', desc: '', icon: '' });
      renderSites(currentData.data.sitesData);
    }

    function addSkill() {
      if (!currentData.data.skillsData) currentData.data.skillsData = [];
      currentData.data.skillsData.push({ name: '新技能', icon: '' });
      renderSkills(currentData.data.skillsData);
    }

    function addSocial() {
      if (!currentData.data.socialData) currentData.data.socialData = [];
      currentData.data.socialData.push({ url: '', ico: '' });
      renderSocial(currentData.data.socialData);
    }

    function addTag() {
      const input = document.getElementById('newTag');
      const tag = input.value.trim();
      if (tag) {
        if (!currentData.data.tagsData) currentData.data.tagsData = [];
        currentData.data.tagsData.push(tag);
        input.value = '';
        renderTags(currentData.data.tagsData);
      }
    }

    // 更新函数
    function updateTimelineTitle(index, value) {
      currentData.data.timelineData[index].title = value;
    }
    function updateTimelineDate(index, value) {
      currentData.data.timelineData[index].date = value;
    }
    function updateProjectName(index, value) {
      currentData.data.projectsData[index].name = value;
    }
    function updateProjectUrl(index, value) {
      currentData.data.projectsData[index].url = value;
    }
    function updateProjectIcon(index, value) {
      currentData.data.projectsData[index].icon = value;
    }
    function updateProjectDesc(index, value) {
      currentData.data.projectsData[index].desc = value;
    }
    function updateSiteName(index, value) {
      currentData.data.sitesData[index].name = value;
    }
    function updateSiteUrl(index, value) {
      currentData.data.sitesData[index].url = value;
    }
    function updateSiteIcon(index, value) {
      currentData.data.sitesData[index].icon = value;
    }
    function updateSiteDesc(index, value) {
      currentData.data.sitesData[index].desc = value;
    }
    function updateSkillName(index, value) {
      currentData.data.skillsData[index].name = value;
    }
    function updateSkillIcon(index, value) {
      currentData.data.skillsData[index].icon = value;
    }
    function updateSocialUrl(index, value) {
      currentData.data.socialData[index].url = value;
    }
    function updateSocialIcon(index, value) {
      currentData.data.socialData[index].ico = value;
    }

    // 删除函数
    function removeTimelineItem(index) {
      currentData.data.timelineData.splice(index, 1);
      renderTimeline(currentData.data.timelineData);
    }
    function removeProject(index) {
      currentData.data.projectsData.splice(index, 1);
      renderProjects(currentData.data.projectsData);
    }
    function removeSite(index) {
      currentData.data.sitesData.splice(index, 1);
      renderSites(currentData.data.sitesData);
    }
    function removeSkill(index) {
      currentData.data.skillsData.splice(index, 1);
      renderSkills(currentData.data.skillsData);
    }
    function removeSocial(index) {
      currentData.data.socialData.splice(index, 1);
      renderSocial(currentData.data.socialData);
    }
    function removeTag(index) {
      currentData.data.tagsData.splice(index, 1);
      renderTags(currentData.data.tagsData);
    }

    // 收集表单数据
    function collectFormData() {
      // 基本信息
      currentData.data.github = document.getElementById('github').value;
      currentData.data.web_info = {
        title: document.getElementById('webTitle').value,
        icon: document.getElementById('webIcon').value
      };
      currentData.data.quoteData = document.getElementById('quote').value;

      // 图片
      const avatar = document.getElementById('avatar').value;
      const bgImage = document.getElementById('bgImage').value;
      currentData.data.imagesData = [];
      if (avatar) currentData.data.imagesData.push({ avatar });
      if (bgImage) currentData.data.imagesData.push({ bg_image: bgImage });
    }

    // 保存所有数据
    async function saveAllData() {
      const statusEl = document.getElementById('dataStatus');
      const lastUpdateEl = document.getElementById('lastUpdate');
      
      statusEl.textContent = '保存中...';
      statusEl.className = 'text-lg font-semibold text-yellow-600';
      
      try {
        collectFormData();
        const response = await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentData)
        });
        const result = await response.json();
        
        statusEl.textContent = '保存成功';
        statusEl.className = 'text-lg font-semibold text-green-600';
        lastUpdateEl.textContent = new Date().toLocaleString('zh-CN');
        
        showNotification(result.message || '保存成功！', 'success');
      } catch (error) {
        statusEl.textContent = '保存失败';
        statusEl.className = 'text-lg font-semibold text-red-600';
        showNotification('保存失败: ' + error.message, 'error');
      }
    }

         // JSON编辑功能
     async function loadJsonData() {
       try {
         const response = await fetch('/api/data');
         const data = await response.json();
         document.getElementById('dataInput').value = JSON.stringify(data, null, 2);
         showNotification('JSON数据加载成功！', 'success');
       } catch (error) {
         showNotification('加载JSON数据失败: ' + error.message, 'error');
       }
     }
     
     async function saveJsonData() {
       try {
         const jsonText = document.getElementById('dataInput').value;
         if (!jsonText.trim()) {
           showNotification('请输入JSON数据！', 'warning');
           return;
         }
         
         const data = JSON.parse(jsonText);
         const response = await fetch('/api/data', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(data)
         });
         const result = await response.json();
         
         showNotification(result.message || '保存成功！', 'success');
         // 重新加载数据到表单
         currentData = data;
         populateFields(data.data);
         
         // 更新状态
         const statusEl = document.getElementById('dataStatus');
         const lastUpdateEl = document.getElementById('lastUpdate');
         statusEl.textContent = '数据已更新';
         statusEl.className = 'text-lg font-semibold text-green-600';
         lastUpdateEl.textContent = new Date().toLocaleString('zh-CN');
         
       } catch (error) {
         if (error instanceof SyntaxError) {
           showNotification('JSON格式错误，请检查语法！', 'error');
         } else {
           showNotification('保存失败: ' + error.message, 'error');
         }
       }
     }

         function exportToJson() {
       collectFormData();
       document.getElementById('dataInput').value = JSON.stringify(currentData, null, 2);
       showNotification('已导出到JSON编辑器！', 'success');
     }
     
     // 密码修改功能
     function showPasswordModal() {
       document.getElementById('passwordModal').style.display = 'flex';
     }
     
     function hidePasswordModal() {
       document.getElementById('passwordModal').style.display = 'none';
       // 清空表单
       document.getElementById('newUsername').value = '';
       document.getElementById('newPassword').value = '';
       document.getElementById('confirmPassword').value = '';
     }
     
     async function changePassword() {
       const newUsername = document.getElementById('newUsername').value.trim();
       const newPassword = document.getElementById('newPassword').value;
       const confirmPassword = document.getElementById('confirmPassword').value;
       
       if (!newUsername || !newPassword) {
         showNotification('用户名和密码不能为空！', 'warning');
         return;
       }
       
       if (newPassword !== confirmPassword) {
         showNotification('两次输入的密码不一致！', 'warning');
         return;
       }
       
       if (newPassword.length < 6) {
         showNotification('密码长度不能少于6位！', 'warning');
         return;
       }
       
       try {
         const response = await fetch('/api/change-password', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             username: newUsername,
             password: newPassword
           })
         });
         
         const result = await response.json();
         if (response.ok) {
           showNotification('密码修改成功！3秒后跳转到登录页面...', 'success');
           setTimeout(() => {
             window.location.href = '/logout';
           }, 3000);
         } else {
           showNotification(result.error || '修改失败', 'error');
         }
       } catch (error) {
         showNotification('修改失败: ' + error.message, 'error');
       }
     }

    // 通知系统
    function showNotification(message, type = 'info') {
      // 创建通知元素
      const notification = document.createElement('div');
      notification.className = \`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform translate-x-full transition-all duration-300 max-w-sm\`;
      
      // 根据类型设置样式
      switch(type) {
        case 'success':
          notification.className += ' bg-green-500 text-white';
          break;
        case 'error':
          notification.className += ' bg-red-500 text-white';
          break;
        case 'warning':
          notification.className += ' bg-yellow-500 text-white';
          break;
        default:
          notification.className += ' bg-blue-500 text-white';
      }
      
      notification.innerHTML = \`
        <div class="flex items-center">
          <i class="fas fa-\${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'} mr-2"></i>
          <span>\${message}</span>
          <button onclick="this.parentElement.parentElement.remove()" class="ml-3 text-white hover:text-gray-200">
            <i class="fas fa-times"></i>
          </button>
        </div>
      \`;
      
      document.body.appendChild(notification);
      
      // 显示动画
      setTimeout(() => {
        notification.style.transform = 'translateX(0)';
      }, 100);
      
      // 自动消失
      setTimeout(() => {
        notification.style.transform = 'translateX(full)';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 300);
      }, 4000);
    }
    
    // 添加键盘快捷键支持
    document.addEventListener('keydown', function(e) {
      // Ctrl+S 保存
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveAllData();
      }
      // Ctrl+R 重新加载
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        loadAllData();
      }
    });

    // 初始化
    document.addEventListener('DOMContentLoaded', function() {
      showTab('basic');
      loadAllData();
      
      // 显示欢迎消息
      setTimeout(() => {
        showNotification('欢迎使用 Portfolio 数据管理系统！', 'info');
      }, 1000);
    });
  </script>
</body>
</html>
    `
  }