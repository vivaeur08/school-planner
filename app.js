// ============================================================
// SCHOOLPLANNER - Application JavaScript
// Refreshed version with all features
// ============================================================

(function() {
    'use strict';

    // ==================== DATA STORE ====================
    const DEFAULT_SUBJECTS = [
        { id: 's1', name: 'VENTE & DEV. COMMER.', teacher: 'MARTIN N.', room: 'F 301 - 302 BTS Tert', color: '#f43f5e' },
        { id: 's2', name: 'ANGLAIS LVA', teacher: 'CATEAULT F.', room: 'F 301 - 302 BTS Tert', color: '#f97316' },
        { id: 's3', name: 'GESTION SINISTRES', teacher: 'DAVOUST S.', room: 'F 301 - 302 BTS Tert', color: '#8b5cf6' },
        { id: 's4', name: 'CULT.PROFES.APPLIQ', teacher: 'ETIENNE G.', room: 'F 301 - 302 BTS Tert', color: '#14b8a6' },
        { id: 's5', name: 'CULTURE GENE.ET EXPR', teacher: 'JOURDAN G.', room: 'F 301 - 302 BTS Tert', color: '#3b82f6' },
        { id: 's6', name: 'RELAT.CLIENT SINISTRE', teacher: 'YOUSFI I.', room: 'F 301 - 302 BTS Tert', color: '#ec4899' },
        { id: 's7', name: 'ACCOMPAGNEMT. PERSO.', teacher: 'JOURDAN G.', room: 'F 304 BTS Tert info', color: '#06b6d4' },
        { id: 's8', name: 'AT. PROFESSIONNALIS.', teacher: 'DAVOUST S., ETIENNE G.', room: 'F 101-102, F 104-107 info', color: '#6b7280' },
        { id: 's9', name: 'RESTI. VECU EN ENT.', teacher: '', room: 'G 102', color: '#6366f1' },
    ];

    const DEFAULT_SCHEDULE = {
        'lundi': [null, { subjectId: 's2' }, { subjectId: 's3' }, null, { subjectId: 's4' }, null, { subjectId: 's6' }, { subjectId: 's5' }, null],
        'mardi': [{ subjectId: 's1' }, { subjectId: 's2' }, null, null, null, null, { subjectId: 's3' }, null, null],
        'mercredi': [null, null, { subjectId: 's4' }, { subjectId: 's3' }, null, null, { subjectId: 's1' }, { subjectId: 's9' }, null],
        'jeudi': [null, null, null, null, { subjectId: 's5' }, null, null, { subjectId: 's6' }, null],
        'vendredi': [{ subjectId: 's1' }, null, { subjectId: 's4' }, { subjectId: 's7' }, null, null, { subjectId: 's8' }, null, { subjectId: 's8' }]
    };

    const TIME_SLOTS = ['8h00', '9h00', '10h00', '11h00', '12h00', '13h00', '14h00', '15h00', '16h00'];
    const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
    const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

    // ==================== STATE ====================
    let state = {
        subjects: [],
        homework: [],
        schedule: {},
        discord: {
            webhookUrl: '',
            alertTime: '19:00',
            alertAdvance: 1,
            enabled: false
        },
        theme: 'dark',
        currentView: 'dashboard',
        currentWeekOffset: 0
    };

    // Sync config (stored in localStorage, NOT in state)
    let syncConfig = {
        token: '',
        owner: 'vivaeur08',
        repo: 'school-planner',
        autoSync: true,
        lastSync: null,
        lastSyncDir: null, // 'push' or 'pull'
        sha: null,         // SHA of the remote file
        syncing: false
    };
    let _autoPushTimer = null;
    let _autoPullTimer = null;

    // ==================== INIT ====================
    async function init() {
        loadSyncConfig();
        await loadState();
        setupEventListeners();
        setupSyncListeners();
        renderCurrentView();
        updateDashboard();

        renderSyncIndicator();

        // Auto-pull on startup (fire-and-forget so splash always hides)
        if (syncConfig.token && syncConfig.autoSync) {
            syncPull(true); // not awaited
        }

        // Auto-sync check every 60s
        _autoPullTimer = setInterval(() => {
            if (syncConfig.token && syncConfig.autoSync && !syncConfig.syncing) {
                syncPull(true);
            }
        }, 60000);

        // Remove splash
        setTimeout(() => {
            document.getElementById('splash-screen').classList.add('hidden');
        }, 800);

        // Set today's date
        const today = new Date();
        document.getElementById('page-subtitle').textContent = today.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        document.getElementById('today-date').textContent = today.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

        updateWeekLabel();
    }

    // ==================== STORAGE ====================
    async function loadState() {
        // Try to fetch from JSON file (GitHub Pages remote source)
        let jsonData = null;
        try {
            const response = await fetch('data/homework.json?t=' + Date.now());
            if (response.ok) {
                jsonData = await response.json();
            }
        } catch (e) {
            console.warn('Could not load data/homework.json:', e);
        }

        // Check localStorage
        const saved = localStorage.getItem('schoolplanner_data');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                state = { ...state, ...parsed };
            } catch (e) {
                console.error('Error parsing localStorage:', e);
            }
        }

        // If no localStorage AND no JSON data, use hardcoded defaults
        if (!saved && !jsonData) {
            state.subjects = [...DEFAULT_SUBJECTS];
            state.schedule = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE));
            state.homework = [];
        } else if (jsonData && !saved) {
            // First load: seed from JSON file
            state.subjects = jsonData.subjects || [...DEFAULT_SUBJECTS];
            state.schedule = jsonData.schedule || JSON.parse(JSON.stringify(DEFAULT_SCHEDULE));
            state.homework = jsonData.homework || [];
            saveState();
        }

        // Apply theme
        document.body.setAttribute('data-theme', state.theme || 'dark');
    }

    async function syncFromJson() {
        try {
            showToast('Synchronisation en cours...', 'info');
            const response = await fetch('data/homework.json?t=' + Date.now());
            if (!response.ok) throw new Error('Fichier non trouvé');
            const jsonData = await response.json();

            const choice = confirm(
                'Synchroniser depuis data/homework.json ?\n\n' +
                'OK = Fusionner (ajouter les nouvelles données)\n' +
                'Annuler = Remplacer tout par le JSON'
            );

            if (choice) {
                const existingHwIds = new Set(state.homework.map(h => h.id));
                const existingSubjIds = new Set(state.subjects.map(s => s.id));

                (jsonData.homework || []).forEach(hw => {
                    if (!existingHwIds.has(hw.id)) state.homework.push(hw);
                });
                (jsonData.subjects || []).forEach(subj => {
                    if (!existingSubjIds.has(subj.id)) state.subjects.push(subj);
                });
                Object.keys(jsonData.schedule || {}).forEach(day => {
                    if (!state.schedule[day]) state.schedule[day] = jsonData.schedule[day];
                });

                showToast('Données fusionnées ! 🔄', 'success');
            } else {
                state.subjects = jsonData.subjects || [...DEFAULT_SUBJECTS];
                state.schedule = jsonData.schedule || JSON.parse(JSON.stringify(DEFAULT_SCHEDULE));
                state.homework = jsonData.homework || [];
                showToast('Données remplacées ! 📋', 'success');
            }

            saveState();
            renderCurrentView();
            updateDashboard();
        } catch (e) {
            showToast('Erreur sync : ' + e.message, 'error');
        }
    }

    function saveState() {
        try {
            state._lastModified = new Date().toISOString();
            localStorage.setItem('schoolplanner_data', JSON.stringify(state));
            // Trigger debounced auto-push
            scheduleAutoPush();
        } catch (e) {
            console.error('Error saving state:', e);
        }
    }

    // ==================== GITHUB SYNC ====================
    function loadSyncConfig() {
        try {
            const saved = localStorage.getItem('schoolplanner_sync');
            if (saved) {
                const parsed = JSON.parse(saved);
                syncConfig = { ...syncConfig, ...parsed };
            }
            // Safety reset: never start stuck in "syncing"
            syncConfig.syncing = false;
        } catch (e) {
            console.error('Error loading sync config:', e);
        }
    }

    function saveSyncConfig() {
        try {
            localStorage.setItem('schoolplanner_sync', JSON.stringify(syncConfig));
        } catch (e) {
            console.error('Error saving sync config:', e);
        }
    }

    function scheduleAutoPush() {
        if (!syncConfig.token || !syncConfig.autoSync) return;
        if (_autoPushTimer) clearTimeout(_autoPushTimer);
        _autoPushTimer = setTimeout(() => {
            _autoPushTimer = null;
            if (syncConfig.syncing) {
                // Still busy pulling/pushing; wait and retry instead of losing the change
                scheduleAutoPush();
                return;
            }
            syncPush(true); // silent = true
        }, 3000); // debounce 3 seconds
    }

    async function syncPush(silent = false) {
        if (!syncConfig.token) {
            if (!silent) showToast('Configure ton token GitHub d\'abord', 'error');
            return;
        }
        if (syncConfig.syncing) return;
        syncConfig.syncing = true;
        renderSyncIndicator();
        if (!silent) showToast('Envoi vers GitHub...', 'info');

        try {
            const githubData = {
                subjects: state.subjects,
                schedule: state.schedule,
                homework: state.homework,
                lastModified: new Date().toISOString()
            };

            const content = btoa(unescape(encodeURIComponent(JSON.stringify(githubData, null, 4))));

            const url = `https://api.github.com/repos/${syncConfig.owner}/${syncConfig.repo}/contents/data/homework.json`;

            // If we don't have the SHA yet, get it first
            if (!syncConfig.sha) {
                try {
                    const getResp = await fetch(url, {
                        headers: { 'Authorization': `Bearer ${syncConfig.token}` }
                    });
                    if (getResp.ok) {
                        const getJson = await getResp.json();
                        syncConfig.sha = getJson.sha;
                    }
                } catch (e) {
                    // File might not exist yet, that's fine for the first push
                }
            }

            const body = {
                message: `🔄 Sync SchoolPlanner ${new Date().toLocaleString('fr-FR')}`,
                content: content
            };
            if (syncConfig.sha) body.sha = syncConfig.sha;

            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${syncConfig.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                const result = await response.json();
                syncConfig.sha = result.content.sha;
                syncConfig.lastSync = new Date().toISOString();
                syncConfig.lastSyncDir = 'push';
                saveSyncConfig();
                renderSyncIndicator();
                if (!silent) showToast('Poussé sur GitHub ! ✅', 'success');
            } else {
                const err = await response.json();
                throw new Error(err.message || 'Erreur API GitHub');
            }
        } catch (e) {
            console.error('Sync push error:', e);
            if (!silent) showToast('Erreur push : ' + e.message, 'error');
            renderSyncIndicator('error');
        } finally {
            syncConfig.syncing = false;
            renderSyncIndicator();
        }
    }

    async function syncPull(silent = false) {
        if (!syncConfig.token) {
            if (!silent) showToast('Configure ton token GitHub d\'abord', 'error');
            return;
        }
        if (syncConfig.syncing) return;
        syncConfig.syncing = true;
        renderSyncIndicator();
        if (!silent) showToast('Récupération depuis GitHub...', 'info');

        try {
            const url = `https://api.github.com/repos/${syncConfig.owner}/${syncConfig.repo}/contents/data/homework.json`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${syncConfig.token}` }
            });

            if (response.status === 404) {
                // File doesn't exist yet — push local data
                if (!silent) showToast('Fichier distant inexistant, envoi local...', 'info');
                syncConfig.syncing = false;
                await syncPush(silent);
                return;
            }

            if (!response.ok) throw new Error('Erreur API GitHub');

            const json = await response.json();
            syncConfig.sha = json.sha;

            const decoded = JSON.parse(decodeURIComponent(escape(atob(json.content))));

            // Merge strategy: merge by ID, keep newer data
            const remoteHw = decoded.homework || [];
            const remoteSubj = decoded.subjects || [];
            const remoteSchedule = decoded.schedule || {};
            const remoteModified = decoded.lastModified ? new Date(decoded.lastModified) : new Date(0);

            // Check if remote is newer
            const localModified = state._lastModified ? new Date(state._lastModified) : new Date(0);

            // Always merge (don't skip if same time, to handle concurrent edits)
            // Homework: union by ID, remote wins for same ID
            const hwMap = new Map(state.homework.map(h => [h.id, h]));
            remoteHw.forEach(hw => {
                const existing = hwMap.get(hw.id);
                if (!existing) {
                    hwMap.set(hw.id, hw); // new from remote
                } else if (remoteModified >= localModified) {
                    hwMap.set(hw.id, hw); // remote is newer, overwrite
                }
                // else keep local (local is newer)
            });

            // Subjects: union by ID, remote wins for same ID
            const subjMap = new Map(state.subjects.map(s => [s.id, s]));
            remoteSubj.forEach(subj => {
                const existing = subjMap.get(subj.id);
                if (!existing) {
                    subjMap.set(subj.id, subj);
                } else if (remoteModified >= localModified) {
                    subjMap.set(subj.id, subj);
                }
            });

            // Schedule: merge per-day, remote wins for non-null cells if remote is newer
            const mergedSchedule = JSON.parse(JSON.stringify(state.schedule));
            Object.keys(remoteSchedule).forEach(day => {
                if (!mergedSchedule[day]) mergedSchedule[day] = remoteSchedule[day];
                else {
                    const remoteSlots = remoteSchedule[day];
                    for (let i = 0; i < remoteSlots.length; i++) {
                        if (remoteSlots[i] && remoteModified >= localModified) {
                            mergedSchedule[day][i] = remoteSlots[i];
                        }
                    }
                }
            });

            state.homework = [...hwMap.values()];
            state.subjects = [...subjMap.values()];
            state.schedule = mergedSchedule;
            state._lastModified = new Date().toISOString();

            syncConfig.lastSync = new Date().toISOString();
            syncConfig.lastSyncDir = 'pull';
            saveSyncConfig();
            saveState(); // save merged state (won't re-trigger push because of syncing flag)
            renderSyncIndicator();

            // Update UI
            renderCurrentView();
            updateDashboard();

            if (!silent) showToast('Données récupérées depuis GitHub ! 📥', 'success');
        } catch (e) {
            console.error('Sync pull error:', e);
            if (!silent) showToast('Erreur pull : ' + e.message, 'error');
            renderSyncIndicator('error');
        } finally {
            syncConfig.syncing = false;
            renderSyncIndicator();
        }
    }

    function renderSyncIndicator(status) {
        const el = document.getElementById('sync-indicator');
        if (!el) return;
        const iconEl = el.querySelector('i');
        const labelEl = el.querySelector('.sync-label');

        el.classList.remove('connected', 'syncing', 'error');

        if (status === 'error') {
            el.classList.add('error');
            iconEl.className = 'fas fa-exclamation-triangle';
            labelEl.textContent = 'Erreur';
            return;
        }

        if (syncConfig.syncing) {
            el.classList.add('syncing');
            iconEl.className = 'fas fa-sync-alt fa-spin';
            labelEl.textContent = 'Sync...';
            return;
        }

        if (syncConfig.token) {
            el.classList.add('connected');
            iconEl.className = 'fas fa-cloud';
            if (syncConfig.lastSync) {
                const ago = getTimeAgo(new Date(syncConfig.lastSync));
                labelEl.textContent = `Sync ${ago}`;
            } else {
                labelEl.textContent = 'Connecté';
            }
        } else {
            iconEl.className = 'fas fa-cloud';
            labelEl.textContent = 'Déconnecté';
        }
    }

    function getTimeAgo(date) {
        const diff = Date.now() - date.getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'à l\'instant';
        if (mins < 60) return `il y a ${mins}min`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `il y a ${hours}h`;
        return `il y a ${Math.floor(hours / 24)}j`;
    }

    function setupSyncListeners() {
        // Save sync config
        document.getElementById('btn-sync-save').addEventListener('click', () => {
            syncConfig.token = document.getElementById('sync-token').value.trim();
            syncConfig.owner = document.getElementById('sync-owner').value.trim();
            syncConfig.repo = document.getElementById('sync-repo').value.trim();
            syncConfig.autoSync = document.getElementById('sync-auto').checked;
            saveSyncConfig();
            renderSyncIndicator();
            showToast('Configuration sync sauvegardée ! 💾', 'success');

            // If just connected, do an initial sync
            if (syncConfig.token) {
                syncPull();
            }
        });

        // Sync now (pull then push)
        document.getElementById('btn-sync-now').addEventListener('click', async () => {
            await syncPull();
            await syncPush();
        });

        // Manual pull
        document.getElementById('btn-sync-pull').addEventListener('click', () => syncPull());

        // Manual push
        document.getElementById('btn-sync-push').addEventListener('click', () => syncPush());

        // Toggle sync panel (from indicator click)
        window.SchoolPlanner.toggleSyncPanel = function() {
            switchView('settings');
            // Focus the token input
            setTimeout(() => document.getElementById('sync-token').focus(), 300);
        };

        // Load saved values into inputs
        document.getElementById('sync-token').value = syncConfig.token || '';
        document.getElementById('sync-owner').value = syncConfig.owner || 'vivaeur08';
        document.getElementById('sync-repo').value = syncConfig.repo || 'school-planner';
        document.getElementById('sync-auto').checked = syncConfig.autoSync !== false;
    }

    // ==================== NAVIGATION ====================
    function setupEventListeners() {
        // Nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                switchView(item.dataset.view);
                document.getElementById('sidebar').classList.remove('open');
            });
        });

        // Menu toggle
        document.getElementById('menu-toggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });

        document.getElementById('sidebar-close').addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('open');
        });

        // Add homework button
        document.getElementById('btn-add-homework').addEventListener('click', () => openHomeworkModal());

        // Refresh
        document.getElementById('btn-refresh').addEventListener('click', () => {
            renderCurrentView();
            updateDashboard();
            showToast('Données rafraîchies !', 'success');
        });

        // Week navigation
        document.getElementById('prev-week').addEventListener('click', () => {
            state.currentWeekOffset--;
            renderWeekView();
        });
        document.getElementById('next-week').addEventListener('click', () => {
            state.currentWeekOffset++;
            renderWeekView();
        });
        document.getElementById('today-btn').addEventListener('click', () => {
            state.currentWeekOffset = 0;
            renderWeekView();
        });

        // Dashboard week nav
        document.getElementById('prev-week-dash').addEventListener('click', () => {
            state.currentWeekOffset--;
            renderWeekPreview();
            updateWeekLabel();
        });
        document.getElementById('next-week-dash').addEventListener('click', () => {
            state.currentWeekOffset++;
            renderWeekPreview();
            updateWeekLabel();
        });

        // Forms
        document.getElementById('homework-form').addEventListener('submit', handleHomeworkSubmit);
        document.getElementById('subject-form').addEventListener('submit', handleSubjectSubmit);
        document.getElementById('btn-add-subject').addEventListener('click', () => openSubjectModal());
        document.getElementById('schedule-edit-form').addEventListener('submit', handleScheduleEditSubmit);
        document.getElementById('btn-clear-slot').addEventListener('click', () => {
            document.getElementById('sched-subject').value = '';
            handleScheduleEditSubmit(new Event('submit'));
        });

        // Schedule controls
        document.getElementById('btn-edit-schedule').addEventListener('click', () => {
            showToast('Cliquez sur un créneau pour le modifier', 'info');
        });
        document.getElementById('btn-reset-schedule').addEventListener('click', () => {
            if (confirm('Réinitialiser l\'emploi du temps par défaut ?')) {
                state.schedule = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE));
                saveState();
                renderScheduleView();
                showToast('Emploi du temps réinitialisé', 'success');
            }
        });

        // Color picker
        document.querySelectorAll('.color-option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                document.getElementById('subj-color').value = btn.dataset.color;
            });
        });

        // Modal closers
        document.querySelectorAll('.modal-overlay, .modal-close, .modal-cancel').forEach(el => {
            el.addEventListener('click', closeAllModals);
        });

        // Homework filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderHomeworkList(btn.dataset.filter);
            });
        });

        // Homework search
        document.getElementById('homework-search').addEventListener('input', (e) => {
            const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
            renderHomeworkList(activeFilter, e.target.value);
        });

        // See all buttons
        document.querySelectorAll('.btn-see-all').forEach(btn => {
            btn.addEventListener('click', () => switchView(btn.dataset.target));
        });

        // Discord

        // Settings - themes
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.theme = btn.dataset.theme;
                document.body.setAttribute('data-theme', state.theme);
                saveState();
            });
            if (btn.dataset.theme === state.theme) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        // Data management
        document.getElementById('btn-export').addEventListener('click', exportData);
        document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-file').click());
        document.getElementById('import-file').addEventListener('change', importData);
        document.getElementById('btn-export-github').addEventListener('click', exportForGitHub);
        document.getElementById('btn-clear-data').addEventListener('click', () => {
            if (confirm('⚠️ Supprimer TOUTES les données ?')) {
                localStorage.removeItem('schoolplanner_data');
                location.reload();
            }
        });

        // Add hw from course detail
        document.getElementById('btn-add-hw-from-course').addEventListener('click', () => {
            const subjectName = document.getElementById('course-detail-name').textContent;
            const subject = state.subjects.find(s => s.name === subjectName);
            closeAllModals();
            if (subject) openHomeworkModal(null, subject.id);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeAllModals();
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                openHomeworkModal();
            }
        });

        // Close sidebar on outside click (mobile)
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const toggle = document.getElementById('menu-toggle');
            if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });
    }

    function switchView(viewName) {
        state.currentView = viewName;

        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });

        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        const targetView = document.getElementById(`view-${viewName}`);
        if (targetView) targetView.classList.add('active');

        const titles = {
            dashboard: 'Tableau de bord',
            week: 'Semainier',
            schedule: 'Emploi du temps',
            homework: 'Devoirs',
            subjects: 'Matières',
            discord: 'Alertes Discord',
            settings: 'Paramètres'
        };
        document.getElementById('page-title').textContent = titles[viewName] || '';

        renderCurrentView();
    }

    function renderCurrentView() {
        switch (state.currentView) {
            case 'dashboard': updateDashboard(); break;
            case 'week': renderWeekView(); break;
            case 'schedule': renderScheduleView(); break;
            case 'homework': renderHomeworkList(); break;
            case 'subjects': renderSubjectsView(); break;
        }
    }

    // ==================== DASHBOARD ====================
    function updateDashboard() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const pending = state.homework.filter(h => !h.done);
        const urgent = pending.filter(h => {
            const d = new Date(h.date);
            const diff = (d - today) / (1000 * 60 * 60 * 24);
            return diff <= 1 && diff >= 0;
        });
        const todayHw = pending.filter(h => new Date(h.date).toDateString() === today.toDateString());
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const thisWeek = pending.filter(h => {
            const d = new Date(h.date);
            return d >= today && d <= weekEnd;
        });
        const done = state.homework.filter(h => h.done);

        document.getElementById('stat-urgent').textContent = urgent.length;
        document.getElementById('stat-today').textContent = todayHw.length;
        document.getElementById('stat-week').textContent = thisWeek.length;
        document.getElementById('stat-done').textContent = done.length;

        renderTodaySchedule();
        renderUpcomingHomework();
        renderWeekPreview();
    }

    function renderTodaySchedule() {
        const container = document.getElementById('today-schedule');
        const today = new Date();
        const dayIndex = today.getDay() - 1;

        if (dayIndex < 0 || dayIndex > 4) {
            container.innerHTML = `
                <div class="empty-state" style="padding:1.5rem">
                    <i class="fas fa-couch"></i>
                    <p>Pas de cours aujourd'hui !</p>
                    <p style="font-size:0.78rem">Profite de ton week-end 😎</p>
                </div>`;
            return;
        }

        const dayKey = DAYS[dayIndex];
        const slots = state.schedule[dayKey] || [];
        let html = '';
        let hasCourses = false;

        slots.forEach((slot, i) => {
            if (slot && slot.subjectId) {
                const subject = state.subjects.find(s => s.id === slot.subjectId);
                if (subject) {
                    hasCourses = true;
                    const hwCount = state.homework.filter(h => !h.done && h.subjectId === subject.id).length;

                    html += `
                        <div class="today-course" onclick="window.SchoolPlanner.openCourseDetail('${subject.id}', '${TIME_SLOTS[i]}')">
                            <span class="course-time">${TIME_SLOTS[i]}</span>
                            <div class="course-color-bar" style="background:${subject.color}"></div>
                            <div class="course-info">
                                <div class="course-name">${subject.name}</div>
                                <div class="course-details">${subject.teacher} ${subject.room ? '• ' + subject.room : ''}</div>
                            </div>
                            ${hwCount > 0 ? `<span class="course-hw-badge">${hwCount}</span>` : ''}
                        </div>`;
                }
            }
        });

        if (!hasCourses) {
            html = `<div class="empty-state" style="padding:1.5rem"><i class="fas fa-calendar-check"></i><p>Pas de cours programmé</p></div>`;
        }

        container.innerHTML = html;
    }

    function renderUpcomingHomework() {
        const container = document.getElementById('upcoming-homework');
        const now = new Date();
        const pending = state.homework
            .filter(h => !h.done)
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(0, 5);

        if (pending.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding:1.5rem">
                    <i class="fas fa-check-double"></i>
                    <p>Aucun devoir en attente !</p>
                    <p style="font-size:0.78rem">Tout est à jour 🎉</p>
                </div>`;
            return;
        }

        let html = '';
        pending.forEach(hw => {
            const subject = state.subjects.find(s => s.id === hw.subjectId);
            const date = new Date(hw.date);
            const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
            let dateLabel = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
            let dateClass = '';

            if (diffDays < 0) { dateLabel = 'En retard !'; dateClass = 'color: var(--danger)'; }
            else if (diffDays === 0) { dateLabel = 'Aujourd\'hui'; dateClass = 'color: var(--warning)'; }
            else if (diffDays === 1) { dateLabel = 'Demain'; dateClass = 'color: var(--warning)'; }

            const priorityEmoji = hw.priority === 'high' ? '🔴' : hw.priority === 'medium' ? '🟡' : '🟢';

            html += `
                <div class="homework-item" onclick="window.SchoolPlanner.openHomeworkModal('${hw.id}')">
                    <div class="hw-checkbox ${hw.done ? 'checked' : ''}" onclick="event.stopPropagation(); window.SchoolPlanner.toggleHomework('${hw.id}')">
                        ${hw.done ? '<i class="fas fa-check"></i>' : ''}
                    </div>
                    <div class="hw-color-dot" style="background:${subject ? subject.color : '#666'}"></div>
                    <div class="hw-content">
                        <div class="hw-title">${hw.title}</div>
                        <div class="hw-meta">
                            <span class="hw-subject-tag" style="background:${subject ? subject.color + '1a' : '#6666661a'}; color:${subject ? subject.color : '#666'}">${subject ? subject.name : 'Inconnu'}</span>
                            <span class="hw-date" style="${dateClass}"><i class="fas fa-calendar-alt"></i> ${dateLabel}</span>
                            <span class="hw-priority">${priorityEmoji}</span>
                        </div>
                    </div>
                </div>`;
        });

        container.innerHTML = html;
    }

    function renderWeekPreview() {
        const container = document.getElementById('week-preview');
        const startOfWeek = getWeekStart(state.currentWeekOffset);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let html = '<div class="week-preview-grid">';
        for (let i = 0; i < 5; i++) {
            const date = new Date(startOfWeek);
            date.setDate(date.getDate() + i);
            const isToday = date.toDateString() === today.toDateString();
            const dayKey = DAYS[i];

            const courseCount = (state.schedule[dayKey] || []).filter(s => s && s.subjectId).length;
            const hwCount = state.homework.filter(h => {
                const d = new Date(h.date);
                return d.toDateString() === date.toDateString() && !h.done;
            }).length;

            html += `
                <div class="wp-day ${isToday ? 'today' : ''}">
                    <div class="wp-day-name">${DAY_LABELS[i].substring(0, 3)}</div>
                    <div class="wp-day-num">${date.getDate()}</div>
                    <div class="wp-day-count">${courseCount} cours${hwCount > 0 ? ` • ${hwCount} 📝` : ''}</div>
                </div>`;
        }
        html += '</div>';
        container.innerHTML = html;
    }

    function updateWeekLabel() {
        const startOfWeek = getWeekStart(state.currentWeekOffset);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 4);

        document.getElementById('week-label-dash').textContent = `${startOfWeek.getDate()}/${startOfWeek.getMonth() + 1} - ${endOfWeek.getDate()}/${endOfWeek.getMonth() + 1}`;
        document.getElementById('current-week-label').textContent = `Semaine ${getWeekNumber(startOfWeek)}`;
    }

    // ==================== WEEK VIEW ====================
    function renderWeekView() {
        const container = document.getElementById('week-grid');
        const startOfWeek = getWeekStart(state.currentWeekOffset);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 4);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        document.getElementById('week-title').textContent = `${startOfWeek.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} — ${endOfWeek.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;

        let html = '';
        for (let i = 0; i < 5; i++) {
            const date = new Date(startOfWeek);
            date.setDate(date.getDate() + i);
            const isToday = date.toDateString() === today.toDateString();
            const dayKey = DAYS[i];
            const slots = state.schedule[dayKey] || [];

            html += `<div class="week-day ${isToday ? 'today' : ''}">`;
            html += `<div class="week-day-header">${DAY_LABELS[i]}<span class="week-day-date">${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span></div>`;
            html += `<div class="week-day-body">`;

            slots.forEach((slot, si) => {
                if (slot && slot.subjectId) {
                    const subject = state.subjects.find(s => s.id === slot.subjectId);
                    if (subject) {
                        const hasHw = state.homework.some(h => !h.done && h.subjectId === subject.id);
                        html += `
                            <div class="week-course-item"
                                 style="background:${subject.color}18; border-color:${subject.color}; color:${subject.color}"
                                 onclick="window.SchoolPlanner.openCourseDetail('${subject.id}', '${TIME_SLOTS[si]}')">
                                <div class="wc-time">${TIME_SLOTS[si]}</div>
                                <div class="wc-name">${subject.name}</div>
                                <div class="wc-room">${subject.room}</div>
                                ${hasHw ? '<div class="week-hw-indicator"></div>' : ''}
                            </div>`;
                    }
                }
            });

            // Homework due this day
            const dayHw = state.homework.filter(h => {
                const d = new Date(h.date);
                return d.toDateString() === date.toDateString() && !h.done;
            });

            dayHw.forEach(hw => {
                const subject = state.subjects.find(s => s.id === hw.subjectId);
                html += `
                    <div class="week-hw-item" onclick="window.SchoolPlanner.openHomeworkModal('${hw.id}')">
                        <div class="whw-title">📝 ${hw.title}</div>
                        <div class="whw-subject">${subject ? subject.name : ''}</div>
                    </div>`;
            });

            html += `</div></div>`;
        }

        container.innerHTML = html;
        updateWeekLabel();
    }

    // ==================== SCHEDULE VIEW ====================
    function renderScheduleView() {
        const table = document.getElementById('schedule-table');
        let html = '<thead><tr><th>Heure</th>';
        DAY_LABELS.forEach(day => { html += `<th>${day}</th>`; });
        html += '</tr></thead><tbody>';

        TIME_SLOTS.forEach((time, timeIdx) => {
            html += `<tr><td>${time}</td>`;
            DAYS.forEach((day, dayIdx) => {
                const slots = state.schedule[day] || [];
                const slot = slots[timeIdx];
                const subject = slot ? state.subjects.find(s => s.id === slot.subjectId) : null;

                if (subject) {
                    html += `<td>
                        <div class="schedule-cell draggable-course"
                             draggable="true"
                             data-day="${day}" data-slot="${timeIdx}"
                             style="background:${subject.color}25; color:${subject.color}; border: 1px solid ${subject.color}35"
                             onclick="window.SchoolPlanner.openCourseDetail('${subject.id}', '${time}')"
                             ondragstart="window.SchoolPlanner.dragStart(event)"
                             ondragend="window.SchoolPlanner.dragEnd(event)">
                            <div class="sc-name">${subject.name}</div>
                            <div class="sc-teacher">${subject.teacher}</div>
                            <div class="sc-room">${subject.room}</div>
                        </div>
                    </td>`;
                } else {
                    html += `<td>
                        <div class="schedule-cell empty"
                             data-day="${day}" data-slot="${timeIdx}"
                             onclick="window.SchoolPlanner.openScheduleEdit('${day}', ${timeIdx})"
                             ondragover="window.SchoolPlanner.dragOver(event)"
                             ondragleave="window.SchoolPlanner.dragLeave(event)"
                             ondrop="window.SchoolPlanner.drop(event)">
                            <i class="fas fa-plus" style="opacity:0.25"></i>
                        </div>
                    </td>`;
                }
            });
            html += '</tr>';
        });

        html += '</tbody>';
        table.innerHTML = html;

        // Allow drop on filled cells (swap)
        document.querySelectorAll('.schedule-cell:not(.empty)').forEach(cell => {
            cell.addEventListener('dragover', (e) => {
                e.preventDefault();
                cell.classList.add('drag-over');
            });
            cell.addEventListener('dragleave', () => {
                cell.classList.remove('drag-over');
            });
            cell.addEventListener('drop', (e) => {
                e.preventDefault();
                cell.classList.remove('drag-over');
                const fromDay = e.dataTransfer.getData('day');
                const fromSlot = parseInt(e.dataTransfer.getData('slot'));
                const toDay = cell.dataset.day;
                const toSlot = parseInt(cell.dataset.slot);

                if (fromDay && !isNaN(fromSlot)) {
                    const temp = state.schedule[toDay][toSlot];
                    state.schedule[toDay][toSlot] = state.schedule[fromDay][fromSlot];
                    state.schedule[fromDay][fromSlot] = temp;
                    saveState();
                    renderScheduleView();
                    showToast('Cours déplacé ! 🔄', 'success');
                }
            });
        });
    }

    // Drag & Drop handlers
    window.SchoolPlanner = window.SchoolPlanner || {};

    window.SchoolPlanner.dragStart = function(e) {
        const cell = e.target.closest('.schedule-cell');
        e.dataTransfer.setData('day', cell.dataset.day);
        e.dataTransfer.setData('slot', cell.dataset.slot);
        cell.classList.add('dragging');
    };

    window.SchoolPlanner.dragEnd = function(e) {
        e.target.closest('.schedule-cell').classList.remove('dragging');
    };

    window.SchoolPlanner.dragOver = function(e) {
        e.preventDefault();
        e.target.closest('.schedule-cell').classList.add('drag-over');
    };

    window.SchoolPlanner.dragLeave = function(e) {
        e.target.closest('.schedule-cell').classList.remove('drag-over');
    };

    window.SchoolPlanner.drop = function(e) {
        e.preventDefault();
        const cell = e.target.closest('.schedule-cell');
        cell.classList.remove('drag-over');

        const fromDay = e.dataTransfer.getData('day');
        const fromSlot = parseInt(e.dataTransfer.getData('slot'));
        const toDay = cell.dataset.day;
        const toSlot = parseInt(cell.dataset.slot);

        if (fromDay && !isNaN(fromSlot)) {
            if (!state.schedule[toDay]) state.schedule[toDay] = [];
            while (state.schedule[toDay].length <= toSlot) state.schedule[toDay].push(null);

            state.schedule[toDay][toSlot] = state.schedule[fromDay][fromSlot];
            state.schedule[fromDay][fromSlot] = null;
            saveState();
            renderScheduleView();
            showToast('Cours déplacé ! 🔄', 'success');
        }
    };

    // ==================== HOMEWORK ====================
    function renderHomeworkList(filter = 'all', search = '') {
        const container = document.getElementById('homework-list');
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        let filtered = [...state.homework];

        if (filter === 'pending') filtered = filtered.filter(h => !h.done);
        else if (filter === 'done') filtered = filtered.filter(h => h.done);
        else if (filter === 'overdue') filtered = filtered.filter(h => !h.done && new Date(h.date) < now);

        if (search) {
            const s = search.toLowerCase();
            filtered = filtered.filter(h => {
                const subject = state.subjects.find(sub => sub.id === h.subjectId);
                return h.title.toLowerCase().includes(s) ||
                    (h.description || '').toLowerCase().includes(s) ||
                    (subject && subject.name.toLowerCase().includes(s));
            });
        }

        filtered.sort((a, b) => {
            if (a.done !== b.done) return a.done ? 1 : -1;
            return new Date(a.date) - new Date(b.date);
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>${filter === 'all' ? 'Aucun devoir' : 'Aucun devoir dans cette catégorie'}</p>
                    <p style="font-size:0.78rem">Clique sur + pour en ajouter un</p>
                </div>`;
            return;
        }

        let html = '';
        filtered.forEach(hw => {
            const subject = state.subjects.find(s => s.id === hw.subjectId);
            const date = new Date(hw.date);
            const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
            let dateLabel = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
            let isOverdue = false;

            if (!hw.done) {
                if (diffDays < 0) { dateLabel = `En retard (${Math.abs(diffDays)}j)`; isOverdue = true; }
                else if (diffDays === 0) dateLabel = 'Aujourd\'hui';
                else if (diffDays === 1) dateLabel = 'Demain';
            }

            const priorityEmoji = hw.priority === 'high' ? '🔴' : hw.priority === 'medium' ? '🟡' : '🟢';
            const typeEmoji = { homework: '📝', exam: '📋', project: '🎯', reading: '📖', other: '📌' }[hw.type] || '📝';

            html += `
                <div class="homework-item ${hw.done ? 'done' : ''} ${isOverdue ? 'overdue' : ''}">
                    <div class="hw-checkbox ${hw.done ? 'checked' : ''}" onclick="window.SchoolPlanner.toggleHomework('${hw.id}')">
                        ${hw.done ? '<i class="fas fa-check"></i>' : ''}
                    </div>
                    <div class="hw-color-dot" style="background:${subject ? subject.color : '#666'}"></div>
                    <div class="hw-content" onclick="window.SchoolPlanner.openHomeworkModal('${hw.id}')">
                        <div class="hw-title">${typeEmoji} ${hw.title}</div>
                        <div class="hw-meta">
                            <span class="hw-subject-tag" style="background:${subject ? subject.color + '1a' : '#6666661a'}; color:${subject ? subject.color : '#666'}">${subject ? subject.name : 'Inconnu'}</span>
                            <span class="hw-date" style="${isOverdue ? 'color:var(--danger)' : ''}"><i class="fas fa-calendar-alt"></i> ${dateLabel}</span>
                            <span class="hw-priority">${priorityEmoji}</span>
                        </div>
                        ${hw.description ? `<div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.25rem">${hw.description.substring(0, 60)}${hw.description.length > 60 ? '...' : ''}</div>` : ''}
                    </div>
                    <div class="hw-actions">
                        <button onclick="event.stopPropagation(); window.SchoolPlanner.openHomeworkModal('${hw.id}')" title="Modifier">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-delete" onclick="event.stopPropagation(); window.SchoolPlanner.deleteHomework('${hw.id}')" title="Supprimer">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>`;
        });

        container.innerHTML = html;
    }

    function openHomeworkModal(hwId = null, preselectedSubject = null) {
        const modal = document.getElementById('modal-homework');
        const title = document.getElementById('modal-homework-title');
        const form = document.getElementById('homework-form');
        const subjectSelect = document.getElementById('hw-subject');

        subjectSelect.innerHTML = '<option value="">-- Choisir --</option>';
        state.subjects.forEach(s => {
            subjectSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });

        if (hwId) {
            const hw = state.homework.find(h => h.id === hwId);
            if (!hw) return;
            title.innerHTML = '<i class="fas fa-edit"></i> Modifier le devoir';
            document.getElementById('hw-id').value = hw.id;
            document.getElementById('hw-subject').value = hw.subjectId;
            document.getElementById('hw-title').value = hw.title;
            document.getElementById('hw-description').value = hw.description || '';
            document.getElementById('hw-date').value = hw.date;
            document.getElementById('hw-priority').value = hw.priority;
            document.getElementById('hw-type').value = hw.type || 'homework';
        } else {
            title.innerHTML = '<i class="fas fa-plus-circle"></i> Nouveau Devoir';
            form.reset();
            document.getElementById('hw-id').value = '';
            if (preselectedSubject) {
                document.getElementById('hw-subject').value = preselectedSubject;
            }
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            document.getElementById('hw-date').value = tomorrow.toISOString().split('T')[0];
        }

        modal.classList.add('active');
    }
    window.SchoolPlanner.openHomeworkModal = openHomeworkModal;

    function handleHomeworkSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('hw-id').value;
        const hw = {
            id: id || 'hw_' + Date.now(),
            subjectId: document.getElementById('hw-subject').value,
            title: document.getElementById('hw-title').value,
            description: document.getElementById('hw-description').value,
            date: document.getElementById('hw-date').value,
            priority: document.getElementById('hw-priority').value,
            type: document.getElementById('hw-type').value,
            done: false
        };

        if (id) {
            const idx = state.homework.findIndex(h => h.id === id);
            if (idx >= 0) {
                hw.done = state.homework[idx].done;
                state.homework[idx] = hw;
            }
            showToast('Devoir modifié ✏️', 'success');
        } else {
            state.homework.push(hw);
            showToast('Devoir ajouté ! 📝', 'success');
        }

        saveState();
        closeAllModals();
        renderCurrentView();
        updateDashboard();
    }

    window.SchoolPlanner.toggleHomework = function(id) {
        const hw = state.homework.find(h => h.id === id);
        if (hw) {
            hw.done = !hw.done;
            saveState();
            renderCurrentView();
            updateDashboard();
            showToast(hw.done ? 'Devoir terminé ! ✅' : 'Devoir remis en attente', hw.done ? 'success' : 'info');
        }
    };

    window.SchoolPlanner.deleteHomework = function(id) {
        if (confirm('Supprimer ce devoir ?')) {
            state.homework = state.homework.filter(h => h.id !== id);
            saveState();
            renderCurrentView();
            updateDashboard();
            showToast('Devoir supprimé 🗑️', 'warning');
        }
    };

    // ==================== SUBJECTS ====================
    function renderSubjectsView() {
        const container = document.getElementById('subjects-grid');
        if (state.subjects.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-palette"></i>
                    <p>Aucune matière</p>
                    <p style="font-size:0.78rem">Ajoute tes matières pour commencer</p>
                </div>`;
            return;
        }

        let html = '';
        state.subjects.forEach(s => {
            const hwCount = state.homework.filter(h => h.subjectId === s.id && !h.done).length;
            const totalHw = state.homework.filter(h => h.subjectId === s.id).length;

            html += `
                <div class="subject-card">
                    <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${s.color}"></div>
                    <div class="subject-card-header">
                        <div class="subject-name">
                            <div class="subject-color-dot" style="background:${s.color}"></div>
                            ${s.name}
                        </div>
                        <div class="subject-card-actions">
                            <button onclick="window.SchoolPlanner.openSubjectModal('${s.id}')" title="Modifier"><i class="fas fa-edit"></i></button>
                            <button onclick="window.SchoolPlanner.deleteSubject('${s.id}')" title="Supprimer"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                    <div class="subject-meta">
                        ${s.teacher ? `<p><i class="fas fa-user"></i> ${s.teacher}</p>` : ''}
                        ${s.room ? `<p><i class="fas fa-door-open"></i> ${s.room}</p>` : ''}
                    </div>
                    <div class="subject-stats">
                        <span class="subject-stat"><strong>${hwCount}</strong> à faire</span>
                        <span class="subject-stat"><strong>${totalHw}</strong> total</span>
                    </div>
                </div>`;
        });

        container.innerHTML = html;
    }

    function openSubjectModal(subjectId = null) {
        const modal = document.getElementById('modal-subject');
        const title = document.getElementById('modal-subject-title');

        document.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));

        if (subjectId) {
            const s = state.subjects.find(sub => sub.id === subjectId);
            if (!s) return;
            title.innerHTML = '<i class="fas fa-edit"></i> Modifier la matière';
            document.getElementById('subj-id').value = s.id;
            document.getElementById('subj-name').value = s.name;
            document.getElementById('subj-teacher').value = s.teacher || '';
            document.getElementById('subj-room').value = s.room || '';
            document.getElementById('subj-color').value = s.color;
            const colorBtn = document.querySelector(`.color-option[data-color="${s.color}"]`);
            if (colorBtn) colorBtn.classList.add('selected');
        } else {
            title.innerHTML = '<i class="fas fa-plus-circle"></i> Nouvelle Matière';
            document.getElementById('subject-form').reset();
            document.getElementById('subj-id').value = '';
            document.getElementById('subj-color').value = '#3b82f6';
            document.querySelector('.color-option[data-color="#3b82f6"]').classList.add('selected');
        }

        modal.classList.add('active');
    }
    window.SchoolPlanner.openSubjectModal = openSubjectModal;

    function handleSubjectSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('subj-id').value;
        const subject = {
            id: id || 's_' + Date.now(),
            name: document.getElementById('subj-name').value,
            teacher: document.getElementById('subj-teacher').value,
            room: document.getElementById('subj-room').value,
            color: document.getElementById('subj-color').value
        };

        if (id) {
            const idx = state.subjects.findIndex(s => s.id === id);
            if (idx >= 0) state.subjects[idx] = subject;
            showToast('Matière modifiée ✏️', 'success');
        } else {
            state.subjects.push(subject);
            showToast('Matière ajoutée ! 🎨', 'success');
        }

        saveState();
        closeAllModals();
        renderSubjectsView();
    }

    window.SchoolPlanner.deleteSubject = function(id) {
        if (confirm('Supprimer cette matière ? Les devoirs associés ne seront pas supprimés.')) {
            state.subjects = state.subjects.filter(s => s.id !== id);
            saveState();
            renderSubjectsView();
            showToast('Matière supprimée', 'warning');
        }
    };

    // ==================== COURSE DETAIL ====================
    function openCourseDetail(subjectId, time) {
        const subject = state.subjects.find(s => s.id === subjectId);
        if (!subject) return;

        const modal = document.getElementById('modal-course-detail');
        document.getElementById('course-detail-name').textContent = subject.name;
        document.getElementById('course-detail-header').style.borderBottom = `3px solid ${subject.color}`;
        document.getElementById('course-detail-teacher').textContent = subject.teacher || 'Non renseigné';
        document.getElementById('course-detail-room').textContent = subject.room || 'Non renseignée';
        document.getElementById('course-detail-time').textContent = time || '';

        const hwList = document.getElementById('course-homework-list');
        const homework = state.homework.filter(h => h.subjectId === subjectId).sort((a, b) => new Date(a.date) - new Date(b.date));

        if (homework.length === 0) {
            hwList.innerHTML = `<div class="empty-state" style="padding:0.85rem"><p>Aucun devoir pour ce cours</p></div>`;
        } else {
            let html = '';
            homework.forEach(hw => {
                const date = new Date(hw.date);
                const dateLabel = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                const priorityEmoji = hw.priority === 'high' ? '🔴' : hw.priority === 'medium' ? '🟡' : '🟢';

                html += `
                    <div class="homework-item ${hw.done ? 'done' : ''}" style="margin-bottom:0.4rem">
                        <div class="hw-checkbox ${hw.done ? 'checked' : ''}" onclick="window.SchoolPlanner.toggleHomework('${hw.id}'); window.SchoolPlanner.openCourseDetail('${subjectId}', '${time}')">
                            ${hw.done ? '<i class="fas fa-check"></i>' : ''}
                        </div>
                        <div class="hw-content">
                            <div class="hw-title">${hw.title}</div>
                            <div class="hw-meta">
                                <span class="hw-date"><i class="fas fa-calendar-alt"></i> ${dateLabel}</span>
                                <span>${priorityEmoji}</span>
                            </div>
                        </div>
                    </div>`;
            });
            hwList.innerHTML = html;
        }

        modal.classList.add('active');
    }
    window.SchoolPlanner.openCourseDetail = openCourseDetail;

    // ==================== SCHEDULE EDIT ====================
    function openScheduleEdit(day, slot) {
        const modal = document.getElementById('modal-schedule-edit');
        document.getElementById('sched-day').value = day;
        document.getElementById('sched-slot').value = slot;

        const select = document.getElementById('sched-subject');
        select.innerHTML = '<option value="">-- Vide --</option>';
        state.subjects.forEach(s => {
            select.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });

        const currentSlot = state.schedule[day] ? state.schedule[day][slot] : null;
        if (currentSlot) select.value = currentSlot.subjectId || '';

        modal.classList.add('active');
    }
    window.SchoolPlanner.openScheduleEdit = openScheduleEdit;

    function handleScheduleEditSubmit(e) {
        e.preventDefault();
        const day = document.getElementById('sched-day').value;
        const slot = parseInt(document.getElementById('sched-slot').value);
        const subjectId = document.getElementById('sched-subject').value;

        if (!state.schedule[day]) state.schedule[day] = [];
        while (state.schedule[day].length <= slot) state.schedule[day].push(null);

        state.schedule[day][slot] = subjectId ? { subjectId } : null;

        saveState();
        closeAllModals();
        renderScheduleView();
        showToast('Emploi du temps modifié', 'success');
    }

    // ==================== SETTINGS ====================
    function exportData() {
        const data = JSON.stringify(state, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `schoolplanner_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Données exportées ! 📥', 'success');
    }

    function exportForGitHub() {
        const githubData = {
            subjects: state.subjects,
            schedule: state.schedule,
            homework: state.homework
        };
        const data = JSON.stringify(githubData, null, 4);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'homework.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Fichier homework.json prêt pour GitHub ! 🐙', 'success');
    }

    function importData(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                state = { ...state, ...data };
                saveState();
                renderCurrentView();
                updateDashboard();
                showToast('Données importées ! 📤', 'success');
            } catch (err) {
                showToast('Erreur de fichier', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    // ==================== UTILITIES ====================
    function getWeekStart(offset = 0) {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1) + (offset * 7);
        const monday = new Date(today.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday;
    }

    function getWeekNumber(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
        const week1 = new Date(d.getFullYear(), 0, 4);
        return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    }

    function closeAllModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="${icons[type]} toast-icon"></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;

        container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(40px)';
                setTimeout(() => toast.remove(), 300);
            }
        }, 3500);
    }



    // ==================== COMPTE CLASSE + SIGNATURES ====================
    // Chaque appareil garde SON membre local (nom ≈ insensible casse, mdp EXACT haché).
    let classAccount = null; // {name, nameKey}

    async function hashPassword(password, salt) {
        const data = (salt || '') + ':' + String(password || '');
        // Web Crypto natif (fiable, dispo en HTTPS = ton site réservé)
        if (window.crypto && crypto.subtle) {
            try {
                const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
                return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (e) { /* fallback ci-dessous */ }
        }
        // Fallback FNV-1a 32 bits (simple, déterministe, sans aucun code rotationnel)
        let h = 0x811c9dc5;
        for (let i = 0; i < data.length; i++) {
            h ^= data.charCodeAt(i);
            h = Math.imul(h, 0x01000193) >>> 0;
        }
        return h.toString(16) + '_len' + data.length;
    }

    function nameKeyFrom(name) {
        return nameKey(name);
    }

    function nameKey(name) {
        return String(name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'').trim();
    }

    function loadClassAccount() {
        try { const s = localStorage.getItem('schoolplanner_account');
            if (s) classAccount = JSON.parse(s); } catch(e) {}
    }
    function saveClassAccount() {
        try { localStorage.setItem('schoolplanner_account', JSON.stringify(classAccount||null)); } catch(e) {}
    }

    // --- membres de la classe (partagés dans le JSON) ---
    function getMembers() {
        if (!Array.isArray(state.members)) state.members = [];
        return state.members;
    }
    function findMemberByName(approxName) {
        const key = nameKey(approxName);
        if (!key) return null;
        return getMembers().find(m => m && m.nameKey === key) || null;
    }
    function ensureMembersSection(onGithub) {
        // stocke aussi les members dans les données poussées
    }

    // ==================== CROCHETS SIGNATURES ====================
    function currentAuthor() { return classAccount ? classAccount.name : 'Anonyme'; }
    function signHomeworkFields(hw) {
        hw.author = currentAuthor();
        hw.authorKey = classAccount ? classAccount.nameKey : 'anon';
        hw._lastModified = new Date().toISOString();
        return hw;
    }

        // ==================== START ====================
    document.addEventListener('DOMContentLoaded', init);
})();
