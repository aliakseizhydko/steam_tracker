document.addEventListener('DOMContentLoaded', () => {
    fetchWeekActivity();
});

async function fetchWeekActivity() {
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
                <div class="single-game-cover 
                    w-80 h-full mx-auto aspect-square 
                    rounded-full overflow-hidden 
                    ring-4 ring-cyan-400/40 
                    shadow-2xl shadow-cyan-500/30 
                    border-8 border-[#0f1117]
                    bg-black">
                    <img src="${singleGameCover}" 
                        alt="${stats[0].name}" 
                        class="w-full h-full object-cover">
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

            renderChart(labels, values);
            renderTable(stats, statsListContainer);
        }

        rawDataContainer.style.display = 'block';
        renderRawDataTable(data.games, rawDataTable);


    } catch (error) {
        console.error('Error fetching weekly activity:', error);
        loadingIndicator.innerHTML = '<p class="text-red-500">Could not load activity data.</p>';
    }
}

function renderChart(gameLabels, gameHours) {
    const backgroundColors = gameHours.map((_, i) => 
        `hsla(${(i * 137.508) % 360}, 80%, 65%, 0.8)`
    );

    new Chart(document.getElementById('statsChart'), {
        type: 'doughnut',
        data: {
            labels: gameLabels.length > 0 ? gameLabels : ['No games this week'],
            datasets: [{
                data: gameHours.length > 0 ? gameHours : [1],
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
                            if (gameHours.length === 0) return 'MAKE STEAM GREAT AGAIN';
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

function renderTable(stats, container) {
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

    tableHtml += `
            </tbody>
        </table>
    `;
    container.innerHTML = tableHtml;
}

function renderRawDataTable(games, container) {
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

    tableHtml += `
            </tbody>
        </table>
    `;
    container.innerHTML = tableHtml;
}