
'use server';
/**
 * @fileOverview An advanced sentiment analysis flow that uses a Gemini API key and URL configured in Firestore.
 *
 * - analyzeAdvancedSentiment - A function that performs sentiment analysis.
 * - AdvancedSentimentInput - The input type for the analyzeAdvancedSentiment function.
 * - AdvancedSentimentOutput - The return type for the analyzeAdvancedSentiment function.
 */

import { z } from 'genkit';
import { getApiKeys } from '@/lib/api-key-service';
import type { ApiKey } from '@/types';

const FIRESTORE_GEMINI_API_KEY_NAME = "GIMINI_API_KEY";
const FIRESTORE_GEMINI_API_URL_NAME = "GIMINI_API_URL";
const API_CALL_TIMEOUT_MS = 15000; // 15 seconds timeout for the API call

// Manually define exported types
export type AdvancedSentimentInput = {
  text: string;
};

export type AdvancedSentimentOutput = {
  sentiment: 'positive' | 'negative' | 'neutral' | 'unknown';
  error?: string;
};

// Internal Zod schema for input validation (not exported)
const AdvancedSentimentInputSchemaInternal = z.object({
  text: z.string().describe("The text to analyze for sentiment."),
});

interface GeminiResponseCandidate {
  content: {
    parts: Array<{ text: string }>;
    role: string;
  };
  finishReason?: string;
  index?: number;
  safetyRatings?: Array<{ category: string; probability: string; blocked?: boolean }>;
}

interface GeminiApiResponse {
  candidates?: GeminiResponseCandidate[];
  promptFeedback?: {
    safetyRatings?: Array<{ category: string; probability: string }>;
  };
  error?: {
    code: number;
    message: string;
    status: string;
  }
}

