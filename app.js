(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const STORAGE_KEY = 'riwayat.workspace.v1';
  const THEME_KEY = 'riwayat.theme.v1';
  const faNumber = new Intl.NumberFormat('fa-IR');
  const faTime = (date = new Date()) => new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(date);
  const nowISO = () => new Date().toISOString();
  const makeId = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const stripHTML = html => { const doc = new DOMParser().parseFromString(String(html || ''), 'text/html'); return (doc.body.textContent || '').replace(/\s+/g, ' ').trim(); };
  const wordCount = text => { const clean = String(text || '').trim(); return clean ? clean.split(/[\s\u200c]+/u).filter(Boolean).length : 0; };
  const readableDate = value => { if (!value) return 'بدون تاریخ'; const d = new Date(value); if (Number.isNaN(d.getTime())) return String(value); return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' }).format(d); };
  const cleanHTML = html => {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    doc.querySelectorAll('script,style,iframe,object,embed,form,input,button,meta,link').forEach(el => el.remove());
    doc.body.querySelectorAll('*').forEach(el => {
      [...el.attributes].forEach(attr => {
        if (/^on/i.test(attr.name) || (['href','src'].includes(attr.name) && /^\s*javascript:/i.test(attr.value))) el.removeAttribute(attr.name);
        if (attr.name === 'contenteditable') el.removeAttribute(attr.name);
      });
    });
    return doc.body.innerHTML;
  };
  const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const splitTags = value => [...new Set((Array.isArray(value) ? value : String(value || '').split(/[,،]/)).map(item => String(item).trim()).filter(Boolean))];
  const initialData = () => {
    const id = makeId();
    return {
      version: 2,
      settings: {
        projectTitle: 'رمان من', genre: 'بدون ژانر', dailyGoal: 500,
        todayWords: 0, totalTarget: 50000, dailyWordsDate: localDateKey(),
        dailyWordsBaseline: 0, theme: 'light', editorFontSize: 15,
        editorLineHeight: 2.2, editorFontFamily: 'Tahoma'
      },
      chapters: [{ id, title: 'فصل اول', status: 'پیش‌نویس', content: '', updatedAt: nowISO() }],
      selectedChapterId: id, notes: [], events: [], characters: [], tags: [], lastSavedAt: nowISO()
    };
  };

  function normalizeData(raw) {
    const seed = initialData();
    if (!raw || typeof raw !== 'object') return seed;
    const normalized = { ...seed, ...raw };
    normalized.settings = { ...seed.settings, ...(raw.settings || {}) };
    ['chapters','notes','events','characters','tags'].forEach(k => { if (!Array.isArray(normalized[k])) normalized[k] = seed[k]; });
    normalized.chapters = normalized.chapters.map(ch => ({ id: ch.id || makeId(), title: String(ch.title || 'فصل بدون نام'), status: ch.status || 'پیش‌نویس', content: cleanHTML(ch.content || ''), tags: Array.isArray(ch.tags) ? ch.tags.map(String) : [], updatedAt: ch.updatedAt || nowISO() }));
    normalized.notes = normalized.notes.map(n => ({ id:n.id || makeId(), title:String(n.title || 'یادداشت بدون نام'), body:String(n.body || ''), category:n.category || 'عمومی', tags:Array.isArray(n.tags) ? n.tags.map(String) : [], pinned:!!n.pinned, createdAt:n.createdAt || nowISO() }));
    normalized.events = normalized.events.map(e => ({id:e.id || makeId(), title:String(e.title || 'رویداد'), when:String(e.when || ''), detail:String(e.detail || '')}));
    normalized.characters = normalized.characters.map(c => ({id:c.id || makeId(), name:String(c.name || 'شخصیت'), role:String(c.role || ''), description:String(c.description || '')}));
    normalized.tags = normalized.tags.map(t => ({id:t.id || makeId(), name:String(t.name || 'برچسب'), color:String(t.color || '#8d70ed')}));
    if (!normalized.chapters.length) normalized.chapters.push({id:makeId(),title:'فصل اول',status:'پیش‌نویس',content:'',updatedAt:nowISO()});
    if (!normalized.chapters.some(ch => ch.id === normalized.selectedChapterId)) normalized.selectedChapterId = normalized.chapters[0].id;
    normalized.version = 2;
    normalized.settings.dailyGoal = Math.max(1, Number(normalized.settings.dailyGoal) || 500);
    normalized.settings.todayWords = Math.max(0, Number(normalized.settings.todayWords) || 0);
    normalized.settings.totalTarget = Math.max(1, Number(normalized.settings.totalTarget) || 50000);
    normalized.settings.theme = normalized.settings.theme === 'dark' ? 'dark' : 'light';
    normalized.settings.editorFontSize = Math.min(24, Math.max(12, Number(normalized.settings.editorFontSize) || 15));
    normalized.settings.editorLineHeight = Math.min(3, Math.max(1.5, Number(normalized.settings.editorLineHeight) || 2.2));
    normalized.settings.editorFontFamily = ['Tahoma','Arial','Georgia','Times New Roman'].includes(normalized.settings.editorFontFamily) ? normalized.settings.editorFontFamily : 'Tahoma';
    const currentDate = localDateKey();
    const currentWords = normalized.chapters.reduce((sum, ch) => sum + wordCount(stripHTML(ch.content)), 0);
    if (!normalized.settings.dailyWordsDate || normalized.settings.dailyWordsDate !== currentDate || !Number.isFinite(Number(normalized.settings.dailyWordsBaseline))) {
      normalized.settings.dailyWordsDate = currentDate;
      normalized.settings.dailyWordsBaseline = currentWords;
      normalized.settings.todayWords = 0;
    } else {
      normalized.settings.dailyWordsBaseline = Math.max(0, Number(normalized.settings.dailyWordsBaseline) || 0);
      normalized.settings.todayWords = Math.max(0, currentWords - normalized.settings.dailyWordsBaseline);
    }
    return normalized;
  }
  function loadLocal() {
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return normalizeData(JSON.parse(raw)); return initialData(); }
    catch (error) { console.warn('Could not read local workspace', error); return initialData(); }
  }
  let data = loadLocal();
  let supabase = null;
  let currentUser = null;
  let cloudEnabled = false;
  let saveTimer = null;
  let remoteSaveChain = Promise.resolve();
  let currentView = 'write';
  let editorDirty = false;
  let viewOutlet;
  let dialogSubmitHandler = null;
  let dialogChapterId = null;
  let lastSaveDate = new Date();
  let lastRemoteUpdatedAt = null;
  let localDirty = false;
  let changeVersion = 0;
  let syncPromise = null;
  let syncingUserId = null;
  let remotePollTimer = null;
  function storeLocal() {
    data.lastSavedAt = nowISO(); lastSaveDate = new Date(data.lastSavedAt);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch (error) { toast('ذخیره‌ی محلی انجام نشد؛ فضای مرورگر را بررسی کن.', 'error'); }
    updateSaveStatus('local');
  }
  function scheduleSave({ remote = true } = {}) {
    changeVersion += 1;
    localDirty = true;
    updateDailyWords();
    storeLocal();
    renderStats();
    clearTimeout(saveTimer);
    const scheduledVersion = changeVersion;
    saveTimer = setTimeout(() => {
      if (remote && currentUser && supabase) pushRemote(false, scheduledVersion);
      else if (!currentUser) localDirty = false;
    }, 850);
  }
  function updateDailyWords() {
    const date = localDateKey();
    const total = totalWords();
    if (data.settings.dailyWordsDate !== date) {
      data.settings.dailyWordsDate = date;
      data.settings.dailyWordsBaseline = total;
      data.settings.todayWords = 0;
    } else {
      data.settings.todayWords = Math.max(0, total - Math.max(0, Number(data.settings.dailyWordsBaseline) || 0));
    }
  }
  function configPresent() {
    const cfg = window.RIWAYAT_CONFIG || {};
    return /^https:\/\//.test(cfg.supabaseUrl || '') && (cfg.supabaseAnonKey || '').trim().length > 15;
  }
  function initSupabase() {
    if (configPresent() && (!window.supabase || typeof window.supabase.createClient !== 'function')) {
      if (document.querySelector('script[data-riwayat-supabase-loader]')) return;
      const loader = document.createElement('script');
      loader.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      loader.async = true; loader.dataset.riwayatSupabaseLoader = 'true';
      loader.onload = () => initSupabase();
      loader.onerror = () => { cloudEnabled = false; updateSaveStatus('local'); toast('کتابخانه‌ی همگام‌سازی بارگذاری نشد؛ ذخیره‌ی محلی فعال است.', 'error'); };
      document.head.appendChild(loader);
      return;
    }
    if (configPresent() && window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        supabase = window.supabase.createClient(window.RIWAYAT_CONFIG.supabaseUrl.trim(), window.RIWAYAT_CONFIG.supabaseAnonKey.trim(), {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        cloudEnabled = true;
        supabase.auth.getSession().then(({ data: sessionData, error }) => {
          if (error) throw error;
          if (sessionData.session) syncFromSession(sessionData.session);
          else updateSaveStatus('local');
        }).catch(err => { console.error(err); updateSaveStatus('error'); });
        supabase.auth.onAuthStateChange((event, session) => {
          if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) setTimeout(() => syncFromSession(session), 0);
          if (event === 'SIGNED_OUT') {
            currentUser = null; lastRemoteUpdatedAt = null; localDirty = false;
            updateSaveStatus('local'); toast('از فضای ابری خارج شدی. نسخه‌ی این دستگاه همچنان ذخیره است.');
          }
        });
        remotePollTimer = setInterval(pollRemote, 9000);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pollRemote(); else flushBeforeHide(); });
        window.addEventListener('pagehide', flushBeforeHide);
        window.addEventListener('focus', pollRemote);
      } catch (error) { console.error('Supabase setup failed', error); cloudEnabled = false; }
    }
    updateSaveStatus(currentUser ? 'cloud' : 'local');
  }
  function workspaceHasContent(workspace) {
    if (!workspace) return false;
    const st = workspace.settings || {};
    const customSettings = ((st.projectTitle || '').trim() && !['رمان من','سرزمین مه‌آلود'].includes(st.projectTitle.trim())) ||
      (st.genre && st.genre !== 'بدون ژانر') || Number(st.dailyGoal || 500) !== 500 || Number(st.totalTarget || 50000) !== 50000 ||
      st.theme === 'dark' || Number(st.editorFontSize || 15) !== 15 || Number(st.editorLineHeight || 2.2) !== 2.2 || (st.editorFontFamily && st.editorFontFamily !== 'Tahoma');
    return (workspace.chapters || []).some(ch => stripHTML(ch.content || '').length > 0) ||
      (workspace.notes || []).length > 0 || (workspace.events || []).length > 0 ||
      (workspace.characters || []).length > 0 || (workspace.tags || []).length > 0 || !!customSettings;
  }
  function sameWorkspace(a, b) {
    const clean = value => {
      const copy = JSON.parse(JSON.stringify(value || {}));
      delete copy.lastSavedAt;
      (copy.chapters || []).forEach(ch => delete ch.updatedAt);
      return JSON.stringify(copy);
    };
    return clean(a) === clean(b);
  }
  async function syncFromSession(session) {
    if (!supabase || !session?.user) return;
    if (syncPromise && syncingUserId === session.user.id) return syncPromise;
    syncingUserId = session.user.id;
    syncPromise = (async () => {
      currentUser = session.user;
      updateSaveStatus('busy');
      try {
        const { data: row, error } = await supabase.from('workspaces').select('data, updated_at').eq('user_id', currentUser.id).maybeSingle();
        if (error) throw error;
        const localCopy = normalizeData(data);
        if (row && row.data) {
          lastRemoteUpdatedAt = row.updated_at || null;
          const remoteData = normalizeData(row.data);
          if (workspaceHasContent(localCopy) && !workspaceHasContent(remoteData)) {
            // Do not let a blank cloud workspace replace real local writing.
            data = localCopy;
            await pushRemote(true, changeVersion);
            renderAll();
            toast('متن‌های این دستگاه در فضای ابری ذخیره شدند.', 'success');
          } else if (workspaceHasContent(localCopy) && workspaceHasContent(remoteData) && !sameWorkspace(localCopy, remoteData)) {
            try { localStorage.setItem('riwayat.recovery.pre-cloud.v1', JSON.stringify(localCopy)); } catch (_) {}
            const chooseCloud = window.confirm(`در این دستگاه و فضای ابری هر دو اطلاعات رمان وجود دارد و متفاوت‌اند.\n\nبرای دریافت نسخه‌ی ابری، «تأیید» را بزن.\nبرای نگه‌داشتن اطلاعات این دستگاه و بارگذاری آن در ابر، «لغو» را بزن.\n\nپیش از این انتخاب، یک نسخه‌ی بازیابی از اطلاعات این دستگاه ذخیره شد.`);
            if (chooseCloud) {
              data = remoteData; storeLocal(); renderAll();
              toast('نسخه‌ی ابری بارگذاری شد. نسخه‌ی قبلی این دستگاه در پشتیبان بازیابی نگه‌داری شد.', 'success');
            } else {
              data = localCopy; await pushRemote(true, changeVersion);
              toast('اطلاعات این دستگاه در فضای ابری ذخیره شد.', 'success');
            }
          } else {
            data = remoteData; storeLocal(); renderAll();
            toast('آخرین نسخه‌ی ابری رمان بارگذاری شد.', 'success');
          }
          localDirty = false;
          updateAuthDialogState();
          updateSaveStatus('cloud');
        } else {
          // New cloud account: initialize its workspace from this device without deleting local writing.
          await pushRemote(true, changeVersion);
          renderAll();
          toast('فضای ابری ساخته شد و اطلاعات این دستگاه در آن ذخیره شد.', 'success');
        }
      } catch (error) {
        console.error(error); updateSaveStatus('error');
        toast('اتصال ابری انجام نشد. اتصال اینترنت، config.js و سیاست‌های دسترسی Supabase را بررسی کن.', 'error');
      }
    })();
    try { await syncPromise; } finally { syncPromise = null; syncingUserId = null; }
  }
  async function pushRemote(force = false, versionAtStart = changeVersion) {
    if (!supabase || !currentUser) return;
    const snapshot = JSON.parse(JSON.stringify(data));
    const userId = currentUser.id;
    const updatedAt = nowISO();
    remoteSaveChain = remoteSaveChain.catch(() => {}).then(async () => {
      updateSaveStatus('busy');
      const { data: savedRow, error } = await supabase.from('workspaces').upsert(
        { user_id: userId, data: snapshot, updated_at: updatedAt }, { onConflict: 'user_id' }
      ).select('updated_at').single();
      if (error) throw error;
      if (currentUser?.id === userId) {
        lastRemoteUpdatedAt = savedRow?.updated_at || updatedAt;
        if (changeVersion === versionAtStart) localDirty = false;
        updateSaveStatus('cloud');
      }
    }).catch(error => {
      console.error('Cloud save failed', error); if (currentUser?.id === userId) updateSaveStatus('error');
      if (force) throw error;
      toast('روی این دستگاه ذخیره شد، اما همگام‌سازی ابری خطا داد.', 'error');
    });
    return remoteSaveChain;
  }
  function flushBeforeHide() {
    const ch = selectedChapter();
    if (ch && $('#editor')) ch.content = cleanHTML($('#editor').innerHTML);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
    if (currentUser && supabase) { clearTimeout(saveTimer); pushRemote(false, changeVersion); }
  }
  async function pollRemote() {
    if (!supabase || !currentUser || document.visibilityState === 'hidden' || localDirty || syncPromise || document.activeElement === $('#editor') || document.activeElement === $('#chapterTitleInput')) return;
    try {
      const { data: row, error } = await supabase.from('workspaces').select('data, updated_at').eq('user_id', currentUser.id).maybeSingle();
      if (error) throw error;
      if (!row?.data || !row.updated_at) return;
      if (!lastRemoteUpdatedAt || Date.parse(row.updated_at) > Date.parse(lastRemoteUpdatedAt) + 500) {
        if (localDirty) return;
        data = normalizeData(row.data);
        lastRemoteUpdatedAt = row.updated_at;
        storeLocal(); renderAll();
        localDirty = false; updateSaveStatus('cloud');
        toast('تغییرات دستگاه دیگر دریافت شد.', 'success');
      }
    } catch (error) {
      console.warn('Remote refresh failed', error);
    }
  }
  function updateSaveStatus(mode) {
    const pill = $('#syncPill');
    if (pill) {
      pill.className = 'sync-pill ' + (mode === 'cloud' ? 'cloud' : mode === 'busy' ? 'busy' : mode === 'error' ? 'error' : 'local');
      const labels = {cloud:'همگام‌سازی ابری روشن',busy:'در حال همگام‌سازی…',error:'خطا در همگام‌سازی',local:'ذخیره روی همین دستگاه'};
      pill.querySelector('span').textContent = labels[mode] || labels.local;
    }
    const status = $('#saveStatusText'); if (status) status.textContent = mode === 'busy' ? 'در حال ذخیره…' : mode === 'error' ? 'ذخیره‌ی محلی؛ خطای ابر' : 'همه‌چیز ذخیره شد';
    const dot = $('.save-dot'); if (dot) dot.style.background = mode === 'error' ? 'var(--red)' : mode === 'busy' ? '#8a79ee' : '#2fac89';
    const time = $('#saveTime'); if (time) time.textContent = mode === 'busy' ? '…' : faTime(lastSaveDate);
    $('#saveFootnote').textContent = mode === 'cloud' ? 'نسخه‌ی ابری همگام است' : mode === 'error' ? 'ذخیره‌ی محلی فعال است' : 'ذخیره‌ی خودکار روشن است';
  }
  function toast(message, type = '') {
    const region = $('#toastRegion'); const item = document.createElement('div'); item.className = 'toast ' + type; item.textContent = message; region.appendChild(item);
    setTimeout(() => { item.style.opacity = '0'; item.style.transform = 'translateY(6px)'; setTimeout(() => item.remove(), 250); }, 3500);
  }
  function selectedChapter() { return data.chapters.find(ch => ch.id === data.selectedChapterId) || data.chapters[0]; }
  function totalWords() { return data.chapters.reduce((sum,ch) => sum + wordCount(stripHTML(ch.content)), 0); }
  function chapterWords(ch) { return wordCount(stripHTML(ch.content)); }
  function formatCount(n) { return faNumber.format(Math.max(0, Math.round(Number(n) || 0))); }

  function renderAll() {
    if (typeof applyTheme === 'function') { const dark = data.settings.theme === 'dark'; document.body.classList.toggle('dark', dark); localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); }
    renderHeader(); renderChapterSelect(); renderEditor(); renderStats(); renderTags(); renderPinnedNotes(); renderRightRail(); renderNavCounts();
    if (currentView !== 'write') renderView(currentView);
  }
  function renderHeader() {
    const title = data.settings.projectTitle || 'رمان بدون نام';
    $('#mainProjectTitle').childNodes[0].textContent = title + ' ';
    $('#projectTitleSidebar').textContent = title;
    $('#projectMetaSidebar').textContent = `${data.settings.genre || 'بدون ژانر'} · پیش‌نویس`;
    $('#projectTitleSidebar').title = title;
  }
  function renderChapterSelect() {
    const select = $('#chapterSelect');
    select.innerHTML = data.chapters.map((ch,i) => `<option value="${escapeHTML(ch.id)}" ${ch.id===data.selectedChapterId?'selected':''}>${escapeHTML(formatCount(i+1)+'. '+ch.title)}</option>`).join('');
    $('#chapterCountLabel').textContent = `${formatCount(data.chapters.length)} فصل`;
    $('#chapterNavCount').textContent = formatCount(data.chapters.length);
  }
  function renderEditor() {
    const ch = selectedChapter(); if (!ch) return;
    $('#chapterTitleInput').value = ch.title;
    $('#editor').innerHTML = cleanHTML(ch.content || '');
    $('#editor').style.fontSize = `${data.settings.editorFontSize || 15}px`;
    $('#editor').style.lineHeight = String(data.settings.editorLineHeight || 2.2);
    $('#editor').style.fontFamily = data.settings.editorFontFamily || 'Tahoma';
    const fontFamilyControl = $('#fontFamily'); if (fontFamilyControl) fontFamilyControl.value = data.settings.editorFontFamily || 'Tahoma';
    const count = chapterWords(ch);
    $('#wordCount').textContent = formatCount(count);
    $('#charCount').textContent = formatCount(stripHTML(ch.content).length);
    $('#readingTime').textContent = count ? `${formatCount(Math.max(1,Math.ceil(count/200)))} دقیقه` : 'کمتر از یک دقیقه';
    $('#chapterWordBadge').textContent = `${formatCount(count)} کلمه`;
    $$('.chapter-row').forEach(row => row.classList.toggle('active', row.dataset.id === ch.id));
    if (document.activeElement !== $('#editor')) editorDirty = false;
  }
  function renderStats() {
    const total = totalWords();
    const progress = Math.min(100, Math.round(total / data.settings.totalTarget * 100));
    const goalPct = Math.min(100, Math.round(data.settings.todayWords / data.settings.dailyGoal * 100));
    $('#progressPercent').textContent = `${formatCount(progress)}٪`;
    $('#progressBar').style.width = `${progress}%`;
    $('#progressWords').textContent = `${formatCount(total)} کلمه`;
    $('#progressChapters').textContent = `${formatCount(data.chapters.length)} فصل`;
    $('#totalWordStat').textContent = formatCount(total);
    $('#goalPercent').textContent = `${formatCount(goalPct)}٪`;
    $('#goalRing').style.setProperty('--ring', `${goalPct}%`);
    $('#goalLabel').textContent = `${formatCount(data.settings.todayWords)} / ${formatCount(data.settings.dailyGoal)} کلمه`;
    $('#goalBar').style.width = `${goalPct}%`;
    $('#chapterNavCount').textContent = formatCount(data.chapters.length);
    $('#noteNavCount').textContent = formatCount(data.notes.length);
    const ch = selectedChapter(); if (ch) { $('#wordCount').textContent = formatCount(chapterWords(ch)); $('#chapterWordBadge').textContent = `${formatCount(chapterWords(ch))} کلمه`; }
  }
  function renderTags() {
    $('#tagList').innerHTML = data.tags.length ? data.tags.map(tag => `<span class="tag-chip"><i class="tag-dot" style="background:${escapeHTML(tag.color)}"></i>${escapeHTML(tag.name)}<button data-action="delete-tag" data-id="${escapeHTML(tag.id)}" title="حذف برچسب">×</button></span>`).join('') : '<div class="empty-state">هنوز برچسبی نساختی.</div>';
  }
  function renderPinnedNotes() {
    const pinned = data.notes.filter(n => n.pinned).slice(0,3);
    $('#pinnedNotes').innerHTML = pinned.length ? pinned.map(n => `<button class="pinned-item" data-action="edit-note" data-id="${escapeHTML(n.id)}"><span class="note-dot">▧</span><span style="min-width:0"><b>${escapeHTML(n.title)}</b><small>${escapeHTML(n.category)}</small></span></button>`).join('') : '<div class="empty-state">یادداشت مهمی سنجاق نشده.</div>';
  }
  function renderRightRail() {
    $('#chapterList').innerHTML = data.chapters.map((ch,i) => `<div class="chapter-row ${ch.id===data.selectedChapterId?'active':''}" data-id="${escapeHTML(ch.id)}"><button class="chapter-row-main" data-action="select-chapter" data-id="${escapeHTML(ch.id)}" style="display:flex;align-items:center;gap:9px;flex:1;min-width:0;border:0;background:transparent;box-shadow:none;padding:0;text-align:right"><span class="chapter-number">${formatCount(i+1)}</span><span class="chapter-data"><b>${escapeHTML(ch.title)}</b><small>${formatCount(chapterWords(ch))} کلمه · ${escapeHTML(ch.status)}</small></span></button><button class="chapter-more" data-action="chapter-menu" data-id="${escapeHTML(ch.id)}" title="گزینه‌های فصل">•••</button></div>`).join('');
    $('#notePreviewList').innerHTML = data.notes.slice(0,3).map(n => `<button class="note-preview" data-action="edit-note" data-id="${escapeHTML(n.id)}"><span class="note-icon">✧</span><span style="min-width:0"><b>${escapeHTML(n.title)}</b><small>${escapeHTML(n.category)}${n.pinned?' · سنجاق‌شده':''}</small></span></button>`).join('') || '<div class="empty-state">یادداشتی ثبت نشده.</div>';
    $('#timelineMini').innerHTML = data.events.slice(0,4).map(e => `<div class="timeline-event">${escapeHTML(e.title)}<small>${escapeHTML(e.when)}</small></div>`).join('') || '<div class="empty-state">هنوز رویدادی نساختی.</div>';
  }
  function renderNavCounts() { $('#chapterNavCount').textContent = formatCount(data.chapters.length); $('#noteNavCount').textContent = formatCount(data.notes.length); }
  function ensureOutlet() {
    if (!viewOutlet) { viewOutlet = document.createElement('div'); viewOutlet.id = 'viewOutlet'; viewOutlet.className = 'view-page'; $('#mainWorkspace').appendChild(viewOutlet); }
    return viewOutlet;
  }
  function switchView(view) {
    currentView = view;
    $$('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
    const writing = view === 'write';
    ['.welcome-row','#editorView','.bottom-grid'].forEach(sel => { const el = $(sel); if (el) el.style.display = writing ? '' : 'none'; });
    document.body.classList.toggle('alternate-view', !writing);
    if (!writing) renderView(view);
    else { if (viewOutlet) viewOutlet.innerHTML=''; renderEditor(); }
    if (window.innerWidth < 821 && !writing) $('#mainWorkspace').scrollIntoView({ behavior:'smooth', block:'start' });
  }
  function renderView(view) {
    const outlet = ensureOutlet();
    if (view === 'chapters') {
      outlet.innerHTML = `<section class="page-card glass"><div class="page-title"><div><h2>فصل‌های رمان</h2><p>ساختار روایت را مرتب کن و هر فصل را جداگانه بنویس.</p></div><button class="primary-button" data-action="new-chapter">＋ فصل تازه</button></div><div class="page-grid">${data.chapters.map((ch,i)=>`<article class="entity-card"><div style="display:flex;align-items:center;gap:9px"><span class="chapter-number">${formatCount(i+1)}</span><div style="min-width:0;flex:1"><h3>${escapeHTML(ch.title)}</h3><div class="subhead">${formatCount(chapterWords(ch))} کلمه · ${escapeHTML(ch.status)}</div></div></div><p>${escapeHTML(stripHTML(ch.content).slice(0,150) || 'هنوز متنی برای این فصل ننوشته‌ای.')}</p>${(ch.tags||[]).length?`<div class="tag-list assigned-tags">${ch.tags.map(t=>`<span class="tag-chip">${escapeHTML(t)}</span>`).join('')}</div>`:''}<div class="entity-actions"><button data-action="open-chapter" data-id="${escapeHTML(ch.id)}" class="primary-button">ادامه‌ی نوشتن</button><button data-action="chapter-up" data-id="${escapeHTML(ch.id)}" class="secondary-button" ${i===0?'disabled':''} title="انتقال به بالا">↑ ترتیب</button><button data-action="chapter-down" data-id="${escapeHTML(ch.id)}" class="secondary-button" ${i===data.chapters.length-1?'disabled':''} title="انتقال به پایین">↓ ترتیب</button><button data-action="chapter-menu" data-id="${escapeHTML(ch.id)}" class="secondary-button">گزینه‌ها</button></div></article>`).join('')}</div></section>`;
    } else if (view === 'notes') {
      outlet.innerHTML = `<section class="page-card glass"><div class="page-title"><div><h2>دفتر یادداشت‌ها</h2><p>ایده‌ها، جزییات جهان داستان و نکته‌هایی که نباید فراموش شوند.</p></div><button class="primary-button" data-action="new-note">＋ یادداشت تازه</button></div><div class="page-grid">${data.notes.map(n=>`<article class="entity-card"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><h3>${escapeHTML(n.title)}</h3><span class="chapter-badge">${escapeHTML(n.category)}</span></div><p>${escapeHTML(n.body || 'متنی نوشته نشده است.')}</p>${(n.tags||[]).length?`<div class="tag-list assigned-tags">${n.tags.map(t=>`<span class="tag-chip">${escapeHTML(t)}</span>`).join('')}</div>`:''}<div class="entity-actions"><button class="secondary-button" data-action="edit-note" data-id="${escapeHTML(n.id)}">ویرایش</button><button class="secondary-button" data-action="toggle-pin-note" data-id="${escapeHTML(n.id)}">${n.pinned?'برداشتن سنجاق':'سنجاق کردن'}</button><button class="secondary-button" data-action="delete-note" data-id="${escapeHTML(n.id)}">حذف</button></div></article>`).join('') || '<div class="empty-state">دفترت هنوز خالی است. اولین ایده را ثبت کن.</div>'}</div></section>`;
    } else if (view === 'timeline') {
      outlet.innerHTML = `<section class="page-card glass"><div class="page-title"><div><h2>خط زمانی داستان</h2><p>ترتیب اتفاق‌ها را حتی وقتی ترتیب فصل‌ها متفاوت است، نگه دار.</p></div><button class="primary-button" data-action="new-event">＋ رویداد تازه</button></div><div class="page-grid">${data.events.map((e,i)=>`<article class="entity-card"><div style="display:flex;align-items:center;gap:9px"><span class="chapter-number">${formatCount(i+1)}</span><div><h3>${escapeHTML(e.title)}</h3><small class="subhead">${escapeHTML(e.when)}</small></div></div><p>${escapeHTML(e.detail || 'توضیحی ثبت نشده است.')}</p><div class="entity-actions"><button class="secondary-button" data-action="edit-event" data-id="${escapeHTML(e.id)}">ویرایش</button><button class="secondary-button" data-action="delete-event" data-id="${escapeHTML(e.id)}">حذف</button><button class="secondary-button" data-action="event-up" data-id="${escapeHTML(e.id)}" ${i===0?'disabled':''}>↑ جابه‌جایی</button><button class="secondary-button" data-action="event-down" data-id="${escapeHTML(e.id)}" ${i===data.events.length-1?'disabled':''}>↓ جابه‌جایی</button></div></article>`).join('') || '<div class="empty-state">برای شروع، اولین رویداد داستانت را اضافه کن.</div>'}</div></section>`;
    } else if (view === 'characters') {
      outlet.innerHTML = `<section class="page-card glass"><div class="page-title"><div><h2>شخصیت‌ها</h2><p>انگیزه، نقش و ویژگی‌های هر شخصیت را یک‌جا نگه دار.</p></div><button class="primary-button" data-action="new-character">＋ شخصیت تازه</button></div><div class="page-grid">${data.characters.map(c=>`<article class="entity-card"><span class="chapter-badge">${escapeHTML(c.role || 'نقش نامشخص')}</span><h3 style="margin-top:10px">${escapeHTML(c.name)}</h3><p>${escapeHTML(c.description || 'هنوز جزئیاتی اضافه نشده است.')}</p><div class="entity-actions"><button class="secondary-button" data-action="edit-character" data-id="${escapeHTML(c.id)}">ویرایش</button><button class="secondary-button" data-action="delete-character" data-id="${escapeHTML(c.id)}">حذف</button></div></article>`).join('') || '<div class="empty-state">شخصیت‌های داستانت را اینجا بساز.</div>'}</div></section>`;
    } else if (view === 'collections') {
      outlet.innerHTML = `<section class="page-card glass"><div class="page-title"><div><h2>دسته‌بندی‌ها و برچسب‌ها</h2><p>برای پیدا کردن سریع ایده‌ها و بخش‌های مرتبط از برچسب استفاده کن.</p></div><button class="primary-button" data-action="new-tag">＋ برچسب تازه</button></div><div class="tag-list" style="margin-bottom:18px">${data.tags.map(t=>`<span class="tag-chip"><i class="tag-dot" style="background:${escapeHTML(t.color)}"></i>${escapeHTML(t.name)}<button data-action="delete-tag" data-id="${escapeHTML(t.id)}">×</button></span>`).join('') || '<span class="empty-state">هنوز برچسبی نساخته‌ای.</span>'}</div><div class="info-box">برچسب‌ها برای نظم ذهنی و دسترسی سریع هستند؛ حذف یک برچسب، متن فصل‌ها یا یادداشت‌ها را حذف نمی‌کند.</div></section>`;
    }
  }

  function openDialog({ title, eyebrow = 'فضای داستان', fields = [], submit = 'ذخیره', onSubmit, danger = false, extraActions = [] }) {
    const dlg = $('#genericDialog'); $('#dialogTitle').textContent = title; $('#dialogEyebrow').textContent = eyebrow; $('#dialogSubmit').textContent = submit; $('#dialogSubmit').className = danger ? 'secondary-button' : 'primary-button';
    const body = $('#dialogBody');
    body.innerHTML = fields.map(f => {
      const id = `field-${f.name}`; const val = f.value == null ? '' : f.value;
      let control = '';
      if (f.type === 'textarea') control = `<textarea id="${id}" name="${escapeHTML(f.name)}" ${f.required?'required':''} placeholder="${escapeHTML(f.placeholder||'')}">${escapeHTML(val)}</textarea>`;
      else if (f.type === 'select') control = `<select id="${id}" name="${escapeHTML(f.name)}" ${f.required?'required':''}>${(f.options||[]).map(o=>`<option value="${escapeHTML(o.value)}" ${String(o.value)===String(val)?'selected':''}>${escapeHTML(o.label)}</option>`).join('')}</select>`;
      else if (f.type === 'checkbox') control = `<label style="display:flex;align-items:center;gap:8px"><input style="width:auto" id="${id}" name="${escapeHTML(f.name)}" type="checkbox" ${val?'checked':''}> ${escapeHTML(f.checkLabel || f.label)}</label>`;
      else control = `<input id="${id}" name="${escapeHTML(f.name)}" type="${escapeHTML(f.type||'text')}" value="${escapeHTML(val)}" ${f.required?'required':''} placeholder="${escapeHTML(f.placeholder||'')}" ${f.min!=null?`min="${f.min}"`:''} ${f.max!=null?`max="${f.max}"`:''}>`;
      return `<div class="field"><label for="${id}">${escapeHTML(f.label)}</label>${control}${f.hint?`<small class="hint">${escapeHTML(f.hint)}</small>`:''}</div>`;
    }).join('');
    const actions = $('#dialogActions'); actions.innerHTML = `<button type="button" class="secondary-button" data-close-dialog>انصراف</button>${extraActions.map(a=>`<button type="button" class="${a.className||'secondary-button'}" data-extra-action="${escapeHTML(a.id)}">${escapeHTML(a.label)}</button>`).join('')}<button type="submit" class="${danger?'secondary-button':'primary-button'}" id="dialogSubmit">${escapeHTML(submit)}</button>`;
    dialogSubmitHandler = onSubmit;
    $('#genericForm').onsubmit = async ev => { ev.preventDefault(); if (typeof dialogSubmitHandler !== 'function') return; const values = {}; fields.forEach(f => { const el = $(`[name="${CSS.escape(f.name)}"]`, body); values[f.name] = f.type === 'checkbox' ? el.checked : el.value.trim(); }); const btn = $('#dialogSubmit'); btn.disabled = true; try { const result = await dialogSubmitHandler(values); if (result !== false) dlg.close(); } catch (error) { console.error(error); toast(error.message || 'ذخیره انجام نشد.', 'error'); } finally { btn.disabled = false; } };
    dlg.showModal();
    return dlg;
  }
  function closeGeneric() { $('#genericDialog').close(); }
  function openProjectEditor() {
    const extraActions = [
      {id:'export-json',label:'ذخیره‌ی فایل متنی کامل پروژه'},
      {id:'import-json',label:'بازیابی از فایل متنی پروژه'},
      {id:'export-word-project',label:'خروجی کل رمان Word'},
      {id:'export-text-project',label:'خروجی کل رمان TXT'}
    ];
  
    openDialog({ title:'تنظیمات رمان', eyebrow:'پروژه‌ی فعال', submit:'ذخیره تنظیمات', fields:[
      {name:'projectTitle',label:'نام رمان',value:data.settings.projectTitle,required:true},
      {name:'genre',label:'ژانر',type:'select',value:data.settings.genre,options:[{value:'فانتزی',label:'فانتزی'},{value:'عاشقانه',label:'عاشقانه'},{value:'علمی‌تخیلی',label:'علمی‌تخیلی'},{value:'معمایی',label:'معمایی'},{value:'درام',label:'درام'},{value:'تاریخی',label:'تاریخی'},{value:'ترکیبی',label:'ترکیبی'},{value:'بدون ژانر',label:'بدون ژانر'}]},
      {name:'dailyGoal',label:'هدف نوشتن روزانه (کلمه)',type:'number',value:data.settings.dailyGoal,min:1,required:true},
      {name:'totalTarget',label:'هدف کل رمان (کلمه)',type:'number',value:data.settings.totalTarget,min:1000,required:true},
      {name:'editorFontSize',label:'اندازه‌ی پایه‌ی متن (پیکسل)',type:'select',value:String(data.settings.editorFontSize||15),options:[{value:'12',label:'۱۲ — جمع‌وجور'},{value:'14',label:'۱۴ — کوچک'},{value:'15',label:'۱۵ — معمولی'},{value:'16',label:'۱۶ — خواناتر'},{value:'18',label:'۱۸ — بزرگ'},{value:'20',label:'۲۰ — خیلی بزرگ'}]},
      {name:'editorLineHeight',label:'فاصله‌ی خطوط',type:'select',value:String(data.settings.editorLineHeight||2.2),options:[{value:'1.7',label:'فشرده'},{value:'1.9',label:'متعادل'},{value:'2.1',label:'باز'},{value:'2.2',label:'آرام'},{value:'2.5',label:'خیلی باز'},{value:'2.8',label:'بسیار باز'}]},
      {name:'editorFontFamily',label:'قلم پیش‌فرض ویرایشگر',type:'select',value:data.settings.editorFontFamily||'Tahoma',options:[{value:'Tahoma',label:'Tahoma'},{value:'Arial',label:'Arial'},{value:'Georgia',label:'Georgia'},{value:'Times New Roman',label:'Times New Roman'}]}
    ],extraActions,onSubmit:v=>{
      data.settings.projectTitle=v.projectTitle; data.settings.genre=v.genre;
      data.settings.dailyGoal=Number(v.dailyGoal)||500; data.settings.totalTarget=Number(v.totalTarget)||50000;
      data.settings.editorFontSize=Number(v.editorFontSize)||15; data.settings.editorLineHeight=Number(v.editorLineHeight)||2.2;
      data.settings.editorFontFamily=v.editorFontFamily||'Tahoma';
      scheduleSave(); renderAll(); toast('تنظیمات رمان ذخیره شد.','success');
    }});
  }
  function addChapter() {
    openDialog({title:'فصل تازه',eyebrow:'ساختار رمان',fields:[{name:'title',label:'عنوان فصل',value:`فصل ${formatCount(data.chapters.length+1)}`,required:true},{name:'status',label:'وضعیت',type:'select',value:'پیش‌نویس',options:[{value:'پیش‌نویس',label:'پیش‌نویس'},{value:'در حال نگارش',label:'در حال نگارش'},{value:'بازبینی',label:'نیازمند بازبینی'},{value:'تکمیل‌شده',label:'تکمیل‌شده'}]},{name:'tags',label:'برچسب‌ها (با ویرگول جدا کن)',value:'',placeholder:'مثلاً راز، تعقیب، فلش‌بک'}],onSubmit:v=>{const tags=registerTags(v.tags);const ch={id:makeId(),title:v.title,status:v.status,tags,content:'',updatedAt:nowISO()};data.chapters.push(ch);data.selectedChapterId=ch.id;scheduleSave();renderAll();switchView('write');toast('فصل تازه ساخته شد.','success');}});
  }
  function chapterMenu(id) {
    const ch = data.chapters.find(x=>x.id===id); if (!ch) return;
    dialogChapterId = id;
    openDialog({title:'گزینه‌های فصل',eyebrow:ch.title,fields:[{name:'title',label:'عنوان فصل',value:ch.title,required:true},{name:'status',label:'وضعیت فصل',type:'select',value:ch.status,options:[{value:'پیش‌نویس',label:'پیش‌نویس'},{value:'در حال نگارش',label:'در حال نگارش'},{value:'بازبینی',label:'نیازمند بازبینی'},{value:'تکمیل‌شده',label:'تکمیل‌شده'}]},{name:'tags',label:'برچسب‌ها (با ویرگول جدا کن)',value:(ch.tags||[]).join('، '),placeholder:'مثلاً راز، تعقیب، فلش‌بک'}],extraActions:[{id:'duplicate-chapter',label:'تکثیر فصل'},{id:'delete-chapter',label:'حذف فصل',className:'secondary-button'}],onSubmit:v=>{ch.title=v.title;ch.status=v.status;ch.tags=registerTags(v.tags);ch.updatedAt=nowISO();scheduleSave();renderAll();toast('اطلاعات فصل به‌روز شد.','success');}});
  }
  function addNote(note = null) {
    const editing = !!note;
    openDialog({title:editing?'ویرایش یادداشت':'یادداشت تازه',eyebrow:'دفتر یادداشت',submit:editing?'ذخیره تغییرات':'افزودن یادداشت',fields:[{name:'title',label:'عنوان',value:note?.title||'',required:true},{name:'category',label:'دسته‌بندی',type:'select',value:note?.category||'ایده‌ها',options:[{value:'ایده‌ها',label:'ایده‌ها'},{value:'شخصیت‌ها',label:'شخصیت‌ها'},{value:'جهان داستان',label:'جهان داستان'},{value:'فضاسازی',label:'فضاسازی'},{value:'پژوهش',label:'پژوهش'},{value:'عمومی',label:'عمومی'}]},{name:'body',label:'متن یادداشت',type:'textarea',value:note?.body||'',placeholder:'ایده‌ات را قبل از فراموش‌شدن ثبت کن…'},{name:'tags',label:'برچسب‌ها (با ویرگول جدا کن)',value:(note?.tags||[]).join('، '),placeholder:'مثلاً جادو، گذشته، رابطه‌ها'},{name:'pinned',label:'سنجاق‌کردن',type:'checkbox',checkLabel:'این یادداشت در میز نوشتن نمایش داده شود',value:note?.pinned??true}],onSubmit:v=>{const tags=registerTags(v.tags);if(editing){Object.assign(note,{...v,tags});}else data.notes.unshift({id:makeId(),...v,tags,createdAt:nowISO()});scheduleSave();renderAll();if(currentView==='notes')renderView('notes');toast(editing?'یادداشت به‌روز شد.':'یادداشت اضافه شد.','success');}});
  }
  function addEvent(ev = null) {
    const editing=!!ev;
    openDialog({title:editing?'ویرایش رویداد':'رویداد تازه',eyebrow:'خط زمانی داستان',fields:[{name:'title',label:'عنوان رویداد',value:ev?.title||'',required:true},{name:'when',label:'زمان یا جایگاه روایی',value:ev?.when||'',placeholder:'مثلاً روز سوم یا پیش از فصل دوم'},{name:'detail',label:'شرح رویداد',type:'textarea',value:ev?.detail||''}],onSubmit:v=>{if(editing)Object.assign(ev,v);else data.events.push({id:makeId(),...v});scheduleSave();renderAll();if(currentView==='timeline')renderView('timeline');toast('خط زمانی به‌روز شد.','success');}});
  }
  function addCharacter(ch = null) {
    const editing=!!ch;
    openDialog({title:editing?'ویرایش شخصیت':'شخصیت تازه',eyebrow:'دفتر شخصیت‌ها',fields:[{name:'name',label:'نام شخصیت',value:ch?.name||'',required:true},{name:'role',label:'نقش در داستان',value:ch?.role||'',placeholder:'قهرمان، همراه، ضدقهرمان…'},{name:'description',label:'ویژگی‌ها، انگیزه و رازها',type:'textarea',value:ch?.description||''}],onSubmit:v=>{if(editing)Object.assign(ch,v);else data.characters.push({id:makeId(),...v});scheduleSave();renderAll();if(currentView==='characters')renderView('characters');toast('اطلاعات شخصیت ذخیره شد.','success');}});
  }
  function addTag() {
    openDialog({title:'برچسب تازه',eyebrow:'دسته‌بندی',fields:[{name:'name',label:'نام برچسب',required:true},{name:'color',label:'رنگ',type:'select',value:'#8d70ed',options:[{value:'#8d70ed',label:'بنفش'},{value:'#dd74b7',label:'صورتی'},{value:'#6a8eeb',label:'آبی'},{value:'#2fa786',label:'سبز'},{value:'#e2a15e',label:'نارنجی'}]}],onSubmit:v=>{if(data.tags.some(t=>t.name.toLowerCase()===v.name.toLowerCase())){toast('این برچسب از قبل وجود دارد.','error');return false;}data.tags.push({id:makeId(),...v});scheduleSave();renderTags();if(currentView==='collections')renderView('collections');toast('برچسب اضافه شد.','success');}});
  }
  function registerTags(values) {
    splitTags(values).forEach(name => {
      if (!data.tags.some(tag => tag.name.toLocaleLowerCase('fa') === name.toLocaleLowerCase('fa'))) {
        data.tags.push({ id: makeId(), name, color: '#8d70ed' });
      }
    });
    return splitTags(values);
  }
  function confirmAction(title, message, action) {
    openDialog({title,eyebrow:'تأیید عملیات',fields:[],submit:'بله، انجام بده',danger:true,onSubmit:()=>{action();scheduleSave();renderAll();toast('انجام شد.','success');}});
    $('#dialogBody').innerHTML = `<p style="font-size:12px;line-height:2;color:var(--muted-dark)">${escapeHTML(message)}</p>`;
  }
  function downloadFile(name, content, type='text/plain;charset=utf-8') {
    const blob = new Blob([content], {type}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function exportProject() { if(selectedChapter()) selectedChapter().content=cleanHTML($('#editor').innerHTML); data.lastSavedAt=nowISO(); downloadFile('riwayat-project.txt', JSON.stringify(data,null,2), 'text/plain;charset=utf-8'); toast('فایل متنی کامل پروژه ذخیره شد. آن را در فضای ابری شخصی‌ات نگه دار.','success'); }
  function importProject() {
    const input=document.createElement('input');input.type='file';input.accept='.txt,.json,text/plain,application/json';
    input.onchange=()=>{const file=input.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const imported=normalizeData(JSON.parse(reader.result));confirmAction('جایگزینی فضای فعلی؟','با واردکردن پشتیبان، اطلاعات فعلی این دستگاه با فایل انتخاب‌شده جایگزین می‌شود. پیش از ادامه از اطلاعات فعلی خروجی بگیر.',()=>{data=imported;storeLocal();renderAll();});}catch(e){toast('فایل پشتیبان معتبر نیست.','error');}};reader.readAsText(file);};input.click();
  }
  function exportChapter() {
    const ch=selectedChapter();if(!ch)return;const text=`${ch.title}\n${'='.repeat(ch.title.length)}\n\n${stripHTML(ch.content)}\n`;
    downloadFile(`${ch.title.replace(/[\\/:*?"<>|]/g,'-')}.txt`,text);toast('خروجی متن فصل آماده شد.','success');
  }
  function wordDocument(title, sections, includeTitle = true) {
    const body = sections.map((section, i) => `<section${includeTitle || i ? ' style="page-break-before:always;"' : ''}><h1>${escapeHTML(section.title)}</h1>${cleanHTML(section.content || '<p></p>')}</section>`).join('\n');
    const cover = includeTitle ? `<h1 class="book-title">${escapeHTML(title)}</h1>` : '';
    return `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${escapeHTML(title)}</title><style>body{font-family:Tahoma,Arial,sans-serif;direction:rtl;text-align:justify;font-size:12pt;line-height:2}h1{font-size:19pt;text-align:center;margin:0 0 24pt}.book-title{font-size:25pt;margin-top:35vh}p{margin:0 0 12pt}blockquote{border-right:2pt solid #777;padding-right:12pt;margin-right:14pt}table{border-collapse:collapse;width:100%}td,th{border:1px solid #888;padding:6pt}</style></head><body dir="rtl">${cover}${body}</body></html>`;
  }
  function exportChapterWord() {
    const ch = selectedChapter(); if (!ch) return;
    downloadFile(`${ch.title.replace(/[\\/:*?"<>|]/g,'-')}.doc`, wordDocument(ch.title, [{title:ch.title,content:ch.content}], false), 'application/msword;charset=utf-8');
    toast('نسخه‌ی سازگار با Microsoft Word آماده شد.', 'success');
  }
  function exportProjectWord() {
    const sections = data.chapters.map(ch => ({title:ch.title, content:ch.content}));
    downloadFile(`${(data.settings.projectTitle||'رمان').replace(/[\\/:*?"<>|]/g,'-')}.doc`, wordDocument(data.settings.projectTitle||'رمان', sections), 'application/msword;charset=utf-8');
    toast('خروجی Word کل رمان آماده شد.', 'success');
  }
  function exportProjectText() {
    const text = `${data.settings.projectTitle || 'رمان'}\n${'='.repeat((data.settings.projectTitle || 'رمان').length)}\n\n` + data.chapters.map((ch,i)=>`${faNumber.format(i+1)}. ${ch.title}\n${'-'.repeat(ch.title.length+3)}\n\n${stripHTML(ch.content)}\n\n`).join('\n');
    downloadFile(`${(data.settings.projectTitle||'رمان').replace(/[\\/:*?"<>|]/g,'-')}.txt`, text);
    toast('خروجی متنی کل رمان آماده شد.', 'success');
  }
  function searchAll(query) {
    const q=query.trim().toLocaleLowerCase('fa');if(!q){$('#searchResults').innerHTML='<div class="empty-state">برای جست‌وجو، یک عبارت بنویس.</div>';return;}
    const results=[];
    data.chapters.forEach(ch=>{const text=stripHTML(ch.content);if((ch.title+' '+text+' '+(ch.tags||[]).join(' ')).toLocaleLowerCase('fa').includes(q))results.push({type:'فصل',title:ch.title,detail:text,id:ch.id,kind:'chapter'});});
    data.notes.forEach(n=>{if((n.title+' '+n.body+' '+n.category+' '+(n.tags||[]).join(' ')).toLocaleLowerCase('fa').includes(q))results.push({type:'یادداشت',title:n.title,detail:n.body,id:n.id,kind:'note'});});
    data.characters.forEach(c=>{if((c.name+' '+c.role+' '+c.description).toLocaleLowerCase('fa').includes(q))results.push({type:'شخصیت',title:c.name,detail:c.description,id:c.id,kind:'character'});});
    data.events.forEach(e=>{if((e.title+' '+e.when+' '+e.detail).toLocaleLowerCase('fa').includes(q))results.push({type:'رویداد',title:e.title,detail:e.detail,id:e.id,kind:'event'});});
    $('#searchResults').innerHTML=results.length?results.map(r=>`<button class="search-result" data-search-kind="${r.kind}" data-id="${escapeHTML(r.id)}"><b>${escapeHTML(r.title)} <span class="chapter-badge">${r.type}</span></b><small>${escapeHTML((r.detail||'').slice(0,180))}</small></button>`).join(''):'<div class="empty-state">نتیجه‌ای پیدا نشد. عبارت دیگری امتحان کن.</div>';
  }
  function openSearch() { $('#searchDialog').showModal();$('#searchDialogInput').value=$('#globalSearch').value||'';searchAll($('#searchDialogInput').value);setTimeout(()=>$('#searchDialogInput').focus(),40); }
  function openAuthDialog() {
    updateAuthDialogState();
    if (!cloudEnabled) {
      $('#cloudConfigNotice').classList.remove('hidden');
      $('#cloudConfigNotice').textContent='همگام‌سازی هنوز پیکربندی نشده است. فایل config.js را با آدرس پروژه و کلید عمومی Supabase پر کن و جدول و سیاست‌های SQL را طبق README بساز.';
      $('#authForm .auth-actions').classList.add('hidden');
      $('#authEmail').disabled=true;$('#authPassword').disabled=true;
    } else {
      $('#cloudConfigNotice').classList.add('hidden');$('#authForm .auth-actions').classList.remove('hidden');$('#authEmail').disabled=false;$('#authPassword').disabled=false;
      if (currentUser) {
        $('#cloudConfigNotice').classList.remove('hidden');$('#cloudConfigNotice').textContent=`متصل به ${currentUser.email || 'حساب کاربری'}؛ نوشته‌هایت با فضای ابری همگام می‌شوند.`;
        $('#signInButton').textContent='همگام‌سازی اکنون';$('#signUpButton').textContent='خروج از حساب';
      } else { $('#signInButton').textContent='ورود';$('#signUpButton').textContent='ساخت حساب'; }
    }
    if (currentUser) { $('#authEmail').removeAttribute('required'); $('#authPassword').removeAttribute('required'); }
    else { $('#authEmail').setAttribute('required',''); $('#authPassword').setAttribute('required',''); }
    $('#authDialog').showModal();
  }
  function updateAuthDialogState() { if (currentUser) { $('#signInButton').textContent='همگام‌سازی اکنون'; $('#signUpButton').textContent='خروج از حساب'; } }
  async function authSubmit(mode) {
    if (!cloudEnabled || !supabase) { toast('برای فعال‌شدن همگام‌سازی، ابتدا config.js و Supabase را تنظیم کن.','error');return; }
    const email=$('#authEmail').value.trim(), password=$('#authPassword').value;
    if (mode==='signout') { const {error}=await supabase.auth.signOut();if(error)throw error;$('#authDialog').close();return; }
    if (mode==='sync' && currentUser) { const {data: sessionData, error}=await supabase.auth.getSession(); if(error) throw error; await syncFromSession(sessionData.session); $('#authDialog').close(); return; }
    if (!email || password.length<6) { toast('ایمیل معتبر و رمز عبور حداقل ۶ نویسه‌ای وارد کن.','error');return; }
    const buttons=$$('.auth-actions button');buttons.forEach(b=>b.disabled=true);
    try {
      let result;
      if (mode==='signup') result=await supabase.auth.signUp({email,password});
      else result=await supabase.auth.signInWithPassword({email,password});
      if(result.error)throw result.error;
      if(mode==='signup'&&!result.data.session){toast('حساب ساخته شد. اگر تأیید ایمیل فعال است، صندوق ورودی‌ات را بررسی کن.','success');}
      else if(result.data.session){await syncFromSession(result.data.session);$('#authDialog').close();}
    } catch(e) { toast(e.message||'ورود انجام نشد.','error'); }
    finally {buttons.forEach(b=>b.disabled=false);}
  }

  // UI events
  $$('.nav-item').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));
  $$('[data-view]').filter(el=>!el.classList.contains('nav-item')).forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));
  $('#newChapterButton').addEventListener('click',addChapter);$('#rightNewChapter').addEventListener('click',addChapter);
  $('#addNoteButton').addEventListener('click',()=>addNote());$('#rightNewNote').addEventListener('click',()=>addNote());$('#rightNewEvent').addEventListener('click',()=>addEvent());$('#addTagButton').addEventListener('click',addTag);
  $('#editProjectButton').addEventListener('click',openProjectEditor);$('#editMainTitle').addEventListener('click',openProjectEditor);$('#settingsButton').addEventListener('click',openProjectEditor);
  $('#chapterSelect').addEventListener('change',e=>{data.selectedChapterId=e.target.value;scheduleSave();renderAll();});
  $('#chapterTitleInput').addEventListener('input',e=>{const ch=selectedChapter();ch.title=e.target.value;ch.updatedAt=nowISO();renderHeader();renderChapterSelect();renderRightRail();renderViewIfActive();scheduleSave();});
  function renderViewIfActive(){if(currentView!=='write')renderView(currentView);}
  $('#editor').addEventListener('input',()=>{const ch=selectedChapter();ch.content=cleanHTML($('#editor').innerHTML);ch.updatedAt=nowISO();editorDirty=true;$('#wordCount').textContent=formatCount(chapterWords(ch));$('#charCount').textContent=formatCount(stripHTML(ch.content).length);$('#chapterWordBadge').textContent=`${formatCount(chapterWords(ch))} کلمه`;$('#readingTime').textContent=`${formatCount(Math.max(1,Math.ceil(chapterWords(ch)/200)))} دقیقه`;renderRightRail();renderStats();scheduleSave();});
  $('#editor').addEventListener('blur',()=>{const ch=selectedChapter();if(ch){ch.content=cleanHTML($('#editor').innerHTML);scheduleSave();}});
  $$('.toolbar [data-command]').forEach(btn=>btn.addEventListener('click',()=>{ $('#editor').focus();document.execCommand(btn.dataset.command,false,null);refreshEditor();}));
  $('#blockFormat').addEventListener('change',e=>{ $('#editor').focus();document.execCommand('formatBlock',false,e.target.value);refreshEditor();});
  $('#fontSize').addEventListener('change',e=>{ $('#editor').focus();document.execCommand('fontSize',false,e.target.value);refreshEditor();});
  function refreshEditor(){const ch=selectedChapter();if(!ch)return;ch.content=cleanHTML($('#editor').innerHTML);$('#wordCount').textContent=formatCount(chapterWords(ch));$('#charCount').textContent=formatCount(stripHTML(ch.content).length);$('#chapterWordBadge').textContent=`${formatCount(chapterWords(ch))} کلمه`;$('#readingTime').textContent=`${formatCount(Math.max(1,Math.ceil(chapterWords(ch)/200)))} دقیقه`;scheduleSave();renderStats();renderRightRail();}
  $('#linkButton').addEventListener('click',()=>{const url=prompt('نشانی پیوند را وارد کن (https://…)');if(!url)return;if(!/^https?:\/\//i.test(url)){toast('نشانی باید با http:// یا https:// شروع شود.','error');return;}$('#editor').focus();document.execCommand('createLink',false,url);refreshEditor();});
  $('#tableButton').addEventListener('click',()=>{const rows=Math.min(8,Math.max(1,Number(prompt('تعداد ردیف‌ها؟','2'))||2));const cols=Math.min(6,Math.max(1,Number(prompt('تعداد ستون‌ها؟','2'))||2));let html='<table><tbody>';for(let r=0;r<rows;r++){html+='<tr>';for(let c=0;c<cols;c++)html+=r===0?'<th>عنوان</th>':'<td>…</td>';html+='</tr>';}html+='</tbody></table><p><br></p>';$('#editor').focus();document.execCommand('insertHTML',false,html);refreshEditor();});
  $('#highlightButton').addEventListener('click',()=>{ $('#editor').focus();document.execCommand('hiliteColor',false,'#fff0a8');refreshEditor();});
  const textColorInput = $('#textColorInput');
  if (textColorInput) textColorInput.addEventListener('input',()=>{ $('#editor').focus();document.execCommand('foreColor',false,textColorInput.value);refreshEditor();});
  const fontFamilySelect = $('#fontFamily');
  if (fontFamilySelect) fontFamilySelect.addEventListener('change',()=>{ $('#editor').focus();document.execCommand('fontName',false,fontFamilySelect.value);data.settings.editorFontFamily=fontFamilySelect.value;scheduleSave();refreshEditor();});
  $('#exportWordChapterButton')?.addEventListener('click',exportChapterWord);
  $('#clearFormatButton').addEventListener('click',()=>{ $('#editor').focus();document.execCommand('removeFormat',false,null);document.execCommand('formatBlock',false,'P');refreshEditor();});
  $('#chapterMenuButton').addEventListener('click',()=>chapterMenu(data.selectedChapterId));
  $('#exportChapterButton').addEventListener('click',exportChapter);
  $('#quickBackupButton').addEventListener('click',exportProject);
  $('#quickWordExportButton').addEventListener('click',exportProjectWord);
  $('#focusModeButton').addEventListener('click',()=>{document.body.classList.toggle('focus-mode');$('#focusModeButton').textContent=document.body.classList.contains('focus-mode')?'↙ خروج از تمرکز':'⛶ تمرکز';});
  $('#goalButton').addEventListener('click',()=>openDialog({title:'هدف نوشتن روزانه',eyebrow:'عادت نوشتن',fields:[{name:'dailyGoal',label:'هدف روزانه بر اساس کلمه',type:'number',min:1,value:data.settings.dailyGoal,required:true},{name:'totalTarget',label:'هدف کل رمان بر اساس کلمه',type:'number',min:1000,value:data.settings.totalTarget,required:true}],onSubmit:v=>{data.settings.dailyGoal=Number(v.dailyGoal)||500;data.settings.totalTarget=Number(v.totalTarget)||50000;updateDailyWords();scheduleSave();renderStats();toast('هدف‌های نوشتن به‌روز شدند.','success');}}));
  $('#syncButton').addEventListener('click',()=>{ const restore=window.confirm('برای دریافت اطلاعات از فایل متنی قبلی، «تأیید» را بزن. برای ذخیره‌ی همه‌ی اطلاعات در یک فایل متنی، «لغو» را بزن.'); if(restore) importProject(); else exportProject(); });
  $('#themeButton').addEventListener('click',()=>{applyTheme(document.body.classList.contains('dark')?'light':'dark');scheduleSave();});
  $('#globalSearch').addEventListener('focus',()=>{});$('#globalSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();openSearch();}});
  $('#searchDialogInput').addEventListener('input',e=>searchAll(e.target.value));
  $('#searchResults').addEventListener('click',e=>{const btn=e.target.closest('[data-search-kind]');if(!btn)return;const {searchKind,id}=btn.dataset;$('#searchDialog').close();if(searchKind==='chapter'){data.selectedChapterId=id;switchView('write');renderAll();}else if(searchKind==='note'){switchView('notes');const n=data.notes.find(x=>x.id===id);if(n)addNote(n);}else if(searchKind==='character'){switchView('characters');const c=data.characters.find(x=>x.id===id);if(c)addCharacter(c);}else if(searchKind==='event'){switchView('timeline');const item=data.events.find(x=>x.id===id);if(item)addEvent(item);}});
  $$('[data-close-dialog]').forEach(btn=>btn.addEventListener('click',()=>$('#genericDialog').close()));
  $$('[data-close-search]').forEach(btn=>btn.addEventListener('click',()=>$('#searchDialog').close()));
  $('#dialogActions').addEventListener('click',e=>{const btn=e.target.closest('[data-extra-action]');if(!btn)return;const action=btn.dataset.extraAction;if(action==='export-json')exportProject();else if(action==='import-json'){ $('#genericDialog').close(); importProject(); }else if(action==='export-word-project')exportProjectWord();else if(action==='export-text-project')exportProjectText();else if(action==='restore-pre-cloud'){const backup=localStorage.getItem('riwayat.recovery.pre-cloud.v1');if(!backup){toast('نسخه‌ی بازیابی پیدا نشد.','error');return;}$('#genericDialog').close();confirmAction('بازیابی نسخه‌ی محلی؟','اطلاعات فعلی با نسخه‌ی ذخیره‌شده پیش از همگام‌سازی جایگزین می‌شود. ابتدا از نسخه‌ی فعلی پشتیبان بگیر.',()=>{data=normalizeData(JSON.parse(backup));scheduleSave();renderAll();});}else if(action==='duplicate-chapter'){const formData=Object.fromEntries(new FormData($('#genericForm')).entries());const source=data.chapters.find(ch=>ch.id===dialogChapterId)||selectedChapter();const dup={id:makeId(),title:`${source.title} — نسخه‌ی دوم`,status:source.status,content:source.content,updatedAt:nowISO()};data.chapters.push(dup);data.selectedChapterId=dup.id;scheduleSave();renderAll();$('#genericDialog').close();toast('فصل تکثیر شد.','success');}else if(action==='delete-chapter'){const ch=data.chapters.find(x=>x.id===dialogChapterId)||selectedChapter();if(data.chapters.length===1){toast('رمان باید دست‌کم یک فصل داشته باشد.','error');return;}$('#genericDialog').close();confirmAction('حذف فصل؟',`فصل «${ch.title}» و متن آن حذف می‌شود. این کار برگشت‌پذیر نیست.`,()=>{data.chapters=data.chapters.filter(x=>x.id!==ch.id);if(data.selectedChapterId===ch.id)data.selectedChapterId=data.chapters[0].id;});}});

  document.addEventListener('click',e=>{
    const actionBtn=e.target.closest('[data-action]');if(actionBtn){const {action,id}=actionBtn.dataset;
      if(action==='select-chapter'||action==='open-chapter'){data.selectedChapterId=id;scheduleSave();switchView('write');renderAll();}
      else if(action==='chapter-menu')chapterMenu(id);
      else if(action==='chapter-up'||action==='chapter-down'){const i=data.chapters.findIndex(x=>x.id===id),j=i+(action==='chapter-up'?-1:1);if(i>=0&&j>=0&&j<data.chapters.length){[data.chapters[i],data.chapters[j]]=[data.chapters[j],data.chapters[i]];scheduleSave();renderAll();if(currentView==='chapters')renderView('chapters');}}
      else if(action==='new-chapter')addChapter();else if(action==='new-note')addNote();else if(action==='new-event')addEvent();else if(action==='new-character')addCharacter();else if(action==='new-tag')addTag();
      else if(action==='edit-note'){const n=data.notes.find(x=>x.id===id);if(n)addNote(n);}
      else if(action==='delete-note'){const n=data.notes.find(x=>x.id===id);if(n)confirmAction('حذف یادداشت؟',`یادداشت «${n.title}» حذف می‌شود.`,()=>{data.notes=data.notes.filter(x=>x.id!==id);});}
      else if(action==='toggle-pin-note'){const n=data.notes.find(x=>x.id===id);if(n){n.pinned=!n.pinned;scheduleSave();renderAll();if(currentView==='notes')renderView('notes');}}
      else if(action==='edit-event'){const item=data.events.find(x=>x.id===id);if(item)addEvent(item);}
      else if(action==='delete-event'){const item=data.events.find(x=>x.id===id);if(item)confirmAction('حذف رویداد؟',`رویداد «${item.title}» حذف می‌شود.`,()=>{data.events=data.events.filter(x=>x.id!==id);});}
      else if(action==='event-up'||action==='event-down'){const i=data.events.findIndex(x=>x.id===id),j=i+(action==='event-up'?-1:1);if(i>=0&&j>=0&&j<data.events.length){[data.events[i],data.events[j]]=[data.events[j],data.events[i]];scheduleSave();renderAll();if(currentView==='timeline')renderView('timeline');}}
      else if(action==='edit-character'){const c=data.characters.find(x=>x.id===id);if(c)addCharacter(c);}
      else if(action==='delete-character'){const c=data.characters.find(x=>x.id===id);if(c)confirmAction('حذف شخصیت؟',`اطلاعات شخصیت «${c.name}» حذف می‌شود.`,()=>{data.characters=data.characters.filter(x=>x.id!==id);});}
      else if(action==='delete-tag'){const t=data.tags.find(x=>x.id===id);if(t)confirmAction('حذف برچسب؟',`برچسب «${t.name}» از فهرست و موارد متصل حذف می‌شود.`,()=>{data.tags=data.tags.filter(x=>x.id!==id);data.chapters.forEach(ch=>ch.tags=(ch.tags||[]).filter(name=>name!==t.name));data.notes.forEach(n=>n.tags=(n.tags||[]).filter(name=>name!==t.name));});}
    }
  });
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch();}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(selectedChapter())selectedChapter().content=cleanHTML($('#editor').innerHTML);scheduleSave();toast('ذخیره انجام شد.','success');}
    if(e.key==='Escape'&&document.body.classList.contains('focus-mode')){document.body.classList.remove('focus-mode');$('#focusModeButton').textContent='⛶ تمرکز';}
  });
  $('#genericDialog').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close();});
  $('#searchDialog').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close();});
  window.addEventListener('storage', event => { if (event.key === STORAGE_KEY && !localDirty && document.activeElement !== $('#editor') && event.newValue) { try { data = normalizeData(JSON.parse(event.newValue)); renderAll(); } catch (_) {} } });
  window.addEventListener('beforeunload',()=>{if(selectedChapter())selectedChapter().content=cleanHTML($('#editor').innerHTML);try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}catch(_){}});

  // Restore visual preferences and run locally without any database or cloud account.
  if (data.settings.theme === 'dark' || localStorage.getItem(THEME_KEY)==='dark') { document.body.classList.add('dark'); data.settings.theme = 'dark'; }
  function applyTheme(theme) { const isDark = theme === 'dark'; document.body.classList.toggle('dark', isDark); data.settings.theme = isDark ? 'dark' : 'light'; localStorage.setItem(THEME_KEY, data.settings.theme); }
  updateDailyWords();
  renderAll(); updateSaveStatus('local');
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('./sw.js').catch(err => console.info('Offline cache registration skipped:', err));
})();
