const CACHE_KEY = 'friendsActivityCache';
const CACHE_DURATION_MS = 30 * 60 * 1000; 

document.addEventListener("DOMContentLoaded", () => {
    fetchAndCacheFriendsActivity();
});

const loadingIndicator = document.getElementById("loadingIndicator");
const myTimePlaceholder = document.getElementById("myTimePlaceholder");
const friendsListContainer = document.getElementById("friendsListContainer");

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


function fetchAndCacheFriendsActivity() {
    const cachedData = localStorage.getItem(CACHE_KEY);

    if (cachedData) {
        try {
            const cache = JSON.parse(cachedData);
            const now = new Date().getTime();

            if (now < cache.timestamp + CACHE_DURATION_MS) {
                console.log('Loading friends data from cache (valid).');
                renderData(cache.data); 
                return;
            } else {
                console.log('Cache expired. Fetching new data.');
            }
        } catch (e) {
            console.error('Error parsing cached data, fetching fresh data:', e);
            localStorage.removeItem(CACHE_KEY);
        }
    }
    
    friendsListContainer.style.display = "none";
    loadingIndicator.style.display = "block";
    
    fetch("/api/friends/activity")
        .then(response => {
            if (!response.ok) throw new Error("Network error");
            return response.json();
        })
        .then(data => {
            const newCache = {
                data: data,
                timestamp: new Date().getTime()
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(newCache));

            console.log('Fresh data fetched and cached.');
            renderData(data);
        })
        .catch(err => {
            console.error("Friends API error:", err);
            loadingIndicator.innerHTML = `
                <p class="text-red-400 text-lg">Failed to load friends</p>
                <button onclick="location.reload()" class="mt-4 px-5 py-2 bg-cyan-500/20 rounded-xl hover:bg-cyan-500/30 transition">Try Again</button>
            `;
            if (cachedData) {
                 const cache = JSON.parse(cachedData);
                 renderData(cache.data); 
                 loadingIndicator.style.display = "none";
                 console.log('Displaying expired data due to network error.');
            } else {
                 friendsListContainer.style.display = "none";
            }
        });
}