class AppRouter {
    constructor() {
        this.mainContainer = document.querySelector('main');
        this.currentPath = null;
        this.isNavigating = false;

        this.initLinks();

        window.addEventListener('popstate', () => this.loadRoute(location.pathname));

        this.cacheCurrentPage();
    }

    initLinks() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('nav a');
            if (link) {
                e.preventDefault();
                const href = link.getAttribute('href');
                
                if (href !== this.currentPath) {
                    this.updateNavHighlight(href);
                    history.pushState(null, '', href);
                    this.loadRoute(href);
                }
            }
        });
    }

    updateNavHighlight(path) {
        document.querySelectorAll('nav a').forEach(a => {
            const div = a.querySelector('div');
            const span = a.querySelector('span');
            const svg = a.querySelector('svg');
            
            const isActive = a.getAttribute('href') === path;

            if (isActive) {
                div.className = "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 bg-cyan-500/20 ring-2 ring-cyan-400/60 shadow-lg shadow-cyan-500/20";
                svg.classList.replace('text-gray-500', 'text-cyan-400');
                span.classList.replace('text-gray-500', 'text-cyan-400');
            } else {
                div.className = "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 bg-white/5 group-hover:bg-cyan-500/10";
                svg.classList.replace('text-cyan-400', 'text-gray-500');
                span.classList.replace('text-cyan-400', 'text-gray-500');
            }
        });
    }

    getViewId(path) {
        const cleanPath = path.replace(/^\/|\/$/g, '') || 'home';
        return `view-${cleanPath.replace(/\//g, '-')}`; 
    }

    cacheCurrentPage() {
        const path = location.pathname;
        const viewId = this.getViewId(path);

        if (!document.getElementById(viewId)) {
            const content = this.mainContainer.innerHTML;
            this.mainContainer.innerHTML = `<div id="${viewId}" class="view-content" style="display: block; opacity: 1;">${content}</div>`;
        }
        this.currentPath = path;
    }

    async loadRoute(path) {
        if (this.currentPath === path || this.isNavigating) return;
        this.isNavigating = true;

        const viewId = this.getViewId(path);
        let newView = document.getElementById(viewId);

        if (!newView) {
            try {
                const response = await fetch(path, {
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                const html = await response.text();
                
                const tempContainer = document.createElement('div');
                tempContainer.innerHTML = html;
                
                newView = document.createElement('div');
                newView.id = viewId;
                newView.className = 'view-content';
                newView.style.display = 'none';
                newView.style.opacity = '0';
                newView.innerHTML = html;

                this.mainContainer.appendChild(newView);
                this.executeScripts(newView);
            } catch (err) {
                console.error('Nav error', err);
                this.isNavigating = false;
                return;
            }
        }

        const currentView = this.mainContainer.querySelector(`.view-content[style*="display: block"]`) 
                         || this.mainContainer.querySelector(`.view-content:not([style*="display: none"])`);

        const updateDOM = () => {
            if (currentView) {
                currentView.style.display = 'none';
                currentView.style.opacity = '0';
            }
            newView.style.display = 'block';

            requestAnimationFrame(() => {
                newView.style.opacity = '1';
            });
        };

        if (document.startViewTransition) {
            const transition = document.startViewTransition(() => {
                if (currentView) currentView.style.display = 'none';
                newView.style.display = 'block';
                newView.style.opacity = '1';
            });
            await transition.finished;
        } else {
            if (currentView) {
                currentView.style.opacity = '0';
                await new Promise(r => setTimeout(r, 200));
                currentView.style.display = 'none';
            }
            
            newView.style.display = 'block';
            void newView.offsetWidth; 
            newView.style.opacity = '1';
        }

        this.currentPath = path;
        this.isNavigating = false;
    }

    executeScripts(container) {
        const scripts = container.querySelectorAll('script');
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));

            newScript.textContent = oldScript.textContent;
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
        
        document.dispatchEvent(new Event('viewLoaded'));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.appRouter = new AppRouter();
});