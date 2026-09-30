const express = require('express');
const { google } = require('googleapis');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.post('/api/index-auto', async (req, res) => {
    const { urls, googleKey, clientId, clientSecret, refreshToken, blogId } = req.body;
    const results = [];
    const urlArray = urls.split('\n').map(u => u.trim()).filter(u => u);

    if (urlArray.length === 0) return res.status(400).json({ error: 'No URLs provided.' });

    try {
        // 1. Authenticate with Blogger API
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

        // 2. Authenticate with Google Indexing API
        const credentials = JSON.parse(googleKey);
        const indexingAuth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/indexing'],
        });
        const indexingClient = await indexingAuth.getClient();

        // 3. Process Each URL
        for (const targetUrl of urlArray) {
            try {
                // Step A: Publish the new post on Blogger
                const postContent = `<h2>Latest News Update</h2><p>We have just discovered a new resource. Read the full details and access the script here: <a href="${targetUrl}">${targetUrl}</a></p>`;
                
                const postResponse = await blogger.posts.insert({
                    blogId: blogId,
                    requestBody: {
                        title: `Breaking Update - ${Math.floor(Math.random() * 10000)}`,
                        content: postContent
                    }
                });

                const newBloggerUrl = postResponse.data.url;

                // Step B: Send the newly created Blogger URL to the Indexing API
                await indexingClient.request({
                    url: 'https://indexing.googleapis.com/v3/urlNotifications:publish',
                    method: 'POST',
                    data: { url: newBloggerUrl, type: 'URL_UPDATED' }
                });

                results.push({ 
                    targetUrl: targetUrl, 
                    bloggerUrl: newBloggerUrl, 
                    status: '✅ Success (Posted & Indexed)' 
                });
            } catch (err) {
                results.push({ targetUrl: targetUrl, bloggerUrl: 'N/A', status: `❌ Error: ${err.message}` });
            }
        }
        res.json({ results });
    } catch (err) {
        res.status(500).json({ error: `Authentication failed: ${err.message}` });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
