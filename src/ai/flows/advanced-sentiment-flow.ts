
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

// Internal Zod schema for output structure (not exported, for reference or internal use)
// const AdvancedSentimentOutputSchemaInternal = z.object({
//   sentiment: z.enum(['positive', 'negative', 'neutral', 'unknown']).describe("The detected sentiment of the text."),
//   error: z.string().optional().describe("Error message if analysis failed."),
// });

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
    console.error("[AdvancedSentimentFlow] Input validation error:", validationError);
    // It's good practice to cast the error to a known type if you want to extract details.
    // For now, a generic message is fine.
    const message = validationError instanceof Error ? validationError.message : "Invalid input structure.";
    return { sentiment: 'unknown', error: `Invalid input: ${message}` };
  }

  console.log("[AdvancedSentimentFlow] Starting advanced sentiment analysis for text:", input.text.substring(0, 50) + "...");

  let geminiApiKey: string | undefined;
  let geminiApiUrl: string | undefined;

  try {
    const apiKeys: ApiKey[] = await getApiKeys();
    const apiKeyEntry = apiKeys.find(k => k.serviceName === FIRESTORE_GEMINI_API_KEY_NAME);
    const apiUrlEntry = apiKeys.find(k => k.serviceName === FIRESTORE_GEMINI_API_URL_NAME);

    if (apiKeyEntry && apiKeyEntry.keyValue) {
      geminiApiKey = apiKeyEntry.keyValue;
    } else {
      console.error(`[AdvancedSentimentFlow] Error: API key "${FIRESTORE_GEMINI_API_KEY_NAME}" not found or empty in Firestore.`);
      return { sentiment: 'unknown', error: `API key "${FIRESTORE_GEMINI_API_KEY_NAME}" not configured.` };
    }

    if (apiUrlEntry && apiUrlEntry.keyValue) {
      geminiApiUrl = apiUrlEntry.keyValue;
    } else {
      console.error(`[AdvancedSentimentFlow] Error: API URL "${FIRESTORE_GEMINI_API_URL_NAME}" not found or empty in Firestore.`);
      return { sentiment: 'unknown', error: `API URL "${FIRESTORE_GEMINI_API_URL_NAME}" not configured.` };
    }
  } catch (e) {
    console.error("[AdvancedSentimentFlow] Error fetching API keys from Firestore:", e);
    return { sentiment: 'unknown', error: "Failed to retrieve API configuration from Firestore." };
  }

  const fullApiUrl = `${geminiApiUrl}?key=${geminiApiKey}`;
  const prompt = `Analyze the sentiment of the following text. The text may be in English, Hindi, or Hinglish (a mix of Hindi and English). Respond with only one word: 'positive', 'negative', or 'neutral'. Text: "${input.text}"`;

  const payload = {
    contents: [{
      parts: [{ "text": prompt }]
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

  try {
    console.log(`[AdvancedSentimentFlow] Making request to Gemini API: ${geminiApiUrl}`);
    const response = await fetch(fullApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorBody = "Unknown error";
      try {
        errorBody = await response.text();
      } catch (parseError) {
        // Ignore if can't parse error body
      }
      console.error(`[AdvancedSentimentFlow] Gemini API error: ${response.status} ${response.statusText}. Body: ${errorBody}`);
      return { sentiment: 'unknown', error: `Gemini API request failed with status ${response.status}: ${response.statusText}` };
    }

    const responseData: GeminiApiResponse = await response.json();

    if (responseData.error) {
        console.error(`[AdvancedSentimentFlow] Gemini API returned an error object: Code ${responseData.error.code}, Message: ${responseData.error.message}`);
        return { sentiment: 'unknown', error: `Gemini API Error: ${responseData.error.message}` };
    }

    if (responseData.candidates && responseData.candidates.length > 0 && responseData.candidates[0].content && responseData.candidates[0].content.parts && responseData.candidates[0].content.parts.length > 0) {
      const rawSentiment = responseData.candidates[0].content.parts[0].text.trim().toLowerCase();
      console.log("[AdvancedSentimentFlow] Raw sentiment from Gemini:", rawSentiment);

      if (rawSentiment.includes('positive')) {
        return { sentiment: 'positive' };
      } else if (rawSentiment.includes('negative')) {
        return { sentiment: 'negative' };
      } else if (rawSentiment.includes('neutral')) {
        return { sentiment: 'neutral' };
      } else {
        console.warn("[AdvancedSentimentFlow] Could not map Gemini response to a known sentiment:", rawSentiment);
        return { sentiment: 'unknown', error: "Could not interpret sentiment from API response." };
      }
    } else {
      console.warn("[AdvancedSentimentFlow] Gemini API response did not contain expected sentiment data. Response:", JSON.stringify(responseData, null, 2));
      return { sentiment: 'unknown', error: "No sentiment data found in API response." };
    }

  } catch (error) {
    console.error("[AdvancedSentimentFlow] Exception during Gemini API call:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return { sentiment: 'unknown', error: `Exception during API call: ${errorMessage}` };
  }
}
