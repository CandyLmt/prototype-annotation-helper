import fetch from 'cross-fetch';

Object.assign(globalThis, { fetch });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bmatatqpfllinpqqvwej.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtYXRhdHFwZmxsaW5wcXF2d2VqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3NDE5MCwiZXhwIjoyMDk0OTUwMTkwfQ.q2lAKP3eP06jQGiRCjtMgVdAKu-UIPyBqZwosXliTvY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  global: {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  }
});

console.log('🚀 原型标注助手后台服务启动');
console.log('🔗 Supabase URL:', SUPABASE_URL);

async function testSupabaseConnection() {
  console.log('🔄 测试 Supabase 连接...');

  try {
    const { data, error } = await supabase
      .from('annotations1')
      .select('id')
      .limit(1);

    if (error) {
      console.error('❌ Supabase 连接失败:', error.message);
      return false;
    }

    console.log('✅ Supabase 连接成功！');
    return true;
  } catch (error) {
    console.error('❌ Supabase 连接失败:', error.message);
    return false;
  }
}

chrome.runtime.onInstalled.addListener(async function() {
  console.log('🎉 扩展安装成功');
  chrome.storage.local.set({annotations: {}});
  await testSupabaseConnection();
});

chrome.runtime.onStartup.addListener(async function() {
  console.log('🔃 浏览器启动，初始化扩展');
  await testSupabaseConnection();
});

