/* ══════════════════════════════
   guides-auth.js
   专业指南 —— 购买者账号登录（邮箱验证码 / Magic Link）
   Living Japanese v4.0 SSG

   用途：不用完整的@supabase/supabase-js SDK（避免为一个静态站引入新依赖），
   直接用Supabase Auth（GoTrue）的REST接口，跟本站其它表单一样走fetch，
   保持和consult-form.js / career-interest.js同样的实现风格。

   登录方式：邮箱一次性验证码（OTP），不设密码。
   1. 用户输入邮箱，调用 /auth/v1/otp，Supabase发一封带验证码的邮件。
   2. 用户输入收到的6位验证码，调用 /auth/v1/verify，成功后拿到access_token。
   3. access_token存进localStorage，之后请求"我的购买记录"接口时带上这个token，
      后端Edge Function会用它反查这个token对应的邮箱，只返回这个邮箱名下的购买记录。

   使用前提：
   - Supabase后台 Authentication 里要启用Email OTP（默认关闭Magic Link的"点击链接"形式，
     改用一次性验证码形式，避免用户在没打开原设备的情况下点链接的常见坑）。
   - 不需要用户设置密码，Supabase Auth会自动为这个邮箱创建一个用户身份（首次登录即注册）。
══════════════════════════════ */

(function () {
  'use strict';

  // ▼▼▼ Supabase 项目信息（与 consult-form.js / career-interest.js 同一项目）▼▼▼
  const SUPABASE_URL = 'https://igpvqipsojmbrbpjjzse.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlncHZxaXBzb2ptYnJicGpqenNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMDM1MTcsImV4cCI6MjEwMjg3OTUxN30.yEl4SVgzGafqjU641Zsr0Y_1DsR3X7VyaJzQgW9cSVU';
  // ▲▲▲ Supabase 项目信息 ▲▲▲

  const SESSION_KEY = 'lj_guides_session';

  function isConfigured() {
    return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
  }

  // 第一步：请求发送验证码邮件
  function requestOtp(email) {
    if (!isConfigured()) return Promise.reject(new Error('Supabase not configured'));
    return fetch(`${SUPABASE_URL}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ email: email, create_user: true })
    }).then(function (res) {
      if (!res.ok) throw new Error('OTP request failed: ' + res.status);
      return true;
    });
  }

  // 第二步：提交验证码，换取登录会话
  function verifyOtp(email, token) {
    if (!isConfigured()) return Promise.reject(new Error('Supabase not configured'));
    return fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ email: email, token: token, type: 'email' })
    }).then(function (res) {
      if (!res.ok) throw new Error('OTP verify failed: ' + res.status);
      return res.json();
    }).then(function (data) {
      if (!data.access_token) throw new Error('No access_token in response');
      const session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        email: email,
        expires_at: Date.now() + (data.expires_in || 3600) * 1000
      };
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
      return session;
    });
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (session.expires_at && session.expires_at < Date.now()) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch (e) {
      return null;
    }
  }

  function logout() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  window.ljGuidesAuth = {
    isConfigured: isConfigured,
    requestOtp: requestOtp,
    verifyOtp: verifyOtp,
    getSession: getSession,
    logout: logout
  };
})();