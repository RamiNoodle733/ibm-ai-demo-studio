import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chatCompletion } from "@/lib/openai";
import { buildDocumentQAPrompt } from "@/lib/prompts/document-qa";

export async function POST(request: NextRequest) {
  try {
    const { question, documentIds, sessionId } = await request.json();

    if (!question) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    const documents = await prisma.document.findMany({
      where: documentIds?.length ? { id: { in: documentIds } } : { isPreloaded: true },
    });

    if (documents.length === 0) {
      return NextResponse.json({ error: "No documents found" }, { status: 404 });
    }

    const docContext = documents
      .map((doc) => `[Source: ${doc.fileName}]\n${doc.content}`)
      .join("\n\n---\n\n");

    const systemPrompt = buildDocumentQAPrompt(docContext);

    const answer = await chatCompletion(systemPrompt, question, {
      model: "gpt-4o",
      maxTokens: 1024,
    });

    const citationRegex = /\[Source: ([^\]]+)\]/g;
    const citations: { text: string; source: string }[] = [];
    let match;
    while ((match = citationRegex.exec(answer)) !== null) {
      citations.push({ text: match[0], source: match[1] });
    }

    if (sessionId) {
      await prisma.interaction.createMany({
        data: [
          { sessionId, type: "question", role: "user", content: question },
          {
            sessionId,
            type: "answer",
            role: "assistant",
            content: answer,
            metadata: JSON.stringify({ citations }),
          },
        ],
      });
    }

    return NextResponse.json({ answer, citations });
  } catch (error) {
    console.error("Document QA error:", error);
    const message = error instanceof Error ? error.message : "Failed to process question";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
