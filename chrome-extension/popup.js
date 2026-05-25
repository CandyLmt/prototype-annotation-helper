let isAnnotationMode = false;
let isListExpanded = false;
let currentUser = null;
let allAnnotations = [];
let selectedAnnotations = new Set();
let searchQuery = '';

document.addEventListener('DOMContentLoaded', function() {
  getUserInfo();
  loadCurrentPageAnnotations();
  checkAnnotationMode();

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'annotationUpdated') {
      loadCurrentPageAnnotations();
    } else if (request.action === 'annotationModeChanged') {
      isAnnotationMode = request.enabled;
      updateToggleSwitch();
    }
  });

  document.getElementById('toggleSwitch').addEventListener('click', function() {
    toggleAnnotationMode();
  });

  document.getElementById('toggleSection').addEventListener('click', function(e) {
    if (e.target.closest('#toggleSwitch')) return;
    toggleAnnotationMode();
  });

  document.getElementById('clearAll').addEventListener('click', function() {
    if (confirm('确定要清除本页所有注释吗？此操作不可恢复。')) {
      clearAllAnnotations();
    }
  });

  document.getElementById('statsRow').addEventListener('click', function() {
    toggleAnnotationList();
  });

  document.getElementById('exportBtn').addEventListener('click', function() {
    exportAnnotations();
  });

  document.getElementById('importBtn').addEventListener('click', function() {
    document.getElementById('importFile').click();
  });

  document.getElementById('importFile').addEventListener('change', function(e) {
    if (e.target.files.length > 0) {
      importAnnotations(e.target.files[0]);
    }
  });

  document.getElementById('searchInput').addEventListener('input', function(e) {
    searchQuery = e.target.value.trim().toLowerCase();
    filterAnnotations();
  });

  document.getElementById('batchDeleteBtn').addEventListener('click', function() {
    if (selectedAnnotations.size === 0) {
      alert('请先选择要删除的标注');
      return;
    }
    if (confirm(`确定要删除选中的 ${selectedAnnotations.size} 个标注吗？此操作不可恢复。`)) {
      batchDeleteAnnotations();
    }
  });

  document.getElementById('saveUserIdBtn').addEventListener('click', function() {
    const manualId = document.getElementById('manualUserId').value.trim();
    if (!manualId) {
      alert('请输入用户标识');
      return;
    }

    const email = manualId.includes('@') ? manualId : manualId + '@example.com';
    const userId = manualId.includes('@') ? manualId.split('@')[0] : manualId;
    currentUser = {
      email: email,
      id: userId
    };

    document.getElementById('authError').classList.remove('show');
    document.getElementById('manualUserInput').style.display = 'none';
    document.getElementById('userName').textContent = userId;
    document.getElementById('userEmail').textContent = email;
    document.getElementById('userAvatar').textContent = email.charAt(0).toUpperCase();
    chrome.storage.local.set({ userId: userId, userEmail: email, useManualUser: true }, function() {
      chrome.tabs.query({}, function(tabs) {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'userInfoUpdated',
            data: { userId: userId, userEmail: email }
          });
        });
      });
      alert('用户标识已保存！');
    });
  });
});

function toggleAnnotationList() {
  isListExpanded = !isListExpanded;
  const listContainer = document.getElementById('annotationList');
  const statsRow = document.getElementById('statsRow');
  
  if (isListExpanded) {
    listContainer.classList.add('show');
    statsRow.classList.add('expanded');
  } else {
    listContainer.classList.remove('show');
    statsRow.classList.remove('expanded');
  }
}

function checkAnnotationMode() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {action: 'checkAnnotationMode'}, function(response) {
      if (chrome.runtime.lastError) {
        console.log('检查标注模式时content script未加载');
        return;
      }
      if (response && response.enabled !== undefined) {
        isAnnotationMode = response.enabled;
        updateToggleSwitch();
      }
    });
  });
}

