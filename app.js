// App State
let appState = {
    user: null,
    currentView: 'welcome',
    currentTab: 'job',
    theme: localStorage.getItem('theme') || 'dark',
    savedItems: [],
    allData: []
};

// DOM Elements
const views = {
    welcome: document.getElementById('view-welcome'),
    auth: document.getElementById('view-auth'),
    dashboard: document.getElementById('view-dashboard'),
    recommendations: document.getElementById('view-recommendations'),
    profile: document.getElementById('view-profile'),
    notifications: document.getElementById('view-notifications')
};

const sidebar = document.getElementById('sidebar');
const menuItems = document.querySelectorAll('.menu-item');

// Buttons & Nav
const themeToggleBtn = document.getElementById('theme-toggle');
const navLoginBtn = document.getElementById('nav-login-btn');
const navUserMenu = document.getElementById('nav-user-menu');
const sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');
const btnGetStarted = document.getElementById('btn-get-started');

// Auth Forms
const loginContainer = document.getElementById('login-container');
const signupContainer = document.getElementById('signup-container');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const goToSignup = document.getElementById('go-to-signup');
const goToLogin = document.getElementById('go-to-login');

// Dashboard Elements
const dashboardUsername = document.getElementById('dashboard-username');
const btnRecInternships = document.getElementById('btn-rec-internships');
const btnRecJobs = document.getElementById('btn-rec-jobs');
const proficiencySlider = document.getElementById('proficiency');
const proficiencyValue = document.getElementById('proficiency-value');

// Recommendation Elements
const resultsContainer = document.getElementById('results-container');
const loadingSpinner = document.getElementById('loading-spinner');
const noResults = document.getElementById('no-results');
const tabBtns = document.querySelectorAll('.tab-btn');
const searchJobsInput = document.getElementById('search-jobs');
const backToDashboardBtn = document.getElementById('back-to-dashboard');
const savedItemsContainer = document.getElementById('saved-items-container');

// API URL (Since it's served by the same node server)
const API_BASE = '/api';

// Initialize
function init() {
    applyTheme(appState.theme);
    lucide.createIcons();

    // Check local storage for session
    const storedUser = localStorage.getItem('hirenext_user');
    if (storedUser) {
        appState.user = JSON.parse(storedUser);
        onLoginSuccess();
    } else {
        navigate('welcome');
    }
}

// Theme Logic
function applyTheme(themeName) {
    document.body.setAttribute('data-theme', themeName);
    const icon = themeToggleBtn.querySelector('i');
    if (themeName === 'light') {
        icon.setAttribute('data-lucide', 'moon');
    } else {
        icon.setAttribute('data-lucide', 'sun');
    }
    lucide.createIcons();
}

themeToggleBtn.addEventListener('click', () => {
    appState.theme = appState.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', appState.theme);
    applyTheme(appState.theme);
});

// Navigation Logic
function navigate(viewName) {
    appState.currentView = viewName;
    Object.values(views).forEach(view => {
        if (view) view.classList.add('hidden');
    });
    if (views[viewName]) {
        views[viewName].classList.remove('hidden');
        views[viewName].classList.add('active');
    }

    // Update Sidebar highlight
    menuItems.forEach(item => {
        if (item.dataset.view === viewName) item.classList.add('active');
        else item.classList.remove('active');
    });

    lucide.createIcons();
}

menuItems.forEach(item => {
    item.addEventListener('click', () => {
        if (item.dataset.tab) {
            appState.currentTab = item.dataset.tab;
            updateTabsUI();
            if (appState.allData.length > 0) renderRecommendations();
        }
        navigate(item.dataset.view);
    });
});

btnGetStarted.addEventListener('click', () => {
    showLogin();
});

navLoginBtn.addEventListener('click', () => {
    showLogin();
});

function showLogin() {
    loginContainer.classList.remove('hidden');
    signupContainer.classList.add('hidden');
    navigate('auth');
}

function showSignup() {
    signupContainer.classList.remove('hidden');
    loginContainer.classList.add('hidden');
    navigate('auth');
}

goToSignup.addEventListener('click', (e) => { e.preventDefault(); showSignup(); });
goToLogin.addEventListener('click', (e) => { e.preventDefault(); showLogin(); });

backToDashboardBtn.addEventListener('click', () => navigate('dashboard'));

sidebarLogoutBtn.addEventListener('click', () => {
    appState.user = null;
    localStorage.removeItem('hirenext_user');
    navLoginBtn.classList.remove('hidden');
    navUserMenu.classList.add('hidden');
    sidebar.classList.add('hidden');
    navigate('welcome');
});

