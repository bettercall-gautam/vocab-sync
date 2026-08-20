export function getRouterBase(baseUrl: string): string | undefined {
  
  return baseUrl === "/" ? undefined : baseUrl.replace(/\/$/, "");
  
}



