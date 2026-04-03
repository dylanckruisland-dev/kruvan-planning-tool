import {
  projectDetailDefaultSearch,
  projectsListSearch,
  tasksPageSearch,
} from "@/lib/router-search-defaults";

/** Default search for routes with `validateSearch` (required on `<Link>`). */
export type RouteSearch =
  | typeof projectsListSearch
  | typeof tasksPageSearch
  | { event: string | undefined }
  | { note: string | undefined }
  | { content: string | undefined; view?: "calendar" }
  | typeof projectDetailDefaultSearch;

export function searchParamsForPath(path: string): RouteSearch | undefined {
  switch (path) {
    case "/projects":
      return { ...projectsListSearch };
    case "/projects/$projectId":
      return { ...projectDetailDefaultSearch };
    case "/tasks":
      return { ...tasksPageSearch };
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
