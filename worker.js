// Cloudflare Worker - 后端 API 服务
// 用于处理所有数据存储和管理操作

// CORS 响应头配置
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8'
};

// 默认管理员账户
const DEFAULT_ADMIN = {
  username: 'admin',
  password: 'admin123' // 首次登录后请立即修改
};

// 数据存储键名
const STORAGE_KEYS = {
  ADMIN: 'admin_account',
  PROFILE: 'user_profile',
  ANNOUNCEMENT: 'announcement',
  PORTALS: 'portals',
  REDEEM_CODES: 'redeem_codes',
  VIP_USERS: 'vip_users',
  VERIFIED_USERS: 'verified_users'
};

// 初始化默认数据
async function initializeDefaultData(KV) {
  try {
    // 检查是否已初始化
    const existingAdmin = await KV.get(STORAGE_KEYS.ADMIN);
    if (existingAdmin) {
      return; // 已经初始化过
    }

    // 初始化管理员账户
    await KV.put(STORAGE_KEYS.ADMIN, JSON.stringify(DEFAULT_ADMIN));

    // 初始化个人资料
    const defaultProfile = {
      name: '你的名字',
      avatar: 'https://via.placeholder.com/150',
      bio: '这是一段个人简介，介绍你自己吧！',
      email: 'your-email@example.com',
      github: '',
      twitter: '',
      website: ''
    };
    await KV.put(STORAGE_KEYS.PROFILE, JSON.stringify(defaultProfile));

    // 初始化公告
    const defaultAnnouncement = {
      title: '欢迎访问我的个人主页！',
      content: '这是一条公告内容，你可以在后台管理中修改。',
      enabled: true,
      updatedAt: new Date().toISOString()
    };
    await KV.put(STORAGE_KEYS.ANNOUNCEMENT, JSON.stringify(defaultAnnouncement));

    // 初始化门户链接
    const defaultPortals = [
      {
        id: '1',
        name: 'GitHub',
        url: 'https://github.com',
        icon: '🔗',
        description: '我的 GitHub 主页',
        enabled: true
      },
      {
        id: '2',
        name: '博客',
        url: 'https://example.com',
        icon: '📝',
        description: '个人技术博客',
        enabled: true
      }
    ];
    await KV.put(STORAGE_KEYS.PORTALS, JSON.stringify(defaultPortals));

    // 初始化兑换码列表
    await KV.put(STORAGE_KEYS.REDEEM_CODES, JSON.stringify([]));

    // 初始化 VIP 用户列表
    await KV.put(STORAGE_KEYS.VIP_USERS, JSON.stringify([]));

    // 初始化认证用户列表
    await KV.put(STORAGE_KEYS.VERIFIED_USERS, JSON.stringify([]));

    console.log('默认数据初始化完成');
  } catch (error) {
    console.error('初始化数据失败:', error);
  }
}

// 验证管理员身份
async function verifyAdmin(request, KV) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  try {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = atob(base64Credentials);
    const [username, password] = credentials.split(':');

    const adminData = await KV.get(STORAGE_KEYS.ADMIN);
    if (!adminData) {
      return false;
    }

    const admin = JSON.parse(adminData);
    return username === admin.username && password === admin.password;
  } catch (error) {
    console.error('验证失败:', error);
    return false;
  }
}

// 生成随机兑换码
function generateRedeemCode(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
    if ((i + 1) % 4 === 0 && i !== length - 1) {
      code += '-';
    }
  }
  return code;
}

// 响应构造函数
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS
  });
}

