import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chatCompletion, parseJsonResponse } from "@/lib/openai";
import { buildDataSummarizationPrompt } from "@/lib/prompts/data-summarization";
import { parseCSV, computeColumnStats, formatSampleRows } from "@/lib/file-parser";

export async function POST(request: NextRequest) {
  try {
    const { csvData, sessionId } = await request.json();

    if (!csvData) {
      return NextResponse.json({ error: "CSV data is required" }, { status: 400 });
    }

    const parsed = parseCSV(csvData);
    const stats = computeColumnStats(parsed.rows, parsed.headers);
    const sampleRows = formatSampleRows(parsed.rows, 10);

    const prompt = buildDataSummarizationPrompt(
      parsed.headers,
      parsed.rowCount,
      JSON.stringify(stats),
      sampleRows
    );

    const response = await chatCompletion(prompt, "Generate the analysis report.", {
      jsonMode: true,
      maxTokens: 2048,
    });

    const result = parseJsonResponse<{
      summary: string;
      keyMetrics: Array<{ label: string; value: string; trend: string }>;
      insights: string[];
      trends: string[];
    }>(response);

    if (sessionId) {
      await prisma.interaction.create({
        data: {
          sessionId,
          type: "summary",
          role: "assistant",
          content: JSON.stringify(result),
          metadata: JSON.stringify({ rowCount: parsed.rowCount, columns: parsed.headers }),
        },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Summarization error:", error);
    const message = error instanceof Error ? error.message : "Failed to summarize data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
