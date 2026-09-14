import type { ReactNode } from 'react'
import './profile-feature-list.css'

/** Shared account menu container; rows use the common Cell component. */
export function ProfileFeatureList({ children }: { children: ReactNode }) {
  return <div className="profile-v2-feature-list" data-ui="ProfileFeatureList">{children}</div>
}
