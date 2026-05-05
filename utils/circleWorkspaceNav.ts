import type { Router } from 'expo-router'

export type CircleWorkspaceSection = 'home' | 'pay' | 'manage' | 'timeline' | 'treasury'

export const circleWorkspacePath = (
  circleId: string | number,
  section: CircleWorkspaceSection
) => {
  const id = String(circleId)
  switch (section) {
    case 'pay':
      return `/circles/${id}/pay`
    case 'manage':
      return `/circles/${id}/manage`
    case 'timeline':
      return `/circles/${id}/timeline`
    case 'treasury':
      return `/circles/${id}/treasury`
    case 'home':
    default:
      return `/circles/${id}`
  }
}

export const replaceCircleWorkspaceSection = (
  router: Router,
  circleId: string | number,
  section: CircleWorkspaceSection
) => {
  router.replace(circleWorkspacePath(circleId, section) as any)
}