// 主请求处理函数
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // 处理 OPTIONS 请求（CORS 预检）
  if (method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // 初始化默认数据
  await initializeDefaultData(env.MY_HOME_KV);

  // ==================== 公开 API（无需认证）====================

  // 获取个人资料
  if (path === '/api/profile' && method === 'GET') {
    const profile = await env.MY_HOME_KV.get(STORAGE_KEYS.PROFILE);
    return jsonResponse(profile ? JSON.parse(profile) : {});
  }

  // 获取公告
  if (path === '/api/announcement' && method === 'GET') {
    const announcement = await env.MY_HOME_KV.get(STORAGE_KEYS.ANNOUNCEMENT);
    return jsonResponse(announcement ? JSON.parse(announcement) : {});
  }

  // 获取门户链接
  if (path === '/api/portals' && method === 'GET') {
    const portals = await env.MY_HOME_KV.get(STORAGE_KEYS.PORTALS);
    const allPortals = portals ? JSON.parse(portals) : [];
    // 只返回启用的门户
    const enabledPortals = allPortals.filter(p => p.enabled);
    return jsonResponse(enabledPortals);
  }

  // 使用兑换码
  if (path === '/api/redeem' && method === 'POST') {
    const { code, email } = await request.json();
    
    if (!code || !email) {
      return jsonResponse({ success: false, message: '请提供兑换码和邮箱' }, 400);
    }

    const codesData = await env.MY_HOME_KV.get(STORAGE_KEYS.REDEEM_CODES);
    const codes = codesData ? JSON.parse(codesData) : [];
    
    const codeIndex = codes.findIndex(c => c.code === code && !c.used);
    
    if (codeIndex === -1) {
      return jsonResponse({ success: false, message: '兑换码无效或已被使用' }, 400);
    }

    // 标记为已使用
    codes[codeIndex].used = true;
    codes[codeIndex].usedBy = email;
    codes[codeIndex].usedAt = new Date().toISOString();
    
    await env.MY_HOME_KV.put(STORAGE_KEYS.REDEEM_CODES, JSON.stringify(codes));

    return jsonResponse({ 
      success: true, 
      message: '兑换成功！',
      type: codes[codeIndex].type,
      value: codes[codeIndex].value
    });
  }

  // 检查用户 VIP 状态
  if (path === '/api/vip/check' && method === 'GET') {
    const email = url.searchParams.get('email');
    if (!email) {
      return jsonResponse({ isVip: false });
    }

    const vipData = await env.MY_HOME_KV.get(STORAGE_KEYS.VIP_USERS);
    const vipUsers = vipData ? JSON.parse(vipData) : [];
    
    const vipUser = vipUsers.find(u => u.email === email);
    
    if (!vipUser) {
      return jsonResponse({ isVip: false });
    }

    // 检查是否过期
    const now = new Date();
    const expiryDate = new Date(vipUser.expiryDate);
    
    if (now > expiryDate) {
      return jsonResponse({ isVip: false, expired: true });
    }

    return jsonResponse({ 
      isVip: true, 
      level: vipUser.level,
      expiryDate: vipUser.expiryDate
    });
  }

  // 检查用户认证状态
  if (path === '/api/verified/check' && method === 'GET') {
    const email = url.searchParams.get('email');
    if (!email) {
      return jsonResponse({ isVerified: false });
    }

    const verifiedData = await env.MY_HOME_KV.get(STORAGE_KEYS.VERIFIED_USERS);
    const verifiedUsers = verifiedData ? JSON.parse(verifiedData) : [];
    
    const isVerified = verifiedUsers.some(u => u.email === email);
    
    return jsonResponse({ isVerified });
  }

  // ==================== 管理员 API（需要认证）====================

  // 验证管理员登录
  if (path === '/api/admin/login' && method === 'POST') {
    const isValid = await verifyAdmin(request, env.MY_HOME_KV);
    
    if (isValid) {
      return jsonResponse({ success: true, message: '登录成功' });
    } else {
      return jsonResponse({ success: false, message: '用户名或密码错误' }, 401);
    }
  }

  // 以下所有接口都需要管理员认证
  const isAdmin = await verifyAdmin(request, env.MY_HOME_KV);
  if (!isAdmin) {
    return jsonResponse({ success: false, message: '未授权访问' }, 401);
  }

  // 修改管理员密码
  if (path === '/api/admin/password' && method === 'PUT') {
    const { currentPassword, newPassword } = await request.json();
    
    const adminData = await env.MY_HOME_KV.get(STORAGE_KEYS.ADMIN);
    const admin = JSON.parse(adminData);

    if (admin.password !== currentPassword) {
      return jsonResponse({ success: false, message: '当前密码错误' }, 400);
    }

    admin.password = newPassword;
    await env.MY_HOME_KV.put(STORAGE_KEYS.ADMIN, JSON.stringify(admin));

    return jsonResponse({ success: true, message: '密码修改成功' });
  }

  // 更新个人资料
  if (path === '/api/profile' && method === 'PUT') {
    const profile = await request.json();
    await env.MY_HOME_KV.put(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    return jsonResponse({ success: true, message: '个人资料更新成功' });
  }

  // 更新公告
  if (path === '/api/announcement' && method === 'PUT') {
    const announcement = await request.json();
    announcement.updatedAt = new Date().toISOString();
    await env.MY_HOME_KV.put(STORAGE_KEYS.ANNOUNCEMENT, JSON.stringify(announcement));
    return jsonResponse({ success: true, message: '公告更新成功' });
  }

  // 获取所有门户（包括禁用的）
  if (path === '/api/admin/portals' && method === 'GET') {
    const portals = await env.MY_HOME_KV.get(STORAGE_KEYS.PORTALS);
    return jsonResponse(portals ? JSON.parse(portals) : []);
  }

  // 更新门户列表
  if (path === '/api/portals' && method === 'PUT') {
    const portals = await request.json();
    await env.MY_HOME_KV.put(STORAGE_KEYS.PORTALS, JSON.stringify(portals));
    return jsonResponse({ success: true, message: '门户列表更新成功' });
  }

  // 获取所有兑换码
  if (path === '/api/admin/redeem-codes' && method === 'GET') {
    const codes = await env.MY_HOME_KV.get(STORAGE_KEYS.REDEEM_CODES);
    return jsonResponse(codes ? JSON.parse(codes) : []);
  }

  // 生成新兑换码
  if (path === '/api/admin/redeem-codes' && method === 'POST') {
    const { type, value, count = 1, description = '' } = await request.json();
    
    const codesData = await env.MY_HOME_KV.get(STORAGE_KEYS.REDEEM_CODES);
    const codes = codesData ? JSON.parse(codesData) : [];
    
    const newCodes = [];
    for (let i = 0; i < count; i++) {
      const code = {
        code: generateRedeemCode(),
        type, // 'vip' 或 'verified' 或其他自定义类型
        value, // 例如 'VIP1'、'VIP2' 或天数
        description,
        used: false,
        createdAt: new Date().toISOString()
      };
      codes.push(code);
      newCodes.push(code);
    }
    
    await env.MY_HOME_KV.put(STORAGE_KEYS.REDEEM_CODES, JSON.stringify(codes));
    
    return jsonResponse({ 
      success: true, 
      message: `成功生成 ${count} 个兑换码`,
      codes: newCodes
    });
  }

  // 删除兑换码
  if (path === '/api/admin/redeem-codes' && method === 'DELETE') {
    const { code } = await request.json();
    
    const codesData = await env.MY_HOME_KV.get(STORAGE_KEYS.REDEEM_CODES);
    const codes = codesData ? JSON.parse(codesData) : [];
    
    const filteredCodes = codes.filter(c => c.code !== code);
    await env.MY_HOME_KV.put(STORAGE_KEYS.REDEEM_CODES, JSON.stringify(filteredCodes));
    
    return jsonResponse({ success: true, message: '兑换码已删除' });
  }

  // 获取所有 VIP 用户
  if (path === '/api/admin/vip-users' && method === 'GET') {
    const vipUsers = await env.MY_HOME_KV.get(STORAGE_KEYS.VIP_USERS);
    return jsonResponse(vipUsers ? JSON.parse(vipUsers) : []);
  }

  // 添加 VIP 用户
  if (path === '/api/admin/vip-users' && method === 'POST') {
    const { email, level, days } = await request.json();
    
    const vipData = await env.MY_HOME_KV.get(STORAGE_KEYS.VIP_USERS);
    const vipUsers = vipData ? JSON.parse(vipData) : [];
    
    // 检查是否已存在
    const existingIndex = vipUsers.findIndex(u => u.email === email);
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    
    const vipUser = {
      email,
      level,
      expiryDate: expiryDate.toISOString(),
      createdAt: new Date().toISOString()
    };
    
    if (existingIndex !== -1) {
      vipUsers[existingIndex] = vipUser;
    } else {
      vipUsers.push(vipUser);
    }
    
    await env.MY_HOME_KV.put(STORAGE_KEYS.VIP_USERS, JSON.stringify(vipUsers));
    
    return jsonResponse({ success: true, message: 'VIP 用户添加成功' });
  }

  // 删除 VIP 用户
  if (path === '/api/admin/vip-users' && method === 'DELETE') {
    const { email } = await request.json();
    
    const vipData = await env.MY_HOME_KV.get(STORAGE_KEYS.VIP_USERS);
    const vipUsers = vipData ? JSON.parse(vipData) : [];
    
    const filteredUsers = vipUsers.filter(u => u.email !== email);
    await env.MY_HOME_KV.put(STORAGE_KEYS.VIP_USERS, JSON.stringify(filteredUsers));
    
    return jsonResponse({ success: true, message: 'VIP 用户已删除' });
  }

  // 获取所有认证用户
  if (path === '/api/admin/verified-users' && method === 'GET') {
    const verifiedUsers = await env.MY_HOME_KV.get(STORAGE_KEYS.VERIFIED_USERS);
    return jsonResponse(verifiedUsers ? JSON.parse(verifiedUsers) : []);
  }

  // 添加认证用户
  if (path === '/api/admin/verified-users' && method === 'POST') {
    const { email, name } = await request.json();
    
    const verifiedData = await env.MY_HOME_KV.get(STORAGE_KEYS.VERIFIED_USERS);
    const verifiedUsers = verifiedData ? JSON.parse(verifiedData) : [];
    
    // 检查是否已存在
    if (verifiedUsers.some(u => u.email === email)) {
      return jsonResponse({ success: false, message: '该用户已认证' }, 400);
    }
    
    verifiedUsers.push({
      email,
      name,
      verifiedAt: new Date().toISOString()
    });
    
    await env.MY_HOME_KV.put(STORAGE_KEYS.VERIFIED_USERS, JSON.stringify(verifiedUsers));
    
    return jsonResponse({ success: true, message: '黄V认证添加成功' });
  }

  // 删除认证用户
  if (path === '/api/admin/verified-users' && method === 'DELETE') {
    const { email } = await request.json();
    
    const verifiedData = await env.MY_HOME_KV.get(STORAGE_KEYS.VERIFIED_USERS);
    const verifiedUsers = verifiedData ? JSON.parse(verifiedData) : [];
    
    const filteredUsers = verifiedUsers.filter(u => u.email !== email);
    await env.MY_HOME_KV.put(STORAGE_KEYS.VERIFIED_USERS, JSON.stringify(filteredUsers));
    
    return jsonResponse({ success: true, message: '黄V认证已删除' });
  }

  // 后台管理页面路由
  if (path === '/manage' || path === '/manage/') {
    const html = await fetch('https://raw.githubusercontent.com/IonRh/HomePage/main/index.html')
      .then(res => res.text())
      .catch(() => '<h1>管理页面加载失败</h1>');
    
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  // 404 响应
  return jsonResponse({ error: '接口不存在' }, 404);
}

// Cloudflare Worker 入口
export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error('服务器错误:', error);
      return jsonResponse({ 
        error: '服务器内部错误', 
        message: error.message 
      }, 500);
    }
  }
};

