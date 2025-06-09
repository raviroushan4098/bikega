// src/lib/gnews-api-service.ts

export async function fetchGnewsArticles(apiKey: string, keywords: string[]): Promise<{ articles: any[]; errors: string[] }> {
  const errors: string[] = [];
  const articles: any[] = [];

  if (!apiKey) {
    console.error("Gnews API key is missing.");
    errors.push("Gnews API key is missing.");
    return { articles, errors };
  }

  if (!keywords || keywords.length === 0) {
    console.log("No keywords provided for Gnews search.");
    return { articles, errors };
  }

  const query = keywords.join(" OR ");
  const endpoint = "https://gnews.io/api/v4/search";
  const url = `${endpoint}?q=${encodeURIComponent(query)}&apikey=${apiKey}`;

  console.log(`[GnewsAPIService] Fetching Gnews articles for query: "${query}"`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorMsg = `Gnews API error: ${response.status} - ${response.statusText}`;
      console.error(`[GnewsAPIService] ${errorMsg}`);
      errors.push(errorMsg);
      try {
        const errorBody = await response.text();
        console.error("[GnewsAPIService] Gnews API error body:", errorBody);
        errors.push(`Gnews API response body: ${errorBody}`);
      } catch (parseError) {
        console.error("[GnewsAPIService] Failed to parse Gnews API error body:", parseError);
        errors.push("Failed to parse Gnews API error body.");
      }
    } else {
      const data = await response.json();
      console.log(`[GnewsAPIService] Received ${data.articles?.length || 0} articles from Gnews.`);
      articles.push(...(data.articles || [])); // Assuming articles are in a 'articles' key
    }

  } catch (error) {
    const errorMsg = `Exception fetching Gnews articles: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[GnewsAPIService] ${errorMsg}`, error);
    errors.push(errorMsg);
  }

  return { articles, errors };
}