function toggleAnnotationMode() {
  const newMode = !isAnnotationMode;
  
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const tabId = tabs[0].id;
    
    chrome.tabs.sendMessage(tabId, {
      action: newMode ? 'enableAnnotationMode' : 'disableAnnotationMode'
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.error('发送消息失败:', chrome.runtime.lastError.message);
        if (chrome.runtime.lastError.message.includes('Receiving end does not exist')) {
          alert('页面脚本未加载，请刷新页面后重试');
        } else {
          alert('操作失败: ' + chrome.runtime.lastError.message);
        }
        return;
      }
      
      if (response && response.success) {
        isAnnotationMode = newMode;
        updateToggleSwitch();
        if (isAnnotationMode) {
          window.close();
        }
      } else {
        alert('操作失败');
      }
    });
  });
}

function updateToggleSwitch() {
  const toggleSwitch = document.getElementById('toggleSwitch');
  if (isAnnotationMode) {
    toggleSwitch.classList.add('active');
  } else {
    toggleSwitch.classList.remove('active');
  }
}

function loadCurrentPageAnnotations() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const url = tabs[0].url;

    chrome.runtime.sendMessage({
      action: 'loadAnnotations',
      data: { pageUrl: url, userId: getUserId() }
    }, function(response) {
      if (response && response.success) {
        const users = response.data.users || {};
        const annotations = Object.keys(response.data.annotations).map(key => ({
          id: response.data.idMap[key],
          selector: key,
          user: users[key],
          ...response.data.annotations[key]
        }));
        allAnnotations = annotations;
        renderAnnotationList(getFilteredAnnotations());
        document.getElementById('annotationCount').textContent = annotations.length;
      } else {
        console.error('Failed to load annotations:', response ? response.error : 'Unknown error');
        chrome.storage.local.get(['annotations'], function(result) {
          const annotations = result.annotations || {};
          const pageAnnotations = annotations[url] || {};
          const annotationArray = Object.keys(pageAnnotations).map(key => ({
            selector: key,
            ...pageAnnotations[key]
          }));
          allAnnotations = annotationArray;
          renderAnnotationList(getFilteredAnnotations());
          document.getElementById('annotationCount').textContent = annotationArray.length;
        });
      }
    });
  });
}

function getFilteredAnnotations() {
  if (!searchQuery) {
    return allAnnotations;
  }
  return allAnnotations.filter(ann => 
    ann.text.toLowerCase().includes(searchQuery) ||
    ann.selector.toLowerCase().includes(searchQuery) ||
    (ann.user && ann.user.toLowerCase().includes(searchQuery))
  );
}

function filterAnnotations() {
  const filtered = getFilteredAnnotations();
  renderAnnotationList(filtered);
  updateSearchCount(filtered.length);
}

function updateSearchCount(filteredCount) {
  document.getElementById('searchCount').textContent = `${filteredCount}/${allAnnotations.length}`;
}

function updateBatchActions() {
  const batchActions = document.getElementById('batchActions');
  const selectedCount = document.getElementById('selectedCount');
  
  if (selectedAnnotations.size > 0) {
    batchActions.style.display = 'flex';
    selectedCount.textContent = selectedAnnotations.size;
  } else {
    batchActions.style.display = 'none';
  }
}

function batchDeleteAnnotations() {
  const idsToDelete = Array.from(selectedAnnotations);
  
  chrome.runtime.sendMessage({
    action: 'batchDeleteAnnotations',
    data: { ids: idsToDelete, userId: getUserId() }
  }, function(response) {
    if (response && response.success) {
      selectedAnnotations.clear();
      updateBatchActions();
      loadCurrentPageAnnotations();
      alert(`成功删除 ${idsToDelete.length} 个标注`);
    } else {
      alert('批量删除失败: ' + (response ? response.error : '未知错误'));
    }
  });
}

function toggleAnnotationSelection(annotationId) {
  if (selectedAnnotations.has(annotationId)) {
    selectedAnnotations.delete(annotationId);
  } else {
    selectedAnnotations.add(annotationId);
  }
  updateBatchActions();
}

