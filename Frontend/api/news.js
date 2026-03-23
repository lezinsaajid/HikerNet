import axios from 'axios';

const NEWS_API_KEY = process.env.EXPO_PUBLIC_NEWS_API;
const BASE_URL = 'https://newsapi.org/v2/everything';

export const fetchTrekkingNews = async () => {
    if (!NEWS_API_KEY) {
        throw new Error('NewsAPI key is missing in environment variables.');
    }

    try {
        const response = await axios.get(BASE_URL, {
            params: {
                // Stricter query to avoid general "mountain" or broadly unrelated news
                q: '("trekking" OR "hiking trail" OR "backpacking outdoor" OR "mountaineering")',
                searchIn: 'title,description',
                language: 'en',
                sortBy: 'publishedAt',
                pageSize: 30, 
                apiKey: NEWS_API_KEY
            }
        });

        const articles = response.data.articles || [];

        // Filter out articles that lack an image or title, or have placeholder strings
        const validArticles = articles.filter(article => {
            const hasTitle = article.title && article.title !== '[Removed]' && article.title.length > 5;
            const hasImage = article.urlToImage && article.urlToImage !== 'null';
            // Optionally check for explicit relevance in text if the query isn't enough:
            const content = (article.title + " " + (article.description || "")).toLowerCase();
            const isRelevant = content.includes('trek') || content.includes('hike') || content.includes('hiking') || content.includes('trail') || content.includes('outdoor') || content.includes('mountaineering') || content.includes('mountain');
            
            return hasTitle && hasImage && isRelevant;
        });

        return validArticles.slice(0, 15);
    } catch (error) {
        console.error('[NewsAPI Error]', error?.response?.data || error.message);
        throw error;
    }
};
