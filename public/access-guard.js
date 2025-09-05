// Access Guard - Protects pages from unauthorized access
(function() {
    'use strict';

    // Don't run guard on the key entry page itself
    if (window.location.pathname === '/' || window.location.pathname.endsWith('key-entry.html')) {
        return;
    }

    async function validateAccess() {
        try {
            const storedKey = sessionStorage.getItem('accessKey');
            
            if (!storedKey) {
                redirectToKeyEntry();
                return;
            }

            // Validate the stored key with the server
            const response = await fetch('/api/validate-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ accessKey: storedKey })
            });

            if (!response.ok) {
                // Invalid key, clear storage and redirect
                sessionStorage.removeItem('accessKey');
                redirectToKeyEntry();
                return;
            }

            // Key is valid, show the page content
            showPageContent();

        } catch (error) {
            console.error('Access validation error:', error);
            // On error, redirect to key entry for security
            redirectToKeyEntry();
        }
    }

    function redirectToKeyEntry() {
        // Prevent infinite redirects
        if (window.location.pathname !== '/') {
            window.location.href = '/';
        }
    }

    function showPageContent() {
        // Remove loading overlay if it exists
        const loadingOverlay = document.getElementById('access-loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
        
        // Show the main content
        document.body.style.visibility = 'visible';
        document.body.style.opacity = '1';
    }

    function createLoadingOverlay() {
        // Hide body content initially
        document.body.style.visibility = 'hidden';
        document.body.style.opacity = '0';

        // Create loading overlay
        const overlay = document.createElement('div');
        overlay.id = 'access-loading-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 300px;
        `;

        content.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 16px;">🔐</div>
            <h2 style="color: #2c3e50; margin-bottom: 16px; font-size: 1.5rem;">Verifying Access</h2>
            <div style="color: #7f8c8d;">Please wait...</div>
        `;

        overlay.appendChild(content);
        document.body.appendChild(overlay);
    }

    // Run validation when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            createLoadingOverlay();
            validateAccess();
        });
    } else {
        createLoadingOverlay();
        validateAccess();
    }
})();