export async function analyzeAdvancedSentiment(input: AdvancedSentimentInput): Promise<AdvancedSentimentOutput> {
  // Optional: Validate input against the internal schema
  try {
    AdvancedSentimentInputSchemaInternal.parse(input);
  } catch (validationError) {
    const message = validationError instanceof Error ? validationError.message : "Invalid input structure.";
    console.error(`[AdvancedSentimentFlow] Input validation error for text "${input.text.substring(0,30)}...": ${message}`, validationError);
    return { sentiment: 'unknown', error: `Invalid input: ${message}` };
  }

  console.log(`[AdvancedSentimentFlow] Starting advanced sentiment analysis for text: "${input.text.substring(0, 50)}..."`);

  let geminiApiKey: string | undefined;
  let geminiApiUrl: string | undefined;

  try {
    console.log("[AdvancedSentimentFlow] Attempting to fetch API keys from Firestore service.");
    const apiKeys: ApiKey[] = await getApiKeys(); // This function should handle its own errors and potentially return []

    if (!apiKeys || !Array.isArray(apiKeys)) {
      const errorMsg = "API keys array fetched from Firestore is empty or not an array.";
      console.error(`[AdvancedSentimentFlow] CRITICAL ERROR: ${errorMsg}`);
      return { sentiment: 'unknown', error: "Failed to retrieve valid API configuration array from Firestore." };
    }
    console.log(`[AdvancedSentimentFlow] Successfully fetched ${apiKeys.length} API key(s) from Firestore service. Raw data: ${JSON.stringify(apiKeys.map(k => ({serviceName: k.serviceName, hasKey: !!k.keyValue})))}`);


    const apiKeyEntry = apiKeys.find(k => k.serviceName === FIRESTORE_GEMINI_API_KEY_NAME);
    const apiUrlEntry = apiKeys.find(k => k.serviceName === FIRESTORE_GEMINI_API_URL_NAME);

    if (apiKeyEntry && apiKeyEntry.keyValue) {
      geminiApiKey = apiKeyEntry.keyValue;
      console.log(`[AdvancedSentimentFlow] Found Gemini API Key: ${geminiApiKey ? '********' : 'NOT FOUND OR EMPTY (this should not happen if apiKeyEntry.keyValue was true)'}`);
    } else {
      const errorMsg = `API key "${FIRESTORE_GEMINI_API_KEY_NAME}" not found or its keyValue is empty in Firestore.`;
      console.error(`[AdvancedSentimentFlow] CRITICAL ERROR: ${errorMsg} Searched among ${apiKeys.length} keys. Found entry: ${JSON.stringify(apiKeyEntry)}`);
      return { sentiment: 'unknown', error: errorMsg };
    }

    if (apiUrlEntry && apiUrlEntry.keyValue) {
      geminiApiUrl = apiUrlEntry.keyValue;
      console.log(`[AdvancedSentimentFlow] Found Gemini API URL: ${geminiApiUrl}`);
    } else {
      const errorMsg = `API URL "${FIRESTORE_GEMINI_API_URL_NAME}" not found or its keyValue is empty in Firestore.`;
      console.error(`[AdvancedSentimentFlow] CRITICAL ERROR: ${errorMsg} Searched among ${apiKeys.length} keys. Found entry: ${JSON.stringify(apiUrlEntry)}`);
      return { sentiment: 'unknown', error: errorMsg };
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred during API key retrieval.";
    console.error(`[AdvancedSentimentFlow] Exception fetching/processing API keys from Firestore: ${errorMessage}`, e);
    return { sentiment: 'unknown', error: `Failed to retrieve API configuration from Firestore: ${errorMessage}` };
  }

  const fullApiUrl = `${geminiApiUrl}?key=${geminiApiKey}`;
  const promptText = `Analyze the sentiment of the following text. The text may be in English, Hindi, or Hinglish (a mix of Hindi and English). Respond with only one word: 'positive', 'negative', or 'neutral'. Text: "${input.text}"`;

  const payload = {
    contents: [{
      parts: [{ "text": promptText }]
    }],
    generationConfig: {
      temperature: 0.2,
      topK: 1,
      topP: 0.95,
      maxOutputTokens: 10,
      candidateCount: 1,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ]
  };
  console.log(`[AdvancedSentimentFlow] Gemini API Request Payload (text part): "${payload.contents[0].parts[0].text.substring(0,100)}..." Full config: ${JSON.stringify(payload.generationConfig)}`);


  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    console.warn(`[AdvancedSentimentFlow] Gemini API call timed out after ${API_CALL_TIMEOUT_MS}ms for text: "${input.text.substring(0,50)}..."`);
  }, API_CALL_TIMEOUT_MS);

  try {
    console.log(`[AdvancedSentimentFlow] Making request to Gemini API: ${geminiApiUrl} (key is appended) with timeout ${API_CALL_TIMEOUT_MS}ms`);
    const response = await fetch(fullApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId); // Clear the timeout if the request completes

    if (!response.ok) {
      let errorBody = "Could not parse error body.";
      try {
        errorBody = await response.text(); // Try to get text first for more detailed errors
      } catch (parseError) {
        // Ignore if can't parse error body as text
      }
      console.error(`[AdvancedSentimentFlow] Gemini API error: ${response.status} ${response.statusText}. URL: ${geminiApiUrl}. Body: ${errorBody}`);
      return { sentiment: 'unknown', error: `Gemini API request failed with status ${response.status} (${response.statusText}). Check server logs for API response body.` };
    }

    const responseData: GeminiApiResponse = await response.json();
    console.log("[AdvancedSentimentFlow] Full Gemini API Response Data:", JSON.stringify(responseData, null, 2));


    if (responseData.error) {
        console.error(`[AdvancedSentimentFlow] Gemini API returned an error object: Code ${responseData.error.code}, Message: ${responseData.error.message}`);
        return { sentiment: 'unknown', error: `Gemini API Error: ${responseData.error.message}` };
    }

    if (responseData.promptFeedback && responseData.promptFeedback.safetyRatings) {
        const blockedRating = responseData.promptFeedback.safetyRatings.find(r => r.blocked);
        if (blockedRating) {
            const blockMsg = `Content blocked by Gemini API due to safety policy: ${blockedRating.category}.`;
            console.warn(`[AdvancedSentimentFlow] ${blockMsg} For text: "${input.text.substring(0,50)}..."`);
            return { sentiment: 'unknown', error: blockMsg };
        }
    }
    if (responseData.candidates && responseData.candidates.length > 0 && responseData.candidates[0].finishReason === "SAFETY") {
        const safetyMsg = `Content generation stopped by Gemini API due to safety policy. Candidate finish reason: SAFETY.`;
        console.warn(`[AdvancedSentimentFlow] ${safetyMsg} For text: "${input.text.substring(0,50)}..."`);
        return { sentiment: 'unknown', error: safetyMsg };
    }


    if (responseData.candidates && responseData.candidates.length > 0 && responseData.candidates[0].content && responseData.candidates[0].content.parts && responseData.candidates[0].content.parts.length > 0) {
      const rawSentiment = responseData.candidates[0].content.parts[0].text.trim().toLowerCase();
      console.log(`[AdvancedSentimentFlow] Raw sentiment from Gemini for "${input.text.substring(0,50)}...": "${rawSentiment}"`);

      if (rawSentiment.includes('positive')) {
        return { sentiment: 'positive' };
      } else if (rawSentiment.includes('negative')) {
        return { sentiment: 'negative' };
      } else if (rawSentiment.includes('neutral')) {
        return { sentiment: 'neutral' };
      } else {
        console.warn(`[AdvancedSentimentFlow] Could not map Gemini response to a known sentiment: "${rawSentiment}" for text "${input.text.substring(0,50)}..."`);
        return { sentiment: 'unknown', error: `Could not interpret sentiment from API response: "${rawSentiment.substring(0, 50)}${rawSentiment.length > 50 ? '...' : ''}"` };
      }
    } else {
      console.warn(`[AdvancedSentimentFlow] Gemini API response did not contain expected sentiment data. Response: ${JSON.stringify(responseData, null, 2)}`);
      return { sentiment: 'unknown', error: "No sentiment data found in API response structure." };
    }

  } catch (error) {
    clearTimeout(timeoutId); // Clear timeout if error occurs before completion
    const castError = error as Error;
    let errorMessage = castError.message || "An unknown error occurred.";
    if (castError.name === 'AbortError' || errorMessage.includes('timed out')) {
        errorMessage = `Gemini API call timed out after ${API_CALL_TIMEOUT_MS}ms.`;
        console.error(`[AdvancedSentimentFlow] ${errorMessage} For text: "${input.text.substring(0,50)}..."`);
        return { sentiment: 'unknown', error: "API call timed out." };
    }
    console.error(`[AdvancedSentimentFlow] Exception during Gemini API call for "${input.text.substring(0,50)}...": ${errorMessage}`, error);
    return { sentiment: 'unknown', error: `Exception during API call: ${errorMessage}` };
  }
}
