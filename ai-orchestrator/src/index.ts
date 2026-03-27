export interface AiRequest {
  language: "ta" | "en" | "te" | "ml" | "kn";
  message: string;
  imageUrl?: string;
  enableVoice?: boolean;
}

export interface AiResponse {
  answer: string;
  confidence: number;
  actions: string[];
}

export async function runAdvisoryOrchestration(input: AiRequest): Promise<AiResponse> {
  const actions = ["Validate crop context", "Select advisory template", "Return localized response"];
  if (input.imageUrl) actions.unshift("Run pest image analysis");
  if (input.enableVoice) actions.push("Generate voice output");

  return {
    answer: `Localized advisory generated for language: ${input.language}`,
    confidence: 0.75,
    actions,
  };
}
