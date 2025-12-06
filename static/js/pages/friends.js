const CACHE_KEY = 'friendsActivityCache';
const CACHE_DURATION_MS = 30 * 60 * 1000;

const loadingIndicator = document.getElementById("loadingIndicator");
const myTimePlaceholder = document.getElementById("myTimePlaceholder");
const friendsListContainer = document.getElementById("friendsListContainer");

document.addEventListener("DOMContentLoaded", () => {
    const cachedRaw = localStorage.getItem(CACHE_KEY);
    if (cachedRaw) {
        try {
            const cached = JSON.parse(cachedRaw);
            renderData(cached.data);
            console.log('Data taken from cache');
        } catch (e) {
            console.error('Failed to parse cache: ', e);
        }
    }

    updateFriendsData();
});

async function updateFriendsData() {
const cachedRaw = localStorage.getItem(CACHE_KEY);
    if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (Date.now() - cached.timestamp < CACHE_DURATION_MS) {
            console.log('Data is fresh, skipping API call.');
            if (friendsListContainer.style.display === "none") {
                renderData(cached.data);
            }
            return; 
        }
    }

    try {
        const response = await fetch("/api/friends/activity");
        if (!response.ok) throw new Error("Network error");

        const data = await response.json();

        const newCache = {
            data: data,
            timestamp: Date.now()
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(newCache));

        renderData(data);
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

function renderFriendItem(friend) {
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
            <div class="text-right">
                ${diffHtml}
            </div>
        </div>
    `;
}

function renderData(data) {
    myTimePlaceholder.textContent = `${data.me.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} h`;

    const htmlContent = data.comparisons
        .map(friend => renderFriendItem(friend))
        .join("");

    friendsListContainer.innerHTML = htmlContent;

    loadingIndicator.style.display = "none";
    friendsListContainer.style.display = "block";
}