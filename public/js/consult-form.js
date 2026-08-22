/* ══════════════════════════════
   consult-form.js
   医疗协调服务咨询表单 → Supabase 提交客户端
   Living Japanese v4.0 SSG

   使用方式：
   1. 在 Supabase 项目里建一张表 medical_consultations，字段建议：
        id           uuid, primary key, default gen_random_uuid()
        created_at   timestamptz, default now()
        name         text
        contact      text
        urgency      text
        message      text
        lang         text
        source_page  text
        page_path    text
        submitted_at timestamptz
      建议开启 Row Level Security，只允许 anon 角色 INSERT（不允许 SELECT/UPDATE/DELETE），
      这样即使有人拿到这里的 anon key，也只能提交数据，看不到别人提交的内容——
      你自己在 Supabase 后台（用你的账号登录）才能看到全部提交记录。
   2. 把下面 SUPABASE_URL / SUPABASE_ANON_KEY 换成你项目的真实值
      （在 Supabase 项目设置 → API 里可以找到，anon/public key 是设计给前端用的，可以放心暴露在客户端代码里，
      安全性由第1步的 Row Level Security 规则保证，不是靠隐藏这个key）。
   3. 部署后即可使用；在真实值填入之前，表单会走"未就绪"提示，
      不会报错也不会丢用户已填的内容（用户仍可通过LINE/微信/邮箱联系）。
══════════════════════════════ */

(function () {
  'use strict';

  // ▼▼▼ Supabase 项目信息（已接入）▼▼▼
  const SUPABASE_URL = 'https://igpvqipsojmbrbpjjzse.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlncHZxaXBzb2ptYnJicGpqenNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMDM1MTcsImV4cCI6MjEwMjg3OTUxN30.yEl4SVgzGafqjU641Zsr0Y_1DsR3X7VyaJzQgW9cSVU';
  const TABLE_NAME = 'medical_consultations';
  // ▲▲▲ Supabase 项目信息（已接入）▲▲▲

  function isConfigured() {
    return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
  }

  function submit(payload) {
    if (!isConfigured()) {
      return Promise.reject(new Error('Supabase not configured'));
    }
    return fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        name: payload.name || '',
        contact: payload.contact || '',
        urgency: payload.urgency || '',
        message: payload.message || '',
        lang: payload.lang || '',
        source_page: payload.source_page || '',
        page_path: payload.page_path || '',
        submitted_at: payload.submitted_at || new Date().toISOString()
      })
    }).then(function (res) {
      if (!res.ok) throw new Error('Supabase insert failed: ' + res.status);
      return true;
    });
  }

  window.ljConsult = {
    isConfigured: isConfigured,
    submit: submit
  };
})();