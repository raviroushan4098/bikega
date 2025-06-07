
import { z } from 'zod';

export const GatherGlobalMentionsInputSchema = z.object({
  userId: z.string().describe("The ID of the user for whom to gather mentions."),
});
export type GatherGlobalMentionsInput = z.infer<typeof GatherGlobalMentionsInputSchema>;

export const GatherGlobalMentionsOutputSchema = z.object({
  totalMentionsFetched: z.number().describe("Total mentions fetched across all platforms before filtering duplicates."),
  newMentionsStored: z.number().describe("Number of new, unique mentions successfully processed and stored."),
  errors: z.array(z.string()).describe("List of errors encountered during the process."),
});
export type GatherGlobalMentionsOutput = z.infer<typeof GatherGlobalMentionsOutputSchema>;