function renderAnnotationList(annotations) {
  const listContainer = document.getElementById('annotationList');

  if (annotations.length === 0) {
    if (searchQuery) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-text">未找到匹配的标注<br>尝试其他关键词</div>
        </div>
      `;
    } else {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-text">暂无注释<br>开启"添加标注"开始添加</div>
        </div>
      `;
    }
    return;
  }

  const sortedAnnotations = annotations.sort((a, b) => b.timestamp - a.timestamp);

    listContainer.innerHTML = sortedAnnotations.map(annotation => {
      const userName = annotation.user || annotation.userEmail?.split('@')[0] || '未知用户';
      const userInitial = userName.charAt(0).toUpperCase();
      const annotationId = annotation.id;
      const isSelected = annotationId && selectedAnnotations.has(annotationId);
      const isDisabled = !annotationId;
      return `
        <div class="annotation-item ${isSelected ? 'selected' : ''}" data-selector="${escapeHtml(annotation.selector)}" data-id="${annotationId || ''}">
          <div class="annotation-item-checkbox ${isSelected ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}" data-annotation-id="${annotationId || ''}"></div>
        <div class="annotation-item-content">
          <span class="annotation-item-selector">${escapeHtml(annotation.selector)}</span>
          <div class="annotation-item-text">${escapeHtml(annotation.text)}</div>
          <div class="annotation-item-time">${formatTime(annotation.timestamp)}</div>
          <div class="annotation-item-user">
            <span class="annotation-item-user-avatar">${userInitial}</span>
            <span class="annotation-item-user-name">${escapeHtml(userName)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  listContainer.querySelectorAll('.annotation-item-checkbox').forEach(checkbox => {
    checkbox.addEventListener('click', function(e) {
      e.stopPropagation();
      const annotationId = this.dataset.annotationId;
      if (!annotationId) {
        return;
      }
      toggleAnnotationSelection(annotationId);
      this.classList.toggle('checked');
      this.closest('.annotation-item').classList.toggle('selected');
    });
  });

  listContainer.querySelectorAll('.annotation-item').forEach(item => {
    item.addEventListener('click', function(e) {
      if (e.target.classList.contains('annotation-item-checkbox')) {
        return;
      }
      const selector = this.dataset.selector;
      locateToElement(selector);
    });
  });
}

function locateToElement(selector) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'locateToElement',
      selector: selector
    });
  });
}

function clearAllAnnotations() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const url = tabs[0].url;

    chrome.runtime.sendMessage({
      action: 'deleteAllAnnotations',
      data: { pageUrl: url }
    }, function(response) {
      if (response && response.success) {
        chrome.storage.local.get(['annotations'], function(result) {
          const annotations = result.annotations || {};
          delete annotations[url];
          chrome.storage.local.set({annotations: annotations});
        });
        loadCurrentPageAnnotations();
        isListExpanded = false;
        document.getElementById('annotationList').classList.remove('show');
        document.getElementById('statsRow').classList.remove('expanded');
      } else {
        alert('清除失败: ' + (response ? response.error : '未知错误'));
      }
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) {
    return '刚刚';
  } else if (diff < 3600000) {
    return Math.floor(diff / 60000) + '分钟前';
  } else if (diff < 86400000) {
    return Math.floor(diff / 3600000) + '小时前';
  } else {
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

function exportAnnotations() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const url = tabs[0].url;
    const pageTitle = tabs[0].title || '未命名页面';

    chrome.storage.local.get(['annotations', 'idMap'], function(result) {
      const annotations = result.annotations || {};
      const idMap = result.idMap || {};
      const pageAnnotations = annotations[url] || {};

      const exportData = {
        version: 1,
        exportTime: new Date().toISOString(),
        pageUrl: url,
        pageTitle: pageTitle,
        annotations: {}
      };

      Object.keys(pageAnnotations).forEach(selector => {
        const annotation = pageAnnotations[selector];
        const id = idMap[selector];
        exportData.annotations[selector] = {
          id: id,
          text: annotation.text,
          timestamp: annotation.timestamp
        };
      });

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const fileName = `标注_${pageTitle.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;

      const reader = new FileReader();
      reader.onload = function() {
        const dataUrl = reader.result;
        chrome.downloads.download({
          url: dataUrl,
          filename: fileName,
          saveAs: true
        }, function(downloadId) {
          if (chrome.runtime.lastError) {
            alert('导出失败: ' + chrome.runtime.lastError.message);
          } else {
            console.log('导出成功，下载ID:', downloadId);
          }
        });
      };
      reader.readAsDataURL(blob);
    });
  });
}

