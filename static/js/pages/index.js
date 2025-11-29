document.addEventListener("DOMContentLoaded", () => {
    const ui = {
        loading: document.getElementById('loadingIndicator'),
        content: document.getElementById('contentContainer'),
        table: document.getElementById('gamesTableContainer'),
        chartCanvas: document.getElementById('twoWeeksChart')
    };

    fetchGames();

    function fetchGames() {
        fetch('/api/recent-games')
            .then(response => response.json())
            .then(handleDataSuccess)
            .catch(handleDataError);
    }

    function handleDataSuccess(games) {
        ui.loading.style.display = 'none';
        ui.content.classList.remove('hidden');
        
        setTimeout(() => ui.content.classList.remove('opacity-0'), 50);

        renderTable(games);
        renderChart(games);
    }

    function handleDataError(err) {
        console.error("Error loading games:", err);
        ui.loading.innerHTML = `<p class="text-red-400">Failed to load data from Steam.</p>`;
    }

    function renderTable(games) {
        if (games.length === 0) {
            ui.table.innerHTML = `
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

        ui.table.innerHTML = `
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

    function renderChart(games) {
        if (!ui.chartCanvas) return;

        const labels = games.length > 0 ? games.map(g => g.name) : ['No games'];
        const hours = games.length > 0 ? games.map(g => (g.playtime_2weeks / 60).toFixed(1)) : [1];
        
        const offset = 270;
        const backgroundColors = games.length > 0 
            ? hours.map((_, i) => `hsla(${((i * 137.508) + offset) % 360}, 80%, 65%, 0.8)`)
            : ['#1a1a2e'];

        new Chart(ui.chartCanvas, {
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
                        labels: {
                            color: '#66fcf1',
                            padding: 20,
                            font: { size: 14, family: "'Inter', sans-serif" },
                            pointStyle: 'rectRounded',
                            usePointStyle: true
                        }
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
});