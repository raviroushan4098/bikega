
// Flows will be imported for their side effects in this file.

// Import the new flow if you want it to be discoverable by Genkit dev UI or for other Genkit tooling.
// However, this specific flow is designed to be called directly as a server function and
// uses a dynamically fetched API key, so it won't use the global Genkit `ai` object configuration.
// For direct invocation, this import isn't strictly necessary unless you want Genkit's tooling awareness.
// import './flows/advanced-sentiment-flow';
