import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chatCompletion, parseJsonResponse } from "@/lib/openai";
import { TEXT_CLASSIFICATION_PROMPT } from "@/lib/prompts/text-classification";

export async function POST(request: NextRequest) {
  try {
    const { texts, sessionId } = await request.json();

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: "Texts array is required" }, { status: 400 });
    }

    const userMessage = texts.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n");

    const response = await chatCompletion(TEXT_CLASSIFICATION_PROMPT, userMessage, {
      jsonMode: true,
      maxTokens: 2048,
    });

    const result = parseJsonResponse<{ classifications: Array<{
      text: string;
      sentiment: string;
      category: string;
      urgency: string;
      confidence: number;
      keyPhrases: string[];
    }> }>(response);

    if (sessionId) {
      await prisma.interaction.create({
        data: {
          sessionId,
          type: "classification",
          role: "assistant",
          content: JSON.stringify(result.classifications),
          metadata: JSON.stringify({ count: result.classifications.length }),
        },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Classification error:", error);
    const message = error instanceof Error ? error.message : "Failed to classify texts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
