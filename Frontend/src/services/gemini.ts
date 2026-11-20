/**
 * gemini.ts — Gemini AI service for Kanban board AI features.
 * Uses @google/genai SDK with model gemini-2.0-flash (stable).
 */

import { GoogleGenAI, Type } from '@google/genai';
import { Task, Column, ActivityLog, TaskPriority } from '../types';

// ─── Client Initialization ─────────────────────────────────────────────────
function getClient(): GoogleGenAI {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error(
      'Gemini API key not configured. Add VITE_GEMINI_API_KEY to Frontend/.env.local'
    );
  }
  return new GoogleGenAI({ apiKey });
}

const MODEL = 'gemini-3.5-flash-lite';
const FALLBACK_MODEL = 'gemini-2.5-flash-preview-05-20';

async function generateWithModel(
  ai: GoogleGenAI,
  config: { contents: string; config?: any }
) {
  try {
    return await ai.models.generateContent({
      model: MODEL,
      ...config,
    });
  } catch (err: any) {
    // If gemini-3.8-flash hits temporary 503 high-demand spike, gracefully fall back
    if (err?.message?.includes('503') || err?.message?.includes('UNAVAILABLE') || err?.status === 503) {
      console.warn(`[Gemini] ${MODEL} 503 unavailable, falling back to ${FALLBACK_MODEL}`);
      return await ai.models.generateContent({
        model: FALLBACK_MODEL,
        ...config,
      });
    }
    throw err;
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────
export interface DraftTask {
  title: string;
  description: string;
  priority: TaskPriority;
  suggestedColumnId: string;
  suggestedColumnName: string;
}

// ─── Feature 1: Parse Meeting Note → Draft Tasks ───────────────────────────
export async function parseMeetingNoteToTasks(
  text: string,
  columns: Column[]
): Promise<DraftTask[]> {
  const ai = getClient();

  const columnList = columns
    .map(c => `- id: "${c._id}", name: "${c.name}"`)
    .join('\n');

  const prompt = `You are a project management assistant. Parse the following meeting note or message and extract actionable tasks.

For each task, determine:
1. A clear, concise title (max 80 chars)
2. A brief description with context and acceptance criteria
3. Priority: URGENT (blockers/critical bugs), HIGH (important features), MEDIUM (standard work), LOW (nice-to-haves)
4. The best column from the list below that suits where this task should start

Available columns:
${columnList}

Meeting note:
"""
${text}
"""

Return a JSON array of tasks. If no tasks are found, return an empty array [].`;

  const response = await generateWithModel(ai, {
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            priority: { type: Type.STRING },
            suggestedColumnId: { type: Type.STRING },
            suggestedColumnName: { type: Type.STRING },
          },
          required: ['title', 'description', 'priority', 'suggestedColumnId', 'suggestedColumnName'],
        },
      },
    },
  });

  const raw = response.text ?? '[]';
  let parsed: any[] = [];
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }

  // Validate priorities and column IDs
  const validPriorities: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  const validColIds = new Set(columns.map(c => c._id));
  const fallbackColId = columns[0]?._id ?? '';
  const fallbackColName = columns[0]?.name ?? 'Backlog';

  return (Array.isArray(parsed) ? parsed : []).map((item: any) => ({
    title: String(item.title || '').slice(0, 80),
    description: String(item.description || ''),
    priority: validPriorities.includes(item.priority) ? item.priority : 'MEDIUM',
    suggestedColumnId: validColIds.has(item.suggestedColumnId)
      ? item.suggestedColumnId
      : fallbackColId,
    suggestedColumnName: validColIds.has(item.suggestedColumnId)
      ? (columns.find(c => c._id === item.suggestedColumnId)?.name ?? fallbackColName)
      : fallbackColName,
  }));
}

// ─── Feature 2: Summarize Task ─────────────────────────────────────────────
export async function summarizeTask(
  task: Task,
  activityLogs: ActivityLog[]
): Promise<string> {
  const ai = getClient();

  const activityText =
    activityLogs.length > 0
      ? activityLogs
          .slice(0, 15)
          .map(
            log =>
              `[${new Date(log.createdAt).toLocaleDateString()}] ${log.actorName} — ${log.action}${
                log.details ? ': ' + JSON.stringify(log.details) : ''
              }`
          )
          .join('\n')
      : 'No activity history available.';

  const prompt = `You are a concise technical PM assistant. Summarize this Kanban task in 2-4 sentences covering: what it is, its current status/priority, and key context from activity. Be direct and professional, no fluff.

Task Title: ${task.title}
Priority: ${task.priority}
Description: ${task.description || '(no description)'}
Labels: ${task.labels?.join(', ') || 'none'}

Recent Activity:
${activityText}

Write the summary in plain prose (no bullet points, no headers). Keep it under 80 words.`;

  const response = await generateWithModel(ai, {
    contents: prompt,
  });

  return (response.text ?? '').trim();
}

// ─── Feature 3: Subtask Breakdown ──────────────────────────────────────────
export async function breakdownTask(task: Task): Promise<string[]> {
  const ai = getClient();

  const prompt = `You are a senior software engineer and project planner. Break down this Kanban task into 4-8 concrete, actionable subtasks. Each subtask should be a single clear action item (start with a verb).

Task Title: ${task.title}
Description: ${task.description || '(no description)'}
Priority: ${task.priority}

Return a JSON array of strings — each string is one subtask. Keep each under 100 characters. No numbering, no markdown symbols.`;

  const response = await generateWithModel(ai, {
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
  });

  const raw = response.text ?? '[]';
  let parsed: any[] = [];
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }

  return (Array.isArray(parsed) ? parsed : [])
    .filter((s: any) => typeof s === 'string' && s.trim())
    .map((s: string) => s.trim())
    .slice(0, 10);
}
