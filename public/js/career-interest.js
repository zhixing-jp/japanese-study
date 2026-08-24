/* ══════════════════════════════
   career-interest.js
   就职・转职版块 —— 文章底部「轻量兴趣登记」提交客户端
   Living Japanese v4.0 SSG

   用途：收集用户对哪些方向内容/未来付费产品感兴趣，
   为月2的PDF选题和早期通知名单积累数据，不涉及支付。

   使用方式：
   1. 复用医疗协调服务同一个Supabase项目，只需新建一张表 career_interest，字段建议：
        id           uuid, primary key, default gen_random_uuid()
        created_at   timestamptz, default now()
        topic        text   （用户希望优先做成付费产品的方向 / 感兴趣的内容）
        contact      text   （可选，方便未来通知新内容/产品上线）
        source_slug  text   （提交发生在哪篇文章）
        page_path    text
        submitted_at timestamptz
      同样建议开启 Row Level Security，只允许 anon 角色 INSERT。
   2. 下面的 SUPABASE_URL / SUPABASE_ANON_KEY 与 consult-form.js 是同一个Supabase项目，
      如果医疗协调服务那边的值已经改过，这里也要同步更新。
   3. 部署后即可使用；表未就绪时不会报错，也不会丢用户已填的内容。
══════════════════════════════ */

(function () {
  'use strict';

  // ▼▼▼ Supabase 项目信息（与 consult-form.js 同一项目）▼▼▼
  const SUPABASE_URL = 'https://igpvqipsojmbrbpjjzse.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlncHZxaXBzb2ptYnJicGpqenNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMDM1MTcsImV4cCI6MjEwMjg3OTUxN30.yEl4SVgzGafqjU641Zsr0Y_1DsR3X7VyaJzQgW9cSVU';
  const TABLE_NAME = 'career_interest';
  // ▲▲▲ Supabase 项目信息（与 consult-form.js 同一项目）▲▲▲

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
        topic: payload.topic || '',
        contact: payload.contact || '',
        source_slug: payload.source_slug || '',
        page_path: payload.page_path || '',
        submitted_at: payload.submitted_at || new Date().toISOString()
      })
    }).then(function (res) {
      if (!res.ok) throw new Error('Supabase insert failed: ' + res.status);
      return true;
    });
  }

  window.ljCareerInterest = {
    isConfigured: isConfigured,
    submit: submit
  };
})();