function importAnnotations(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importData = JSON.parse(e.target.result);

      if (!importData.version || !importData.pageUrl || !importData.annotations) {
        alert('文件格式不正确，不是有效的标注文件');
        return;
      }

      const confirmImport = confirm(`即将导入以下标注：\n\n页面：${importData.pageTitle || importData.pageUrl}\n标注数量：${Object.keys(importData.annotations).length}\n\n是否继续？`);
      if (!confirmImport) {
        return;
      }

      chrome.storage.local.get(['annotations', 'idMap'], function(result) {
        const annotations = result.annotations || {};
        const idMap = result.idMap || {};

        if (!annotations[importData.pageUrl]) {
          annotations[importData.pageUrl] = {};
        }

        Object.keys(importData.annotations).forEach(selector => {
          const annotation = importData.annotations[selector];
          annotations[importData.pageUrl][selector] = {
            text: annotation.text,
            timestamp: annotation.timestamp
          };
          if (annotation.id) {
            idMap[selector] = annotation.id;
          }
        });

        chrome.storage.local.set({ annotations: annotations, idMap: idMap }, function() {
          chrome.runtime.sendMessage({
            action: 'annotationsImported',
            data: {
              pageUrl: importData.pageUrl,
              annotations: annotations[importData.pageUrl]
            }
          }, function(response) {
            if (response && response.success) {
              alert('导入成功！');
              loadCurrentPageAnnotations();
            } else {
              alert('导入成功（本地存储已更新，但页面刷新失败，请手动刷新页面）');
              loadCurrentPageAnnotations();
            }
          });
        });
      });
    } catch (error) {
      alert('导入失败：文件解析错误 ' + error.message);
    }
  };
  reader.readAsText(file);
}

function getUserInfo() {
  chrome.storage.local.get(['userId', 'userEmail'], function(stored) {
    chrome.identity.getProfileUserInfo(function(userInfo) {
      let email = null;
      let userId = null;

      console.log('📊 Chrome API 返回:', userInfo);
      console.log('📊 缓存数据:', stored);

      if (userInfo && userInfo.email) {
        email = userInfo.email;
        userId = email.split('@')[0];
        console.log('✅ 从 Chrome API 获取用户信息:', email, 'userId:', userId);
        chrome.storage.local.set({ userId: userId, userEmail: email }, function() {
          notifyTabsUserInfoUpdated(userId, email);
        });
      } else if (stored.userEmail && stored.userId) {
        email = stored.userEmail;
        userId = stored.userId;
        console.log('🔄 使用缓存的用户信息:', email, 'userId:', userId);
        notifyTabsUserInfoUpdated(userId, email);
      }

      if (email) {
        currentUser = {
          email: email,
          id: userId
        };
        document.getElementById('authError').classList.remove('show');
        document.getElementById('manualUserInput').style.display = 'none';
        document.getElementById('userName').textContent = email.split('@')[0];
        document.getElementById('userEmail').textContent = email;
        document.getElementById('userAvatar').textContent = email.charAt(0).toUpperCase();
      } else {
        document.getElementById('authError').classList.add('show');
        document.getElementById('manualUserInput').style.display = 'block';
        document.getElementById('userName').textContent = '未登录';
        document.getElementById('userEmail').textContent = '-';
        document.getElementById('userAvatar').textContent = '?';
      }
    });
  });
}

function notifyTabsUserInfoUpdated(userId, userEmail) {
  chrome.tabs.query({}, function(tabs) {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'userInfoUpdated',
        data: { userId: userId, userEmail: userEmail }
      }).catch(() => {});
    });
  });
}

function getUserId() {
  return currentUser ? currentUser.id : null;
}