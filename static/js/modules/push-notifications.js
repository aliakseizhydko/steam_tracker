class PushNotificationManager {
    constructor(publicKey, buttonId, iconId) {
        this.publicKey = publicKey;
        this.toggleBtn = document.getElementById(buttonId);
        this.bellIcon = document.getElementById(iconId);
        this.isSubscribed = false;
        this.registration = null;

        if (this.toggleBtn && this.bellIcon) {
            this.init();
        }
    }

    async init() {
        this.setupEventListeners();
        await this.setupServiceWorker();
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    updateIcon(subscribed) {
        this.isSubscribed = subscribed;
        if (subscribed) {
            this.bellIcon.innerHTML = `<path fill="currentColor" d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9z"/>
                                       <path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19.5 18.5L18 17h-3m-3-1v1a3 3 0 006 0v-1m-6 0h6"/>`;
            this.toggleBtn.title = "Click to disable notifications";
        } else {
            this.bellIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                       d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>`;
            this.toggleBtn.title = "Click to enable notifications";
        }
    }

    async setupServiceWorker() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        try {
            this.registration = await navigator.serviceWorker.register('/static/service-worker.js');
            const existingSub = await this.registration.pushManager.getSubscription();
            this.updateIcon(!!existingSub);
        } catch (err) {
            console.error('SW error:', err);
        }
    }

    setupEventListeners() {
        this.toggleBtn.addEventListener('click', async () => {
            if (!this.registration) return alert("Service Worker not ready");
            
            try {
                if (this.isSubscribed) {
                    await this.unsubscribe();
                } else {
                    await this.subscribe();
                }
            } catch (err) {
                console.error(err);
                alert("Error: " + err.message);
            }
        });
    }

    async unsubscribe() {
        const sub = await this.registration.pushManager.getSubscription();
        if (sub) {
            await sub.unsubscribe();
            await fetch("/unsubscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ endpoint: sub.endpoint })
            });
        }
        this.updateIcon(false);
    }

    async subscribe() {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return alert("Permission denied");

        const sub = await this.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: this.urlBase64ToUint8Array(this.publicKey)
        });

        await fetch("/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sub.toJSON())
        });

        this.updateIcon(true);
    }
}