// Auth Logic
async function handleAuth(url, body) {
    try {
        const res = await fetch(`${API_BASE}${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();

        if (data.success) {
            appState.user = data.user;
            localStorage.setItem('hirenext_user', JSON.stringify(data.user));
            onLoginSuccess();
        } else {
            alert(data.message || 'Authentication failed');
        }
    } catch (err) {
        console.error(err);
        alert('Server error during authentication. Ensure the Node server is running.');
    }
}

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleAuth('/auth/login', {
        username: loginForm.querySelector('#login-username').value,
        password: loginForm.querySelector('#login-password').value
    });
});

signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleAuth('/auth/signup', {
        username: signupForm.querySelector('#signup-username').value,
        email: signupForm.querySelector('#signup-email').value,
        password: signupForm.querySelector('#signup-password').value
    });
});

function onLoginSuccess() {
    navLoginBtn.classList.add('hidden');
    navUserMenu.classList.remove('hidden');
    sidebar.classList.remove('hidden');
    dashboardUsername.textContent = appState.user.username;

    // Set Avatar initials
    document.getElementById('user-avatar-img').src = `https://ui-avatars.com/api/?name=${appState.user.username}&background=6366f1&color=fff`;

    fetchSavedJobs();
    navigate('dashboard');
}

// Proficiency Slider update
proficiencySlider.addEventListener('input', (e) => {
    proficiencyValue.textContent = `${e.target.value}%`;
    const circle = document.querySelector('.progress-ring__circle');
    if (circle) {
        const radius = circle.r.baseVal.value;
        const circumference = radius * 2 * Math.PI;
        const offset = circumference - (e.target.value / 100) * circumference;
        circle.style.strokeDashoffset = offset;
        document.querySelector('.progress-text').textContent = `${e.target.value}%`;
    }
});

// Recommendation Engine
async function executeRecommendation(type) {
    const skillsInput = document.getElementById('skills').value;
    const interestsInput = document.getElementById('interests').value;

    if (!skillsInput || !interestsInput) {
        alert("Please enter both Skills and Area of Interest.");
        return;
    }

    appState.currentTab = type;
    updateTabsUI();
    navigate('recommendations');

    resultsContainer.classList.add('hidden');
    noResults.classList.add('hidden');
    loadingSpinner.classList.remove('hidden');

    const userSkills = skillsInput.split(',').map(s => s.trim()).filter(s => s);

    try {
        const response = await fetch(`${API_BASE}/recommendations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skills: userSkills, interests: interestsInput, type: type })
        });

        const result = await response.json();

        // Simulate delay for smooth UI animation
        setTimeout(() => {
            loadingSpinner.classList.add('hidden');
            if (result.success) {
                appState.allData = result.data;
                renderRecommendations();
            } else {
                alert(result.message || "Failed to fetch recommendations.");
                noResults.classList.remove('hidden');
            }
        }, 1200);

    } catch (error) {
        console.error(error);
        loadingSpinner.classList.add('hidden');
        noResults.classList.remove('hidden');
    }
}

btnRecInternships.addEventListener('click', () => executeRecommendation('internship'));
btnRecJobs.addEventListener('click', () => executeRecommendation('job'));

// Tabs Logic
function updateTabsUI() {
    tabBtns.forEach(b => {
        if (b.dataset.type === appState.currentTab) b.classList.add('active');
        else b.classList.remove('active');
    });
}

tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        appState.currentTab = e.target.dataset.type;
        updateTabsUI();
        renderRecommendations();
    });
});

// Render Recommendations
function renderRecommendations(searchTerm = '') {
    resultsContainer.innerHTML = '';

    let currentList = appState.allData.filter(item => item.type === appState.currentTab);

    if (searchTerm) {
        currentList = currentList.filter(item =>
            item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.company.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    if (currentList.length === 0) {
        resultsContainer.classList.add('hidden');
        noResults.classList.remove('hidden');
    } else {
        resultsContainer.classList.remove('hidden');
        noResults.classList.add('hidden');

        currentList.forEach(item => {
            const isSaved = appState.savedItems.some(saved => saved.id === item.id);
            const card = document.createElement('div');
            card.className = 'job-card glass-panel';

            card.innerHTML = `
                <div class="match-badge">${item.matchPercentage || 85}% Match</div>
                <div class="card-header">
                    <h3 class="job-title">${item.title}</h3>
                    <div class="company-info">
                        <i data-lucide="building-2" style="width:16px;height:16px;"></i> ${item.company} • 
                        <i data-lucide="map-pin" style="width:16px;height:16px;"></i> ${item.location}
                    </div>
                </div>
                <p class="job-desc">${item.description}</p>
                <div class="skills-container">
                    ${item.skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
                </div>
                <div class="card-footer">
                    <a href="${item.link && item.link !== '#' ? item.link : 'javascript:void(0)'}" ${item.link && item.link !== '#' ? 'target="_blank"' : 'onclick="alert(\\\'Application portal will open shortly for this position.\\\')"'} class="btn btn-primary btn-full glow-effect" style="text-decoration: none; text-align: center;">Apply Now</a>
                    <button class="btn btn-icon" onclick="toggleSave('${item.id}', event)" title="${isSaved ? 'Unsave' : 'Save'}">
                        <i data-lucide="bookmark" class="${isSaved ? 'fill-current' : ''}" style="color: ${isSaved ? 'var(--primary-color)' : 'inherit'}"></i>
                    </button>
                </div>
            `;
            resultsContainer.appendChild(card);
        });
        lucide.createIcons();
    }
}

searchJobsInput.addEventListener('input', (e) => {
    renderRecommendations(e.target.value);
});

// Save Logic
async function fetchSavedJobs() {
    if (!appState.user) return;
    try {
        const res = await fetch(`${API_BASE}/saved_jobs?user_id=${appState.user.id}`);
        const data = await res.json();
        if (data.success) {
            appState.savedItems = data.data;
            renderSavedItems();
        }
    } catch (err) { console.error(err); }
}

window.toggleSave = async function (id, event) {
    if (event) event.stopPropagation();

    const isSaved = appState.savedItems.some(item => item.id == id);
    const endpoint = isSaved ? '/unsave_job' : '/save_job';

    try {
        await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: appState.user.id, job_id: id })
        });
        await fetchSavedJobs();
        if (appState.currentView === 'recommendations') renderRecommendations(searchJobsInput.value);
    } catch (err) { console.error(err); }
}

function renderSavedItems() {
    if (appState.savedItems.length === 0) {
        savedItemsContainer.innerHTML = '<p class="empty-state">No saved opportunities yet.</p>';
        return;
    }

    savedItemsContainer.innerHTML = appState.savedItems.map(item => `
        <div class="saved-item" style="padding: 0.8rem; background: rgba(0,0,0,0.1); border-radius: 8px; border: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h4 style="font-size: 0.95rem;">${item.title}</h4>
                <p style="font-size: 0.8rem; color: var(--text-muted);">${item.company}</p>
            </div>
            <button class="btn btn-icon" onclick="toggleSave('${item.id}')" style="color: #ef4444;"><i data-lucide="trash-2" style="width: 16px; height: 16px;"></i></button>
        </div>
    `).join('');
    lucide.createIcons();
}

// Profile Upload Logic
const profileResumeInput = document.getElementById('profile-resume');
const resumeFileName = document.getElementById('resume-file-name');
const saveProfileBtn = document.getElementById('save-profile-btn');

if (profileResumeInput) {
    profileResumeInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            resumeFileName.textContent = "Selected: " + e.target.files[0].name;
        } else {
            resumeFileName.textContent = "";
        }
    });
}

if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
        if (!appState.isLoggedIn) {
            alert('Please login first to save your profile.');
            return;
        }

        const formData = new FormData();
        formData.append('user_id', appState.user.id);
        formData.append('name', document.getElementById('profile-name').value);
        formData.append('email', document.getElementById('profile-email').value);
        formData.append('phone', document.getElementById('profile-phone').value);
        formData.append('degree', document.getElementById('profile-degree').value);
        formData.append('address', document.getElementById('profile-address').value);
        formData.append('projects', document.getElementById('profile-projects').value);

        if (profileResumeInput.files.length > 0) {
            formData.append('resume', profileResumeInput.files[0]);
        }

        const originalText = saveProfileBtn.textContent;
        saveProfileBtn.textContent = 'Saving...';
        saveProfileBtn.disabled = true;

        try {
            const res = await fetch(`${API_BASE}/upload-resume`, {
                method: 'POST',
                body: formData // Note: no Content-Type header so browser sets multipart/form-data with boundary
            });
            const data = await res.json();

            if (data.success) {
                alert('Profile and Resume Saved Successfully!');
            } else {
                alert('Error saving profile: ' + data.message);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to save profile. Is the server running?');
        } finally {
            saveProfileBtn.textContent = originalText;
            saveProfileBtn.disabled = false;
        }
    });
}

// Run
init();
