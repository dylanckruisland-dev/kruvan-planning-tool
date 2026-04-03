import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { AgendaPage } from "@/pages/AgendaPage";
import { NotesPage } from "@/pages/NotesPage";
import { OverviewPage } from "@/pages/OverviewPage";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { TasksPage } from "@/pages/TasksPage";
import { ContentPage } from "@/pages/ContentPage";
import { DirectMessagesPage } from "@/pages/DirectMessagesPage";

const rootRoute = createRootRoute({
  component: AppShell,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: OverviewPage,
});

const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects",
  validateSearch: (raw: Record<string, unknown>) => ({
    project:
      typeof raw.project === "string" && raw.project.length > 0
        ? raw.project
        : undefined,
    folder:
      typeof raw.folder === "string" && raw.folder.length > 0
        ? raw.folder
        : undefined,
    sort:
      raw.sort === "status" ||
      raw.sort === "priority" ||
      raw.sort === "due"
        ? raw.sort
        : undefined,
    dir: raw.dir === "asc" || raw.dir === "desc" ? raw.dir : undefined,
  }),
  component: ProjectsPage,
});

const projectDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId",
  validateSearch: (raw: Record<string, unknown>) => ({
    tab:
      raw.tab === "tasks" ||
      raw.tab === "notes" ||
      raw.tab === "overview" ||
      raw.tab === "content"
        ? raw.tab
        : "overview",
    taskView:
      raw.taskView === "board" || raw.taskView === "list"
        ? raw.taskView
        : "list",
    dueSort: raw.dueSort === "asc" || raw.dueSort === "desc" ? raw.dueSort : undefined,
  }),
  component: ProjectDetailPage,
});

const tasksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tasks",
  validateSearch: (raw: Record<string, unknown>) => ({
    task:
      typeof raw.task === "string" && raw.task.length > 0
        ? raw.task
        : undefined,
    taskView:
      raw.taskView === "board" || raw.taskView === "list"
        ? raw.taskView
        : undefined,
    dueSort: raw.dueSort === "asc" || raw.dueSort === "desc" ? raw.dueSort : undefined,
  }),
  component: TasksPage,
});

const agendaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/agenda",
  validateSearch: (raw: Record<string, unknown>) => ({
    event:
      typeof raw.event === "string" && raw.event.length > 0
        ? raw.event
        : undefined,
  }),
  component: AgendaPage,
});

const notesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/notes",
  validateSearch: (raw: Record<string, unknown>) => ({
    note:
      typeof raw.note === "string" && raw.note.length > 0
        ? raw.note
        : undefined,
  }),
  component: NotesPage,
});

const contentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/content",
  validateSearch: (raw: Record<string, unknown>) => ({
    content:
      typeof raw.content === "string" && raw.content.length > 0
        ? raw.content
        : undefined,
    view:
      raw.view === "calendar" || raw.view === "board" ? raw.view : undefined,
  }),
  component: ContentPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const messagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/messages",
  validateSearch: (raw: Record<string, unknown>) => ({
    conversation:
      typeof raw.conversation === "string" && raw.conversation.length > 0
        ? raw.conversation
        : undefined,
    team:
      typeof raw.team === "string" && raw.team.length > 0
        ? raw.team
        : undefined,
  }),
  component: DirectMessagesPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  projectsRoute,
  projectDetailRoute,
  tasksRoute,
  agendaRoute,
  notesRoute,
  contentRoute,
  messagesRoute,
  settingsRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function AppRouter() {
  return <RouterProvider router={router} />;
}