chrome.runtime.onMessage.addListener(async function(request, sender, sendResponse) {
  console.log('📨 收到消息:', request.action);

  try {
    if (request.action === 'getUserInfo') {
      chrome.storage.local.get(['userId', 'userEmail'], function(stored) {
        const userId = stored.userId || null;
        const userEmail = stored.userEmail || null;
        sendResponse({ userId: userId, userEmail: userEmail });
      });
      return true;
    } else if (request.action === 'loadAnnotations') {
      const pageUrl = request.data.pageUrl;
      const userId = request.data.userId;

      const { data, error } = await supabase
        .from('annotations1')
        .select('*')
        .eq('url_path', pageUrl);

      if (error) throw error;

      const annotations = {};
      const idMap = {};
      const ownership = {};
      const users = {};

      data.forEach(item => {
        annotations[item.element_selector] = {
          text: item.content,
          timestamp: item.created_at ? new Date(item.created_at).getTime() : Date.now()
        };
        idMap[item.element_selector] = item.id;
        ownership[item.element_selector] = item.user_id === userId;
        users[item.element_selector] = item.user_name || item.user_id || '未知用户';
      });

      sendResponse({ success: true, data: { annotations, idMap, ownership, users } });

    } else if (request.action === 'saveAnnotation') {
      const { pageUrl, selector, text, id, userId, userEmail } = request.data;

      let result;
      if (id) {
        const { data: existing } = await supabase
          .from('annotations1')
          .select('user_id')
          .eq('id', id)
          .single();

        if (existing && existing.user_id && existing.user_id !== userId) {
          sendResponse({ success: false, error: '无权限修改此标注' });
          return;
        }

        const { data, error } = await supabase
          .from('annotations1')
          .update({ content: text })
          .eq('id', id)
          .select();

        if (error) throw error;
        result = data;
      } else {
        const displayName = userEmail ? userEmail.split('@')[0] : userId || '未知用户';
        const { data, error } = await supabase
          .from('annotations1')
          .insert({ 
            url_path: pageUrl, 
            element_selector: selector, 
            content: text, 
            project_id: 'default',
            user_id: displayName
          })
          .select();

        if (error) throw error;
        result = data;
      }

      sendResponse({ success: true, id: result[0]?.id || id });

    } else if (request.action === 'deleteAnnotation') {
      const { id, userId } = request.data;
      if (id) {
        const { data: existing } = await supabase
          .from('annotations1')
          .select('user_id')
          .eq('id', id)
          .single();

        const displayName = userId && userId.includes('@') ? userId.split('@')[0] : userId;
        if (existing && existing.user_id && existing.user_id !== displayName) {
          sendResponse({ success: false, error: '无权限删除此标注' });
          return;
        }

        const { error } = await supabase
          .from('annotations1')
          .delete()
          .eq('id', id);

        if (error) throw error;
      }
      sendResponse({ success: true });

    } else if (request.action === 'deleteAllAnnotations') {
      const { pageUrl, userId } = request.data;

      const { error } = await supabase
        .from('annotations1')
        .delete()
        .eq('url_path', pageUrl)
        .eq('user_id', userId);

      if (error) throw error;
      sendResponse({ success: true });

    } else if (request.action === 'batchDeleteAnnotations') {
      const { ids, userId } = request.data;
      let deletedCount = 0;
      let failedCount = 0;
      let notFoundCount = 0;

      const displayName = userId && userId.includes('@') ? userId.split('@')[0] : userId;
      console.log('🔄 batchDeleteAnnotations - ids:', ids);
      console.log('🔄 batchDeleteAnnotations - userId:', userId);
      console.log('🔄 batchDeleteAnnotations - displayName:', displayName);

      for (const id of ids) {
        const { data: existing, error: fetchError } = await supabase
          .from('annotations1')
          .select('user_id')
          .eq('id', id)
          .single();

        if (fetchError) {
          console.error('❌ 获取标注信息失败:', id, fetchError.message);
          notFoundCount++;
          continue;
        }

        if (!existing) {
          console.log('⚠️ 未找到标注:', id);
          notFoundCount++;
          continue;
        }

        console.log('📋 找到标注:', id, 'user_id:', existing.user_id);

        if (existing.user_id && existing.user_id !== displayName) {
          console.log('❌ 权限不足:', id, 'owner:', existing.user_id, 'current:', displayName);
          failedCount++;
          continue;
        }

        const { error: deleteError } = await supabase
          .from('annotations1')
          .delete()
          .eq('id', id);

        if (deleteError) {
          console.error('❌ 删除失败:', id, deleteError.message);
          failedCount++;
        } else {
          console.log('✅ 删除成功:', id);
          deletedCount++;
        }
      }

      console.log('📊 删除结果:', { deletedCount, failedCount, notFoundCount });

      if (deletedCount > 0) {
        sendResponse({ success: true, deletedCount, failedCount, notFoundCount });
      } else {
        let errorMsg = '没有删除任何标注';
        if (notFoundCount > 0) errorMsg += `（${notFoundCount}个未找到）`;
        if (failedCount > 0) errorMsg += `（${failedCount}个权限不足）`;
        sendResponse({ success: false, error: errorMsg });
      }

    } else if (request.action === 'getAnnotations') {
      const { data, error } = await supabase
        .from('annotations1')
        .select('*');

      if (error) throw error;
      sendResponse({ success: true, data });

    } else if (request.action === 'annotationsImported') {
      const { pageUrl, annotations } = request.data;

      for (const [selector, annotation] of Object.entries(annotations)) {
        const { data: existing } = await supabase
          .from('annotations1')
          .select('id')
          .eq('url_path', pageUrl)
          .eq('element_selector', selector)
          .single();

        if (existing) {
          const { error } = await supabase
            .from('annotations1')
            .update({ content: annotation.text })
            .eq('id', existing.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('annotations1')
            .insert({
              url_path: pageUrl,
              element_selector: selector,
              content: annotation.text,
              project_id: 'default'
            });

          if (error) throw error;
        }
      }

      sendResponse({ success: true });
    }
  } catch (error) {
    console.error('❌ 处理消息失败:', error.message);
    sendResponse({ success: false, error: error.message });
  }

  return true;
});

chrome.action.onClicked.addListener(function(tab) {
  chrome.tabs.sendMessage(tab.id, {action: 'startSelection'});
});
