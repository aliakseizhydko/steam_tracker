class SPARouter {
    constructor() {
        this.routes = {
            '/': {
                title: 'Steam Tracker • Recent',
                init: () => this.loadPage('index')
            },
            '/week': {
                title: 'Steam Tracker • Weekly Activity',
                init: () => this.loadPage('week')
            },
            '/achievements': {
                title: 'Steam Tracker • Achievements',
                init: () => this.loadPage('achievements')
            },
            '/friends': {
                title: 'Steam Tracker • Friends',
                init: () => this.loadPage('friends')
            },
            '/profile': {
                title: 'Steam Tracker • Profile',
                init: () => this.loadPage('profile')
            }
        };

        this.contentContainer = document.querySelector('main');
        this.currentPageCleanup = null;
        this.init();
    }

    init() {
        this.interceptNavigation();
        
        // Handling the browser's back/forward buttons
        window.addEventListener('popstate', (e) => {
            this.navigate(window.location.pathname, false);
        });

        // Loading the current page
        this.navigate(window.location.pathname, false);
    }

    interceptNavigation() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href^="/"]');
            if (!link) return;

            if (link.target || link.hostname !== window.location.hostname) return;

            e.preventDefault();
            const path = link.getAttribute('href');
            this.navigate(path, true);
        });
    }

    navigate(path, pushState = true) {
        console.log(`[SPA Router] Navigate to: ${path}, pushState: ${pushState}`);
        
        const route = this.routes[path];
        
        if (!route) {
            console.error('[SPA Router] Route not found:', path);
            return;
        }

        // Refreshing browser history
        if (pushState) {
            window.history.pushState({ path }, '', path);
        }

        document.title = route.title;

        this.updateActiveNavButton(path);
        this.cleanup();
        route.init();
    }

    updateActiveNavButton(currentPath) {
        const navLinks = document.querySelectorAll('nav a[href^="/"]');
        
        navLinks.forEach(link => {
            const linkPath = link.getAttribute('href');
            const isActive = linkPath === currentPath;
            
            const iconWrapper = link.querySelector('div:first-child');
            const label = link.querySelector('span');
            const svg = iconWrapper.querySelector('svg');

            if (isActive) {
                iconWrapper.className = 'w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 bg-cyan-500/20 ring-2 ring-cyan-400/60 shadow-lg shadow-cyan-500/20';
                svg.setAttribute('class', 'w-6 h-6 transition-colors text-cyan-400');
                label.className = 'text-xs font-medium transition-colors text-cyan-400';
            } else {
                iconWrapper.className = 'w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 bg-white/5 group-hover:bg-cyan-500/10';
                svg.setAttribute('class', 'w-6 h-6 transition-colors text-gray-500 group-hover:text-cyan-300');
                label.className = 'text-xs font-medium transition-colors text-gray-500 group-hover:text-cyan-300';
            }
        });
    }

    async loadPage(pageName) {
        try {
            console.log(`[SPA Router] Loading page: ${pageName}`);
            
            this.showLoader();

            const response = await fetch(`/api/page/${pageName}`);
            if (!response.ok) {
                throw new Error(`Failed to load page: ${response.status} ${response.statusText}`);
            }
            
            const html = await response.text();
            console.log(`[SPA Router] Content loaded, length: ${html.length}`);

            this.contentContainer.innerHTML = html;

            this.initPageScripts(pageName);
            
            console.log(`[SPA Router] Page ${pageName} loaded successfully`);

        } catch (error) {
            console.error('[SPA Router] Error loading page:', error);
            this.contentContainer.innerHTML = `
                <div class="flex items-center justify-center min-h-screen">
                    <div class="text-center">
                        <p class="text-red-400 text-2xl mb-4">Failed to load page</p>
                        <p class="text-red-300 text-sm mb-4">${error.message}</p>
                        <button onclick="location.reload()" 
                                class="px-6 py-3 bg-cyan-500/20 rounded-xl hover:bg-cyan-500/30 transition">
                            Reload
                        </button>
                    </div>
                </div>
            `;
        }
    }

    showLoader() {
        this.contentContainer.innerHTML = `
            <div class="flex items-center justify-center min-h-screen">
                <div class="text-center">
                    <div class="loader-pulse mx-auto"></div>
                    <p class="mt-6 text-cyan-400 opacity-80 text-lg">Loading...</p>
                </div>
            </div>
        `;
    }

    initPageScripts(pageName) {
        this.cleanup();

        switch(pageName) {
            case 'index':
                this.initIndexPage();
                break;
            case 'week':
                this.initWeekPage();
                break;
            case 'friends':
                this.initFriendsPage();
                break;
            case 'achievements':
            case 'profile':
                break;
        }
    }

    initIndexPage() {
        // Load Chart.js if it isn't already loaded.
        this.loadScript('https://cdn.jsdelivr.net/npm/chart.js', () => {
            const ui = {
                loading: document.getElementById('loadingIndicator'),
                content: document.getElementById('contentContainer'),
                table: document.getElementById('gamesTableContainer'),
                chartCanvas: document.getElementById('twoWeeksChart')
            };

            fetch('/api/recent-games')
                .then(response => response.json())
                .then(games => {
                    ui.loading.style.display = 'none';
                    ui.content.classList.remove('hidden');
                    setTimeout(() => ui.content.classList.remove('opacity-0'), 50);

                    this.renderIndexTable(games, ui.table);
                    this.renderIndexChart(games, ui.chartCanvas);
                })
                .catch(err => {
                    console.error("Error loading games:", err);
                    ui.loading.innerHTML = `<p class="text-red-400">Failed to load data from Steam.</p>`;
                });

            this.initPushNotifications();
        });
    }

    initWeekPage() {
        this.loadScript('https://cdn.jsdelivr.net/npm/chart.js', async () => {
            const loadingIndicator = document.getElementById('loadingIndicator');
            const chartContainer = document.getElementById('chartContainer');
            const chartWrapper = document.getElementById('chartWrapper');
            const statsListContainer = document.getElementById('statsListContainer');
            const rawDataContainer = document.getElementById('debug-raw-data-container');
            const rawDataTable = document.getElementById('rawDataTable');

            try {
                const response = await fetch('/api/week-activity');
                const data = await response.json();

                loadingIndicator.style.display = 'none';
                chartContainer.style.display = 'block';
                statsListContainer.style.display = 'block';

                const stats = data.stats;
                const labels = data.labels;
                const values = data.values;
                const singleGameCover = data.single_game_cover;

                if (singleGameCover && stats.length === 1) {
                    const coverHtml = `
                        <div class="single-game-cover w-80 h-full mx-auto aspect-square rounded-full overflow-hidden 
                             ring-4 ring-cyan-400/40 shadow-2xl shadow-cyan-500/30 border-8 border-[#0f1117] bg-black">
                            <img src="${singleGameCover}" alt="${stats[0].name}" class="w-full h-full object-cover">
                        </div>
                    `;
                    chartWrapper.innerHTML = coverHtml;
                    
                    statsListContainer.innerHTML = `
                        <div class="text-5xl text-cyan-300">${stats[0].hours} h</div>
                        <div class="text-lg mt-2 opacity-80">this week in ${stats[0].name}</div>
                    `;
                } else {
                    const canvas = document.createElement('canvas');
                    canvas.id = 'statsChart';
                    chartWrapper.appendChild(canvas);

                    this.renderWeekChart(labels, values);
                    this.renderWeekTable(stats, statsListContainer);
                }

                rawDataContainer.style.display = 'block';
                this.renderWeekRawData(data.games, rawDataTable);

            } catch (error) {
                console.error('Error fetching weekly activity:', error);
                loadingIndicator.innerHTML = '<p class="text-red-500">Could not load activity data.</p>';
            }
        });
    }

    initFriendsPage() {
        const CACHE_KEY = 'friendsActivityCache';
        const loadingIndicator = document.getElementById("loadingIndicator");
        const myTimePlaceholder = document.getElementById("myTimePlaceholder");
        const friendsListContainer = document.getElementById("friendsListContainer");

        const cachedRaw = localStorage.getItem(CACHE_KEY);
        if (cachedRaw) {
            try {
                const cached = JSON.parse(cachedRaw);
                this.renderFriendsData(cached.data, myTimePlaceholder, friendsListContainer, loadingIndicator);
                console.log('Data taken from cache');
            } catch (e) {
                console.error('Failed to parse cache: ', e);
            }
        }

        this.updateFriendsData(CACHE_KEY, loadingIndicator, myTimePlaceholder, friendsListContainer);
    }

    async updateFriendsData(CACHE_KEY, loadingIndicator, myTimePlaceholder, friendsListContainer) {
        if (!localStorage.getItem(CACHE_KEY)) {
            friendsListContainer.style.display = "none";
            loadingIndicator.style.display = "block";
        }

        try {
            const response = await fetch("/api/friends/activity");
            if (!response.ok) throw new Error("Network error");

            const data = await response.json();
            const newCache = { data: data, timestamp: Date.now() };
            localStorage.setItem(CACHE_KEY, JSON.stringify(newCache));

            this.renderFriendsData(data, myTimePlaceholder, friendsListContainer, loadingIndicator);
            console.log('Data updated');
        } catch (err) {
            console.error("Friends API error:", err);
            if (!localStorage.getItem(CACHE_KEY)) {
                loadingIndicator.innerHTML = `
                    <p class="text-red-400 text-lg">Failed to load :(</p>
                    <button onclick="location.reload()" class="mt-4 px-5 py-2 bg-cyan-500/20 rounded-xl hover:bg-cyan-500/30 transition">
                        Try again
                    </button>
                `;
            }
        }
    }

    renderFriendsData(data, myTimePlaceholder, friendsListContainer, loadingIndicator) {
        myTimePlaceholder.textContent = `${data.me.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} h`;

        const htmlContent = data.comparisons.map(friend => {
            let diffHtml;
            if (friend.diff > 0) {
                diffHtml = `<div class="text-red-400 font-bold">${friend.diff} h</div><div class="text-xs opacity-75">less than you</div>`;
            } else if (friend.diff < 0) {
                diffHtml = `<div class="text-green-400 font-bold">${Math.abs(friend.diff)} h</div><div class="text-xs opacity-75">more than you</div>`;
            } else {
                diffHtml = `<div class="text-cyan-300 font-bold">Equal</div><div class="text-xs opacity-75">same as you</div>`;
            }

            return `
                <div class="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-cyan-500/10 transition-all group">
                    <img src="${friend.avatar}" alt="${friend.name}" class="w-12 h-12 rounded-full ring-2 ring-cyan-400/30 object-cover">
                    <div class="flex-1 min-w-0">
                        <div class="font-medium text-cyan-200 truncate">${friend.name}</div>
                        <div class="text-sm opacity-70">${friend.friend_hours.toLocaleString()} h played</div>
                    </div>
                    <div class="text-right">${diffHtml}</div>
                </div>
            `;
        }).join("");

        friendsListContainer.innerHTML = htmlContent;
        loadingIndicator.style.display = "none";
        friendsListContainer.style.display = "block";
    }

    renderIndexTable(games, container) {
        if (games.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12 text-3xl font-bold text-cyan-400/70">
                    No games played in the last 2 weeks<br>
                    <span class="text-5xl mt-4 block text-cyan-300">MAKE STEAM GREAT AGAIN</span>
                </div>
            `;
            return;
        }

        const rowsHtml = games.map(game => `
            <tr class="border-b border-cyan-900/20 hover:bg-cyan-500/5 transition">
                <td class="py-4 px-2">${game.name}</td>
                <td class="py-4 px-2 text-right font-mono text-cyan-200">
                    ${(game.playtime_2weeks / 60).toFixed(1)} h
                </td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="border-b-2 border-cyan-900/50">
                            <th class="py-3 px-2 text-cyan-300 font-semibold">Game</th>
                            <th class="py-3 px-2 text-right text-cyan-300 font-semibold">Hours</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        `;
    }

    renderIndexChart(games, canvas) {
        if (!canvas) return;

        const labels = games.length > 0 ? games.map(g => g.name) : ['No games'];
        const hours = games.length > 0 ? games.map(g => (g.playtime_2weeks / 60).toFixed(1)) : [1];
        const offset = 270;
        const backgroundColors = games.length > 0 
            ? hours.map((_, i) => `hsla(${((i * 137.508) + offset) % 360}, 80%, 65%, 0.8)`)
            : ['#1a1a2e'];

        new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: hours,
                    backgroundColor: backgroundColors,
                    borderColor: '#0f1117',
                    borderWidth: 3,
                    hoverOffset: 16
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#66fcf1', padding: 20, font: { size: 14 }, pointStyle: 'rectRounded', usePointStyle: true }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 17, 23, 0.95)',
                        titleColor: '#66fcf1',
                        bodyColor: '#e0fbfc',
                        borderColor: '#06b6d4',
                        borderWidth: 1,
                        cornerRadius: 12,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                if (games.length === 0) return ' MAKE STEAM GREAT AGAIN';
                                const value = parseFloat(context.parsed);
                                const total = context.dataset.data.reduce((a,b) => parseFloat(a)+parseFloat(b), 0);
                                const percentage = total > 0 ? (value / total * 100).toFixed(1) : 0;
                                return `${context.label}: ${value} h (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    renderWeekChart(labels, values) {
        const backgroundColors = values.map((_, i) => `hsla(${(i * 137.508) % 360}, 80%, 65%, 0.8)`);

        new Chart(document.getElementById('statsChart'), {
            type: 'doughnut',
            data: {
                labels: labels.length > 0 ? labels : ['No games this week'],
                datasets: [{
                    data: values.length > 0 ? values : [1],
                    backgroundColor: backgroundColors,
                    borderColor: '#0f1117',
                    borderWidth: 3,
                    hoverOffset: 14
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#66fcf1', padding: 20 } },
                    tooltip: {
                        backgroundColor: 'rgba(15, 17, 23, 0.95)',
                        cornerRadius: 12,
                        borderColor: '#06b6d4',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                if (values.length === 0) return 'MAKE STEAM GREAT AGAIN';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a,b) => a+b, 0);
                                const percentage = total > 0 ? (value / total * 100).toFixed(1) : 0;
                                return `${context.label}: ${value} h (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    renderWeekTable(stats, container) {
        let tableHtml = `
            <table class="w-full mx-auto max-w-md">
                <thead>
                    <tr class="text-cyan-400 border-b border-cyan-900/50">
                        <th class="py-2 text-left">Game</th>
                        <th class="py-2 text-right">Hours</th>
                    </tr>
                </thead>
                <tbody>
        `;

        stats.forEach(row => {
            tableHtml += `
                <tr class="border-b border-cyan-900/20">
                    <td class="py-3">${row.name}</td>
                    <td class="py-3 text-right font-mono text-cyan-200">${row.hours} h</td>
                </tr>
            `;
        });

        tableHtml += `</tbody></table>`;
        container.innerHTML = tableHtml;
    }

    renderWeekRawData(games, container) {
        let tableHtml = `
            <table class="w-full text-xs font-mono">
                <thead class="sticky top-0 bg-[#0f1117] border-b border-cyan-900/50">
                    <tr>
                        <th class="py-2 px-3 text-left text-cyan-500">ID</th>
                        <th class="py-2 px-3 text-left text-cyan-300">Name</th>
                        <th class="py-2 px-3 text-right text-cyan-400">2w</th>
                        <th class="py-2 px-3 text-right text-cyan-100">Total</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-cyan-900/20">
        `;

        games.forEach(g => {
            const playTime2WeeksHours = (g.play_time_2weeks / 60).toFixed(1);
            const playTimeForeverHours = (g.playtime_forever / 60).toFixed(1);
            const twoWeeksDisplay = g.play_time_2weeks > 0 ? `${playTime2WeeksHours}h` : '—';

            tableHtml += `
                <tr class="hover:bg-cyan-500/5 transition">
                    <td class="py-2 px-3 text-cyan-500">${g.id}</td>
                    <td class="py-2 px-3 text-cyan-200 truncate max-w-[200px]" title="${g.name}">${g.name}</td>
                    <td class="py-2 px-3 text-right text-cyan-400">${twoWeeksDisplay}</td>
                    <td class="py-2 px-3 text-right">${playTimeForeverHours}h</td>
                </tr>
            `;
        });

        tableHtml += `</tbody></table>`;
        container.innerHTML = tableHtml;
    }

    initPushNotifications() {
        const toggleBtn = document.getElementById('togglePush');
        const bellIcon = document.getElementById('bellIcon');
        
        if (toggleBtn && bellIcon && window.PushNotificationManager) {
            const vapidKey = toggleBtn.dataset.vapidKey;
            if (vapidKey) {
                new PushNotificationManager(vapidKey, 'togglePush', 'bellIcon');
            }
        }
    }

    loadScript(src, callback) {
        if (document.querySelector(`script[src="${src}"]`)) {
            if (callback) callback();
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.onload = callback;
        document.head.appendChild(script);
    }

    cleanup() {
        if (window.Chart) {
            Chart.helpers.each(Chart.instances, function(instance) {
                instance.destroy();
            });
        }

        if (this.currentPageCleanup) {
            this.currentPageCleanup();
            this.currentPageCleanup = null;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.spaRouter = new SPARouter();
});
