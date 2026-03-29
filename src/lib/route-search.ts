/** Default search for routes with `validateSearch` (required on `<Link>`). */
export type RouteSearch =
  | { project: string | undefined; folder: string | undefined }
  | { task: string | undefined; taskView: "list" | "board" | undefined }
  | { event: string | undefined }
  | { note: string | undefined }
  | { content: string | undefined; view?: "calendar" }
  | {
      tab: "overview" | "tasks" | "notes" | "content";
      taskView: "list" | "board";
    };

export function searchParamsForPath(path: string): RouteSearch | undefined {
  switch (path) {
    case "/projects":
      return { project: undefined, folder: undefined };
    case "/projects/$projectId":
      return { tab: "overview", taskView: "list" };
    case "/tasks":
      return { task: undefined, taskView: undefined };
    case "/agenda":
      return { event: undefined };
    case "/notes":
      return { note: undefined };
    case "/content":
      return { content: undefined };
    default:
      return undefined;
  }
}
