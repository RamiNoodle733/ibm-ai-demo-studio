import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chatCompletion, parseJsonResponse } from "@/lib/openai";
import { buildFollowUpPrompt } from "@/lib/prompts/follow-up";

export async function POST(request: NextRequest) {
  try {
    const { sessionId, industry, painPoints, successMetrics } =
      await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    const session = await prisma.demoSession.findUnique({
      where: { id: sessionId },
      include: {
        demo: true,
        interactions: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const interactionSummary = session.interactions
      .map((i) => `[${i.role}] ${i.content.slice(0, 200)}`)
      .join("\n");

    const systemPrompt = buildFollowUpPrompt({
      prospectName: session.prospectName ?? undefined,
      companyName: session.companyName ?? undefined,
      industry,
      demoTitle: session.demo.title,
      painPoints,
      successMetrics,
      interactions: interactionSummary || "No interactions recorded.",
    });

    const response = await chatCompletion(
      systemPrompt,
      "Generate the follow-up content.",
      { jsonMode: true, maxTokens: 2048 }
    );

    const result = parseJsonResponse<{
      recapEmail: string;
      actionPlan: Array<{
        step: string;
        timeline: string;
        details: string;
      }>;
      valueProps: Array<{
        title: string;
        description: string;
        relevantPainPoint: string;
      }>;
    }>(response);

    const followUp = await prisma.followUp.create({
      data: {
        sessionId,
        recapEmail: result.recapEmail,
        actionPlan: JSON.stringify(result.actionPlan),
        valueProps: JSON.stringify(result.valueProps),
      },
    });

    if (industry || painPoints || successMetrics) {
      await prisma.demoSession.update({
        where: { id: sessionId },
        data: {
          ...(industry && { industry }),
          ...(painPoints && { painPoints }),
          ...(successMetrics && { successMetrics }),
        },
      });
    }

    return NextResponse.json({ followUp: { ...followUp, ...result } });
  } catch (error) {
    console.error("Follow-up generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate follow-up";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
