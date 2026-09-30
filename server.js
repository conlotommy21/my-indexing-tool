const express = require('express');
const { GoogleAuth } = require('google-auth-library');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.post('/api/index', async (req, res) => {
    const { urls, googleKey, bingKey } = req.body;
    const results = [];
    const urlArray = urls.split('\n').map(u => u.trim()).filter(u => u);

    if (urlArray.length === 0) {
        return res.status(400).json({ error: 'No URLs provided.' });
    }

    // 1. Process Google Indexing API
    if (googleKey) {
        try {
            const credentials = JSON.parse(googleKey);
            const auth = new GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/indexing'],
            });
            const client = await auth.getClient();

            for (const url of urlArray) {
                try {
                    await client.request({
                        url: 'https://indexing.googleapis.com/v3/urlNotifications:publish',
                        method: 'POST',
                        data: { url: url, type: 'URL_UPDATED' }
                    });
                    results.push({ url, engine: 'Google', status: '✅ Success' });
                } catch (err) {
                    results.push({ url, engine: 'Google', status: `❌ Error: ${err.message}` });
                }
            }
        } catch (err) {
            results.push({ url: 'N/A', engine: 'Google', status: `❌ Auth Error: Invalid JSON Format` });
        }
    }

    // 2. Process Bing / IndexNow API
    if (bingKey) {
        // Group URLs by domain, as IndexNow requires host-specific payloads
        const urlsByHost = {};
        urlArray.forEach(u => {
            try {
                const host = new URL(u).hostname;
                if (!urlsByHost[host]) urlsByHost[host] = [];
                urlsByHost[host].push(u);
            } catch (e) {}
        });

        for (const [host, hostUrls] of Object.entries(urlsByHost)) {
            try {
                const payload = {
                    host: host,
                    key: bingKey,
                    keyLocation: `https://${host}/${bingKey}.txt`,
                    urlList: hostUrls
                };

                const response = await fetch('https://api.indexnow.org/indexnow', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json; charset=utf-8' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    hostUrls.forEach(url => results.push({ url, engine: 'Bing', status: '✅ Success' }));
                } else {
                    hostUrls.forEach(url => results.push({ url, engine: 'Bing', status: `❌ API Error ${response.status}` }));
                }
            } catch (err) {
                hostUrls.forEach(url => results.push({ url, engine: 'Bing', status: `❌ Network Error: ${err.message}` }));
            }
        }
    }

    res.json({ results });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));