import * as fs from 'fs/promises';
import * as path from 'path';
import { Session, RecentProjectsData, RecentProject } from '../shared/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');
const RECENT_PROJECTS_FILE = path.join(DATA_DIR, 'recent-projects.json');
const MAX_RECENT_PROJECTS = 10;

async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create data directory:', error);
    throw error;
  }
}

// Session storage
export async function saveSession(session: Session): Promise<void> {
  await ensureDataDir();
  const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
}

export async function loadSession(sessionId: string): Promise<Session | null> {
  try {
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as Session;
  } catch {
    return null;
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  try {
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    await fs.unlink(filePath);
  } catch {
    // File doesn't exist, ignore
  }
}

export async function listSessions(): Promise<Session[]> {
  await ensureDataDir();
  try {
    const files = await fs.readdir(SESSIONS_DIR);
    const sessions: Session[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const sessionId = file.replace('.json', '');
        const session = await loadSession(sessionId);
        if (session) {
          sessions.push(session);
        }
      }
    }

    return sessions.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  } catch {
    return [];
  }
}

// Recent projects storage
export async function loadRecentProjects(): Promise<RecentProjectsData> {
  try {
    const data = await fs.readFile(RECENT_PROJECTS_FILE, 'utf-8');
    return JSON.parse(data) as RecentProjectsData;
  } catch {
    return { projects: [] };
  }
}

export async function saveRecentProjects(data: RecentProjectsData): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(RECENT_PROJECTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export async function addRecentProject(projectPath: string): Promise<void> {
  const data = await loadRecentProjects();
  const projectName = path.basename(projectPath);

  // Remove if already exists
  const existingIndex = data.projects.findIndex(p => p.path === projectPath);
  if (existingIndex !== -1) {
    data.projects.splice(existingIndex, 1);
  }

  // Add to front
  const project: RecentProject = {
    path: projectPath,
    name: projectName,
    lastOpened: Date.now(),
    openCount: existingIndex !== -1
      ? data.projects[existingIndex]?.openCount + 1 || 1
      : 1
  };

  data.projects.unshift(project);

  // Keep only max number
  if (data.projects.length > MAX_RECENT_PROJECTS) {
    data.projects = data.projects.slice(0, MAX_RECENT_PROJECTS);
  }

  await saveRecentProjects(data);
}

export async function removeRecentProject(projectPath: string): Promise<void> {
  const data = await loadRecentProjects();
  data.projects = data.projects.filter(p => p.path !== projectPath);
  await saveRecentProjects(data);
}
