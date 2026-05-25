(function() {
  let isAnnotationMode = false;
  let isSelecting = false;
  let selectedElement = null;
  let annotationEditor = null;
  let currentAnnotations = {};
  let annotationIdMap = {};
  let annotationOwnership = {};
  let annotationUsers = {};
  let userId = null;
  let currentUserEmail = null;

  function createAnnotationEditor() {
    annotationEditor = document.createElement('div');
    annotationEditor.className = 'annotation-editor';
    annotationEditor.innerHTML = `
      <div class="annotation-editor-header">
        <span class="annotation-editor-title">添加注释</span>
        <button class="annotation-editor-close">×</button>
      </div>
      <div class="annotation-editor-content">
        <textarea class="annotation-editor-textarea" placeholder="输入功能说明..."></textarea>
        <div class="annotation-editor-user"></div>
        <div class="annotation-editor-status">已连接</div>
      </div>
      <div class="annotation-editor-footer">
        <button class="annotation-editor-delete">删除</button>
        <button class="annotation-editor-save">保存</button>
      </div>
    `;
    annotationEditor.style.display = 'none';
    document.body.appendChild(annotationEditor);

    annotationEditor.querySelector('.annotation-editor-close').addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      closeEditor();
    });
    annotationEditor.querySelector('.annotation-editor-save').addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      saveAnnotation();
    });
    annotationEditor.querySelector('.annotation-editor-delete').addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      deleteAnnotation();
    });
  }

  function setupMessageListener() {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      if (request.action === 'startSelection') {
        startSelection();
      } else if (request.action === 'stopSelection') {
        stopSelection();
      } else if (request.action === 'annotationsLoaded') {
        currentAnnotations = request.data.annotations || {};
        annotationIdMap = request.data.idMap || {};
        annotationOwnership = request.data.ownership || {};
        annotationUsers = request.data.users || {};
        renderAllAnnotations();
      } else if (request.action === 'enableAnnotationMode') {
        enableAnnotationMode();
        sendResponse({ success: true });
      } else if (request.action === 'disableAnnotationMode') {
        disableAnnotationMode();
        sendResponse({ success: true });
      } else if (request.action === 'checkAnnotationMode') {
        sendResponse({ enabled: isAnnotationMode });
      } else if (request.action === 'annotationsImported') {
        if (request.data && request.data.annotations) {
          currentAnnotations = request.data.annotations;
        }
        renderAllAnnotations();
        sendResponse({ success: true });
      } else if (request.action === 'userInfoUpdated') {
        userId = request.data.userId;
        currentUserEmail = request.data.userEmail;
        console.log('✅ 用户信息已更新:', currentUserEmail);
        sendResponse({ success: true });
      } else if (request.action === 'locateToElement') {
        locateToElement(request.selector);
        sendResponse({ success: true });
      }
      return true;
    });
  }

  function startSelection() {
    isSelecting = true;
    document.body.style.cursor = 'crosshair';
    document.addEventListener('mouseout', unhighlightElement);
    document.addEventListener('mouseover', highlightElement);
    document.addEventListener('click', handleElementClick);
  }

  function stopSelection() {
    isSelecting = false;
    document.body.style.cursor = 'default';
    document.removeEventListener('mouseover', highlightElement);
    document.removeEventListener('mouseout', unhighlightElement);
    document.removeEventListener('click', handleElementClick);
    clearHighlights();
  }

  function enableAnnotationMode() {
    isAnnotationMode = true;
    renderAllAnnotations();
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', handleGlobalClick, true);
    document.addEventListener('submit', handleGlobalSubmit, true);
    window.addEventListener('beforeunload', handleBeforeUnload);
    disableAllLinks();
    startSelection();
    console.log('✅ 标注模式已开启');
  }

  function disableAnnotationMode() {
    isAnnotationMode = false;
    document.querySelectorAll('.annotation-marker').forEach(el => el.remove());
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('click', handleGlobalClick, true);
    document.removeEventListener('submit', handleGlobalSubmit, true);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    restoreAllLinks();
    stopSelection();
    closeEditor();
    console.log('❌ 标注模式已关闭');
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      if (isSelecting) {
        stopSelection();
      } else if (annotationEditor && annotationEditor.style.display === 'block') {
        closeEditor();
      } else if (isAnnotationMode) {
        disableAnnotationMode();
        chrome.runtime.sendMessage({action: 'annotationModeChanged', enabled: false});
      }
    } else if (e.key === 'a' || e.key === 'A') {
      if (isAnnotationMode && !isSelecting && !annotationEditor) {
        startSelection();
      }
    }
  }

  function handleGlobalClick(e) {
    if (!isAnnotationMode) return;
    
    if (isBeforeUnloadDialogOpen) {
      return;
    }
    
    const target = e.target;
    
    if (isBrowserDialogElement(target)) {
      e.stopPropagation();
      return;
    }
    
    const tagName = target.tagName.toLowerCase();
    
    if (tagName === 'a' && target.href) {
      e.preventDefault();
      e.stopPropagation();
    } else if (target.closest('a')) {
      const anchor = target.closest('a');
      if (anchor.href) {
        e.preventDefault();
        e.stopPropagation();
      }
    } else if (tagName === 'form') {
      e.preventDefault();
      e.stopPropagation();
    } else if (target.closest('form')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function handleGlobalSubmit(e) {
    if (!isAnnotationMode) return;
    e.preventDefault();
    e.stopPropagation();
  }

  let isBeforeUnloadDialogOpen = false;

  function handleBeforeUnload(e) {
    if (!isAnnotationMode) return;
    isBeforeUnloadDialogOpen = true;
    e.preventDefault();
    e.returnValue = '';
    setTimeout(() => {
      isBeforeUnloadDialogOpen = false;
    }, 100);
    return '';
  }

  function disableAllLinks() {
    document.querySelectorAll('a[href]').forEach(anchor => {
      if (!anchor.hasAttribute('data-original-href')) {
        anchor.setAttribute('data-original-href', anchor.href);
        anchor.removeAttribute('href');
      }
    });
  }

  function restoreAllLinks() {
    document.querySelectorAll('a[data-original-href]').forEach(anchor => {
      anchor.setAttribute('href', anchor.getAttribute('data-original-href'));
      anchor.removeAttribute('data-original-href');
    });
  }

  function highlightElement(e) {
    if (!isSelecting) return;
    e.target.classList.add('annotation-highlight');
  }

  function unhighlightElement(e) {
    e.target.classList.remove('annotation-highlight');
  }

  function clearHighlights() {
    const highlights = document.querySelectorAll('.annotation-highlight');
    highlights.forEach(el => el.classList.remove('annotation-highlight'));
  }

  function handleElementClick(e) {
    if (isBeforeUnloadDialogOpen) return;
    
    e.preventDefault();
    e.stopPropagation();

    if (!isSelecting) return;

    const target = e.target;
    
    if (isBrowserDialogElement(target)) {
      return;
    }

    selectedElement = target;
    const rect = selectedElement.getBoundingClientRect();
    const selector = generateSelector(selectedElement);

    const tagName = target.tagName.toLowerCase();
    
    if (tagName === 'a' && target.href) {
      target.setAttribute('data-href', target.href);
      target.removeAttribute('href');
    } else if (target.closest('a')) {
      const anchor = target.closest('a');
      if (anchor.href) {
        anchor.setAttribute('data-href', anchor.href);
        anchor.removeAttribute('href');
      }
    }

    showEditor(rect, selector);
    stopSelection();
  }

  function isBrowserDialogElement(element) {
    if (!element || !element.nodeType) return false;
    
    const dialogTexts = ['离开此网站', '离开', '取消', 'Stay', 'Leave', 'Cancel', 'OK', '确定'];
    
    if (element.textContent && dialogTexts.some(text => element.textContent.includes(text))) {
      return true;
    }
    
    const parentElement = element.parentElement;
    if (!parentElement || parentElement === document.body) {
      const rect = element.getBoundingClientRect();
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      
      const distanceToCenter = Math.sqrt(
        Math.pow(rect.left + rect.width / 2 - centerX, 2) + 
        Math.pow(rect.top + rect.height / 2 - centerY, 2)
      );
      
      const computedStyle = window.getComputedStyle(element);
      const bgColor = computedStyle.getPropertyValue('background-color');
      
      if (distanceToCenter < 150 && 
          rect.width < 300 && 
          rect.height < 50 &&
          (bgColor === 'rgb(255, 102, 102)' || bgColor === 'rgb(66, 133, 244)')) {
        return true;
      }
    }
    
    return false;
  }

  function generateSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }

    let selector = [];
    let current = element;
    
    while (current && current !== document.body && current !== document.documentElement) {
      let tagName = current.tagName.toLowerCase();
      let classSelector = '';
      
      if (current.className) {
        const classes = current.className.split(' ')
          .filter(c => c && 
            !c.includes('annotation') && 
            !c.includes(':') && 
            !c.startsWith('-') &&
            !c.includes('/') &&
            !c.includes('(') &&
            !c.includes(')') &&
            !c.includes('[') &&
            !c.includes(']') &&
            !c.includes('{') &&
            !c.includes('}') &&
            !c.includes('"') &&
            !c.includes("'") &&
            /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c)
          )
          .slice(0, 3).join('.');
        if (classes) {
          classSelector = `.${classes}`;
        }
      }
      
      const siblings = current.parentElement?.children || [];
      const sameTagSiblings = Array.from(siblings).filter(s => s.tagName === current.tagName);
      
      if (sameTagSiblings.length > 1) {
        let nthIndex = 1;
        let sibling = current.previousElementSibling;
        while (sibling) {
          if (sibling.tagName === current.tagName) {
            nthIndex++;
          }
          sibling = sibling.previousElementSibling;
        }
        
        if (classSelector) {
          selector.unshift(`${tagName}:nth-of-type(${nthIndex})${classSelector}`);
        } else {
          selector.unshift(`${tagName}:nth-of-type(${nthIndex})`);
        }
      } else {
        selector.unshift(`${tagName}${classSelector}`);
      }
      
      current = current.parentElement;
      
      if (selector.length >= 4) break;
    }
    
    return selector.join(' > ');
  }

  function showEditor(rect, selector) {
    let left = rect.right + 10;
    let top = rect.top;

    if (left + 300 > window.innerWidth) {
      left = rect.left - 310;
    }

    if (top + 200 > window.innerHeight) {
      top = window.innerHeight - 210;
    }

    annotationEditor.style.left = left + 'px';
    annotationEditor.style.top = top + 'px';
    annotationEditor.style.display = 'block';
    annotationEditor.dataset.selector = selector;

    const textarea = annotationEditor.querySelector('.annotation-editor-textarea');
    const deleteBtn = annotationEditor.querySelector('.annotation-editor-delete');
    const saveBtn = annotationEditor.querySelector('.annotation-editor-save');
    const userInfo = annotationEditor.querySelector('.annotation-editor-user');

    const isOwner = annotationOwnership[selector];
    const annotatorUser = annotationUsers[selector];

    if (currentAnnotations[selector]) {
      textarea.value = currentAnnotations[selector].text;
      
      if (userInfo) {
        const displayName = annotatorUser || '未知';
        userInfo.textContent = `标注者: ${displayName}`;
        userInfo.dataset.initials = displayName.charAt(0).toUpperCase();
        userInfo.style.display = 'block';
      }
      
      if (isOwner) {
        deleteBtn.style.display = 'inline-block';
        textarea.disabled = false;
        saveBtn.style.display = 'inline-block';
      } else {
        deleteBtn.style.display = 'none';
        textarea.disabled = true;
        saveBtn.style.display = 'none';
      }
    } else {
      textarea.value = '';
      deleteBtn.style.display = 'none';
      textarea.disabled = false;
      saveBtn.style.display = 'inline-block';
      if (userInfo) {
        userInfo.style.display = 'none';
      }
    }

    textarea.focus();
  }

  function closeEditor() {
    annotationEditor.style.display = 'none';
    selectedElement = null;
    
    document.querySelectorAll('a[data-href]').forEach(anchor => {
      anchor.setAttribute('href', anchor.getAttribute('data-href'));
      anchor.removeAttribute('data-href');
    });
    
    if (isAnnotationMode && !isSelecting) {
      startSelection();
    }
  }

  function saveAnnotation() {
    const selector = annotationEditor.dataset.selector;
    const text = annotationEditor.querySelector('.annotation-editor-textarea').value.trim();
    const url = window.location.href;

    if (!text) {
      alert('请输入注释内容');
      return;
    }

    if (!userId && !currentUserEmail) {
      alert('请先打开插件弹窗获取用户信息后再添加标注');
      return;
    }

    const isUpdate = !!annotationIdMap[selector];
    const displayName = currentUserEmail ? currentUserEmail.split('@')[0] : userId || '未知用户';

    chrome.runtime.sendMessage({
      action: 'saveAnnotation',
      data: {
        pageUrl: url,
        selector: selector,
        text: text,
        id: annotationIdMap[selector] || null,
        userId: userId,
        userEmail: currentUserEmail
      }
    }, function(response) {
      if (response && response.success) {
        currentAnnotations[selector] = {
          text: text,
          timestamp: Date.now()
        };
        annotationIdMap[selector] = response.id;
        annotationOwnership[selector] = true;
        annotationUsers[selector] = displayName;
        renderAnnotation(selector, currentAnnotations[selector]);
        closeEditor();
      } else {
        alert('保存失败: ' + (response ? response.error : '未知错误'));
      }
    });
  }

  function deleteAnnotation() {
    const selector = annotationEditor.dataset.selector;

    if (!currentAnnotations[selector]) {
      closeEditor();
      return;
    }

    chrome.runtime.sendMessage({
      action: 'deleteAnnotation',
      data: {
        id: annotationIdMap[selector],
        userId: userId
      }
    }, function(response) {
      delete currentAnnotations[selector];
      delete annotationIdMap[selector];
      removeAnnotationElement(selector);
      closeEditor();
    });
  }

  function renderAllAnnotations() {
    document.querySelectorAll('.annotation-marker').forEach(el => el.remove());
    
    Object.keys(currentAnnotations).forEach(selector => {
      renderAnnotation(selector, currentAnnotations[selector]);
    });
  }

  function renderAnnotation(selector, annotation) {
    let elements;
    try {
      elements = document.querySelectorAll(selector);
    } catch (error) {
      console.warn('❌ 无效的选择器:', selector, error.message);
      return;
    }
    if (elements.length === 0) return;

    let annotationEl = document.querySelector(`.annotation-marker[data-selector="${selector}"]`);
    
    if (!annotationEl) {
      annotationEl = document.createElement('div');
      annotationEl.className = 'annotation-marker';
      annotationEl.dataset.selector = selector;
      annotationEl.innerHTML = `<span class="annotation-badge">✦</span>`;

      const element = elements[0];
      const rect = element.getBoundingClientRect();
      annotationEl.style.position = 'fixed';
      annotationEl.style.left = (rect.right + window.scrollX) + 'px';
      annotationEl.style.top = (rect.top + window.scrollY) + 'px';

      annotationEl.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        showEditMode(selector, annotation);
      });

      document.body.appendChild(annotationEl);
    }

    annotationEl.title = annotation.text;
  }

  function showEditMode(selector, annotation) {
    const annotationEl = document.querySelector(`.annotation-marker[data-selector="${selector}"]`);
    if (!annotationEl) return;

    const rect = {
      left: parseInt(annotationEl.style.left),
      right: parseInt(annotationEl.style.left) + 30,
      top: parseInt(annotationEl.style.top)
    };

    showEditor(rect, selector);
  }

  function removeAnnotationElement(selector) {
    const annotationEl = document.querySelector(`.annotation-marker[data-selector="${selector}"]`);
    if (annotationEl) {
      annotationEl.remove();
    }
  }

  function locateToElement(selector) {
    let elements;
    try {
      elements = document.querySelectorAll(selector);
    } catch (error) {
      console.warn('❌ 无效的选择器:', selector, error.message);
      alert('无法定位到元素：选择器无效');
      return;
    }

    if (elements.length === 0) {
      console.warn('❌ 未找到元素:', selector);
      alert('无法定位到元素：元素不存在或已被移除');
      return;
    }

    const element = elements[0];
    const rect = element.getBoundingClientRect();

    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    });

    const highlightOverlay = document.createElement('div');
    highlightOverlay.style.cssText = `
      position: fixed;
      left: ${rect.left + window.scrollX}px;
      top: ${rect.top + window.scrollY}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      border: 3px solid #667eea;
      border-radius: 8px;
      background: rgba(102, 126, 234, 0.15);
      pointer-events: none;
      z-index: 2147483647;
      box-shadow: 0 0 20px rgba(102, 126, 234, 0.5);
      animation: locatePulse 1.5s ease-out;
    `;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes locatePulse {
        0% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.8;
          transform: scale(1.05);
        }
        100% {
          opacity: 0;
          transform: scale(1.1);
        }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(highlightOverlay);

    setTimeout(() => {
      highlightOverlay.remove();
      style.remove();
    }, 1500);

    console.log('✅ 已定位到元素:', selector);
  }

  function init() {
    console.log('📌 原型标注助手初始化...');
    
    chrome.storage.local.get(['userId', 'userEmail'], function(stored) {
      userId = stored.userId || null;
      currentUserEmail = stored.userEmail || null;
      
      if (currentUserEmail) {
        console.log('✅ 使用缓存的用户信息:', currentUserEmail);
      } else {
        console.log('⚠️ 用户信息未找到，请先打开插件弹窗登录');
      }
      
      chrome.runtime.sendMessage({
        action: 'loadAnnotations',
        data: { pageUrl: window.location.href, userId: userId }
      }, function(response) {
        if (response && response.success) {
          currentAnnotations = response.data.annotations || {};
          annotationIdMap = response.data.idMap || {};
          annotationOwnership = response.data.ownership || {};
          annotationUsers = response.data.users || {};
          console.log('✅ 插件连接成功！已加载注释数据');
        } else {
          console.error('❌ 插件连接失败：无法从后台获取数据');
        }
      });
    });
    
    createAnnotationEditor();
    setupMessageListener();
    
    console.log('✅ 原型标注助手已加载到页面（标注模式未开启）');
  }

  init();
})();
